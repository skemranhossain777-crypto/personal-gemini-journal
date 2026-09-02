import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, type User } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  query,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import type { JournalInteraction } from '../types';
import firebaseFallbackConfig from '../../firebase-applet-config.json';

// Build Firebase config from Vite environment variables (VITE_ prefix)
// Falls back to firebase-applet-config.json if env vars are not set (e.g. local dev)
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseFallbackConfig.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseFallbackConfig.appId,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseFallbackConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseFallbackConfig.authDomain,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseFallbackConfig.firestoreDatabaseId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseFallbackConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseFallbackConfig.messagingSenderId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseFallbackConfig.measurementId || '',
  oAuthClientId: import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID || firebaseFallbackConfig.oAuthClientId || '',
  recaptchaSiteKey: import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY || firebaseFallbackConfig.recaptchaSiteKey || '',
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Firestore initialization with custom databaseId support
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

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
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validates connection to Firestore on initialization
 */
async function testConnection() {
  try {
    const { doc, getDocFromServer } = await import('firebase/firestore');
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or configuration needs verification.');
    }
  }
}
testConnection();

/**
 * Strict Undefined-Stripping (Zero-Crash Payload Hygiene)
 * Recursively cleans objects to remove any undefined fields before writing to Firestore.
 */
export function sanitizeFirestorePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeFirestorePayload) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeFirestorePayload(value);
      }
    }
    return cleaned as unknown as T;
  }
  return obj;
}

/**
 * Signs in user via Google Popup, with graceful error handling.
 */
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * Signs out current user.
 */
export async function logOut(): Promise<void> {
  await signOut(auth);
}

const LOCAL_STORAGE_KEY_PREFIX = 'gemini_journal_demo_';

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

/**
 * Persists an interaction in the user's isolated Firestore collection:
 * /users/{userId}/interactions/{interactionId}
 */
export async function saveUserInteraction(
  userId: string,
  interaction: JournalInteraction
): Promise<void> {
  if (!userId) {
    throw new Error('User must be authenticated to persist interactions');
  }

  // Handle Demo/Guest user without requiring remote Firestore write permissions
  if (userId.startsWith('demo-')) {
    const current = getLocalDemoInteractions(userId);
    const index = current.findIndex((item) => item.id === interaction.id);
    if (index >= 0) {
      current[index] = interaction;
    } else {
      current.unshift(interaction);
    }
    saveLocalDemoInteractions(userId, current);
    return;
  }

  const path = `users/${userId}/interactions/${interaction.id}`;
  try {
    const interactionRef = doc(db, 'users', userId, 'interactions', interaction.id);
    const cleanPayload = sanitizeFirestorePayload(interaction);
    await setDoc(interactionRef, cleanPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Deletes an interaction from user's isolated collection.
 */
export async function deleteUserInteraction(userId: string, interactionId: string): Promise<void> {
  if (!userId || !interactionId) return;

  if (userId.startsWith('demo-')) {
    const current = getLocalDemoInteractions(userId);
    const filtered = current.filter((item) => item.id !== interactionId);
    saveLocalDemoInteractions(userId, filtered);
    return;
  }

  const path = `users/${userId}/interactions/${interactionId}`;
  try {
    const interactionRef = doc(db, 'users', userId, 'interactions', interactionId);
    await deleteDoc(interactionRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Subscribes to real-time updates of user interactions, isolated to /users/{userId}/interactions
 */
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
    const list = getLocalDemoInteractions(userId);
    onUpdate(list);
    // Return empty unsubscribe function for local storage
    return () => {};
  }

  const path = `users/${userId}/interactions`;
  const interactionsRef = collection(db, 'users', userId, 'interactions');
  const q = query(interactionsRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: JournalInteraction[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as JournalInteraction);
      });
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
