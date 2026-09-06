import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  type DocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDbInstance } from '../services/firebase';
import { DataError, toDataError } from './errors';
import type { BaseEntity } from './models';
import {
  buildPage,
  normalizePageOptions,
  type ListOptions,
  type Page,
} from './pagination';
import { assertSafeId, buildDocPath, requireOwnerUid } from './paths';
import { withoutUndefined, type ValidationResult } from './validation';

/**
 * Generic owner-scoped CRUD for `users/{uid}/<collection>`.
 *
 * Ownership is ALWAYS derived from the authenticated session (`requireOwnerUid`)
 * — callers can never reach another user's partition. Validation runs before
 * every write, timestamps are stamped server-side, and read-back returns the
 * canonical document. The Firestore security rules enforce every boundary
 * again server-side (nothing here can be trusted in isolation).
 */

export interface PendingWrite {
  id: string;
  uid: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface CollectionConfig<T extends BaseEntity> {
  /** Subcollection name under `users/{uid}`. */
  name: string;
  /** Validator for the user-controlled fields (no id/uid/pedigree). */
  validateInput(input: unknown): ValidationResult;
  /** Keys the client may set on create (mirrors the rules `hasOnly`). */
  createKeys: readonly string[];
  /** Keys the client may modify on update. */
  updateKeys: readonly string[];
  /** Immutable extra keys (beyond id/uid/createdAt) that updates must preserve. */
  readonlyKeys?: readonly string[];
  /** Fixed document id (e.g. settings uses `preferences`). */
  fixedDocId?: string;
  /** Sort field for list/subscribe (defaults to createdAt). */
  orderByField?: string;
}

export interface CollectionApi<T extends BaseEntity> {
  create(input: Record<string, unknown>, options?: { id?: string }): Promise<T>;
  get(id: string): Promise<T>;
  update(id: string, patch: Record<string, unknown>): Promise<T>;
  remove(id: string): Promise<void>;
  list(options?: ListOptions): Promise<Page<T>>;
  subscribe(onUpdate: (items: T[]) => void, onError?: (err: Error) => void): Unsubscribe;
}

/**
 * Optional runtime overrides. The app always derives the UID from the session
 * and uses the app-wide Firestore instance; emulator-backed integration tests
 * bind a configured database + fixed UID through these.
 */
export interface CollectionApiInit {
  db?: import('firebase/firestore').Firestore;
  uid?: string;
}

function readEntity<T>(snap: DocumentSnapshot, path: string, operation: 'read' | 'list'): T {
  if (!snap.exists()) {
    throw new DataError({ code: 'not-found', operation, path });
  }
  return snap.data() as T;
}

export function createCollectionApi<T extends BaseEntity>(config: CollectionConfig<T>, init: CollectionApiInit = {}): CollectionApi<T> {
  const db = init.db ?? getDbInstance();
  const getUid = () => (init.uid !== undefined ? init.uid : requireOwnerUid());
  const orderByField = config.orderByField ?? 'createdAt';

  const assertPatchAllowed = (patch: Record<string, unknown>) => {
    const forbidden = [...new Set(['id', 'uid', 'createdAt', 'updatedAt', ...(config.readonlyKeys ?? [])])];
    for (const key of Object.keys(patch)) {
      if (forbidden.includes(key)) {
        throw new DataError(
          { code: 'invalid-data', operation: 'update' },
          `Field "${key}" is immutable and cannot be updated.`,
        );
      }
      if (!(config.updateKeys as readonly string[]).includes(key)) {
        throw new DataError(
          { code: 'invalid-data', operation: 'update' },
          `Field "${key}" cannot be updated.`,
        );
      }
    }
  };

  return {
    async create(input, options = {}) {
      const uid = getUid();
      const id = config.fixedDocId ?? options.id ?? doc(collection(db, 'users', uid, config.name)).id;
      assertSafeId(id, config.name);
      assertSafeId(uid, 'user id');

      const path = buildDocPath(uid, config.name, id);
      const inputKeys = Object.keys(input);
      const illegal = inputKeys.filter((k) => !(config.createKeys as readonly string[]).includes(k));
      if (illegal.length > 0) {
        throw new DataError({ code: 'invalid-data', operation: 'create', path }, `Field "${illegal[0]}" cannot be set on create.`);
      }
      const validated = config.validateInput(input);
      if (!validated.ok) {
        throw new DataError({ code: 'invalid-data', operation: 'create', path }, validated.errors.join(' '));
      }

      const payload: PendingWrite = {
        ...withoutUndefined(input),
        id,
        uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const ref = doc(db, 'users', uid, config.name, id);
      try {
        await setDoc(ref, payload);
        const written = await getDoc(ref);
        return readEntity<T>(written, path, 'read');
      } catch (err) {
        throw toDataError(err, 'create', path);
      }
    },

    async get(id) {
      const uid = getUid();
      assertSafeId(id, config.name);
      const path = buildDocPath(uid, config.name, id);
      try {
        const snap = await getDoc(doc(db, 'users', uid, config.name, id));
        return readEntity<T>(snap, path, 'read');
      } catch (err) {
        throw toDataError(err, 'read', path);
      }
    },

    async update(id, patch) {
      const uid = getUid();
      assertSafeId(id, config.name);
      const path = buildDocPath(uid, config.name, id);
      assertPatchAllowed(patch);

      try {
        const ref = doc(db, 'users', uid, config.name, id);
        const existing = await getDoc(ref);
        if (!existing.exists()) {
          throw new DataError({ code: 'not-found', operation: 'update', path });
        }
        const existingData = existing.data() as BaseEntity;

        // Validate the post-update state, guaranteeing updates can never
        // corrupt a document into an invalid shape ("update bypass").
        const merged = { ...existingData, ...patch };
        delete (merged as Record<string, unknown>).id;
        delete (merged as Record<string, unknown>).uid;
        delete (merged as Record<string, unknown>).createdAt;
        delete (merged as Record<string, unknown>).updatedAt;
        const validated = config.validateInput(merged);
        if (!validated.ok) {
          throw new DataError({ code: 'invalid-data', operation: 'update', path }, validated.errors.join(' '));
        }

        await updateDoc(ref, { ...withoutUndefined(patch), updatedAt: serverTimestamp() });
        const written = await getDoc(ref);
        return readEntity<T>(written, path, 'read');
      } catch (err) {
        throw toDataError(err, 'update', path);
      }
    },

    async remove(id) {
      const uid = getUid();
      assertSafeId(id, config.name);
      const path = buildDocPath(uid, config.name, id);
      try {
        await deleteDoc(doc(db, 'users', uid, config.name, id));
      } catch (err) {
        throw toDataError(err, 'delete', path);
      }
    },

    async list(options = {}) {
      const uid = getUid();
      const { limit: pageSize, after } = normalizePageOptions(options);
      const path = `users/${uid}/${config.name}`;
      try {
        const base = query(
          collection(db, 'users', uid, config.name),
          orderBy(orderByField, 'desc'),
          orderBy('__name__', 'desc'),
        );
        const ordered = after ? query(base, startAfter(after)) : base;
        const snap = await getDocs(query(ordered, limit(pageSize + 1)));
        return buildPage<T>(snap, pageSize);
      } catch (err) {
        throw toDataError(err, 'list', path);
      }
    },

    subscribe(onUpdate, onError) {
      try {
        const uid = getUid();
        const q = query(
          collection(db, 'users', uid, config.name),
          orderBy(orderByField, 'desc'),
          orderBy('__name__', 'desc'),
        );
        return onSnapshot(
          q,
          (snap) => {
            const items: T[] = [];
            snap.forEach((d) => items.push(d.data() as T));
            onUpdate(items);
          },
          (err) => {
            console.error(`[data:${config.name}] subscription error:`, err);
            if (onError) onError(toDataError(err, 'subscribe', `users/${uid}/${config.name}`));
          },
        );
      } catch (err) {
        throw toDataError(err, 'subscribe', `users/${config.name}`);
      }
    },
  };
}