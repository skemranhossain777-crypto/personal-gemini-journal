import { getAuthInstance } from './firebase';
import type { JournalInteraction } from '../types';

/**
 * Local-first data layer (skill Phase 4.2). Caches per-user interactions in
 * localStorage for instant reads and non-blocking cloud sync, so the UI never
 * waits on the network. Real-time subscriptions still refresh the canonical
 * view; this layer provides an instant mirror + hydration on login.
 */
const LOCAL_CACHE_KEY = 'gemini_journal_local_store_v1';

interface LocalStore {
  [uid: string]: {
    interactions: JournalInteraction[];
    lastHydrated: number | null;
  };
}

class DataService {
  private store: LocalStore = this.load();

  private load(): LocalStore {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_CACHE_KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(this.store));
    } catch (e) {
      console.warn('[data] local persist failed:', e);
    }
  }

  private scope(uid: string) {
    if (!this.store[uid]) this.store[uid] = { interactions: [], lastHydrated: null };
    return this.store[uid];
  }

  /** Instant cached read of a user's interactions (local-first). */
  getInteractions(uid: string): JournalInteraction[] {
    return this.scope(uid).interactions;
  }

  /** Cache the latest canonical list (from the real-time subscription). */
  cacheInteractions(uid: string, list: JournalInteraction[]): void {
    this.scope(uid).interactions = list;
    this.persist();
  }

  /** Called on login to stamp the hydration time for logging/debug. */
  markHydrated(uid: string): void {
    this.scope(uid).lastHydrated = Date.now();
    this.persist();
  }

  /** Current demo/session user id, if any. */
  get sessionUid(): string | null {
    return getAuthInstance().currentUser?.uid ?? null;
  }
}

export const dataService = new DataService();
