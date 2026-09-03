import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocFromServer,
  query,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDbInstance, getAuthInstance } from './firebase';
import type { JournalInteraction } from '../types';

const LOCAL_STORAGE_KEY_PREFIX = 'gemini_journal_demo_';

// ── Error handling ────────────────────────────────────────────────────────────
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: { providerId?: string | null; email?: string | null }[];
  };
}

function currentAuthInfo() {
  const auth = getAuthInstance();
  const u = auth.currentUser;
  return {
    userId: u?.uid,
    email: u?.email,
    emailVerified: u?.emailVerified,
    isAnonymous: u?.isAnonymous,
    tenantId: u?.tenantId,
    providerInfo: u?.providerData?.map((p) => ({ providerId: p.providerId, email: p.email })) || [],
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: currentAuthInfo(),
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/** Strips `undefined` fields before writing to Firestore (zero-crash payload hygiene). */
export function sanitizeFirestorePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as unknown as T;
  if (Array.isArray(obj)) return obj.map(sanitizeFirestorePayload) as unknown as T;
  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) cleaned[key] = sanitizeFirestorePayload(value);
    }
    return cleaned as unknown as T;
  }
  return obj;
}

export async function validateConnection(): Promise<void> {
  const db = getDbInstance();
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or configuration needs verification.');
    }
  }
}

function getLocalDemoInteractions(userId: string): JournalInteraction[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + userId);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveLocalDemoInteractions(userId: string, list: JournalInteraction[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + userId, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}

/** Persists an interaction at /users/{userId}/interactions/{id}. */
export async function saveUserInteraction(
  userId: string,
  interaction: JournalInteraction
): Promise<void> {
  if (!userId) throw new Error('User must be authenticated to persist interactions');

  if (userId.startsWith('demo-')) {
    const current = getLocalDemoInteractions(userId);
    const index = current.findIndex((item) => item.id === interaction.id);
    if (index >= 0) current[index] = interaction;
    else current.unshift(interaction);
    saveLocalDemoInteractions(userId, current);
    return;
  }

  const path = `users/${userId}/interactions/${interaction.id}`;
  try {
    const db = getDbInstance();
    const interactionRef = doc(db, 'users', userId, 'interactions', interaction.id);
    await setDoc(interactionRef, sanitizeFirestorePayload(interaction), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/** Deletes an interaction from the user's isolated collection. */
export async function deleteUserInteraction(userId: string, interactionId: string): Promise<void> {
  if (!userId || !interactionId) return;

  if (userId.startsWith('demo-')) {
    const current = getLocalDemoInteractions(userId);
    saveLocalDemoInteractions(
      userId,
      current.filter((item) => item.id !== interactionId)
    );
    return;
  }

  const path = `users/${userId}/interactions/${interactionId}`;
  try {
    const db = getDbInstance();
    const interactionRef = doc(db, 'users', userId, 'interactions', interactionId);
    await deleteDoc(interactionRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/** Real-time subscription to /users/{userId}/interactions, newest first. */
export function subscribeUserInteractions(
  userId: string,
  onUpdate: (interactions: JournalInteraction[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  if (userId.startsWith('demo-')) {
    onUpdate(getLocalDemoInteractions(userId));
    return () => {};
  }

  const path = `users/${userId}/interactions`;
  const db = getDbInstance();
  const interactionsRef = collection(db, 'users', userId, 'interactions');
  const q = query(interactionsRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: JournalInteraction[] = [];
      snapshot.forEach((docSnap) => list.push(docSnap.data() as JournalInteraction));
      onUpdate(list);
    },
    (err) => {
      console.error('Firestore subscription error:', err);
      try {
        handleFirestoreError(err, OperationType.LIST, path);
      } catch (wrappedErr) {
        if (onError) onError(wrappedErr instanceof Error ? wrappedErr : new Error(String(wrappedErr)));
      }
    }
  );
}
