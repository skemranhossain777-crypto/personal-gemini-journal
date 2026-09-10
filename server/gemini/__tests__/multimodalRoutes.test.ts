// @vitest-environment node
//
// Integration-level verification of the production multimodal routes
// (/api/gemini/analyze-image and /api/gemini/transcribe-voice).
//
// The @google/genai SDK is mocked so that a "live" model response is simulated
// at the SDK boundary only; the full production path (verifyFirebaseToken →
// multer memory upload → validateMultimodalMedia → generateMultimodal →
// structured JSON parse) runs against the real HTTP app. This proves the
// server constructs and handles a multimodal Gemini request end-to-end without
// requiring a live secret in CI. Live smoke tests are performed separately
// against the deployed Cloud Run service (see docs/PHASE1_MULTIMODAL_JOURNAL.md).
import { describe, expect, it, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';

// Capture the requests the mocked SDK receives so the test can assert the
// production path really forwards inline media + system instruction.
let capturedRequests: Array<Record<string, unknown>> = [];

vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models: { generateContent: any };
    constructor(_opts: Record<string, unknown>) {
      this.models = {
        generateContent: vi.fn(async (params: any) => {
          capturedRequests.push(params);
          const prompt = JSON.stringify(params);
          let payload: Record<string, unknown>;
          if (prompt.includes('visual journaling assistant')) {
            payload = {
              body: 'I saw a calm harbor at sunset and felt at peace.',
              summary: 'A calm sunset by the harbor.',
              tags: ['nature', 'sunset'],
              emotion: 'Calm',
              observed: ['A sunset over the water.'],
              userProvided: ['User Caption: "My evening walk"'],
              aiInferred: ['The scene suggests a reflective mood.'],
            };
          } else if (prompt.includes('voice-journaling assistant')) {
            payload = {
              transcript: 'Today I walked along the harbor and reflected on my week.',
              body: 'I took a peaceful walk by the harbor and thought about my week.',
              summary: 'A peaceful reflective walk.',
              tags: ['nature', 'reflection'],
              emotion: 'Peaceful',
            };
          } else {
            payload = {};
          }
          return { text: JSON.stringify(payload) };
        }),
      };
    }
  }
  return { GoogleGenAI: MockGoogleGenAI };
});

const CANONICAL_PROJECT = 'gen-lang-client-0345619653';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const FAKE_KID = 'multimodal-test-key-1';

function forgeFirebaseToken(projectId: string): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      sub: 'multimodal-test-user',
      email: 'multimodal-tester@example.com',
      email_verified: true,
      iat: now,
      exp: now + 3600,
    },
    privateKey,
    {
      algorithm: 'RS256',
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      header: { kid: FAKE_KID, alg: 'RS256', typ: 'JWT' },
    }
  );
}

// Stub Google's public-key metadata endpoint with our fake key.
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
  process.env.VITE_FIREBASE_PROJECT_ID = CANONICAL_PROJECT;
  process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID = 'gemini-journal';
  process.env.GEMINI_API_KEY = 'mock-gemini-key';
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

describe('Multimodal routes auth gating', () => {
  it('rejects unauthenticated analyze-image with 401', async () => {
    const form = new FormData();
    form.append('image', new Blob([Buffer.from('fake-image')], { type: 'image/jpeg' }), 'photo.jpg');
    const res = await fetch(`${baseUrl}/api/gemini/analyze-image`, { method: 'POST', body: form });
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated transcribe-voice with 401', async () => {
    const form = new FormData();
    form.append('audio', new Blob([Buffer.from('fake-audio')], { type: 'audio/webm' }), 'memo.webm');
    const res = await fetch(`${baseUrl}/api/gemini/transcribe-voice`, { method: 'POST', body: form });
    expect(res.status).toBe(401);
  });

  it('rejects unsupported media MIME for an authenticated analyze-image request', async () => {
    stubKeyEndpoint();
    const token = forgeFirebaseToken(CANONICAL_PROJECT);
    const form = new FormData();
    form.append('image', new Blob([Buffer.from('fake-pdf')], { type: 'application/pdf' }), 'evil.pdf');
    const res = await fetch(`${baseUrl}/api/gemini/analyze-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    expect(res.status).toBe(415);
  });

  it('rejects an image exceeding the allowed image size with 400', async () => {
    stubKeyEndpoint();
    const token = forgeFirebaseToken(CANONICAL_PROJECT);
    const big = Buffer.alloc(11 * 1024 * 1024); // 11MB > 10MB image limit
    const form = new FormData();
    form.append('image', new Blob([big], { type: 'image/jpeg' }), 'huge.jpg');
    const res = await fetch(`${baseUrl}/api/gemini/analyze-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    expect(res.status).toBe(400);
  });

  it('rejects an upload exceeding the multer transport limit with 413', async () => {
    stubKeyEndpoint();
    const token = forgeFirebaseToken(CANONICAL_PROJECT);
    const huge = Buffer.alloc(26 * 1024 * 1024); // 26MB > 25MB multer transport limit
    const form = new FormData();
    form.append('video', new Blob([huge], { type: 'image/jpeg' }), 'huge.jpg');
    const res = await fetch(`${baseUrl}/api/gemini/analyze-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    expect(res.status).toBe(413);
  });

  it('accepts an authenticated valid image and returns a structured journal result', async () => {
    stubKeyEndpoint();
    capturedRequests = [];
    const token = forgeFirebaseToken(CANONICAL_PROJECT);
    const form = new FormData();
    form.append('image', new Blob([Buffer.from('fake-jpeg-bytes')], { type: 'image/jpeg' }), 'sunset.jpg');
    form.append('caption', 'My evening walk');

    const res = await fetch(`${baseUrl}/api/gemini/analyze-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.body).toContain('harbor at sunset');
    expect(body.result.tags).toEqual(['nature', 'sunset']);
    expect(body.result.visualAnalysis.observed).toContain('A sunset over the water.');
    expect(body.result.modelUsed).toBe('gemini-3.6-flash');

    // Prove the production path actually forwarded inline image data to Gemini.
    const req = capturedRequests.find((r) => JSON.stringify(r).includes('inlineData'));
    expect(req).toBeDefined();
    const parts: any[] = (req as any).contents?.[0]?.parts || [];
    const inline = parts.find((p: any) => p.inlineData);
    expect(inline).toBeDefined();
    expect(inline.inlineData.mimeType).toBe('image/jpeg');
    expect(inline.inlineData.data).toBe(Buffer.from('fake-jpeg-bytes').toString('base64'));
  });

  it('accepts an authenticated valid audio memo and returns a transcript', async () => {
    stubKeyEndpoint();
    capturedRequests = [];
    const token = forgeFirebaseToken(CANONICAL_PROJECT);
    const form = new FormData();
    form.append('audio', new Blob([Buffer.from('fake-webm-bytes')], { type: 'audio/webm' }), 'memo.webm');
    form.append('language', 'en-US');

    const res = await fetch(`${baseUrl}/api/gemini/transcribe-voice`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.transcript).toContain('walked along the harbor');
    expect(body.result.body).toContain('peaceful walk');
    expect(body.result.modelUsed).toBe('gemini-3.6-flash');

    const req = capturedRequests.find((r) => JSON.stringify(r).includes('inlineData'));
    expect(req).toBeDefined();
    const parts: any[] = (req as any).contents?.[0]?.parts || [];
    const inline = parts.find((p: any) => p.inlineData);
    expect(inline).toBeDefined();
    expect(inline.inlineData.mimeType).toBe('audio/webm');
  });
});
