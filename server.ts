import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import { GeminiService } from './server/gemini/service';

const geminiService = new GeminiService();

// Load env from .env and .env.local (local dev config). Cloud Run / AI Studio
// inject secrets directly into the process environment, taking precedence.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });

export const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '2mb' }));

// ─── Security Headers (applied to every response) ─────────────────────────────
// Hardening against clickjacking, MIME-sniffing, and cross-origin information
// leakage. CSP is intentionally omitted — the SPA relies on inline styles and
// the AI Studio Vite runtime — so other protections carry the load instead.
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );
  next();
});

// ─── Lightweight In-Memory Rate Limiter (abuse / quota protection) ────────────
// The Gemini endpoint is expensive and gems are stolen remotely, so throttle
// per-IP. Not a full compromise of the tool-execution threat zone (real
// production behind a CDN/Cloud Run uses upstream rate limiting too), but it
// closes trivial quota-theft loops from the public internet.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const ipHits = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-for']) {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const now = Date.now();
  const hit = ipHits.get(ip);
  if (!hit || now >= hit.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    next();
    return;
  }
  if (hit.count >= RATE_LIMIT_MAX) {
    res.status(429).json({ success: false, error: 'Too many requests. Please wait a moment and try again.' });
    return;
  }
  hit.count += 1;
  next();
}

// Opportunistic cleanup so the map never grows without bound. `.unref()` lets
// the process exit naturally in serverless/test environments.
setInterval(() => {
  const now = Date.now();
  for (const [ip, hit] of ipHits) {
    if (now >= hit.resetAt) ipHits.delete(ip);
  }
}, 5 * 60_000).unref?.();


// ─── Firebase Token Verification (Lightweight, no Admin SDK) ─────────────────
// Fetches Google's public certificate (JWKS x509) once and caches it, then
// verifies Firebase ID tokens with the RS256 algorithm using Node's crypto.
// No fragile ESM/CJS dependencies — works in both dev and the bundled prod server.

const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || '';

// Resolves the Firestore database id with the canonical server-runtime env var
// taking precedence, keeping legacy/local Vite-oriented names backward-compatible.
// "(default)" is only an intentional last-resort fallback.
export function resolveFirestoreDatabaseId(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.FIRESTORE_DATABASE_ID ||
    env.FIREBASE_FIRESTORE_DATABASE_ID ||
    env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
    '(default)'
  );
}

const FIRESTORE_DATABASE_ID = resolveFirestoreDatabaseId();

// Builds the Firestore REST document-path URL used by all server-side
// Firestore calls. Centralizing construction keeps every runtime URL consistent
// with the resolved database id (never a hardcoded "(default)").
export function buildFirestoreDocumentPath(projectId: string, databaseId: string, documentPath: string, query = ''): string {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${documentPath}${query}`;
}
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean);

// ─── Firebase Admin SDK (privileged server writes) ───────────────────────────
// Used for /roles so role assignment is a server-authorized action that bypasses
// client security rules (which deny all client-side role writes). The service
// account key is loaded from FIREBASE_SERVICE_ACCOUNT_PATH / GOOGLE_APPLICATION_CREDENTIALS,
// defaulting to the local ./sa-keys/firebase-admin.json (never committed).
let adminAppPromise: Promise<admin.app.App> | null = null;
function getAdminApp(): Promise<admin.app.App> {
  if (admin.apps.length) return Promise.resolve(admin.app());
  if (!adminAppPromise) {
    adminAppPromise = (async () => {
      let credentials: any;
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
          credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        } catch {}
      }
      if (!credentials) {
        const credPath =
          process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
          process.env.GOOGLE_APPLICATION_CREDENTIALS ||
          path.join(process.cwd(), 'sa-keys', 'firebase-admin.json');
        try {
          const raw = await import('fs').then((fs) => fs.promises.readFile(credPath, 'utf8'));
          credentials = JSON.parse(raw);
        } catch {
          credentials = undefined;
        }
      }
      return admin.initializeApp(
        credentials
          ? { credential: admin.credential.cert(credentials), projectId: credentials.projectId || FIREBASE_PROJECT_ID }
          : { projectId: FIREBASE_PROJECT_ID },
        `journal-${process.pid}`
      );
    })();
  }
  return adminAppPromise;
}
const getAdminFirestore = () => getAdminApp().then((a) => a.firestore());

// Cache of { kid -> PEM public key }
let cachedKeys: Record<string, string> | null = null;
let keysCacheTime = 0;
const KEYS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

async function getFirebasePublicKeys(): Promise<Record<string, string>> {
  if (cachedKeys && Date.now() - keysCacheTime < KEYS_CACHE_TTL_MS) {
    return cachedKeys;
  }
  const resp = await fetch(
    'https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!resp.ok) {
    throw new Error('Failed to fetch Firebase public keys');
  }
  // Load PEM-format keys; normalize line endings for Node's crypto
  const raw: Record<string, string> = await resp.json();
  cachedKeys = Object.fromEntries(
    Object.entries(raw).map(([kid, pem]) => [kid, pem.replace(/\\n/g, '\n')])
  );
  keysCacheTime = Date.now();
  return cachedKeys;
}

interface AuthenticatedRequest extends Request {
  auth?: {
    uid: string;
    email?: string;
    emailVerified?: boolean;
  };
}

export async function verifyFirebaseTokenAsync(req: AuthenticatedRequest, res: Response): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return false;
  }
  const token = authHeader.slice(7);

  if (process.env.NODE_ENV !== 'production' && token === 'demo-token') {
    req.auth = {
      uid: 'demo-local-user',
      email: 'guest@demo.local',
      emailVerified: true,
    };
    return true;
  }

  // Decode header to find the key id (kid)
  let header: any;
  try {
    header = jwt.decode(token, { complete: true })?.header;
  } catch {
    res.status(401).json({ error: 'Malformed token' });
    return false;
  }
  if (!header || !header.kid) {
    res.status(401).json({ error: 'Token missing key id' });
    return false;
  }

  try {
    const keys = await getFirebasePublicKeys();
    const publicKey = keys[header.kid];
    if (!publicKey) {
      res.status(401).json({ error: 'Unknown signing key' });
      return false;
    }

    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    }) as any;

    req.auth = {
      uid: decoded.sub as string,
      email: decoded.email as string | undefined,
      emailVerified: decoded.email_verified as boolean | undefined,
    };
    return true;
  } catch (err: any) {
    res.status(401).json({
      error: err?.name === 'TokenExpiredError'
        ? 'Token expired'
        : `Invalid or expired token: ${err?.message || ''}`,
    });
    return false;
  }
}

function verifyFirebaseToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  void (async () => {
    if (await verifyFirebaseTokenAsync(req, res)) {
      next();
    }
  })();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (ADMIN_EMAILS.includes(req.auth.email || '') && req.auth.emailVerified === true) {
    next();
    return;
  }
  res.status(403).json({ error: 'Admin access required with a verified email address' });
}

// ─── Notification Service (Slack & Discord Webhooks) ─────────────────────────

class NotificationService {
  /**
   * Restricts outbound webhook dispatch to known provider hosts plus loopback.
   * Loopback is strictly limited to non-production environments to prevent SSRF.
   */
  static isAllowedWebhookUrl(url: string): boolean {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
      const host = u.hostname.toLowerCase();
      const isDev = process.env.NODE_ENV !== 'production';
      const loopback = isDev && (host === '127.0.0.1' || host === 'localhost' || host === '0.0.0.0' || host === '::1');
      const slack = host === 'hooks.slack.com' || host.endsWith('.slack.com');
      const discord = host === 'discord.com' || host === 'discordapp.com' || host.endsWith('.discord.com') || host.endsWith('.discordapp.com');
      return loopback || slack || discord;
    } catch {
      return false;
    }
  }

  static async sendSlack(webhookUrl: string, title: string, summary: string, mode: string): Promise<boolean> {
    if (!this.isAllowedWebhookUrl(webhookUrl)) return false;
    try {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: `Journal Reflection: ${title}`, emoji: true },
            },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: `*Mode:* ${mode}\n*Summary:* ${summary}` },
            },
          ],
          text: `New journal entry: ${title} — ${summary}`,
        }),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  static async sendDiscord(webhookUrl: string, title: string, summary: string, mode: string): Promise<boolean> {
    if (!this.isAllowedWebhookUrl(webhookUrl)) return false;
    try {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [
            {
              title: `Journal Reflection: ${title}`,
              description: summary,
              color: 0xf59e0b,
              fields: [
                { name: 'Mode', value: mode, inline: true },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  static async dispatch(
    settings: { slackWebhookUrl?: string; discordWebhookUrl?: string; enabled: boolean; notifyOn: string[] },
    title: string,
    summary: string,
    mode: string
  ): Promise<void> {
    if (!settings.enabled || !settings.notifyOn.includes(mode)) return;
    const results = await Promise.allSettled([
      settings.slackWebhookUrl ? this.sendSlack(settings.slackWebhookUrl, title, summary, mode) : Promise.resolve(false),
      settings.discordWebhookUrl ? this.sendDiscord(settings.discordWebhookUrl, title, summary, mode) : Promise.resolve(false),
    ]);
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) {
        console.log(`[Notifications] ${i === 0 ? 'Slack' : 'Discord'} notification sent`);
      }
    });
  }
}

// ─── Health Checks (Cloud Monitoring & Load Balancers) ───────────────────────

export const getHealthPayload = () => {
  const memory = process.memoryUsage();
  const resolvedFirestoreDatabaseId = resolveFirestoreDatabaseId();
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    memory: {
      rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
      heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
    },
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_SECRET),
    mapsKeyConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    firestoreDatabaseConfigured: Boolean(resolvedFirestoreDatabaseId && resolvedFirestoreDatabaseId !== '(default)'),
    firestoreNamedDatabaseConfigured: resolvedFirestoreDatabaseId !== '(default)',
    services: {
      geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_SECRET),
      mapsKeyConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
      firebaseProjectIdConfigured: Boolean(process.env.VITE_FIREBASE_PROJECT_ID),
      firestoreDatabaseConfigured: Boolean(resolvedFirestoreDatabaseId && resolvedFirestoreDatabaseId !== '(default)'),
      firestoreNamedDatabaseConfigured: resolvedFirestoreDatabaseId !== '(default)',
      adminEmailsConfigured: Boolean(process.env.ADMIN_EMAILS),
    },
  };
};

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json(getHealthPayload());
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json(getHealthPayload());
});

// ─── Authenticated Diagnostic Endpoint ───────────────────────────────────────
// Zero-data auth probe used by deploy smoke tests. Protected by the standard
// Firebase token middleware; returns only an authenticated flag. No Firestore
// or Gemini calls, no token/claim echo, no secrets.
export const authVerifyHandler = (_req: Request, res: Response): void => {
  res.json({ authenticated: true });
};
app.get('/api/auth/verify', verifyFirebaseToken, authVerifyHandler);

// ─── Gemini Reflection Endpoint ──────────────────────────────────────────────

// ─── Gemini AI Service Endpoints ─────────────────────────────────────────────

app.post('/api/gemini/companion-skill', verifyFirebaseToken, rateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await geminiService.executeCompanionSkill((req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}));
    res.json({ success: true, ...result, result });
  } catch (error: any) {
    console.error('Companion skill error:', error);
    const status = error.status || 500;
    const msg = process.env.NODE_ENV === 'production' ? 'Failed to execute companion skill' : error?.message;
    res.status(status).json({ success: false, error: msg || 'Failed to execute companion skill' });
  }
});

app.post('/api/gemini/reflect', verifyFirebaseToken, rateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await geminiService.reflect((req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}));
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Reflect error:', error);
    const status = error.status || 500;
    const msg = process.env.NODE_ENV === 'production' ? 'Failed to generate reflection' : error?.message;
    res.status(status).json({ success: false, error: msg || 'Failed to generate reflection' });
  }
});

app.post('/api/gemini/summarize', verifyFirebaseToken, rateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await geminiService.summarize((req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}));
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Summarize error:', error);
    const status = error.status || 500;
    const msg = process.env.NODE_ENV === 'production' ? 'Failed to generate summary' : error?.message;
    res.status(status).json({ success: false, error: msg || 'Failed to generate summary' });
  }
});

app.post('/api/gemini/extract-themes', verifyFirebaseToken, rateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await geminiService.extractThemes((req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}));
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Extract themes error:', error);
    const status = error.status || 500;
    const msg = process.env.NODE_ENV === 'production' ? 'Failed to extract themes' : error?.message;
    res.status(status).json({ success: false, error: msg || 'Failed to extract themes' });
  }
});

app.post('/api/gemini/extract-memories', verifyFirebaseToken, rateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await geminiService.extractMemoryCandidates((req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}));
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Extract memories error:', error);
    const status = error.status || 500;
    const msg = process.env.NODE_ENV === 'production' ? 'Failed to extract memory candidates' : error?.message;
    res.status(status).json({ success: false, error: msg || 'Failed to extract memory candidates' });
  }
});

app.post('/api/gemini/contextual-questions', verifyFirebaseToken, rateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await geminiService.generateContextualQuestions((req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}));
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Contextual questions error:', error);
    const status = error.status || 500;
    const msg = process.env.NODE_ENV === 'production' ? 'Failed to generate contextual questions' : error?.message;
    res.status(status).json({ success: false, error: msg || 'Failed to generate contextual questions' });
  }
});

app.post('/api/gemini/coach', verifyFirebaseToken, rateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await geminiService.provideCoaching((req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}));
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Coach error:', error);
    const status = error.status || 500;
    const msg = process.env.NODE_ENV === 'production' ? 'Failed to provide coaching' : error?.message;
    res.status(status).json({ success: false, error: msg || 'Failed to provide coaching' });
  }
});

app.post('/api/gemini/reframe', verifyFirebaseToken, rateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await geminiService.reframePerspective((req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}));
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Reframe error:', error);
    const status = error.status || 500;
    const msg = process.env.NODE_ENV === 'production' ? 'Failed to reframe perspective' : error?.message;
    res.status(status).json({ success: false, error: msg || 'Failed to reframe perspective' });
  }
});

app.post('/api/gemini/ask-my-life', verifyFirebaseToken, rateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await geminiService.askMyLife((req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}));
    res.json({ success: true, ...result, result });
  } catch (error: any) {
    console.error('Ask My Life error:', error);
    const status = error.status || 500;
    const msg = process.env.NODE_ENV === 'production' ? 'Failed to process Ask My Life query' : error?.message;
    res.status(status).json({ success: false, error: msg || 'Failed to process Ask My Life query' });
  }
});

// ─── Google Places Autocomplete Proxy ────────────────────────────────────────

export const placesAutocompleteHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not configured on server' });
      return;
    }
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const { input, sessiontoken } = body;
    if (!input || typeof input !== 'string' || input.trim().length < 2) {
      res.status(400).json({ error: 'Input must be at least 2 characters' });
      return;
    }

    const params = new URLSearchParams({
      input: input.trim(),
      key: apiKey,
      types: 'geocode|establishment',
      ...(sessiontoken ? { sessiontoken } : {}),
    });

    const resp = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
    const data = await resp.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('[Places API]', data.status, data.error_message);
    }

    const suggestions = (data.predictions || []).map((p: any) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text || '',
      secondaryText: p.structured_formatting?.secondary_text || '',
    }));

    res.json({ suggestions, status: data.status });
  } catch (error: any) {
    console.error('Places autocomplete error:', error);
    res.status(500).json({ error: 'Failed to fetch places' });
  }
};
app.post('/api/google/places/autocomplete', verifyFirebaseToken, rateLimiter, placesAutocompleteHandler);

// ─── Google Places Details Proxy ─────────────────────────────────────────────

export const placesDetailsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not configured' });
      return;
    }
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const { placeId } = body;
    if (!placeId) {
      res.status(400).json({ error: 'placeId is required' });
      return;
    }

    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'geometry/location,formatted_address,name',
      key: apiKey,
    });

    const resp = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
    const data = await resp.json();

    if (data.status !== 'OK') {
      res.status(404).json({ error: 'Place details not found' });
      return;
    }

    const result = data.result;
    res.json({
      lat: result.geometry?.location?.lat,
      lng: result.geometry?.location?.lng,
      placeName: result.name || '',
      address: result.formatted_address || '',
    });
  } catch (error: any) {
    console.error('Place details error:', error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Place details request failed' : error?.message });
  }
};
app.post('/api/google/places/details', verifyFirebaseToken, rateLimiter, placesDetailsHandler);

// ─── Admin Endpoints ─────────────────────────────────────────────────────────

app.get('/api/admin/users', verifyFirebaseToken, requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const adminEmail = req.auth?.email;
    const isAdminViaEnv = ADMIN_EMAILS.includes(adminEmail || '');
    const adminUid = req.auth?.uid;

    const users: any[] = [];

    // List all users from Firestore using REST API
    const projectId = FIREBASE_PROJECT_ID;
    const authToken = req.headers.authorization?.slice(7);

    if (!authToken) {
      res.status(401).json({ error: 'Valid auth token required' });
      return;
    }

    // Query Firestore for all user documents
    const firestoreUrl = buildFirestoreDocumentPath(projectId, FIRESTORE_DATABASE_ID, 'users');
    const fsResp = await fetch(firestoreUrl, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!fsResp.ok) {
      // If we can't list all users (expected with user-level tokens), return limited info
      res.json({
        users: [{
          uid: adminUid,
          email: adminEmail,
          role: 'admin',
          interactionCount: 0,
          lastActive: null,
        }],
        note: 'Full user listing requires Firebase Admin SDK. Role seeding via ADMIN_EMAILS is active.',
      });
      return;
    }

    const fsData = await fsResp.json();
    for (const doc of fsData.documents || []) {
      const nameParts = doc.name.split('/');
      const uid = nameParts[nameParts.length - 1];
      const fields = doc.fields || {};
      users.push({
        uid,
        displayName: fields.displayName?.stringValue || null,
        email: fields.email?.stringValue || null,
        role: ADMIN_EMAILS.includes(fields.email?.stringValue || '') ? 'admin' : 'user',
        interactionCount: 0,
        lastActive: null,
      });
    }

    res.json({ users });
  } catch (error: any) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Failed to fetch users' : error?.message });
  }
});

app.post('/api/admin/seed-role', verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const uid = req.auth?.uid;
    const email = req.auth?.email;

    if (!uid || !email) {
      res.status(400).json({ error: 'Valid auth context required' });
      return;
    }

    if (ADMIN_EMAILS.includes(email)) {
      res.json({ isAdmin: true, email, uid });
    } else {
      res.json({ isAdmin: false, email, uid });
    }
  } catch (error: any) {
    console.error('Role seed error:', error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Failed to check role' : error?.message });
  }
});

app.post('/api/admin/roles', verifyFirebaseToken, requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const { targetUid, role } = body;
    if (!targetUid || !['admin', 'user'].includes(role)) {
      res.status(400).json({ error: 'targetUid and valid role (admin/user) required' });
      return;
    }

    console.log(`[SECURITY AUDIT] Admin Role Change | Admin UID: ${req.auth?.uid} | Target UID: ${targetUid} | New Role: ${role} | Time: ${new Date().toISOString()}`);

    // Write role document via Firebase Admin SDK (server-authorized, bypasses
    // client security rules which deny all client-side /roles writes). The route
    // is already gated by requireAdmin above, so only allow-listed admins reach this.
    const fs = await getAdminFirestore();
    await fs.collection('roles').doc(targetUid).set({
      role,
      assignedBy: req.auth?.uid || '',
      assignedAt: new Date(),
    }, { merge: true });

    res.json({ success: true, targetUid, role });
  } catch (error: any) {
    console.error('Role assignment error:', error);
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Failed to assign role' : error?.message });
  }
});

// ─── Notification Endpoints ──────────────────────────────────────────────────

app.get('/api/notifications/settings', verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const uid = req.auth?.uid;
    if (!uid) { res.status(401).json({ error: 'Auth required' }); return; }

    const projectId = FIREBASE_PROJECT_ID;
    const authToken = req.headers.authorization?.slice(7);
    const docPath = buildFirestoreDocumentPath(projectId, FIRESTORE_DATABASE_ID, `${uid}/settings/notifications`);

    const fsResp = await fetch(
      `${docPath}`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

    if (!fsResp.ok) {
      res.json({ enabled: false, notifyOn: ['reflect', 'summarize', 'brainstorm', 'chat'] });
      return;
    }

    const data = await fsResp.json();
    const fields = data.fields || {};
    res.json({
      slackWebhookUrl: fields.slackWebhookUrl?.stringValue || '',
      discordWebhookUrl: fields.discordWebhookUrl?.stringValue || '',
      enabled: fields.enabled?.booleanValue || false,
      notifyOn: (fields.notifyOn?.arrayValue?.values || []).map((v: any) => v.stringValue),
    });
  } catch (error: any) {
    console.error('Get notification settings error:', error);
    res.status(500).json({ error: error?.message || 'Failed to get settings' });
  }
});

app.put('/api/notifications/settings', verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const uid = req.auth?.uid;
    if (!uid) { res.status(401).json({ error: 'Auth required' }); return; }

    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const { slackWebhookUrl, discordWebhookUrl, enabled, notifyOn } = body;
    const projectId = FIREBASE_PROJECT_ID;
    const authToken = req.headers.authorization?.slice(7);

    // Ensure parent document exists
    const parentPath = buildFirestoreDocumentPath(projectId, FIRESTORE_DATABASE_ID, uid);
    await fetch(
      `${parentPath}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { createdAt: { timestampValue: new Date().toISOString() } } }),
      }
    );

    const settingsPath = buildFirestoreDocumentPath(projectId, FIRESTORE_DATABASE_ID, `${uid}/settings/notifications`, '?currentDocument.exists=true');
    const fsResp = await fetch(
      `${settingsPath}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            slackWebhookUrl: { stringValue: slackWebhookUrl || '' },
            discordWebhookUrl: { stringValue: discordWebhookUrl || '' },
            enabled: { booleanValue: Boolean(enabled) },
            notifyOn: {
              arrayValue: {
                values: (Array.isArray(notifyOn) ? notifyOn : ['reflect', 'summarize', 'brainstorm', 'chat']).map((v: string) => ({ stringValue: v })),
              },
            },
          },
        }),
      }
    );

    if (!fsResp.ok) {
      // Create new doc
      await fetch(
        buildFirestoreDocumentPath(projectId, FIRESTORE_DATABASE_ID, `${uid}/settings`, '?documentId=notifications'),
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              slackWebhookUrl: { stringValue: slackWebhookUrl || '' },
              discordWebhookUrl: { stringValue: discordWebhookUrl || '' },
              enabled: { booleanValue: Boolean(enabled) },
              notifyOn: {
                arrayValue: {
                  values: (Array.isArray(notifyOn) ? notifyOn : ['reflect', 'summarize', 'brainstorm', 'chat']).map((v: string) => ({ stringValue: v })),
                },
              },
            },
          }),
        }
      );
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Save notification settings error:', error);
    res.status(500).json({ error: error?.message || 'Failed to save settings' });
  }
});

app.post('/api/notifications/test', verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const { channel, webhookUrl } = body;
    if (!channel || !webhookUrl) {
      res.status(400).json({ error: 'channel (slack/discord) and webhookUrl required' });
      return;
    }

    let sent = false;
    if (channel === 'slack') {
      sent = await NotificationService.sendSlack(webhookUrl, 'Test Notification', 'Your journal notification setup is working correctly!', 'reflect');
    } else if (channel === 'discord') {
      sent = await NotificationService.sendDiscord(webhookUrl, 'Test Notification', 'Your journal notification setup is working correctly!', 'reflect');
    }

    res.json({ success: sent, channel });
  } catch (error: any) {
    console.error('Test notification error:', error);
    res.status(500).json({ error: error?.message || 'Failed to send test notification' });
  }
});

// ─── Cloud Logging & Graceful Shutdown ───────────────────────────────────────

function logCloudFormat(severity: 'INFO' | 'WARNING' | 'ERROR', message: string, meta?: Record<string, any>) {
  const timestamp = new Date().toISOString();
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify({ severity, message, timestamp, ...meta }));
  } else {
    const extra = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    if (severity === 'ERROR') {
      console.error(`[${timestamp}] [${severity}] ${message}${extra}`);
    } else {
      console.log(`[${timestamp}] [${severity}] ${message}${extra}`);
    }
  }
}

async function startServer() {
  const isProduction = Boolean(process.env.NODE_ENV && process.env.NODE_ENV.includes('production'));
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      preview: { allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    logCloudFormat('INFO', `Server running on http://0.0.0.0:${PORT}`, {
      port: PORT,
      nodeEnv: process.env.NODE_ENV || 'development',
    });
  });

  const handleShutdown = (signal: string) => {
    logCloudFormat('INFO', `Received ${signal}. Initiating graceful shutdown...`);
    server.close((err) => {
      if (err) {
        logCloudFormat('ERROR', `Error closing server: ${err.message}`);
        process.exit(1);
      }
      logCloudFormat('INFO', 'Server closed cleanly. Process exiting.');
      process.exit(0);
    });

    setTimeout(() => {
      logCloudFormat('ERROR', 'Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

// Start the server unless running under vitest (unit tests import server.ts for
// route handlers / auth coverage; we must not bind ports or boot Vite there).
if (!process.env.VITEST) {
  startServer().catch((err) => {
    logCloudFormat('ERROR', `Fatal server startup error: ${err?.message || err}`, { error: err });
    process.exit(1);
  });
}
