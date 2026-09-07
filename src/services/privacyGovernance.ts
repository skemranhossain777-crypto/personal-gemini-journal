import { collection, deleteDoc, doc, getDocs, type Firestore } from 'firebase/firestore';
import { OWNER_SCOPED_COLLECTIONS } from '../data/models';
import { requireOwnerUid } from '../data/paths';
import { getDbInstance } from './firebase';

/**
 * Persistent, owner-scoped data deletion (Phase 4 privacy repair).
 *
 * The legacy privacy center could only "delete" entries from the in-memory
 * arrays it was handed. This module performs REAL deletes against Firestore —
 * every document lives at `users/{uid}/<collection>/<id>` and the security
 * rules permit deletes only when `request.auth.uid == userId`, so persistent
 * cleanup is enforced client-side by the trusted session and server-side by
 * the rules.
 *
 * Ownership is ALWAYS derived from the authenticated session via
 * `requireOwnerUid()` — never accepted from a caller argument — and demo
 * sessions (which have no Firestore token) are refused. Injecting `uid` or the
 * Firestore members is only supported so unit tests can exercise the logic
 * without an emulator.
 */

export const LEGACY_INTERACTIONS_COLLECTION = 'interactions' as const;

/** Every user-scoped chunk of data, including the legacy AI-session store. */
export const FULL_WIPE_COLLECTIONS = [
  ...OWNER_SCOPED_COLLECTIONS,
  LEGACY_INTERACTIONS_COLLECTION,
] as const;

export type GovernanceErrorCode = 'UNAUTHORIZED' | 'DEMO_SESSION' | 'DELETE_FAILED';

export class GovernanceError extends Error {
  constructor(
    message: string,
    public readonly code: GovernanceErrorCode,
  ) {
    super(message);
    this.name = 'GovernanceError';
  }
}

export interface WipeResult {
  collection: string;
  deleted: number;
  failed: number;
}

export interface WipeDeps {
  /** Test seam only — production ownership always comes from the session. */
  uid?: string;
  db?: Firestore;
  listDocIds?: (collectionName: string, uid: string) => Promise<string[]>;
  removeDoc?: (collectionName: string, uid: string, docId: string) => Promise<void>;
  /** Docs deleted per Promise batch. Lower is safer; default is scaled for small batches. */
  batchSize?: number;
}

function resolveOwner(deps: WipeDeps): string {
  if (deps.uid !== undefined) {
    if (!deps.uid) {
      throw new GovernanceError(
        'You must be signed in to delete JOURNAL∞ data.',
        'UNAUTHORIZED',
      );
    }
    if (deps.uid.startsWith('demo-')) {
      throw new GovernanceError(
        'Demo sessions cannot delete data. Sign in with Google to manage your data.',
        'DEMO_SESSION',
      );
    }
    return deps.uid;
  }

  try {
    return requireOwnerUid();
  } catch (err) {
    if ((err as { code?: unknown } | null)?.code === 'demo-session') {
      throw new GovernanceError(
        'Demo sessions cannot delete data. Sign in with Google to manage your data.',
        'DEMO_SESSION',
      );
    }
    throw new GovernanceError(
      'You must be signed in to delete JOURNAL∞ data.',
      'UNAUTHORIZED',
    );
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function wipeCollection(collectionName: string, deps: WipeDeps, uid: string): Promise<WipeResult> {
  const db = deps.db ?? getDbInstance();
  const batchSize = Math.max(1, deps.batchSize ?? 20);
  const listDocIds = deps.listDocIds ?? (async (name: string) => {
    const snapshot = await getDocs(collection(db, 'users', uid, name));
    return snapshot.docs.map((doc) => doc.id);
  });
  const removeDoc = deps.removeDoc ?? (async (name: string, _uid: string, docId: string) => {
    await deleteDoc(doc(db, 'users', _uid, name, docId));
  });

  let docIds: string[];
  try {
    docIds = await listDocIds(collectionName, uid);
  } catch (err) {
    const why = err instanceof Error ? err.message : 'unknown error';
    throw new GovernanceError(`Could not scan your ${collectionName} data: ${why}`, 'DELETE_FAILED');
  }

  const result: WipeResult = { collection: collectionName, deleted: 0, failed: 0 };
  for (const batch of chunk(docIds, batchSize)) {
    const settled = await Promise.allSettled(
      batch.map((id) => removeDoc(collectionName, uid, id)),
    );
    for (const item of settled) {
      if (item.status === 'fulfilled') result.deleted += 1;
      else result.failed += 1;
    }
  }
  return result;
}

/** Permanently deletes every journal entry from Firestore. */
export async function deleteAllJournalEntries(deps: WipeDeps = {}): Promise<WipeResult> {
  const uid = resolveOwner(deps);
  return wipeCollection('journalEntries', deps, uid);
}

/** Permanently deletes every AI memory from Firestore. */
export async function deleteAllMemories(deps: WipeDeps = {}): Promise<WipeResult> {
  const uid = resolveOwner(deps);
  return wipeCollection('memories', deps, uid);
}

/** Permanently deletes every user-scoped record, including legacy AI sessions. */
export async function deleteAllUserData(deps: WipeDeps = {}): Promise<WipeResult[]> {
  const uid = resolveOwner(deps);
  const results: WipeResult[] = [];
  for (const name of FULL_WIPE_COLLECTIONS) {
    results.push(await wipeCollection(name, deps, uid));
  }
  return results;
}