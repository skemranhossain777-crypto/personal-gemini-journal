import { getAuthInstance } from '../services/firebase';
import { DataError } from './errors';

/**
 * Ownership-aware path builders. The data layer NEVER accepts a UID from
 * callers — the owning UID is always derived from the authenticated session,
 * and demo sessions (which carry no Firebase token) are rejected outright.
 * This is the client-side half of "never trust frontend authorization": the
 * security rules enforce the same boundary server-side.
 */

/** Upper bound on doc IDs — mirrors the rule `isValidId`. */
export const MAX_DOC_ID_LENGTH = 128;

/** Human-readable collection names that end users must not write into. */
const DANGEROUS_SEGMENTS = ['.', '..', '__proto__', 'constructor', 'prototype'];

export function assertSafeId(id: string, what = 'document id'): void {
  if (typeof id !== 'string' || id.length === 0) {
    throw new DataError({ code: 'invalid-data', operation: 'create', path: what }, `${what} is required.`);
  }
  if (id.length > MAX_DOC_ID_LENGTH) {
    throw new DataError(
      { code: 'invalid-data', operation: 'create', path: what },
      `${what} exceeds ${MAX_DOC_ID_LENGTH} characters.`,
    );
  }
  if (id.includes('/') || id.includes('\\')) {
    throw new DataError({ code: 'invalid-data', operation: 'create', path: what }, `${what} may not contain path separators.`);
  }
  if (DANGEROUS_SEGMENTS.includes(id)) {
    throw new DataError({ code: 'invalid-data', operation: 'create', path: what }, `${what} is reserved.`);
  }
}

/** Returns the authenticated UID or throws. Demo sessions are refused. */
export function requireOwnerUid(): string {
  const uid = getAuthInstance().currentUser?.uid;
  if (!uid) {
    throw new DataError({ code: 'unauthenticated', operation: 'create' });
  }
  if (uid.startsWith('demo-')) {
    throw new DataError({ code: 'demo-session', operation: 'create' });
  }
  return uid;
}

export function buildCollectionPath(uid: string, collectionName: string): string {
  assertSafeId(uid, 'user id');
  return `users/${uid}/${collectionName}`;
}

export function buildDocPath(uid: string, collectionName: string, docId: string): string {
  assertSafeId(docId, collectionName);
  return `${buildCollectionPath(uid, collectionName)}/${docId}`;
}