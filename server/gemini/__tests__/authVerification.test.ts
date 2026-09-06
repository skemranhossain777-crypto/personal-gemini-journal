// @vitest-environment node
import { describe, expect, it, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';

const CANONICAL_PROJECT = 'gen-lang-client-0345619653';
const OTHER_PROJECT = 'some-other-project';

// RSA keypair used to fabricate verifiable Firebase-format ID tokens in tests.
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const FAKE_KID = 'test-key-1';

function forgeFirebaseToken(projectId: string, overrides: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      sub: 'test-user-123',
      email: 'tester@example.com',
      email_verified: true,
      iat: now,
      exp: now + 3600,
      ...overrides,
    },
    privateKey,
    { algorithm: 'RS256', issuer: `https://securetoken.google.com/${projectId}`, audience: projectId, header: { kid: FAKE_KID, alg: 'RS256', typ: 'JWT' } }
  );
}

// Mock Google's public-key metadata endpoint, keyed by kid. Pass-through for
// everything else (e.g. the test's own HTTP client calls).
function stubKeyEndpoint() {
  const realFetch = globalThis.fetch.bind(globalThis);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const href = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (href.includes('securetoken@system.gserviceaccount.com')) {
        return new Response(JSON.stringify({ [FAKE_KID]: publicKey.replace(/\n/g, '\\n') }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return realFetch(url as any, init);
    })
  );
}

let serverModule: typeof import('../../../server');
let baseUrl: string;
let listener: { close: () => Promise<void> } | null = null;

beforeAll(async () => {
  // Ensure the canonical deployment value is what the module captures at import.
  process.env.VITE_FIREBASE_PROJECT_ID = CANONICAL_PROJECT;
  process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID = 'ai-studio-geminijournalref-07d208be-ffdc-41ac-9ad4-a205122972b6';
  vi.resetModules();
  serverModule = await import('../../../server');

  const server = serverModule.app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  listener = { close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
});

afterAll(async () => {
  await listener?.close();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Firebase auth verification', () => {
  it('detects a missing Firebase project ID in the health contract', () => {
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '');
    const payload = serverModule.getHealthPayload();
    expect(payload.services.firebaseProjectIdConfigured).toBe(false);

    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', CANONICAL_PROJECT);
    expect(serverModule.getHealthPayload().services.firebaseProjectIdConfigured).toBe(true);
  });

  it('accepts the canonical project ID issuer/audience', async () => {
    stubKeyEndpoint();
    const req: any = { headers: { authorization: `Bearer ${forgeFirebaseToken(CANONICAL_PROJECT)}` } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const ok = await serverModule.verifyFirebaseTokenAsync(req, res);
    expect(ok).toBe(true);
    expect(req.auth?.uid).toBe('test-user-123');
    expect(req.auth?.email).toBe('tester@example.com');
  });

  it('rejects a token issued for a different Firebase project', async () => {
    stubKeyEndpoint();
    const req: any = { headers: { authorization: `Bearer ${forgeFirebaseToken(OTHER_PROJECT)}` } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const ok = await serverModule.verifyFirebaseTokenAsync(req, res);
    expect(ok).toBe(false);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects a malformed bearer token', async () => {
    const req: any = { headers: { authorization: 'Bearer not-a-real-token' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const ok = await serverModule.verifyFirebaseTokenAsync(req, res);
    expect(ok).toBe(false);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects the demo-token in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const req: any = { headers: { authorization: 'Bearer demo-token' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const ok = await serverModule.verifyFirebaseTokenAsync(req, res);
    expect(ok).toBe(false);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('accepts the demo-token outside production (dev parity)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const req: any = { headers: { authorization: 'Bearer demo-token' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const ok = await serverModule.verifyFirebaseTokenAsync(req, res);
    expect(ok).toBe(true);
    expect(req.auth?.uid).toBe('demo-local-user');
  });
});

describe('GET /api/auth/verify (diagnostic route)', () => {
  it('returns 401 without a token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify`);
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/verify`, {
      headers: { Authorization: 'Bearer bogus' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 authenticated for a verified token with the canonical project', async () => {
    stubKeyEndpoint();
    const res = await fetch(`${baseUrl}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${forgeFirebaseToken(CANONICAL_PROJECT)}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ authenticated: true });
  });

  it('does not leak token claims in the diagnostic response', async () => {
    stubKeyEndpoint();
    const res = await fetch(`${baseUrl}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${forgeFirebaseToken(CANONICAL_PROJECT)}` },
    });
    const body = await res.json();
    expect(Object.keys(body)).toEqual(['authenticated']);
    expect(JSON.stringify(body)).not.toContain('tester@example.com');
    expect(JSON.stringify(body)).not.toContain('test-user-123');
  });
});