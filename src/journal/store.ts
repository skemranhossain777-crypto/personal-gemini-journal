import { journalEntriesApi, type CollectionApi, type JournalEntry } from '../data';
import { validateJournalEntryInput } from '../data/validation';
import { toPlain } from './format';
import type { JournalDraft, JournalStore } from './types';

/**
 * Firestore-backed JournalStore. Wraps the owner-scoped `journalEntriesApi`
 * (users/{uid}/journalEntries). The collection API stamps `createdAt` /
 * `updatedAt` server-side and forbids client timestamps, so writes send only
 * the user-controllable fields.
 */
export function createFirestoreJournalStore(api: CollectionApi<JournalEntry> = journalEntriesApi): JournalStore {
  return {
    kind: 'firestore',
    async create(input) {
      return api.create(normalizeInput(input));
    },
    async update(id, draft) {
      return api.update(id, normalizeInput(draft));
    },
    async get(id) {
      return api.get(id);
    },
    async remove(id) {
      return api.remove(id);
    },
    async list() {
      return (await api.list({ limit: 500 })).items;
    },
    subscribe(onUpdate, onError) {
      return api.subscribe(onUpdate, onError);
    },
  };
}

function normalizeInput(draft: JournalDraft): Record<string, unknown> {
  return {
    title: draft.title,
    body: draft.body,
    mode: draft.mode,
    mood: draft.mood,
    energy: draft.energy,
    tags: draft.tags,
    location: draft.location ? { ...draft.location } : null,
    attachments: draft.attachments,
    favorite: draft.favorite,
    archived: draft.archived,
    private: draft.private,
    // `aiMetadata` must be present as null: rules evaluate the missing field as
    // `undefined`, and `undefined == null` is FALSE in the rules language, so
    // omitting the key would deny every journal write.
    aiMetadata: null,
  };
}

/**
 * Demo-mode JournalStore. Persists to localStorage keyed per user so a demo
 * session still gets the full journal experience with no network. Timestamps
 * are stored structurally (`{ seconds, nanoseconds }`) and rehydrated so the
 * rest of the UI can render them.
 */
export function createDemoJournalStore(uid: string): JournalStore {
  const bucket = `gemini_journal_entries_demo_${uid}`;
  let lastWriteMs = 0;

  // Date.now() has millisecond resolution and is not monotonic; rapid writes
  // (e.g. back-to-back autosaves) can land in the same millisecond and break
  // "most recently updated" ordering. Clamp to strictly-increasing times.
  function nowTs(): { seconds: number; nanoseconds: number } {
    const raw = Date.now();
    const ms = raw > lastWriteMs ? raw : lastWriteMs + 1;
    lastWriteMs = ms;
    const seconds = Math.floor(ms / 1000);
    return { seconds, nanoseconds: (ms - seconds * 1000) * 1e6 };
  }

  function readAll(): JournalEntry[] {
    try {
      const raw = localStorage.getItem(bucket);
      if (!raw) return [];
      const rows = JSON.parse(raw) as unknown[];
      if (!Array.isArray(rows)) return [];
      return rows
        .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
        .map((r) => ({
          ...r,
          id: String(r.id ?? ''),
          uid: String(r.uid ?? ''),
          tags: Array.isArray(r.tags) ? r.tags : [],
          attachments: Array.isArray(r.attachments) ? r.attachments : [],
        }) as unknown as JournalEntry);
    } catch {
      return [];
    }
  }

  function writeAll(rows: JournalEntry[]): void {
    localStorage.setItem(bucket, JSON.stringify(rows));
  }

  function nextId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `demo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function buildEntry(id: string, draft: JournalDraft): JournalEntry {
    const now = toPlain(nowTs());
    const entry: JournalEntry = {
      id,
      uid,
      title: draft.title,
      body: draft.body,
      mode: draft.mode,
      mood: draft.mood,
      energy: draft.energy,
      tags: [...draft.tags],
      location: draft.location ? { ...draft.location } : null,
      attachments: [...draft.attachments],
      favorite: draft.favorite,
      archived: draft.archived,
      private: draft.private,
      aiMetadata: null,
      createdAt: now as JournalEntry['createdAt'],
      updatedAt: now as JournalEntry['updatedAt'],
    };
    const validated = validateJournalEntryInput(stripPedigree(entry));
    if (!validated.ok) throw new Error(validated.errors.join(' '));
    return entry;
  }

  return {
    kind: 'local',
    async create(input) {
      const entry = buildEntry(nextId(), input);
      const rows = readAll();
      rows.unshift(entry);
      writeAll(rows);
      return entry;
    },
    async update(id, draft) {
      const rows = readAll();
      const idx = rows.findIndex((r) => r.id === id);
      if (idx === -1) throw new Error(`Entry '${id}' no longer exists.`);
      const now = toPlain(nowTs());
      const updated: JournalEntry = {
        ...rows[idx],
        ...draft,
        tags: [...draft.tags],
        attachments: [...draft.attachments],
        location: draft.location ? { ...draft.location } : null,
        updatedAt: now as JournalEntry['updatedAt'],
      };
      const validated = validateJournalEntryInput(stripPedigree(updated));
      if (!validated.ok) throw new Error(validated.errors.join(' '));
      rows[idx] = updated;
      writeAll(rows);
      return updated;
    },
    async get(id) {
      const row = readAll().find((r) => r.id === id);
      if (!row) throw new Error(`Entry '${id}' not found.`);
      return row;
    },
    async remove(id) {
      writeAll(readAll().filter((r) => r.id !== id));
    },
    async list() {
      return readAll().sort(byUpdatedDesc);
    },
    subscribe(onUpdate) {
      queueMicrotask(() => onUpdate(readAll().sort(byUpdatedDesc)));
      return () => {};
    },
  };
}

function stripPedigree(entry: JournalEntry): Record<string, unknown> {
  const { id: _id, uid: _uid, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = entry;
  return rest;
}

function byUpdatedDesc(a: JournalEntry, b: JournalEntry): number {
  return updatedMillis(b) - updatedMillis(a);
}

function updatedMillis(e: JournalEntry): number {
  const t = e.updatedAt as { seconds?: number; nanoseconds?: number } | null | undefined;
  if (!t?.seconds) return 0;
  return t.seconds * 1000 + Math.floor((t.nanoseconds ?? 0) / 1e6);
}
