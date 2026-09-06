import type { JournalEntry } from '../data';
import { draftFromEntry, isUntouched, normalizeDraftForSave, type DraftRecord, type DraftSnapshot, type DraftStatus, type JournalDraft, type JournalStore } from './types';

/**
 * Autosave/draft reliability engine for the journal editor.
 *
 * Guarantees the product's hardest requirement: **the user's writing is never
 * silently lost.** Every mutation is mirrored synchronously to localStorage
 * before the async save is even scheduled, so refresh, navigation, or a crash
 * can always recover the newest text. The async write to the backing store is
 * serialized, coalesced, and retried with backoff; the newest content is never
 * dropped behind an in-flight save.
 *
 * Pure TypeScript (no React, no DOM assumptions beyond localStorage) so it is
 * unit-testable and used by the editor hook.
 */

export interface DraftEngineOptions {
  store: JournalStore;
  /** localStorage-like backend; defaults to `window.localStorage`. */
  storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } | null;
  /** Scopes draft keys per user (uid). */
  storageNamespace?: string;
  debounceMs?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  onStatusChange?: (snapshot: DraftSnapshot) => void;
  onSaved?: (entry: JournalEntry) => void;
}

const DEFAULTS = { debounceMs: 900, maxRetries: 6, retryBaseMs: 1500 };

const noopStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

export class DraftEngine {
  private readonly store: JournalStore;
  private readonly storage: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };
  private readonly storageNamespace: string;
  private readonly debounceMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly onStatusChange?: (snapshot: DraftSnapshot) => void;
  private readonly onSaved?: (entry: JournalEntry) => void;

  private _fields: JournalDraft;
  private entryId: string | null = null;
  private status: DraftStatus = 'idle';
  private error: string | null = null;
  private lastSavedAt: number | null = null;
  private savedAt: number | null = null;
  private savedJson: string | null = null;
  private lastMutationAt: number | null = null;
  private isOffline: boolean = typeof navigator !== 'undefined' && navigator.onLine === false;
  private recovered = false;
  private mounted = false;
  private retryCount = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private again = false;
  private pending: Promise<boolean> | null = null;

  constructor(options: DraftEngineOptions) {
    this.store = options.store;
    this.storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : noopStorage);
    this.storageNamespace = (options.storageNamespace ?? 'anon').replace(/[^A-Za-z0-9_-]/g, '_');
    this.debounceMs = options.debounceMs ?? DEFAULTS.debounceMs;
    this.maxRetries = options.maxRetries ?? DEFAULTS.maxRetries;
    this.retryBaseMs = options.retryBaseMs ?? DEFAULTS.retryBaseMs;
    this.onStatusChange = options.onStatusChange;
    this.onSaved = options.onSaved;
    this._fields = empty();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  get fields(): JournalDraft {
    return { ...this._fields, tags: [...this._fields.tags], attachments: [...this._fields.attachments] };
  }

  get snapshot(): DraftSnapshot {
    return {
      status: this.status,
      saving: this.running,
      isOffline: this.isOffline,
      lastSavedAt: this.lastSavedAt,
      error: this.error,
      recovered: this.recovered,
      entryId: this.entryId,
    };
  }

  get targetEntryId(): string | null {
    return this.entryId;
  }

  didRecover(): boolean {
    return this.recovered;
  }

  setMounted(mounted: boolean): void {
    this.mounted = mounted;
  }

  setFields(patch: Partial<JournalDraft>): void {
    this._fields = {
      ...this._fields,
      ...patch,
      tags: patch.tags !== undefined ? [...patch.tags] : [...this._fields.tags],
      attachments: patch.attachments !== undefined ? [...patch.attachments] : [...this._fields.attachments],
      location: patch.location !== undefined ? (patch.location ? { ...patch.location } : null) : this._fields.location,
    };
    this.lastMutationAt = Date.now();
    this.retryCount = 0;
    this.error = null;
    this.status = 'dirty';
    this.persist();
    this.emitStatus();
    this.schedule();
  }

  /**
   * Restores the engine to a known server state, layering any newer local draft
   * on top (crash recovery). `requestedId` is the entry the UI asked for.
   */
  hydrate(server: JournalEntry | null, requestedId: string | null): void {
    if (requestedId) this.entryId = requestedId;
    const record = this.readRecord();
    // A local record is "newer" when it was edited after its last confirmed save.
    const pendingLocal = !!record && !isUntouched(record.fields) && (record.savedAt ?? 0) < record.draftUpdatedAt;

    if (server) {
      if (pendingLocal) {
        this._fields = { ...record!.fields, tags: [...record!.fields.tags], attachments: [...record!.fields.attachments] };
        this.entryId = server.id;
        this.savedAt = record!.savedAt ?? 0;
        this.lastMutationAt = record!.draftUpdatedAt;
        this.recovered = true;
        this.status = 'dirty';
        this.error = null;
      } else {
        this.adoptServer(server);
      }
    } else if (pendingLocal) {
      // A newer local draft survives even if the server doc is missing (deleted
      // elsewhere, or a brand-new draft that was never created) — the user's
      // text is preserved and gets created on the next save.
      this._fields = { ...record!.fields, tags: [...record!.fields.tags], attachments: [...record!.fields.attachments] };
      this.savedAt = record!.savedAt ?? 0;
      this.lastMutationAt = record!.draftUpdatedAt;
      this.recovered = true;
      this.status = 'dirty';
      this.error = null;
      if (requestedId) this.entryId = null; // doc no longer exists → next save (re)creates
    } else {
      if (record) this.storage.removeItem(this.draftKey());
      this.status = 'idle';
      this.error = null;
      this.recovered = false;
    }
    this.persist();
    this.emitStatus();
  }

  /** Serialized, coalescing save. Resolves true when the newest content is saved. */
  async flush(): Promise<boolean> {
    if (this.running && this.pending) {
      this.again = true;
      return this.pending;
    }
    this.again = true;
    this.running = true;
    this.pending = this.saveLoop().finally(() => {
      this.running = false;
      this.pending = null;
    });
    return this.pending;
  }

  /** Convenience alias — flush the entire pipeline and get the outcome. */
  async ensureSaved(): Promise<boolean> {
    return this.flush();
  }

  /** Manual retry after an error (also resets the backoff counter). */
  retry(): void {
    this.clearTimer(this.retryTimer);
    this.retryCount = 0;
    void this.flush();
  }

  handleConnectivity(online: boolean): void {
    this.isOffline = !online;
    if (online) {
      this.retryCount = 0;
      this.clearTimer(this.retryTimer);
      if (this.isDirty() && this.hasWorthSaving()) {
        void this.flush();
      } else {
        this.emitStatus();
      }
    } else {
      if (this.status === 'error' || this.status === 'saving') {
        this.status = 'dirty';
        this.error = null;
        this.emitStatus();
      }
    }
  }

  /** Drops the local draft record (e.g. after a confirmed delete). */
  clearDraft(): void {
    this.storage.removeItem(this.draftKey());
  }

  /** Tears down the engine: cancels timers, persists the final draft. */
  destroy(): void {
    this.mounted = false;
    this.clearTimer(this.debounceTimer);
    this.clearTimer(this.retryTimer);
    try {
      this.persist();
    } catch {
      // Best-effort on teardown; the per-keystroke persist already secured data.
    }
    if (this.isDirty() && this.hasWorthSaving() && !this.running) {
      void this.flush();
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private adoptServer(server: JournalEntry): void {
    this._fields = normalizeDraftForSave(draftFromEntry(server));
    this.entryId = server.id;
    this.savedJson = JSON.stringify(this.serializeDraft(this._fields));
    const now = Date.now();
    this.savedAt = now;
    this.lastMutationAt = now;
    this.lastSavedAt = now;
    this.status = 'saved';
    this.error = null;
    this.recovered = false;
    this.retryCount = 0;
  }

  private isDirty(): boolean {
    // Content comparison first: timestamps have millisecond resolution and
    // Date.now() is not monotonic, so text typed within the same millisecond a
    // save lands could otherwise look "clean" and be silently dropped.
    if (this.savedJson !== null) {
      const currentJson = JSON.stringify(this.serializeDraft(normalizeDraftForSave(this._fields)));
      if (currentJson !== this.savedJson) return true;
    }
    return this.savedAt === null || this.lastMutationAt === null || this.lastMutationAt > this.savedAt;
  }

  private hasWorthSaving(): boolean {
    return !isUntouched(this._fields);
  }

  private draftKey(): string {
    const id = this.entryId ?? 'new';
    return `gemini_journal_drafts_v1__${this.storageNamespace}__${id}`;
  }

  private persist(): void {
    if (!this.hasWorthSaving()) {
      this.storage.removeItem(this.draftKey());
      return;
    }
    const record: DraftRecord = {
      version: 1,
      entryId: this.entryId,
      fields: this.serializeDraft(this._fields),
      draftUpdatedAt: this.lastMutationAt ?? Date.now(),
      savedAt: this.savedAt ?? 0,
    };
    this.storage.setItem(this.draftKey(), JSON.stringify(record));
  }

  /** JSON-safe deep copy of the draft (plain timestamps, non-enumerable-safe). */
  private serializeDraft(draft: JournalDraft): JournalDraft {
    return JSON.parse(JSON.stringify(draft)) as JournalDraft;
  }

  private readRecord(): DraftRecord | null {
    try {
      const raw = this.storage.getItem(this.draftKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DraftRecord;
      if (parsed?.version !== 1 || typeof parsed?.fields !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private emitStatus(): void {
    if (this.mounted) this.onStatusChange?.(this.snapshot);
  }

  private schedule(): void {
    if (!this.mounted) return;
    this.clearTimer(this.debounceTimer);
    this.debounceTimer = setTimeout(() => void this.flush(), this.debounceMs);
  }

  private async saveLoop(): Promise<boolean> {
    let result = true;
    while ((this.again || this.isDirty()) && this.hasWorthSaving()) {
      if (this.isOffline) {
        // Nothing to save over the wire; the draft is already secured locally.
        this.status = 'dirty';
        this.emitStatus();
        result = false;
        break;
      }
      this.again = false;
      result = await this.saveOnce();
      if (!result) break;
      if (this.status === 'saved' && !this.isDirty()) break;
    }
    return result;
  }

  private async saveOnce(): Promise<boolean> {
    const targetId = this.entryId;
    const draftForSave = normalizeDraftForSave({ ...this._fields, tags: [...this._fields.tags], attachments: [...this._fields.attachments] });
    const savedJson = JSON.stringify(this.serializeDraft(draftForSave));
    this.status = 'saving';
    this.emitStatus();

    try {
      const entry = targetId ? await this.store.update(targetId, draftForSave) : await this.store.create(draftForSave);
      this.entryId = entry.id;
      this.retryCount = 0;

      // The user may have typed more while this save was in flight. If so, keep
      // the draft dirty and DO NOT advance savedAt — otherwise the content-only
      // difference would be considered "already saved" and the newest text would
      // silently drop out of the next flush. The loop immediately saves again.
      const currentJson = JSON.stringify(this.serializeDraft(normalizeDraftForSave(this._fields)));
      this.savedJson = savedJson;
      if (currentJson === savedJson) {
        const now = Date.now();
        this.savedAt = now;
        this.lastSavedAt = now;
        this.status = 'saved';
      } else {
        this.status = 'dirty';
      }
      this.error = null;
      this.persist();
      this.emitStatus();
      this.onSaved?.(entry);
      return true;
    } catch (err) {
      this.status = 'error';
      this.error = this.toMessage(err);
      this.retryCount += 1;
      this.persist();
      this.emitStatus();
      this.scheduleRetry();
      return false;
    }
  }

  private scheduleRetry(): void {
    if (!this.mounted || this.retryCount >= this.maxRetries) return;
    const delay = Math.min(this.retryBaseMs * 2 ** (this.retryCount - 1), 30_000);
    this.clearTimer(this.retryTimer);
    this.retryTimer = setTimeout(() => void this.flush(), delay);
  }

  private toMessage(err: unknown): string {
    if (err instanceof Error && err.message) {
      switch ((err as { code?: string }).code) {
        case 'permission-denied':
          return 'You do not have permission to write this entry.';
        case 'unavailable':
        case 'network':
        case 'server-unavailable':
          return 'Could not reach the server. Your writing is kept on this device — you can retry.';
        default:
          return err.message;
      }
    }
    return 'Something went wrong. Your writing is safe on this device — you can retry.';
  }

  private clearTimer(timer: ReturnType<typeof setTimeout> | null): void {
    if (timer) clearTimeout(timer);
  }
}

function empty(): JournalDraft {
  return { title: '', body: '', mode: 'free-write', mood: null, energy: null, tags: [], location: null, attachments: [], favorite: false, archived: false, private: false };
}
