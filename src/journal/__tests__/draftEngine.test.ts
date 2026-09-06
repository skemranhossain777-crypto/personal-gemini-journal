import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JournalEntry } from '../../data';
import { emptyDraft, normalizeDraftForSave, deriveTitleFromBody, isUntouched } from '../types';
import { DraftEngine, type DraftEngineOptions } from '../draftEngine';
import type { JournalStore } from '../types';

interface MockStorage {
  map: Map<string, string>;
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
}

function makeStorage(): MockStorage {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  const base: JournalEntry = emptyEntry();
  return { ...base, ...overrides, tags: [...(overrides.tags ?? base.tags)] };
}

function emptyEntry(): JournalEntry {
  return {
    id: 'e1',
    uid: 'u1',
    title: 'T',
    body: '',
    mode: 'free-write' as const,
    mood: null,
    energy: null,
    tags: [],
    location: null,
    attachments: [],
    favorite: false,
    archived: false,
    private: false,
    aiMetadata: null,
    createdAt: { seconds: 1, nanoseconds: 0 } as JournalEntry['createdAt'],
    updatedAt: { seconds: 1, nanoseconds: 0 } as JournalEntry['updatedAt'],
  };
}

function createMockStore(): JournalStore & { calls: { creates: number; updates: string[]; removed: string[] } } {
  const calls = { creates: 0, updates: [] as string[], removed: [] as string[] };
  let counter = 0;
  const rows = new Map<string, JournalEntry>();
  const store: JournalStore = {
    kind: 'local',
    async create(input) {
      calls.creates++;
      const entry = makeEntry({ ...input, id: `mock-${++counter}`, uid: 'u1', tags: [...input.tags] });
      rows.set(entry.id, entry);
      return entry;
    },
    async update(id, draft) {
      calls.updates.push(id);
      const existing = rows.get(id) ?? makeEntry({ id, uid: 'u1' });
      const entry = { ...existing, ...draft, id, tags: [...draft.tags] };
      rows.set(id, entry);
      return entry;
    },
    async get(id) {
      const row = rows.get(id);
      if (!row) throw new Error('not found');
      return row;
    },
    async remove(id) {
      calls.removed.push(id);
      rows.delete(id);
    },
    async list() {
      return [...rows.values()];
    },
    subscribe() {
      return () => {};
    },
  };
  return { ...store, calls };
}

function makeEngine(store: JournalStore, opts: Partial<DraftEngineOptions> = {}) {
  const engine = new DraftEngine({
    store,
    storage: makeStorage(),
    storageNamespace: 'u1',
    debounceMs: 0,
    maxRetries: 1,
    retryBaseMs: 1,
    ...opts,
  });
  engine.setMounted(true);
  return engine;
}

describe('deriving titles from a free-write body', () => {
  it('uses the first non-empty line', () => {
    expect(deriveTitleFromBody('Today I\nwent for a walk')).toBe('Today I');
  });
  it('falls back to Untitled entry', () => {
    expect(deriveTitleFromBody('   \n\n ')).toBe('Untitled entry');
  });
  it('caps at the title limit', () => {
    const long = 'x'.repeat(250);
    expect(deriveTitleFromBody(long).length).toBe(200);
  });
});

describe('normalizeDraftForSave', () => {
  it('fills an empty title from the body', () => {
    const draft = { ...emptyDraft(), title: '', body: 'Hello world' };
    expect(normalizeDraftForSave(draft).title).toBe('Hello world');
  });
  it('trims the title and does not mutate input', () => {
    const draft = { ...emptyDraft(), title: '  My  title ' };
    const out = normalizeDraftForSave(draft);
    expect(out.title).toBe('My  title');
    expect(draft.title).toBe('  My  title ');
  });
});

describe('isUntouched', () => {
  it('is true for a pristine draft', () => {
    expect(isUntouched(emptyDraft())).toBe(true);
  });
  it('is false once the body has text', () => {
    expect(isUntouched({ ...emptyDraft(), body: 'x' })).toBe(false);
  });
});

describe('DraftEngine – create flow', () => {
  it('creates a new entry on the store and reports saved', async () => {
    const store = createMockStore();
    const engine = makeEngine(store);
    engine.setFields({ body: 'First entry' });
    const ok = await engine.flush();
    expect(ok).toBe(true);
    expect(store.calls.creates).toBe(1);
    expect(engine.snapshot.status).toBe('saved');
    expect(engine.targetEntryId).toBe('mock-1');
    expect(engine.snapshot.entryId).toBe('mock-1');
  });

  it('does not create the store entry for an untouched draft', async () => {
    const store = createMockStore();
    const engine = makeEngine(store);
    await engine.flush();
    expect(store.calls.creates).toBe(0);
  });

  it('updates an existing entry after creation', async () => {
    const store = createMockStore();
    const engine = makeEngine(store);
    engine.setFields({ body: 'First' });
    await engine.flush();
    engine.setFields({ body: 'First, then more' });
    const ok = await engine.flush();
    expect(ok).toBe(true);
    expect(store.calls.updates.length).toBe(1);
    expect(store.calls.creates).toBe(1);
  });

  it('never drops the newest text typed during an in-flight save', async () => {
    const store = createMockStore();
    let resolveUpdate!: (e: JournalEntry) => void;
    const hangUpdate = new Promise<JournalEntry>((resolve) => {
      resolveUpdate = resolve;
    });
    let updateCount = 0;
    const origUpdate = store.update.bind(store);
    store.update = async (id, draft) => {
      updateCount++;
      if (updateCount === 1) return hangUpdate; // first update hangs
      return origUpdate(id, draft);
    };

    const engine = makeEngine(store);
    engine.setFields({ body: 'one' });
    await engine.flush(); // create lands (id stabilized)
    engine.setFields({ body: 'two' });
    const pending = engine.flush(); // starts the hanging update
    engine.setFields({ body: 'three' }); // typed while save is in flight
    resolveUpdate(makeEntry({ id: engine.targetEntryId!, body: 'two' }));
    await pending;
    const saved = (await store.get(engine.targetEntryId!)).body;
    expect(saved).toBe('three');
    // The hanging 'two' update never reached the store; only the 'three' save did.
    expect(store.calls.updates).toEqual([engine.targetEntryId]);
  });

  it('retries with backoff and ultimately succeeds', async () => {
    vi.useFakeTimers();
    try {
      const store = createMockStore();
      let attempts = 0;
      const origCreate = store.create.bind(store);
      store.create = async (input) => {
        attempts++;
        if (attempts === 1) throw new Error('network unavailable');
        return origCreate(input);
      };
      const engine = makeEngine(store, { maxRetries: 3, retryBaseMs: 10 });
      engine.setFields({ body: 'retry me' });
      await vi.advanceTimersByTimeAsync(1); // fire the debounce → first attempt
      expect(attempts).toBe(1);
      expect(store.calls.creates).toBe(0); // the failed attempt never reached the store
      expect(engine.snapshot.status).toBe('error');
      expect(engine.snapshot.lastSavedAt).toBeNull();
      await vi.advanceTimersByTimeAsync(10); // fire the backoff retry
      expect(attempts).toBe(2);
      expect(store.calls.creates).toBe(1);
      expect(engine.snapshot.status).toBe('saved');
      expect(engine.snapshot.lastSavedAt).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('surfaces an error status when saves keep failing', async () => {
    const store = createMockStore();
    store.create = async () => {
      throw new Error('boom');
    };
    const engine = makeEngine(store, { maxRetries: 0 });
    engine.setFields({ body: 'doomed' });
    const ok = await engine.flush();
    expect(ok).toBe(false);
    expect(engine.snapshot.status).toBe('error');
    expect(engine.snapshot.error).toContain('boom');
  });
});

describe('DraftEngine – local persistence (crash recovery)', () => {
  it('persists every mutation to storage synchronously', () => {
    const store = createMockStore();
    const storage = makeStorage();
    const engine = new DraftEngine({ store, storage, storageNamespace: 'u1', debounceMs: 0 });
    engine.setMounted(true);
    engine.setFields({ body: 'crash here' });
    const raw = [...storage.map.entries()].find(([k]) => k.includes('new'))?.[1];
    expect(raw).toBeTruthy();
    const record = JSON.parse(raw!);
    expect(record.fields.body).toBe('crash here');
  });

  it('restores a newer local draft over the server entry (recovered)', () => {
    const store = createMockStore();
    const storage = makeStorage();
    // Seed a local record that was edited after its last save.
    const record = {
      version: 1,
      entryId: 'e1',
      fields: { ...emptyDraft(), body: 'local newer text' },
      draftUpdatedAt: 2000,
      savedAt: 1000,
    };
    storage.setItem('gemini_journal_drafts_v1__u1__e1', JSON.stringify(record));
    const engine = new DraftEngine({ store, storage, storageNamespace: 'u1', debounceMs: 0 });
    engine.setMounted(true);
    engine.hydrate(makeEntry({ id: 'e1', body: 'server older text' }), 'e1');
    expect(engine.fields.body).toBe('local newer text');
    expect(engine.didRecover()).toBe(true);
    expect(engine.snapshot.status).toBe('dirty');
  });

  it('adopts the server entry when no newer local draft exists', () => {
    const store = createMockStore();
    const storage = makeStorage();
    const engine = new DraftEngine({ store, storage, storageNamespace: 'u1', debounceMs: 0 });
    engine.setMounted(true);
    engine.hydrate(makeEntry({ id: 'e1', body: 'server text' }), 'e1');
    expect(engine.fields.body).toBe('server text');
    expect(engine.didRecover()).toBe(false);
    expect(engine.snapshot.status).toBe('saved');
  });

  it('drops a stale local record when the user is editing a clean server entry', () => {
    const store = createMockStore();
    const storage = makeStorage();
    const stale = {
      version: 1,
      entryId: null,
      fields: { ...emptyDraft() },
      draftUpdatedAt: 1000,
      savedAt: 2000, // no newer edits → not worth recovering
    };
    storage.setItem('gemini_journal_drafts_v1__u1__new', JSON.stringify(stale));
    const engine = new DraftEngine({ store, storage, storageNamespace: 'u1', debounceMs: 0 });
    engine.setMounted(true);
    engine.hydrate(null, null);
    expect([...storage.map.keys()].some((k) => k.includes('new'))).toBe(false);
  });
});

describe('DraftEngine – connectivity', () => {
  it('marks drafts dirty (not error) when offline, then flushes on reconnect', async () => {
    const store = createMockStore();
    const engine = makeEngine(store);
    engine.handleConnectivity(false);
    engine.setFields({ body: 'offline writing' });
    const ok = await engine.flush();
    expect(ok).toBe(false);
    expect(engine.snapshot.isOffline).toBe(true);
    expect(store.calls.creates).toBe(0);
    // Reconnect → auto-flush pushes the draft.
    engine.handleConnectivity(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(store.calls.creates).toBe(1);
    expect(engine.snapshot.status).toBe('saved');
  });

  it('persists local draft while offline (no data loss)', () => {
    const store = createMockStore();
    const storage = makeStorage();
    const engine = new DraftEngine({ store, storage, storageNamespace: 'u1', debounceMs: 0 });
    engine.setMounted(true);
    engine.handleConnectivity(false);
    engine.setFields({ body: 'safe offline text' });
    const raw = [...storage.map.values()].find((v) => v.includes('offline text'));
    expect(raw).toBeTruthy();
  });
});

describe('DraftEngine – delete-aware clearing', () => {
  it('clearDraft removes the stored draft', () => {
    const store = createMockStore();
    const storage = makeStorage();
    const engine = new DraftEngine({ store, storage, storageNamespace: 'u1', debounceMs: 0 });
    engine.setMounted(true);
    engine.setFields({ body: 'to be cleared' });
    expect([...storage.map.keys()].some((k) => k.includes('new'))).toBe(true);
    engine.clearDraft();
    expect([...storage.map.keys()].some((k) => k.includes('new'))).toBe(false);
  });
});
