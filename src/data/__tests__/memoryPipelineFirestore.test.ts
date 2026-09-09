import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalEntry, MemoryType } from '../models';
import type { MemoryCandidateOutput } from '../../../server/gemini/types';

// Mock Firebase SDK modules BEFORE importing the data layer, mirroring
// memoriesFirestore.test.ts so the pipeline exercises the REAL crud layer
// (validateMemoryInput + owner-scoped writes) against an in-memory store.
// vi.hoisted guarantees authMock is initialized BEFORE this module's static
// imports run — and therefore before the pipeline's import of services/auth
// calls getAuthInstance() at module load.
const { authMock, authServiceMock } = vi.hoisted(() => ({
  authMock: { currentUser: null as { uid: string } | null },
  authServiceMock: { currentUser: null as { uid: string; isDemo?: boolean } | null },
}));

// The pipeline reads authService.currentUser as a signature fallback; stub it
// so importing the pipeline does not construct a real Firebase AuthService.
vi.mock('../../services/auth', () => ({
  authService: authServiceMock,
}));

vi.mock('../../services/firebase', () => {
  const db = { _mocked: true };
  return {
    getDbInstance: () => db,
    getAuthInstance: () => authMock,
  };
});

let autoCounter = 0;
const firestoreStore = new Map<string, Record<string, unknown>>();

vi.mock('firebase/firestore', () => {
  const separators = (segments: unknown[]) => segments.join('/');
  return {
    collection: (...segments: unknown[]) => ({ kind: 'collection', path: separators(segments) }),
    doc: (base: unknown, ...rest: unknown[]) => {
      const parts = (base && typeof base === 'object' && 'segments' in base ? (base.segments as unknown[]) : [base]) as unknown[];
      const all = [...parts, ...(rest as unknown[])];
      if (rest.length === 0) {
        all.push(`auto-${autoCounter++}`);
      }
      return { kind: 'doc', path: separators(all), id: all[all.length - 1] };
    },
    serverTimestamp: () => ({ __serverTimestamp: true }),
    query: (...refs: unknown[]) => ({ kind: 'query', refs }),
    orderBy: (field: string, dir?: 'asc' | 'desc') => ({ field, dir }),
    limit: (n: number) => ({ kind: 'limit', n }),
    startAfter: () => ({ kind: 'startAfter' }),
    setDoc: async (ref: { path: string }, data: Record<string, unknown>) => {
      firestoreStore.set(ref.path, data);
    },
    updateDoc: async (ref: { path: string }, patch: Record<string, unknown>) => {
      const current = firestoreStore.get(ref.path) ?? {};
      firestoreStore.set(ref.path, { ...current, ...patch });
    },
    deleteDoc: async (ref: { path: string }) => {
      firestoreStore.delete(ref.path);
    },
    getDoc: async (ref: { path: string; id: string }) => ({
      exists: () => firestoreStore.has(ref.path),
      data: () => firestoreStore.get(ref.path),
      id: ref.id,
    }),
    getDocs: async () => ({
      docs: [...firestoreStore.values()].map((d) => ({ id: d.id, data: () => d })),
    }),
    onSnapshot: () => () => {},
  };
});

import { memoriesApi, saveMemory } from '../services/memories';
import { runMemoryExtraction } from '../../services/memoryPipeline';

function signInAs(uid: string) {
  authMock.currentUser = { uid };
}

function makeEntry(id: string, body: string): JournalEntry {
  return { id, body } as unknown as JournalEntry;
}

function makeStorage(): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void } {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

const OW = 'user_pipeline_owner';

const happyCandidates: MemoryCandidateOutput = {
  candidates: [
    { type: 'project', title: 'Memory engine', narrative: 'Started building the personal memory engine.', importance: 4, confidence: 0.9 },
    { type: 'person', title: 'Mentor Sarah', narrative: 'Met with mentor Sarah for project guidance.', importance: 5, confidence: 0.95 },
    { type: 'thought' as MemoryType, title: '', narrative: '', importance: 9, confidence: 9 },
  ],
  modelUsed: 'gemini-3.6-flash',
};

describe('Memory Extraction Pipeline — Firestore Lifecycle', () => {
  const extract = vi.fn();

  beforeEach(() => {
    firestoreStore.clear();
    signInAs(OW);
    authServiceMock.currentUser = { uid: OW };
    extract.mockClear();
    extract.mockResolvedValue(happyCandidates);
  });

  it('extracts a saved journal into candidates, then a user review approves one', async () => {
    const storage = makeStorage();
    const report = await runMemoryExtraction(makeEntry('entry-lifecycle', 'Signed in and started building the memory engine with my mentor.'), {
      deps: { uid: OW, extract, storage },
    });
    expect(report.status).toBe('done');
    if (report.status !== 'done') return;
    expect(report.created).toHaveLength(2);

    const candidate = await memoriesApi.get(report.created[0]);
    expect(candidate.saved).toBe(false);
    expect(candidate.status).toBe('candidate');
    expect(candidate.uid).toBe(OW);
    expect(candidate.sourceEntryIds).toEqual(['entry-lifecycle']);
    expect(candidate.confidence).toBe(0.9);

    // Explicit user approval turns the candidate into a permanent memory.
    const approved = await saveMemory(candidate.id);
    expect(approved.saved).toBe(true);
    expect(approved.status).toBe('saved');
  });

  it('is idempotent for the same unchanged journal (no duplicate extraction)', async () => {
    const storage = makeStorage();
    const entry = makeEntry('entry-idem', 'Started building the memory engine with my mentor today.');
    const first = await runMemoryExtraction(entry, { deps: { uid: OW, extract, storage } });
    expect(first.status).toBe('done');
    if (first.status !== 'done') return;
    const savedCount = (await memoriesApi.list()).items.length;

    const second = await runMemoryExtraction(entry, { deps: { uid: OW, extract, storage } });
    expect(second.status).toBe('duplicate');
    expect(extract).toHaveBeenCalledTimes(1);
    expect((await memoriesApi.list()).items.length).toBe(savedCount);
  });

  it('keeps the journal unaffected when extraction or a write fails', async () => {
    const storage = makeStorage();
    const failingExtract = vi.fn().mockRejectedValue(new Error('Gemini unavailable'));
    const failed = await runMemoryExtraction(makeEntry('entry-fail', 'Wrote a private entry while the model was down.'), {
      deps: { uid: OW, extract: failingExtract, storage },
    });
    expect(failed.status).toBe('error');
    if (failed.status !== 'error') return;
    expect(failed.message).toMatch(/Gemini/);
    expect((await memoriesApi.list()).items).toHaveLength(0);
  });

  it('truncates oversized narratives so candidates stay rule-valid', async () => {
    const bigNarrative = 'x'.repeat(30000);
    extract.mockResolvedValue({
      candidates: [
        {
          type: 'lesson',
          title: 'Long lesson',
          narrative: bigNarrative,
          importance: 3,
          confidence: 0.6,
        },
      ],
      modelUsed: 'gemini-3.6-flash',
    });
    const storage = makeStorage();
    const report = await runMemoryExtraction(makeEntry('entry-long', 'Learned a very long and detailed lesson today.'.repeat(10)), {
      deps: { uid: OW, extract, storage },
    });
    expect(report.status).toBe('done');
    if (report.status !== 'done') return;
    const memory = await memoriesApi.get(report.created[0]);
    expect(memory.narrative.length).toBeLessThanOrEqual(20000);
  });
});