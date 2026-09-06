// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { placesAutocompleteHandler, placesDetailsHandler } from '../../../server';

describe('Server Route Security Hardening', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'mock-key');
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
