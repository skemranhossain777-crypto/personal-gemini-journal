// @vitest-environment node
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  placesAutocompleteHandler,
  placesDetailsHandler,
  askMyLifeHandler,
  ensureEmbeddingHandler,
  removeEmbeddingHandler,
  backfillEmbeddingsHandler,
  semanticSearchHandler,
} from '../../../server';

describe('Server Route Security Hardening', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'mock-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const createMockRes = () => {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  it('placesAutocompleteHandler rejects malformed or empty array body with controlled 400', async () => {
    const req: any = { body: [] };
    const res = createMockRes();
    await placesAutocompleteHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Input must be at least 2 characters' });
  });

  it('placesAutocompleteHandler rejects empty body object with controlled 400', async () => {
    const req: any = { body: {} };
    const res = createMockRes();
    await placesAutocompleteHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Input must be at least 2 characters' });
  });

  it('placesDetailsHandler rejects malformed or empty array body with controlled 400', async () => {
    const req: any = { body: [] };
    const res = createMockRes();
    await placesDetailsHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'placeId is required' });
  });

  it('placesDetailsHandler rejects empty body object with controlled 400', async () => {
    const req: any = { body: {} };
    const res = createMockRes();
    await placesDetailsHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'placeId is required' });
  });
});

describe('G3 semantic retrieval route guards', () => {
  beforeEach(() => {
    vi.stubEnv('ENABLE_SEMANTIC_RETRIEVAL', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const createMockRes = () => {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  it('ensureEmbeddingHandler returns 401 without an authenticated uid', async () => {
    const req: any = { body: { sourceType: 'entry', sourceId: 'entry-1' } };
    const res = createMockRes();
    await ensureEmbeddingHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('ensureEmbeddingHandler validates sourceType and sourceId', async () => {
    const req: any = { auth: { uid: 'user-1' }, body: { sourceType: 'entry' } };
    const res = createMockRes();
    await ensureEmbeddingHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/sourceId/);
  });

  it('ensureEmbeddingHandler reports disabled when the flag is off (no embedding call)', async () => {
    const req: any = { auth: { uid: 'user-1' }, body: { sourceType: 'memory', sourceId: 'm-1' } };
    const res = createMockRes();
    await ensureEmbeddingHandler(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      result: { sourceType: 'memory', sourceId: 'm-1', status: 'disabled', textHash: '' },
    });
  });

  it('removeEmbeddingHandler returns 401 and validates input like ensure', async () => {
    const res = createMockRes();
    await removeEmbeddingHandler({ body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('removeEmbeddingHandler is a no-op (success) when the flag is off', async () => {
    const req: any = { auth: { uid: 'user-1' }, body: { sourceType: 'entry', sourceId: 'entry-1' } };
    const res = createMockRes();
    await removeEmbeddingHandler(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, removed: { sourceType: 'entry', sourceId: 'entry-1' } });
  });

  it('backfillEmbeddingsHandler returns 401 without auth and disabled when flag off', async () => {
    const res = createMockRes();
    await backfillEmbeddingsHandler({ body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);

    const res2 = createMockRes();
    await backfillEmbeddingsHandler({ auth: { uid: 'user-1' }, body: {} } as any, res2);
    const payload = res2.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.result.processed).toBe(0);
    expect(payload.retrieval).toBe('disabled');
  });

  it('semanticSearchHandler returns 401 without auth and 400 for an empty query', async () => {
    const res = createMockRes();
    await semanticSearchHandler({ body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);

    const res2 = createMockRes();
    await semanticSearchHandler({ auth: { uid: 'user-1' }, body: { query: '   ' } } as any, res2);
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  it('semanticSearchHandler reports disabled when the flag is off', async () => {
    const req: any = { auth: { uid: 'user-1' }, body: { query: 'when was I proud?' } };
    const res = createMockRes();
    await semanticSearchHandler(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.result.results).toEqual([]);
    expect(payload.result.retrieval).toBe('disabled');
  });

  it('askMyLifeHandler keeps exact legacy behavior when the flag is off', async () => {
    const req: any = {
      body: { question: 'How were the last few days?', contextDocuments: [] },
    };
    const res = createMockRes();
    await askMyLifeHandler(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.retrieval).toBe('disabled');
    expect(payload.hasSufficientEvidence).toBe(false);
    expect(payload.confidence).toBe('insufficient');
  });

  it('askMyLifeHandler never invokes server retrieval without a verified uid (flag on)', async () => {
    vi.stubEnv('ENABLE_SEMANTIC_RETRIEVAL', 'true');
    const req: any = {
      body: { question: 'How were the last few days?', contextDocuments: [] },
    };
    const res = createMockRes();
    await askMyLifeHandler(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(['disabled', 'client']).toContain(payload.retrieval);
    expect(payload.hasSufficientEvidence).toBe(false);
  });
});
