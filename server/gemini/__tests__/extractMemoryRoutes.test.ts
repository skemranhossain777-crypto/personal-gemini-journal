// @vitest-environment node
//
// Route-level verification of /api/gemini/extract-memories — the engine that
// the journal saves now trigger. The @google/genai SDK is mocked so a "live"
// model response is simulated at the SDK boundary only; the full production
// path (verifyFirebaseToken → rateLimiter → extractMemoryCandidates → AI
// interaction audit) runs against the real HTTP app.
import { describe, expect, it, vi, beforeAll, afterAll, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';

vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models: { generateContent: any };
    constructor(_opts: Record<string, unknown>) {
      this.models = {
        generateContent: vi.fn(async (params: any) => {
          const prompt = JSON.stringify(params);
          let payload: Record<string, unknown>;
          if (prompt.includes('Identify explicit memory candidates')) {
            payload = {
              candidates: [
                { type: 'project', title: 'Ship the memory engine', narrative: 'The user started building an AI memory engine.', importance: 4, confidence: 0.9 },
                { type: 'person', title: 'Mentor', narrative: 'The user met with their mentor for guidance.', importance: 5, confidence: 0.85 },
              ],
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

let serverModule: typeof import('../../../server');
let baseUrl: string;
let listener: { close: () => Promise<void> } | null = null;

beforeAll(async () => {
  process.env.VITE_FIREBASE_PROJECT_ID = CANONICAL_PROJECT;
  process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID = 'ai-studio-geminijournalref-07d208be-ffdc-41ac-9ad4-a205122972b6';
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

function post(body: unknown, auth = true): Promise<Response> {
  return fetch(`${baseUrl}/api/gemini/extract-memories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: 'Bearer demo-token' } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/gemini/extract-memories', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await post({ text: 'A protected reflection.' }, false);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  it('extracts memory candidates and records a memory-extraction audit interaction', async () => {
    const auditSpy = vi.spyOn(serverModule.aiAudit, 'log').mockResolvedValue(undefined);
    const res = await post({ text: 'I started building the AI memory engine with my mentor today.' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.result.candidates).toHaveLength(2);
    expect(data.result.candidates[0]).toMatchObject({ type: 'project', importance: 4, confidence: 0.9 });
    expect(data.result.modelUsed).toBeTruthy();

    expect(auditSpy).toHaveBeenCalledTimes(1);
    const [uid, skill, prompt, response, modelUsed, durationMs] = auditSpy.mock.calls[0];
    expect(uid).toBe('demo-local-user');
    expect(skill).toBe('memory-extraction');
    expect(String(prompt)).toContain('[memory-extraction]');
    expect(String(response)).toMatch(/Candidates: 2/);
    expect(String(modelUsed)).toBeTruthy();
    expect(typeof durationMs).toBe('number');
  });

  it('rejects empty or oversize input without auditing', async () => {
    const auditSpy = vi.spyOn(serverModule.aiAudit, 'log').mockResolvedValue(undefined);

    const empty = await post({ text: '' });
    expect(empty.status).toBe(400);

    const oversized = await post({ text: 'x'.repeat(13000) });
    expect(oversized.status).toBe(400);
    const data = await oversized.json();
    expect(data.success).toBe(false);

    expect(auditSpy).not.toHaveBeenCalled();
  });
});