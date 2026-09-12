import { describe, expect, it, vi } from 'vitest';
import {
  l2Normalize,
  computeTextHash,
  buildEmbeddingText,
  toMatchScore,
  normalizePageSize,
  EMBEDDING_MODEL,
  EMBEDDING_OUTPUT_DIM,
} from '../embeddings';
import { GeminiService } from '../service';

const unitNorm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));

function createEmbeddingMockClient(vectors: number[][]) {
  const embedContent = vi.fn(async ({ contents }: any) => ({
    embeddings: contents.map((_: string, i: number) => ({ values: vectors[i % vectors.length] })),
  }));
  return { models: { embedContent }, __embedContent: embedContent };
}

describe('l2Normalize', () => {
  it('produces unit-norm vectors (the R2 cosine invariant)', () => {
    const raw = [3, 4, 0, -1, 0.5, -2.25];
    const normalized = l2Normalize(raw);
    expect(unitNorm(normalized)).toBeCloseTo(1, 6);
    expect(normalized.length).toBe(raw.length);
  });

  it('keeps zero vectors degenerate but non-throwing', () => {
    expect(l2Normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('does not mutate its input array', () => {
    const input = [1, 2, 3, 4];
    const copy = [...input];
    l2Normalize(input);
    expect(input).toEqual(copy);
  });
});

describe('computeTextHash', () => {
  it('is deterministic for identical text', () => {
    expect(computeTextHash('the same text')).toBe(computeTextHash('the same text'));
  });

  it('differs when content changes', () => {
    expect(computeTextHash('alpha')).not.toBe(computeTextHash('beta'));
  });
});

describe('buildEmbeddingText', () => {
  it('joins title, body, and narrative with tags appended', () => {
    expect(
      buildEmbeddingText({ title: 'Morning', body: 'Woke up early.', narrative: 'Outcome.', tags: ['wellness'] })
    ).toBe('Morning\n\nWoke up early.\n\nOutcome.\n\ntags: wellness');
  });

  it('skips blank sections and extra tag whitespace', () => {
    expect(buildEmbeddingText({ title: '', body: 'Only body', tags: ['a', ' b '] })).toBe(
      'Only body\n\ntags: a, b'
    );
  });

  it('caps the embedding text at the documented limit', () => {
    const long = 'x'.repeat(20000);
    const result = buildEmbeddingText({ body: long });
    expect(result.length).toBeLessThanOrEqual(12000);
  });
});

describe('score mapping + page-size normalization', () => {
  it('maps cosine similarity to a 0..100 match percentage', () => {
    expect(toMatchScore(1)).toBe(100);
    expect(toMatchScore(0.875)).toBe(88);
    expect(toMatchScore(0)).toBe(0);
    expect(toMatchScore(-0.5)).toBe(0);
  });

  it('clamps page sizes into the documented search surface', () => {
    expect(normalizePageSize(6)).toBe(6);
    expect(normalizePageSize(1000)).toBe(100);
    expect(normalizePageSize(NaN as any)).toBe(6);
  });
});

describe('GeminiService embedding operations', () => {
  it('embeds documents in one batch, L2-normalizes, and pinpoints the model + dimensionality', async () => {
    const mockClient = createEmbeddingMockClient([
      [3, 4, 0, 0], // scaled vector — must be normalized before use
      [0, 0, 6, 8],
    ]);
    const service = new GeminiService({ apiKey: 'test-key' }, mockClient as any);

    const vectors = await service.embedDocuments([
      { title: 'A', text: 'first document' },
      { title: 'B', text: 'second document' },
    ]);

    expect(mockClient.models.embedContent).toHaveBeenCalledTimes(1);
    const params = mockClient.models.embedContent.mock.calls[0][0];
    expect(params.model).toBe(EMBEDDING_MODEL);
    expect(params.config.outputDimensionality).toBe(EMBEDDING_OUTPUT_DIM);
    expect(params.config.taskType).toBe('RETRIEVAL_DOCUMENT');
    expect(params.config.title).toBe('A');

    expect(vectors).toHaveLength(2);
    for (const v of vectors) expect(unitNorm(v)).toBeCloseTo(1, 6);
  });

  it('embeds a query with the RETRIEVAL_QUERY task and no title', async () => {
    const mockClient = createEmbeddingMockClient([[1, 2, 2, 4]]);
    const service = new GeminiService({ apiKey: 'test-key' }, mockClient as any);

    const vector = await service.embedQuery('when was I proud?');

    expect(mockClient.models.embedContent).toHaveBeenCalledTimes(1);
    const params = mockClient.models.embedContent.mock.calls[0][0];
    expect(params.config.taskType).toBe('RETRIEVAL_QUERY');
    expect(params.config.title).toBeUndefined();
    expect(unitNorm(vector)).toBeCloseTo(1, 6);
  });

  it('truncates over-long individual vectors to the pinned dimension', async () => {
    const longVector = Array.from({ length: 900 }, () => 1);
    const mockClient = createEmbeddingMockClient([longVector]);
    const service = new GeminiService({ apiKey: 'test-key' }, mockClient as any);

    const vectors = await service.embedDocuments([{ text: 'long doc' }]);
    expect(vectors[0]).toHaveLength(EMBEDDING_OUTPUT_DIM);
  });

  it('returns [] without calling the API for empty inputs', async () => {
    const mockClient = createEmbeddingMockClient([]);
    const service = new GeminiService({ apiKey: 'test-key' }, mockClient as any);
    expect(await service.embedDocuments([])).toEqual([]);
    expect(await service.embedContentBatch([])).toEqual([]);
    expect(mockClient.models.embedContent).not.toHaveBeenCalled();
  });

  it('maps embedding API authentication failures to a 401 GeminiError', async () => {
    const client = {
      models: {
        embedContent: vi.fn(async () => {
          throw new Error('API_KEY_INVALID: bad key');
        }),
      },
    };
    const service = new GeminiService({ apiKey: 'bad-key' }, client as any);
    await expect(service.embedQuery('q')).rejects.toMatchObject({ status: 401, code: 'API_ERROR' });
  });

  it('wraps generic embedding failures as 500 GeminiErrors', async () => {
    const client = {
      models: {
        embedContent: vi.fn(async () => {
          throw new Error('network down');
        }),
      },
    };
    const service = new GeminiService({ apiKey: 'bad-key' }, client as any);
    await expect(service.embedQuery('q')).rejects.toMatchObject({ status: 500, code: 'API_ERROR' });
  });

  it('throws EMPTY_RESPONSE when the API returns no embeddings', async () => {
    const client = {
      models: {
        embedContent: vi.fn(async () => ({ embeddings: [] })),
      },
    };
    const service = new GeminiService({ apiKey: 'bad-key' }, client as any);
    await expect(service.embedQuery('q')).rejects.toMatchObject({ status: 500, code: 'EMPTY_RESPONSE' });
  });
});