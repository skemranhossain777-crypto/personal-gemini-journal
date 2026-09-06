import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Firebase SDK modules BEFORE importing the data layer so no real SDK
// init or network occurs in unit tests.
vi.mock('../../services/firebase', () => {
  const db = {
    _mocked: true,
  };
  return {
    getDbInstance: () => db,
    getAuthInstance: () => authMock,
  };
});

const authMock = {
  currentUser: null,
};

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
      store.set(ref.path, { ...(store.get(ref.path) ?? {}), ...patch });
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

let autoCounter = 0;

// Defer requiring the data layer until the mocks are installed.
import { DataError } from '../errors';
import { journalEntriesApi } from '../services/journalEntries';

function signInAs(uid: string) {
  authMock.currentUser = { uid };
}

describe('journalEntries CRUD — ownership + validation boundary', () => {
  beforeEach(() => {
    authMock.currentUser = null;
  });

  it('refuses create without a session (unauthenticated)', async () => {
    await expect(journalEntriesApi.create({ title: 'x' })).rejects.toBeInstanceOf(DataError);
    await expect(journalEntriesApi.create({ title: 'x' })).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('refuses demo-session writes (local-only demo must never hit the cloud)', async () => {
    signInAs('demo-local-user');
    await expect(journalEntriesApi.create({ title: 'x' })).rejects.toMatchObject({ code: 'demo-session' });
  });

  it('rejects non-owner-mutable fields on create (uid is derived, not caller-supplied)', async () => {
    signInAs('uid-1');
    // `uid` is not in createKeys, so supplying it is rejected — callers cannot
    // self-author a document as another user.
    await expect(
      journalEntriesApi.create({
        title: 'x',
        body: 'b',
        mode: 'free-write',
        uid: 'someone-else',
      }),
    ).rejects.toMatchObject({ code: 'invalid-data' });
  });

  it('replicates validation on write (invalid mode rejected client-side)', async () => {
    signInAs('uid-1');
    await expect(
      journalEntriesApi.create({ title: 'x', body: 'b', mode: 'garbage' }),
    ).rejects.toMatchObject({ code: 'invalid-data' });
  });

  it('rejects unsafe document ids that would allow path traversal', async () => {
    signInAs('uid-1');
    await expect(
      journalEntriesApi.create({ title: 'ok', body: '', mode: 'free-write', tags: [] }, { id: '../escape' }),
    ).rejects.toMatchObject({ code: 'invalid-data' });
  });
});