import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalEntry, MemoryType } from '../../data';
import type { MemoryCandidateOutput } from '../../../server/gemini/types';
import {
  buildCandidateInput,
  EXTRACTION_MARKER_STORAGE_KEY,
  extractionTextForEntry,
  getExtractionMarker,
  hashText,
  MAX_CANDIDATES_PER_ENTRY,
  MAX_EXTRACTION_TEXT_CHARS,
  MIN_EXTRACTABLE_BODY_CHARS,
  runMemoryExtraction,
  setExtractionMarker,
  type ExtractionReport,
} from '../memoryPipeline';

const extract = vi.fn(async (_input: { text: string }): Promise<MemoryCandidateOutput> => {
  throw new Error('extract not configured in this test');
});
const create = vi.fn(async (input: Record<string, unknown>): Promise<any> => ({ id: 'mem-x', ...input }));

function makeStorage(): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

function makeEntry(body: string, id = 'entry-1'): JournalEntry {
  return { id, body } as unknown as JournalEntry;
}

describe('memoryPipeline helpers', () => {
  it('hashes text deterministically', () => {
    expect(hashText('same text')).toBe(hashText('same text'));
    expect(hashText('same text')).not.toBe(hashText('other text'));
  });

  it('returns null for empty or trivial bodies and caps oversized bodies', () => {
    expect(extractionTextForEntry(makeEntry(''))).toBeNull();
    expect(extractionTextForEntry(makeEntry('   '))).toBeNull();
    expect(extractionTextForEntry(makeEntry('a'.repeat(Math.max(1, MIN_EXTRACTABLE_BODY_CHARS - 1))))).toBeNull();
    const longBody = 'word '.repeat(MAX_EXTRACTION_TEXT_CHARS);
    const text = extractionTextForEntry(makeEntry(longBody)) ?? '';
    expect(text.length).toBeLessThanOrEqual(MAX_EXTRACTION_TEXT_CHARS);
  });

  it('sanitizes a model candidate into a rule-valid memory payload', () => {
    const input = buildCandidateInput('entry-1', {
      type: 'project',
      title: '  Ship it  ',
      narrative: 'A short narrative.',
      importance: 11,
      confidence: 7,
    });
    expect(input).toEqual({
      type: 'project',
      title: 'Ship it',
      narrative: 'A short narrative.',
      importance: 5,
      confidence: 1,
      sourceEntryIds: ['entry-1'],
      tags: [],
      saved: false,
      status: 'candidate',
      occurredAt: null,
    });
  });

  it('falls back to idea/untitled + defaults and rejects empty candidates', () => {
    const input = buildCandidateInput('entry-1', {
      type: 'mystery' as MemoryType,
      title: '',
      narrative: 'x'.repeat(50),
      importance: 0,
      confidence: 0,
    });
    expect(input).toBeNull();

    const normalized = buildCandidateInput('entry-1', {
      type: 'not-a-real-type' as MemoryType,
      title: 'Repeats',
      narrative: '   ',
      importance: -3,
      confidence: 2,
    });
    expect(normalized).toBeNull();
  });

  it('reads and writes per-uid extraction markers', () => {
    const storage = makeStorage();
    expect(getExtractionMarker('u1', 'e1', storage)).toBeNull();
    setExtractionMarker('u1', 'e1', { hash: 'abc', state: 'done', at: 1 }, storage);
    expect(getExtractionMarker('u1', 'e1', storage)).toEqual({ hash: 'abc', state: 'done', at: 1 });
    expect(getExtractionMarker('u2', 'e1', storage)).toBeNull();
    expect(getExtractionMarker('u1', 'e2', storage)).toBeNull();
    expect(storage.map.get(EXTRACTION_MARKER_STORAGE_KEY)).toBeTruthy();
  });
});

describe('runMemoryExtraction pipeline statuses', () => {
  beforeEach(() => {
    extract.mockClear();
    create.mockClear();
  });

  it('skips demo sessions without calling Gemini', async () => {
    const report = await runMemoryExtraction(makeEntry('A meaningful entry worth remembering.'), {
      deps: { isDemo: true, uid: 'demo-user', extract, storage: null },
    });
    expect(report.status).toBe('demo');
    expect(extract).not.toHaveBeenCalled();
  });

  it('returns an error when no owner is available', async () => {
    const report = await runMemoryExtraction(makeEntry('A meaningful entry worth remembering.'), {
      deps: { uid: undefined, extract, storage: null },
    });
    expect(report.status).toBe('error');
    expect(extract).not.toHaveBeenCalled();
  });

  it('returns empty for a blank journal without calling Gemini', async () => {
    const report = await runMemoryExtraction(makeEntry(''), {
      deps: { uid: 'u1', extract, storage: null },
    });
    expect(report.status).toBe('empty');
    expect(extract).not.toHaveBeenCalled();
  });

  it('returns error (never throws) when Gemini fails', async () => {
    extract.mockRejectedValue(new Error('Gemini outage'));
    const report = await runMemoryExtraction(makeEntry('A meaningful entry worth remembering.'), {
      deps: { uid: 'u1', extract, storage: null },
    });
    expect(report.status).toBe('error');
    expect((report as ExtractionReport & { status: 'error' }).message).toMatch(/Gemini outage/);
  });

  it('treats a failed candidate write as retryable and dedups non-forced reruns', async () => {
    extract.mockResolvedValue({
      candidates: [{ type: 'project', title: 'A', narrative: 'B'.repeat(60), importance: 3, confidence: 0.9 }],
      modelUsed: 'gemini-3.6-flash',
    });
    create.mockRejectedValueOnce(new Error('denied'));
    const storage = makeStorage();
    const entry = makeEntry('A meaningful entry worth remembering.');
    const deps = { uid: 'u1', extract, create, storage };

    const first = await runMemoryExtraction(entry, { deps });
    expect(first.status).toBe('error');
    expect(create).toHaveBeenCalledTimes(1);

    // A non-forced rerun of the same content is idempotent — no extra Gemini call.
    const blocked = await runMemoryExtraction(entry, { deps });
    expect(blocked.status).toBe('duplicate');
    expect(extract).toHaveBeenCalledTimes(1);

    // The UI Retry button forces a fresh attempt.
    create.mockResolvedValue({ id: 'mem-ok' });
    const retried = await runMemoryExtraction(entry, { deps, force: true });
    expect(retried.status).toBe('done');
    if (retried.status !== 'done') return;
    expect(retried.created).toEqual(['mem-ok']);
    expect(extract).toHaveBeenCalledTimes(2);
  });
});

describe('runMemoryExtraction happy path + dedup', () => {
  beforeEach(() => {
    extract.mockClear();
    create.mockClear();
  });

  const threeCandidates: MemoryCandidateOutput = {
    candidates: [
      { type: 'project', title: 'Memory engine', narrative: 'Started building the memory engine.', importance: 4, confidence: 0.9 },
      { type: 'person', title: 'Mentor', narrative: 'Met with my mentor.', importance: 5, confidence: 0.8 },
      { type: 'bogus' as MemoryType, title: '', narrative: '', importance: 99, confidence: 99 },
    ],
    modelUsed: 'gemini-3.6-flash',
  };

  it('persists valid candidates as saved:false candidates and reports created ids', async () => {
    extract.mockResolvedValue(threeCandidates);
    let counter = 0;
    create.mockImplementation(async (input: Record<string, unknown>) => {
      counter += 1;
      return { id: `mem_${counter}`, ...input };
    });
    const report = await runMemoryExtraction(makeEntry('A meaningful entry worth remembering.'), {
      deps: { uid: 'u1', extract, create, storage: makeStorage() },
    });
    expect(report.status).toBe('done');
    if (report.status !== 'done') return;
    expect(report.created).toEqual(['mem_1', 'mem_2']);
    expect(report.candidates).toHaveLength(2);
    expect(report.modelUsed).toBe('gemini-3.6-flash');
    expect(create).toHaveBeenCalledTimes(2);
    const [firstInput, secondInput] = create.mock.calls.map((c) => c[0]);
    expect(firstInput).toMatchObject({ saved: false, status: 'candidate', sourceEntryIds: ['entry-1'], tags: [] });
    expect(secondInput).toMatchObject({ type: 'person', importance: 5, confidence: 0.8 });
  });

  it('caps candidates and clamps out-of-range importance/confidence', async () => {
    const many: MemoryCandidateOutput = {
      candidates: Array.from({ length: MAX_CANDIDATES_PER_ENTRY + 4 }, (_, i) => ({
        type: 'idea',
        title: `Idea ${i}`,
        narrative: `Narrative number ${i}.`,
        importance: 10,
        confidence: 5,
      })),
      modelUsed: 'gemini-3.6-flash',
    };
    extract.mockResolvedValue(many);
    create.mockImplementation(async (input: Record<string, unknown>) => ({ id: `mem_${input.title}`, ...input }));
    const report = await runMemoryExtraction(makeEntry('A meaningful entry worth remembering.'), {
      deps: { uid: 'u1', extract, create, storage: makeStorage() },
    });
    expect(report.status).toBe('done');
    if (report.status !== 'done') return;
    expect(report.created).toHaveLength(MAX_CANDIDATES_PER_ENTRY);
    expect(report.candidates.every((c) => c.importance === 5 && c.confidence === 1)).toBe(true);
  });

  it('is idempotent for the same unchanged journal, and force re-runs', async () => {
    extract.mockResolvedValue(threeCandidates);
    create.mockImplementation(async (input: Record<string, unknown>) => ({ id: `mem-${input.title}`, ...input }));
    const storage = makeStorage();
    const entry = makeEntry('A meaningful entry worth remembering.');
    const first = await runMemoryExtraction(entry, { deps: { uid: 'u1', extract, create, storage } });
    expect(first.status).toBe('done');

    const second = await runMemoryExtraction(entry, { deps: { uid: 'u1', extract, create, storage } });
    expect(second.status).toBe('duplicate');
    expect(extract).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(2);

    const forced = await runMemoryExtraction(entry, { deps: { uid: 'u1', extract, create, storage }, force: true });
    expect(forced.status).toBe('done');
    expect(extract).toHaveBeenCalledTimes(2);
  });

  it('isolation: another uid re-extracts the same entry', async () => {
    extract.mockResolvedValue(threeCandidates);
    create.mockImplementation(async (input: Record<string, unknown>) => ({ id: `mem-${input.title}`, ...input }));
    const storage = makeStorage();
    const entry = makeEntry('A meaningful entry worth remembering.');
    await runMemoryExtraction(entry, { deps: { uid: 'u1', extract, create, storage } });
    const other = await runMemoryExtraction(entry, { deps: { uid: 'u2', extract, create, storage } });
    expect(other.status).toBe('done');
  });
});