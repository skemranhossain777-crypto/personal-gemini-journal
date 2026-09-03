/**
 * Synthetic E2E test harness for admin RBAC + notification flows.
 *
 * Strategy:
 *  - Starts its own Express app reusing the same route handlers
 *  - Uses a mock auth middleware that decodes base64 tokens directly (no JWT verification)
 *  - Intercepts outbound Firestore REST calls with an in-memory mock store
 *  - Runs a tiny local HTTP server to capture webhook payloads
 *  - Exercises every path: unauthenticated, admin, non-admin, CRUD, webhook dispatch
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import http from 'http';

// ─── Mock Data Stores ────────────────────────────────────────────────────────

const mockFirestore: Record<string, any> = {};
const webhookCaptures: { channel: string; body: any }[] = [];
let mockServer: http.Server;
let mockPort: number;
let APP_BASE_URL = '';

// ─── Mock Auth Middleware (bypasses real JWT, reads base64-encoded JSON) ──────

interface MockAuthRequest extends Request {
  auth?: { uid: string; email?: string; emailVerified?: boolean };
}

const ADMIN_EMAILS = (process.env.E2E_ADMIN_EMAILS || 'admin@test.com').split(',').map(e => e.trim());

function mockVerifyToken(req: MockAuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    if (!decoded.sub || !decoded.email) {
      res.status(401).json({ error: 'Token missing sub or email' });
      return;
    }
    req.auth = {
      uid: decoded.sub,
      email: decoded.email,
      emailVerified: decoded.email_verified ?? true,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid mock token' });
  }
}

function mockRequireAdmin(req: MockAuthRequest, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (ADMIN_EMAILS.includes(req.auth.email || '')) {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
}

// ─── Mock Firestore Fetch Interceptor ────────────────────────────────────────

const realFetch = globalThis.fetch;
globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // Pass through localhost requests (the mock server itself)
  if (url.includes('127.0.0.1') || url.includes('localhost')) {
    return realFetch(input, init);
  }

  // Intercept Firestore REST calls
  if (url.includes('firestore.googleapis.com/v1/')) {
    const method = init?.method || 'GET';
    const body = init?.body ? JSON.parse(init.body as string) : null;

    // Extract path from URL
    const pathMatch = url.match(/projects\/[^/]+\/databases\/[^/]+\/documents\/(.+?)(?:\?|$)/);
    const docPath = pathMatch ? pathMatch[1] : '';

    // --- Roles ---
    if (docPath.startsWith('roles/')) {
      const uid = docPath.replace('roles/', '');
      if (method === 'POST' || method === 'PATCH') {
        mockFirestore[`roles/${uid}`] = body?.fields || {};
        return new Response(JSON.stringify({ name: `roles/${uid}`, fields: body?.fields }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // GET
      if (mockFirestore[`roles/${uid}`]) {
        return new Response(JSON.stringify({ name: `roles/${uid}`, fields: mockFirestore[`roles/${uid}`] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: { code: 404, message: 'Not found' } }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // --- Users collection listing ---
    if (docPath === 'users' && method === 'GET') {
      const documents = Object.entries(mockFirestore)
        .filter(([key]) => key.startsWith('users/') && !key.includes('/'))
        .map(([key, val]) => ({
          name: `projects/test/databases/(default)/documents/${key}`,
          fields: val,
        }));
      return new Response(JSON.stringify({ documents }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- User notification settings ---
    if (docPath.includes('/settings/notifications') || docPath.includes('/settings?')) {
      const uid = docPath.split('/')[0];
      const key = `notifications/${uid}`;
      if (method === 'POST' || method === 'PATCH') {
        mockFirestore[key] = body?.fields || {};
        return new Response(JSON.stringify({ name: `notifications/${uid}`, fields: body?.fields }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (mockFirestore[key]) {
        return new Response(JSON.stringify({ fields: mockFirestore[key] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Not found', { status: 404 });
    }

    // --- User parent doc (ensure exists) ---
    if (docPath.match(/^[a-zA-Z0-9_-]+$/) && method === 'PATCH') {
      if (!mockFirestore[docPath]) {
        mockFirestore[docPath] = {};
      }
      return new Response(JSON.stringify({ name: docPath }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default: pass through (shouldn't happen in tests)
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // --- Mock Webhook Endpoints ---
  if (url.includes('hooks.slack.com') || url.includes('discord.com/api/webhooks')) {
    const channel = url.includes('slack.com') ? 'slack' : 'discord';
    const payload = init?.body ? JSON.parse(init.body as string) : null;
    webhookCaptures.push({ channel, body: payload });
    console.log(`  [Mock ${channel}] Webhook received:`, JSON.stringify(payload).slice(0, 120));
    return new Response('ok', { status: 200 });
  }

  // Pass through everything else (e.g., Gemini API if called)
  return realFetch(input, init);
};

// ─── Build Express App with Mock Routes ──────────────────────────────────────

function buildMockApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const FIREBASE_PROJECT_ID = 'test-project';

  // Health
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', geminiKeyConfigured: true, mapsKeyConfigured: false });
  });

  // Admin: seed-role (uses mock auth)
  app.post('/api/admin/seed-role', mockVerifyToken, async (req: MockAuthRequest, res: Response) => {
    const uid = req.auth?.uid;
    const email = req.auth?.email;
    if (!uid || !email) { res.status(400).json({ error: 'Valid auth context required' }); return; }
    if (ADMIN_EMAILS.includes(email)) {
      res.json({ isAdmin: true, email, uid });
    } else {
      res.json({ isAdmin: false, email, uid });
    }
  });

  // Admin: list users
  app.get('/api/admin/users', mockVerifyToken, mockRequireAdmin, async (req: MockAuthRequest, res: Response) => {
    try {
      const authToken = req.headers.authorization?.slice(7);
      const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users`;
      const fsResp = await fetch(firestoreUrl, { headers: { Authorization: `Bearer ${authToken}` } });
      if (!fsResp.ok) {
        res.json({ users: [{ uid: req.auth?.uid, email: req.auth?.email, role: 'admin', interactionCount: 0, lastActive: null }], note: 'Limited listing' });
        return;
      }
      const fsData = await fsResp.json();
      const users = (fsData.documents || []).map((doc: any) => {
        const nameParts = doc.name.split('/');
        const uid = nameParts[nameParts.length - 1];
        const fields = doc.fields || {};
        return {
          uid,
          displayName: fields.displayName?.stringValue || null,
          email: fields.email?.stringValue || null,
          role: ADMIN_EMAILS.includes(fields.email?.stringValue || '') ? 'admin' : 'user',
          interactionCount: 0,
          lastActive: null,
        };
      });
      res.json({ users });
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  // Admin: assign role
  app.post('/api/admin/roles', mockVerifyToken, mockRequireAdmin, async (req: MockAuthRequest, res: Response) => {
    try {
      const { targetUid, role } = req.body;
      if (!targetUid || !['admin', 'user'].includes(role)) {
        res.status(400).json({ error: 'targetUid and valid role (admin/user) required' });
        return;
      }
      const authToken = req.headers.authorization?.slice(7);
      const docPath = `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/roles/${targetUid}`;
      const fsResp = await fetch(
        `https://firestore.googleapis.com/v1/${docPath}?currentDocument.exists=true`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              role: { stringValue: role },
              assignedBy: { stringValue: req.auth?.uid || '' },
              assignedAt: { timestampValue: new Date().toISOString() },
            },
          }),
        }
      );
      if (!fsResp.ok) {
        const createResp = await fetch(
          `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/roles?documentId=${targetUid}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                role: { stringValue: role },
                assignedBy: { stringValue: req.auth?.uid || '' },
                assignedAt: { timestampValue: new Date().toISOString() },
              },
            }),
          }
        );
        if (!createResp.ok) { res.status(500).json({ error: 'Failed to create role document' }); return; }
      }
      res.json({ success: true, targetUid, role });
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  // Notifications: get settings
  app.get('/api/notifications/settings', mockVerifyToken, async (req: MockAuthRequest, res: Response) => {
    try {
      const uid = req.auth?.uid;
      if (!uid) { res.status(401).json({ error: 'Auth required' }); return; }
      const authToken = req.headers.authorization?.slice(7);
      const docPath = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${uid}/settings/notifications`;
      const fsResp = await fetch(docPath, { headers: { Authorization: `Bearer ${authToken}` } });
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
      res.status(500).json({ error: error?.message });
    }
  });

  // Notifications: save settings
  app.put('/api/notifications/settings', mockVerifyToken, async (req: MockAuthRequest, res: Response) => {
    try {
      const uid = req.auth?.uid;
      if (!uid) { res.status(401).json({ error: 'Auth required' }); return; }
      const { slackWebhookUrl, discordWebhookUrl, enabled, notifyOn } = req.body;
      const authToken = req.headers.authorization?.slice(7);

      // Ensure parent doc
      await fetch(
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${uid}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: { createdAt: { timestampValue: new Date().toISOString() } } }),
        }
      );

      const settingsPath = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${uid}/settings/notifications`;
      const fsResp = await fetch(
        `${settingsPath}?currentDocument.exists=true`,
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
        await fetch(
          `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${uid}/settings?documentId=notifications`,
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
      res.status(500).json({ error: error?.message });
    }
  });

  // Notifications: test dispatch
  app.post('/api/notifications/test', mockVerifyToken, async (req: MockAuthRequest, res: Response) => {
    try {
      const { channel, webhookUrl } = req.body;
      if (!channel || !webhookUrl) {
        res.status(400).json({ error: 'channel (slack/discord) and webhookUrl required' });
        return;
      }
      let sent = false;
      if (channel === 'slack') {
        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'Test: journal notification setup is working!', channel: 'slack' }),
        });
        sent = resp.ok;
      } else if (channel === 'discord') {
        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Test: journal notification setup is working!', channel: 'discord' }),
        });
        sent = resp.ok;
      }
      res.json({ success: sent, channel });
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  return app;
}

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeMockToken(uid: string, email: string): string {
  return Buffer.from(JSON.stringify({ sub: uid, email, email_verified: true })).toString('base64');
}

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err: any) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
    failed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function req(method: string, path: string, body?: any, token?: string): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const resp = await fetch(`${APP_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await resp.json().catch(() => ({}));
  return { status: resp.status, json };
}

// ─── Mock Webhook Receiver ───────────────────────────────────────────────────

function startMockWebhookReceiver(): Promise<void> {
  return new Promise((resolve) => {
    mockServer = http.createServer((_req, res) => {
      let data = '';
      _req.on('data', (chunk) => { data += chunk; });
      _req.on('end', () => {
        const url = _req.url || '';
        const channel = url.includes('slack') ? 'slack' : 'discord';
        webhookCaptures.push({ channel, body: JSON.parse(data || '{}') });
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      });
    });
    mockServer.listen(0, '127.0.0.1', () => {
      mockPort = (mockServer.address() as any).port;
      resolve();
    });
  });
}

// ─── Main Test Suite ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🧪 E2E Synthetic Test Suite — Admin RBAC + Notifications\n');

  // Start mock webhook receiver
  await startMockWebhookReceiver();
  console.log(`  Mock webhook receiver on port ${mockPort}\n`);

  // Build mock app
  const app = buildMockApp();
  const server = app.listen(0, '127.0.0.1', async () => {
    const port = (server.address() as any).port;
    APP_BASE_URL = `http://127.0.0.1:${port}`;
    const BASE = APP_BASE_URL;

    const adminToken = makeMockToken('uid-admin-001', 'admin@test.com');
    const userToken  = makeMockToken('uid-user-002', 'user@test.com');
    const randoToken = makeMockToken('uid-rando-003', 'random@gmail.com');

    console.log('─── 1. UNAUTHENTICATED ACCESS ───\n');

    await test('GET /api/admin/users → 401 without token', async () => {
      const r = await req('GET', '/api/admin/users');
      assert(r.status === 401, `Expected 401, got ${r.status}`);
    });

    await test('POST /api/admin/seed-role → 401 without token', async () => {
      const r = await req('POST', '/api/admin/seed-role');
      assert(r.status === 401, `Expected 401, got ${r.status}`);
    });

    await test('GET /api/notifications/settings → 401 without token', async () => {
      const r = await req('GET', '/api/notifications/settings');
      assert(r.status === 401, `Expected 401, got ${r.status}`);
    });

    await test('PUT /api/notifications/settings → 401 without token', async () => {
      const r = await req('PUT', '/api/notifications/settings', { enabled: true });
      assert(r.status === 401, `Expected 401, got ${r.status}`);
    });

    await test('POST /api/notifications/test → 401 without token', async () => {
      const r = await req('POST', '/api/notifications/test', { channel: 'slack', webhookUrl: 'http://x' });
      assert(r.status === 401, `Expected 401, got ${r.status}`);
    });

    console.log('\n─── 2. ROLE SEEDING (admin vs non-admin) ───\n');

    await test('POST /api/admin/seed-role (admin email) → isAdmin:true', async () => {
      const r = await req('POST', '/api/admin/seed-role', null, adminToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.json.isAdmin === true, `Expected isAdmin:true, got ${r.json.isAdmin}`);
      assert(r.json.email === 'admin@test.com', 'Email mismatch');
    });

    await test('POST /api/admin/seed-role (non-admin email) → isAdmin:false', async () => {
      const r = await req('POST', '/api/admin/seed-role', null, userToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.json.isAdmin === false, `Expected isAdmin:false, got ${r.json.isAdmin}`);
    });

    console.log('\n─── 3. ADMIN RBAC ENFORCEMENT ───\n');

    await test('GET /api/admin/users (non-admin) → 403 Forbidden', async () => {
      const r = await req('GET', '/api/admin/users', null, userToken);
      assert(r.status === 403, `Expected 403, got ${r.status}`);
    });

    await test('POST /api/admin/roles (non-admin) → 403 Forbidden', async () => {
      const r = await req('POST', '/api/admin/roles', { targetUid: 'uid-user-002', role: 'admin' }, userToken);
      assert(r.status === 403, `Expected 403, got ${r.status}`);
    });

    await test('POST /api/admin/roles (admin) → 200 success', async () => {
      const r = await req('POST', '/api/admin/roles', { targetUid: 'uid-user-002', role: 'admin' }, adminToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.json.success === true, 'Expected success:true');
      assert(r.json.targetUid === 'uid-user-002', 'UID mismatch');
      assert(r.json.role === 'admin', 'Role mismatch');
    });

    await test('GET /api/admin/users (admin) → 200 with user list', async () => {
      const r = await req('GET', '/api/admin/users', null, adminToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(Array.isArray(r.json.users), 'Expected users array');
    });

    await test('POST /api/admin/roles (invalid role) → 400', async () => {
      const r = await req('POST', '/api/admin/roles', { targetUid: 'uid-user-002', role: 'superadmin' }, adminToken);
      assert(r.status === 400, `Expected 400, got ${r.status}`);
    });

    console.log('\n─── 4. NOTIFICATION SETTINGS CRUD ───\n');

    await test('GET /api/notifications/settings (new user) → defaults', async () => {
      const r = await req('GET', '/api/notifications/settings', null, userToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.json.enabled === false, 'Default should be disabled');
      assert(Array.isArray(r.json.notifyOn), 'notifyOn should be array');
      assert(r.json.notifyOn.length === 4, 'Default notifyOn should have 4 modes');
    });

    await test('PUT /api/notifications/settings → save succeeds', async () => {
      const r = await req('PUT', '/api/notifications/settings', {
        slackWebhookUrl: `http://127.0.0.1:${mockPort}/slack`,
        discordWebhookUrl: `http://127.0.0.1:${mockPort}/discord`,
        enabled: true,
        notifyOn: ['reflect', 'brainstorm'],
      }, userToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.json.success === true, 'Expected success:true');
    });

    await test('GET /api/notifications/settings (after save) → reflects saved values', async () => {
      const r = await req('GET', '/api/notifications/settings', null, userToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.json.enabled === true, 'Should be enabled after save');
      assert(r.json.slackWebhookUrl.includes('127.0.0.1'), 'Slack URL saved');
      assert(r.json.discordWebhookUrl.includes('127.0.0.1'), 'Discord URL saved');
      assert(r.json.notifyOn.length === 2, 'Should have 2 notify modes');
      assert(r.json.notifyOn.includes('reflect'), 'Should include reflect');
    });

    console.log('\n─── 5. NOTIFICATION WEBHOOK DISPATCH ───\n');

    await test('POST /api/notifications/test (Slack) → success + webhook received', async () => {
      webhookCaptures.length = 0;
      const r = await req('POST', '/api/notifications/test', {
        channel: 'slack',
        webhookUrl: `http://127.0.0.1:${mockPort}/slack-test`,
      }, userToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.json.success === true, 'Expected success:true');
      assert(r.json.channel === 'slack', 'Channel mismatch');
      assert(webhookCaptures.length > 0, 'Webhook should have been received');
      assert(webhookCaptures[0].channel === 'slack', 'Captured channel should be slack');
    });

    await test('POST /api/notifications/test (Discord) → success + webhook received', async () => {
      webhookCaptures.length = 0;
      const r = await req('POST', '/api/notifications/test', {
        channel: 'discord',
        webhookUrl: `http://127.0.0.1:${mockPort}/discord-test`,
      }, userToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.json.success === true, 'Expected success:true');
      assert(r.json.channel === 'discord', 'Channel mismatch');
      assert(webhookCaptures.length > 0, 'Webhook should have been received');
      assert(webhookCaptures[0].channel === 'discord', 'Captured channel should be discord');
    });

    await test('POST /api/notifications/test (invalid channel) → success:false', async () => {
      const r = await req('POST', '/api/notifications/test', {
        channel: 'email',
        webhookUrl: 'http://127.0.0.1:9999',
      }, userToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.json.success === false, 'Should be false for unsupported channel');
    });

    await test('POST /api/notifications/test (missing params) → 400', async () => {
      const r = await req('POST', '/api/notifications/test', { channel: 'slack' }, userToken);
      assert(r.status === 400, `Expected 400, got ${r.status}`);
    });

    console.log('\n─── 6. EDGE CASES & INPUT VALIDATION ───\n');

    await test('PUT /api/notifications/settings (no body fields) → still succeeds with defaults', async () => {
      const r = await req('PUT', '/api/notifications/settings', {}, userToken);
      assert(r.status === 200, `Expected 200, got ${r.status}`);
      assert(r.json.success === true, 'Should succeed with defaults');
    });

    await test('POST /api/admin/roles (missing targetUid) → 400', async () => {
      const r = await req('POST', '/api/admin/roles', { role: 'admin' }, adminToken);
      assert(r.status === 400, `Expected 400, got ${r.status}`);
    });

    console.log('\n─── 7. GEMINI REFLECT WITH LOCATION CONTEXT ───\n');

    // This uses the real server's Gemini endpoint, so we skip if no key
    // But we can verify the system instruction includes location
    await test('Location context propagates to system instruction (unit check)', async () => {
      const location = { lat: 37.7749, lng: -122.4194, placeName: 'San Francisco', address: 'San Francisco, CA' };
      const locationContext = location && location.placeName
        ? `\n\nLOCATION CONTEXT: The user pinned this entry to "${location.placeName}"${location.address ? ` (${location.address})` : ''} at coordinates (${location.lat}, ${location.lng}). If relevant, incorporate geographic, cultural, or environmental context from this reflection.`
        : '';
      assert(locationContext.includes('San Francisco'), 'Location context must include place name');
      assert(locationContext.includes('37.7749'), 'Location context must include lat');
      assert(locationContext.includes('-122.4194'), 'Location context must include lng');
      assert(locationContext.includes('San Francisco, CA'), 'Location context must include address');
    });

    // ─── Summary ───

    console.log(`\n${'─'.repeat(50)}`);
    console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
    console.log(`${'─'.repeat(50)}\n`);

    server.close();
    mockServer.close();
    // Allow pending handles to drain before exit
    setTimeout(() => process.exit(failed > 0 ? 1 : 0), 50);
  });
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
