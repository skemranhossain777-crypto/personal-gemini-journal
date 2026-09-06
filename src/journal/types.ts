import type { Attachment, JournalEntry, JournalLocation, ReflectionMode } from '../data';

/**
 * Journal engine — core types for the autosave-driven free-writing experience.
 *
 * A "draft" is the user's working copy of one journal entry. It always exists
 * locally (mirrored to localStorage on every change) and is pushed to the
 * backing store (Firestore for signed-in users, localStorage for demo sessions)
 * through a serialize-and-never-drop autosave pipeline — see `DraftEngine`.
 */

/** Structural timestamp used when a real Firestore Timestamp object is not
 * available (local drafts, demo store rows, JSON snapshots). Firestore's
 * `Timestamp` is a superset (it has `seconds`/`nanoseconds` too), so drafts can
 * carry either and the store normalizes before writing. */
export interface PlainTimestamp {
  seconds: number;
  nanoseconds: number;
}

export type TimestampLike = PlainTimestamp | { seconds: number; nanoseconds: number; toDate: () => Date };

/** User-controllable fields of a journal entry (mirrors `JournalEntry` minus the
 * server-managed pedigree: id/uid/createdAt/updatedAt). */
export interface JournalDraft {
  title: string;
  body: string;
  mode: ReflectionMode;
  mood: number | null;
  energy: number | null;
  tags: string[];
  location: JournalLocation | null;
  attachments: Attachment[];
  favorite: boolean;
  archived: boolean;
  private: boolean;
}

export const DEFAULT_MODE: ReflectionMode = 'free-write';

export function emptyDraft(): JournalDraft {
  return {
    title: '',
    body: '',
    mode: DEFAULT_MODE,
    mood: null,
    energy: null,
    tags: [],
    location: null,
    attachments: [],
    favorite: false,
    archived: false,
    private: false,
  };
}

export function draftFromEntry(entry: JournalEntry): JournalDraft {
  return {
    title: entry.title,
    body: entry.body,
    mode: entry.mode,
    mood: entry.mood,
    energy: entry.energy,
    tags: [...entry.tags],
    location: entry.location ? { ...entry.location } : null,
    attachments: [...entry.attachments],
    favorite: entry.favorite,
    archived: entry.archived,
    private: entry.private,
  };
}

/** True when the user has not written anything meaningful (nothing to recover). */
export function isUntouched(draft: JournalDraft): boolean {
  return (
    draft.title.trim() === '' &&
    draft.body.trim() === '' &&
    draft.tags.length === 0 &&
    draft.attachments.length === 0 &&
    draft.mood === null &&
    draft.energy === null &&
    draft.location === null &&
    draft.favorite === false
  );
}

/**
 * Derives the entry title from the body's first non-empty line (≤200 chars),
 * so an untitled free-write still produces a valid, human-readable title at
 * save time. Falls back to "Untitled entry".
 */
export function deriveTitleFromBody(body: string, maxTitle = 200): string {
  const line =
    body
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? '';
  const title = line.slice(0, maxTitle).trim();
  return title.length > 0 ? title : 'Untitled entry';
}

/** Normalizes a draft for save: `title` can never be empty. */
export function normalizeDraftForSave(draft: JournalDraft): JournalDraft {
  const title = draft.title.trim() || deriveTitleFromBody(draft.body);
  return { ...draft, title };
}

export type DraftStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface DraftSnapshot {
  status: DraftStatus;
  /** True while a write to the backing store is in flight. */
  saving: boolean;
  /** True when the device is offline; drafts are still secured locally. */
  isOffline: boolean;
  /** Epoch ms of the last confirmed store write, or null. */
  lastSavedAt: number | null;
  error: string | null;
  /** True when localStorage held a newer draft that was restored on mount. */
  recovered: boolean;
  /** Server-side id once the entry has been created, otherwise null. */
  entryId: string | null;
}

/**
 * Backing store for journal entries. Firestore-backed for real users;
 * localStorage-backed for demo sessions (the session decides; the engine and UI
 * never do).
 */
export interface JournalStore {
  readonly kind: 'firestore' | 'local';
  create(input: JournalDraft): Promise<JournalEntry>;
  update(id: string, draft: JournalDraft): Promise<JournalEntry>;
  get(id: string): Promise<JournalEntry>;
  remove(id: string): Promise<void>;
  list(): Promise<JournalEntry[]>;
  subscribe(onUpdate: (entries: JournalEntry[]) => void, onError?: (err: Error) => void): () => void;
}

/** One entry's draft, as persisted to localStorage for crash recovery. */
export interface DraftRecord {
  version: 1;
  entryId: string | null;
  fields: JournalDraft;
  /** Epoch ms of the newest local edit. */
  draftUpdatedAt: number;
  /** Epoch ms of the last confirmed store write (0 if never). */
  savedAt: number;
}
