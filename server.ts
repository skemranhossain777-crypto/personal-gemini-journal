import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';

// Load env from .env and .env.local (local dev config). Cloud Run / AI Studio
// inject secrets directly into the process environment, taking precedence.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '2mb' }));

// Lazy GoogleGenAI client accessor
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not configured');
  if (!aiClient) aiClient = new GoogleGenAI({ apiKey });
  return aiClient;
}

// Model Fallback Ladder
// Order = preference. Prefer the newest stable dated Gemini 3.x Flash first
// (reliable, no alias contention), then lighter/fallback tiers.
// `gemini-flash-latest` is the most contended alias and frequently 503s under
// high demand, so it lives mid-ladder, not first. Model names verified as of
// 2026-09: gemini-3.7-flash (stable), gemini-3.6-flash, gemini-3.5-flash,
// gemini-3.1-flash-lite. There is no gemini-3.8-flash.
const MODEL_FALLBACK_LADDER = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
];

async function generateContentWithFallback(
  contents: any,
  systemInstruction: string,
  temperature = 0.7
): Promise<{ text: string; modelUsed: string }> {
  const ai = getGenAI();
  let lastError: any = null;
  const REQUEST_TIMEOUT_MS = 30000; // frontier models do heavy reasoning; 18s was too tight
  const MAX_ATTEMPTS = 2; // retry transient 503 "high demand" responses before falling back

  for (const model of MODEL_FALLBACK_LADDER) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        console.log(`[Gemini Engine] Attempting generation with model: ${model} (attempt ${attempt}/${MAX_ATTEMPTS})`);
        const generatePromise = ai.models.generateContent({
          model,
          contents,
          config: { systemInstruction, temperature },
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model ${model} request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)), REQUEST_TIMEOUT_MS)
        );
        const response = await Promise.race([generatePromise, timeoutPromise]);
        const text = response.text || '';
        if (text.trim()) {
          console.log(`[Gemini Engine] Generation successful with model: ${model}`);
          return { text, modelUsed: model };
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const errStatus = err?.status || err?.error?.status || '';
        const errCode = err?.statusCode || err?.error?.code || '';
        const isTransient503 = errStatus === 503 || errCode === 503 || errMsg.includes('high demand');
        console.warn(`[Gemini Engine] Model ${model} error (status: ${errStatus}, code: ${errCode}): ${errMsg.slice(0, 150)}`);
        if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('apiKey is invalid') || errMsg.includes('API key not valid')) throw err;
        // Retry this same model once on transient capacity spikes; otherwise move on
        if (isTransient503 && attempt < MAX_ATTEMPTS) {
          console.log(`[Gemini Engine] Transient 503 on ${model}, retrying (attempt ${attempt + 1})...`);
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        console.log(`[Gemini Engine] Falling back to next model...`);
        break;
      }
    }
  }
  throw new Error(`All Gemini models exhausted. Last error: ${lastError?.message || lastError}`);
}

// ─── Firebase Token Verification (Lightweight, no Admin SDK) ─────────────────
// Fetches Google's public certificate (JWKS x509) once and caches it, then
// verifies Firebase ID tokens with the RS256 algorithm using Node's crypto.
// No fragile ESM/CJS dependencies — works in both dev and the bundled prod server.

const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || '';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean);

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

async function verifyFirebaseTokenAsync(req: AuthenticatedRequest, res: Response): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return false;
  }
  const token = authHeader.slice(7);

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
  if (ADMIN_EMAILS.includes(req.auth.email || '')) {
    next();
    return;
  }
  res.status(403).json({ error: 'Admin access required' });
}

// ─── Notification Service (Slack & Discord Webhooks) ─────────────────────────

class NotificationService {
  static async sendSlack(webhookUrl: string, title: string, summary: string, mode: string): Promise<boolean> {
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

// ─── Health Check ────────────────────────────────────────────────────────────

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    mapsKeyConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
  });
});

// ─── Gemini Reflection Endpoint ──────────────────────────────────────────────

app.post('/api/gemini/reflect', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const {
      prompt = '',
      mode = 'reflect',
      history = [],
      title = 'Journal Reflection',
      location = null,
    } = body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ success: false, error: 'A non-empty prompt is required.' });
      return;
    }

    const safeMode = ['reflect', 'summarize', 'brainstorm', 'chat'].includes(mode) ? mode : 'reflect';

    let modeInstruction = '';
    switch (safeMode) {
      case 'summarize':
        modeInstruction = 'You are an insightful summarizer. Provide a crisp, empathetic executive summary of the user\'s journal entry, highlighting key emotions, core themes, and actionable lessons.';
        break;
      case 'brainstorm':
        modeInstruction = 'You are a creative brainstorming thought partner. Offer fresh perspectives, alternative approaches, innovative ideas, and actionable next steps based on the user\'s reflection.';
        break;
      case 'chat':
        modeInstruction = 'You are a warm, conversational journaling companion. Engage in supportive, thoughtful multi-turn dialogue, asking probing questions that facilitate self-discovery.';
        break;
      case 'reflect':
      default:
        modeInstruction = 'You are a compassionate, thoughtful reflection coach. Help the user unpack their experiences, validate their feelings, identify cognitive patterns, and offer grounded, constructive wisdom.';
        break;
    }

    const locationContext = location && location.placeName
      ? `\n\nLOCATION CONTEXT: The user pinned this entry to "${location.placeName}"${location.address ? ` (${location.address})` : ''} at coordinates (${location.lat}, ${location.lng}). If relevant, incorporate geographic, cultural, or environmental context from this location into your reflection.`
      : '';

    const systemInstruction = `
${modeInstruction}${locationContext}

IMPORTANT OPERATIONAL RULES:
- Ground your response deeply in the user's thoughts and emotions.
- Structure your response cleanly using markdown (paragraphs, bullet points, headers if helpful).
- At the very end of your response, output a structured metadata block formatted EXACTLY like this:
---METADATA---
SUMMARY: <A concise 1-sentence synopsis of this reflection>
TAGS: <3 to 5 comma-separated tags, e.g., Mindfulness, Career, Growth, Resilience>
---END_METADATA---
Do not include any text after ---END_METADATA---.
`.trim();

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const item of history) {
        if (item && typeof item === 'object' && item.content && (item.role === 'user' || item.role === 'model')) {
          contents.push({ role: item.role, parts: [{ text: String(item.content) }] });
        }
      }
    }

    const locationTag = location?.placeName ? ` [Location: ${location.placeName}]` : '';
    contents.push({
      role: 'user',
      parts: [{ text: `Entry Title: ${String(title || 'Untitled')}${locationTag}\n\nUser Input:\n${prompt}` }],
    });

    const { text, modelUsed } = await generateContentWithFallback(contents, systemInstruction, 0.7);

    let reply = text;
    let summary = 'A thoughtful reflection on personal experiences and insights.';
    let tags: string[] = ['Reflection', 'Personal Growth'];

    const metadataMatch = text.match(/---METADATA---([\s\S]*?)---END_METADATA---/);
    if (metadataMatch) {
      reply = text.replace(/---METADATA---[\s\S]*?---END_METADATA---/, '').trim();
      const metaContent = metadataMatch[1];
      const summaryMatch = metaContent.match(/SUMMARY:\s*(.+)/i);
      if (summaryMatch?.[1]) summary = summaryMatch[1].trim();
      const tagsMatch = metaContent.match(/TAGS:\s*(.+)/i);
      if (tagsMatch?.[1]) {
        tags = tagsMatch[1].split(',').map((t) => t.trim()).filter((t) => t.length > 0);
      }
    }

    res.json({ success: true, reply, summary, tags, modelUsed });
  } catch (error: any) {
    console.error('Gemini Reflection API error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to generate reflection' });
  }
});

// ─── Google Places Autocomplete Proxy ────────────────────────────────────────

app.post('/api/google/places/autocomplete', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not configured on server' });
      return;
    }
    const { input, sessiontoken } = req.body;
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
    res.status(500).json({ error: error?.message || 'Places API request failed' });
  }
});

app.post('/api/google/places/details', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not configured' });
      return;
    }
    const { placeId } = req.body;
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
    res.status(500).json({ error: error?.message || 'Place details request failed' });
  }
});

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
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users`;
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
    res.status(500).json({ error: error?.message || 'Failed to fetch users' });
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
    res.status(500).json({ error: error?.message || 'Failed to check role' });
  }
});

app.post('/api/admin/roles', verifyFirebaseToken, requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { targetUid, role } = req.body;
    if (!targetUid || !['admin', 'user'].includes(role)) {
      res.status(400).json({ error: 'targetUid and valid role (admin/user) required' });
      return;
    }

    // Write role document to Firestore via REST
    const projectId = FIREBASE_PROJECT_ID;
    const authToken = req.headers.authorization?.slice(7);
    const docPath = `projects/${projectId}/databases/(default)/documents/roles/${targetUid}`;

    const fsResp = await fetch(
      `https://firestore.googleapis.com/v1/${docPath}?currentDocument.exists=true`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            role: { stringValue: role },
            assignedBy: { stringValue: req.auth?.uid || '' },
            assignedAt: { timestampValue: new Date().toISOString() },
          },
        }),
      }
    );

    // If doc doesn't exist, create it
    if (!fsResp.ok) {
      const createResp = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/roles?documentId=${targetUid}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: {
              role: { stringValue: role },
              assignedBy: { stringValue: req.auth?.uid || '' },
              assignedAt: { timestampValue: new Date().toISOString() },
            },
          }),
        }
      );
      if (!createResp.ok) {
        res.status(500).json({ error: 'Failed to create role document' });
        return;
      }
    }

    res.json({ success: true, targetUid, role });
  } catch (error: any) {
    console.error('Role assignment error:', error);
    res.status(500).json({ error: error?.message || 'Failed to assign role' });
  }
});

// ─── Notification Endpoints ──────────────────────────────────────────────────

app.get('/api/notifications/settings', verifyFirebaseToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const uid = req.auth?.uid;
    if (!uid) { res.status(401).json({ error: 'Auth required' }); return; }

    const projectId = FIREBASE_PROJECT_ID;
    const authToken = req.headers.authorization?.slice(7);
    const docPath = `projects/${projectId}/databases/(default)/documents/${uid}/settings/notifications`;

    const fsResp = await fetch(
      `https://firestore.googleapis.com/v1/${docPath}`,
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

    const { slackWebhookUrl, discordWebhookUrl, enabled, notifyOn } = req.body;
    const projectId = FIREBASE_PROJECT_ID;
    const authToken = req.headers.authorization?.slice(7);

    // Ensure parent document exists
    const parentPath = `projects/${projectId}/databases/(default)/documents/${uid}`;
    await fetch(
      `https://firestore.googleapis.com/v1/${parentPath}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { createdAt: { timestampValue: new Date().toISOString() } } }),
      }
    );

    const settingsPath = `projects/${projectId}/databases/(default)/documents/${uid}/settings/notifications`;
    const fsResp = await fetch(
      `https://firestore.googleapis.com/v1/${settingsPath}?currentDocument.exists=true`,
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
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${uid}/settings?documentId=notifications`,
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
    const { channel, webhookUrl } = req.body;
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

// ─── Vite Middleware & Static Serving ────────────────────────────────────────

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
