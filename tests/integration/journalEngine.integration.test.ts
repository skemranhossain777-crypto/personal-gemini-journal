// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, setLogLevel } from 'firebase/firestore';
import { createCollectionApi, type CollectionApi, type JournalEntry } from '../../src/data';
import { validateJournalEntryInput } from '../../src/data/validation';
import { createFirestoreJournalStore } from '../../src/journal/store';
import { DraftEngine } from '../../src/journal/draftEngine';
import { isUntouched } from '../../src/journal/types';

// The integration suite runs on the SAME emulator process (127.0.0.1:8080) but
// under its own project id, so its clearFirestore()/rules upload never races the
// security-rules suite (which drives `demo-firestore-rules` concurrently).
const PROJECT_ID = 'demo-journal-integration';
const OWNER = 'alice';

const here = dirname(fileURLToPath(import.meta.url));
const rulesText = readFileSync(resolve(here, '../../firestore.rules'), 'utf8');

const INPUT_KEYS = [
  'title',
  'body',
  'mode',
  'mood',
  'energy',
  'tags',
  'location',
  'attachments',
  'favorite',
  'archived',
  'private',
  'aiMetadata',
] as const;

interface MemoryStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function makeStorage(): MemoryStorage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readEntry(api: CollectionApi<JournalEntry>, id: string): Promise<JournalEntry> {
  return api.get(id);
}

let testEnv: RulesTestEnvironment;
let ownerDb: import('firebase/firestore').Firestore;
let api: CollectionApi<JournalEntry>;
let storage: MemoryStorage;
let storageNamespace: string;
let engine: DraftEngine;

function makeEngine(overrides: { requestedId?: string | null; server?: JournalEntry | null; debounceMs?: number } = {}): DraftEngine {
  const e = new DraftEngine({
    store: createFirestoreJournalStore(api),
    storage,
    storageNamespace,
    debounceMs: overrides.debounceMs ?? 60_000,
  });
  e.hydrate(overrides.server ?? null, overrides.requestedId ?? null);
  return e;
}

describe('journal engine — Firestore emulator integration', () => {
  beforeAll(async () => {
    setLogLevel('silent');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: rulesText,
      },
    });
    ownerDb = testEnv
      .authenticatedContext(OWNER, {})
      .firestore() as unknown as import('firebase/firestore').Firestore;
    api = createCollectionApi<JournalEntry>(
      {
        name: 'journalEntries',
        validateInput: validateJournalEntryInput,
        createKeys: INPUT_KEYS,
        updateKeys: INPUT_KEYS,
      },
      { db: ownerDb, uid: OWNER },
    );
    storage = makeStorage();
    storageNamespace = OWNER;
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    storage = makeStorage();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('creates a new entry through the engine and round-trips with server timestamps', async () => {
    engine = makeEngine();
    engine.setFields({ title: 'A real round trip', body: 'written over the wire', tags: ['emulator'] });

    const ok = await engine.ensureSaved();

    if (!ok) {
      expect.fail(`first save failed: ${JSON.stringify(engine.snapshot)}`);
    }
    expect(ok).toBe(true);
    expect(engine.snapshot.status).toBe('saved');
    expect(engine.targetEntryId).not.toBeNull();

    const id = engine.targetEntryId!;
    const doc = await readEntry(api, id);
    expect(doc.id).toBe(id);
    expect(doc.uid).toBe(OWNER);
    expect(doc.title).toBe('A real round trip');
    expect(doc.body).toBe('written over the wire');
    expect(doc.tags).toEqual(['emulator']);
    expect(doc.createdAt).toBeInstanceOf(Timestamp);
    expect(doc.updatedAt).toBeInstanceOf(Timestamp);
    expect(engine.snapshot.lastSavedAt).not.toBeNull();

    const listed = await api.list({ limit: 10 });
    expect(listed.items.some((e) => e.id === id)).toBe(true);
  });

  it('coalesces rapid edits so the newest text always wins over an in-flight save', async () => {
    engine = makeEngine();
    engine.setFields({ title: 'start', body: 'A' });

    const first = engine.flush();
    engine.setFields({ body: 'B' });
    const ok = await first;

    expect(ok).toBe(true);
    const doc = await readEntry(api, engine.targetEntryId!);
    expect(doc.body).toBe('B');

    // A trailing save must reflect the very latest bytes, never an older snapshot.
    await engine.ensureSaved();
    const after = await readEntry(api, engine.targetEntryId!);
    expect(after.body).toBe('B');
  });

  it('updates an existing entry in place without rewriting its createdAt', async () => {
    engine = makeEngine();
    engine.setFields({ title: 'Original', body: 'first words' });
    await engine.ensureSaved();
    const id = engine.targetEntryId!;
    const createdAt = (await readEntry(api, id)).createdAt;

    engine.setFields({ body: 'revised words' });
    await engine.ensureSaved();

    const doc = await readEntry(api, id);
    expect(doc.id).toBe(id);
    expect(doc.body).toBe('revised words');
    expect(doc.createdAt).toEqual(createdAt);
  });

  it('recovers the newest local text over a stale server doc and flushes it', async () => {
    engine = makeEngine();
    engine.setFields({ title: 'Recovery', body: 'Draft line 1' });
    await engine.ensureSaved();
    const id = engine.targetEntryId!;

    // "Crash": newer text lands locally but never reaches the server. (Sleep so
    // the mirror's savedAt/draftUpdatedAt land in distinct real milliseconds.)
    await sleep(10);
    engine.setFields({ body: 'Draft line 1\nline 2' });

    // Fresh engine over the same mirror storage + the stale server doc.
    const staleServer = (await readEntry(api, id)) as JournalEntry;
    const engine2 = makeEngine({ requestedId: id, server: staleServer });

    expect(engine2.didRecover()).toBe(true);
    expect(engine2.snapshot.status).toBe('dirty');
    expect(engine2.fields.body).toBe('Draft line 1\nline 2');

    const ok = await engine2.ensureSaved();
    expect(ok).toBe(true);
    const doc = await readEntry(api, id);
    expect(doc.body).toBe('Draft line 1\nline 2');
  });

  it('adopts the server state when the local mirror has nothing newer', async () => {
    engine = makeEngine();
    engine.setFields({ title: 'Adopt', body: 'server truth' });
    await engine.ensureSaved();
    const id = engine.targetEntryId!;

    const serverDoc = (await readEntry(api, id)) as JournalEntry;
    const engine2 = makeEngine({ requestedId: id, server: serverDoc });

    expect(engine2.didRecover()).toBe(false);
    expect(engine2.snapshot.status).toBe('saved');
    expect(engine2.fields.body).toBe('server truth');
    expect(engine2.fields.title).toBe('Adopt');
    expect(isUntouched(engine2.fields)).toBe(false);
  });

  it('preserves a newer local draft even when the server doc is gone (re-create on save)', async () => {
    engine = makeEngine();
    engine.setFields({ title: 'Tenacious', body: 'kept locally' });
    await engine.ensureSaved();
    const id = engine.targetEntryId!;
    await api.remove(id);

    engine.setFields({ body: 'kept locally — updated' });
    const engine2 = makeEngine({ requestedId: id, server: null });

    expect(engine2.didRecover()).toBe(true);
    expect(engine2.fields.body).toBe('kept locally — updated');
    expect(engine2.snapshot.entryId).toBeNull();

    const ok = await engine2.ensureSaved();
    expect(ok).toBe(true);
    expect(engine2.targetEntryId).not.toBeNull();
    const doc = await readEntry(api, engine2.targetEntryId!);
    expect(doc.uid).toBe(OWNER);
    expect(doc.body).toBe('kept locally — updated');
  });

  it('lists entries newest-created first, reflecting later edits in place', async () => {
    const e1 = makeEngine();
    e1.setFields({ title: 'First', body: 'one' });
    await e1.ensureSaved();
    const id1 = e1.targetEntryId!;

    const e2 = makeEngine();
    e2.setFields({ title: 'Second', body: 'two' });
    await e2.ensureSaved();

    await sleep(30);
    e1.setFields({ body: 'one, revised' });
    expect(await e1.ensureSaved()).toBe(true);

    // The Firestore listing is ordered by createdAt (newest entry first); an
    // edit updates the stored document in place without reordering it.
    const { items } = await api.list({ limit: 10 });
    expect(items.map((i) => i.title)).toEqual(['Second', 'First']);
    expect(items.some((i) => i.id === id1 && i.body === 'one, revised')).toBe(true);
  });
});