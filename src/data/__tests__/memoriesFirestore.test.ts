import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Firebase SDK modules BEFORE importing data layer
const authMock = {
  currentUser: null as { uid: string } | null,
};

vi.mock('../../services/firebase', () => {
  const db = { _mocked: true };
  return {
    getDbInstance: () => db,
    getAuthInstance: () => authMock,
  };
});

let autoCounter = 0;

vi.mock('firebase/firestore', () => {
  const store = new Map<string, Record<string, unknown>>();
  const separators = (segments: string[]) => segments.join('/');

  return {
    collection: (...segments: string[]) => ({ kind: 'collection', path: separators(segments) }),
    doc: (base: unknown, ...rest: unknown[]) => {
      const parts = (base && typeof base === 'object' && 'segments' in base ? (base.segments as unknown[]) : [base]) as string[];
      const all = [...parts, ...(rest as string[])];
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
      store.set(ref.path, data);
    },
    updateDoc: async (ref: { path: string }, patch: Record<string, unknown>) => {
      const current = store.get(ref.path) ?? {};
      store.set(ref.path, { ...current, ...patch });
    },
    deleteDoc: async (ref: { path: string }) => {
      store.delete(ref.path);
    },
    getDoc: async (ref: { path: string; id: string }) => ({
      exists: () => store.has(ref.path),
      data: () => store.get(ref.path),
      id: ref.id,
    }),
    getDocs: async () => ({
      docs: [...store.values()].map((d) => ({ id: d.id, data: () => d })),
    }),
    onSnapshot: () => () => {},
  };
});

import {
  memoriesApi,
  saveMemory,
  ignoreMemory,
  forgetMemory,
  deleteMemory,
} from '../services/memories';

function signInAs(uid: string) {
  authMock.currentUser = { uid };
}

describe('Personal Memory Engine — Firestore Lifecycle & Deletion Integrity', () => {
  const uid = 'user_test_memory_owner';

  beforeEach(() => {
    signInAs(uid);
  });

  // 1. Candidate Creation & Initial Un-saved State
  it('creates memory candidate in candidate status (saved: false)', async () => {
    const memory = await memoriesApi.create({
      type: 'project',
      title: 'JOURNAL∞ Memory Engine',
      narrative: 'Extracted memory candidate awaiting user review.',
      importance: 4,
      confidence: 0.92,
      sourceEntryIds: ['entry_abc123'],
      tags: ['Architecture', 'Memory'],
      saved: false,
      status: 'candidate',
      occurredAt: null,
    });

    expect(memory.id).toBeTruthy();
    expect(memory.uid).toBe(uid);
    expect(memory.saved).toBe(false);
    expect(memory.status).toBe('candidate');
    expect(memory.sourceEntryIds).toEqual(['entry_abc123']);
  });

  // 2. User Review Operation: Save Memory
  it('transitions memory candidate to saved status upon explicit user Save action', async () => {
    const created = await memoriesApi.create({
      type: 'person',
      title: 'Mentor Sarah',
      narrative: 'Met with Sarah for project guidance.',
      importance: 5,
      confidence: 0.95,
      sourceEntryIds: ['entry_xyz789'],
      tags: ['Mentorship'],
      saved: false,
      status: 'candidate',
      occurredAt: null,
    });

    const saved = await saveMemory(created.id);
    expect(saved.saved).toBe(true);
    expect(saved.status).toBe('saved');

    // Retrieve from store to confirm persistence
    const fetched = await memoriesApi.get(created.id);
    expect(fetched.saved).toBe(true);
    expect(fetched.status).toBe('saved');
  });

  // 3. User Review Operation: Ignore Memory
  it('transitions memory candidate to ignored status upon user Ignore action', async () => {
    const created = await memoriesApi.create({
      type: 'preference',
      title: 'Prefers Coffee in Morning',
      narrative: 'User mentioned morning coffee.',
      importance: 2,
      confidence: 0.7,
      sourceEntryIds: ['entry_coffee'],
      tags: ['Routine'],
      saved: false,
      status: 'candidate',
      occurredAt: null,
    });

    const ignored = await ignoreMemory(created.id);
    expect(ignored.saved).toBe(false);
    expect(ignored.status).toBe('ignored');
  });

  // 4. User Operation: Forget Memory (Un-save)
  it('transitions saved memory to forgotten status upon user Forget action', async () => {
    const created = await memoriesApi.create({
      type: 'goal',
      title: 'Temporary Goal',
      narrative: 'A goal that is no longer active.',
      importance: 3,
      confidence: 0.8,
      sourceEntryIds: ['entry_goal'],
      tags: ['Goal'],
      saved: true,
      status: 'saved',
      occurredAt: null,
    });

    const forgotten = await forgetMemory(created.id);
    expect(forgotten.saved).toBe(false);
    expect(forgotten.status).toBe('forgotten');
  });

  // 5. Permanent Deletion Integrity Test
  it('permanently deletes memory from store and verifies deletion integrity', async () => {
    const created = await memoriesApi.create({
      type: 'idea',
      title: 'Idea to be deleted',
      narrative: 'Temporary idea content.',
      importance: 1,
      confidence: 0.5,
      sourceEntryIds: ['entry_delete'],
      tags: ['Draft'],
      saved: false,
      status: 'candidate',
      occurredAt: null,
    });

    // Delete memory
    await deleteMemory(created.id);

    // Verify memory document no longer exists
    await expect(memoriesApi.get(created.id)).rejects.toThrow();

    const page = await memoriesApi.list();
    expect(page.items.some((m) => m.id === created.id)).toBe(false);
  });

  // 6. Memory Edit Operation
  it('updates memory fields (title, narrative, importance, type, tags)', async () => {
    const created = await memoriesApi.create({
      type: 'milestone',
      title: 'Original Milestone',
      narrative: 'Draft narrative.',
      importance: 3,
      confidence: 0.85,
      sourceEntryIds: ['entry_ms'],
      tags: ['Milestone'],
      saved: true,
      status: 'saved',
      occurredAt: null,
    });

    const updated = await memoriesApi.update(created.id, {
      title: 'Updated High-Impact Milestone',
      narrative: 'Refined narrative content after review.',
      importance: 5,
      tags: ['Milestone', 'HighImpact'],
    });

    expect(updated.title).toBe('Updated High-Impact Milestone');
    expect(updated.importance).toBe(5);
    expect(updated.tags).toEqual(['Milestone', 'HighImpact']);
  });
});
