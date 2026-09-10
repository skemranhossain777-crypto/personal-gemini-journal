// @vitest-environment node
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  resolveFirestoreDatabaseId,
  buildFirestoreDocumentPath,
  getHealthPayload,
} from '../../../server';

const CANONICAL_DB = 'gemini-journal';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveFirestoreDatabaseId', () => {
  it('uses FIRESTORE_DATABASE_ID (canonical runtime var) first', () => {
    expect(
      resolveFirestoreDatabaseId({
        FIRESTORE_DATABASE_ID: CANONICAL_DB,
        FIREBASE_FIRESTORE_DATABASE_ID: 'legacy-db',
        VITE_FIREBASE_FIRESTORE_DATABASE_ID: 'local-db',
      })
    ).toBe(CANONICAL_DB);
  });

  it('falls back to FIREBASE_FIRESTORE_DATABASE_ID when canonical is absent', () => {
    expect(
      resolveFirestoreDatabaseId({
        FIREBASE_FIRESTORE_DATABASE_ID: 'legacy-db',
      } as NodeJS.ProcessEnv)
    ).toBe('legacy-db');
  });

  it('falls back to VITE_FIREBASE_FIRESTORE_DATABASE_ID when others absent', () => {
    expect(
      resolveFirestoreDatabaseId({
        VITE_FIREBASE_FIRESTORE_DATABASE_ID: 'local-db',
      } as NodeJS.ProcessEnv)
    ).toBe('local-db');
  });

  it('falls back to (default) only when nothing is configured', () => {
    expect(resolveFirestoreDatabaseId({} as NodeJS.ProcessEnv)).toBe('(default)');
  });
});

describe('buildFirestoreDocumentPath', () => {
  it('builds an active Firestore REST URL with the canonical named database', () => {
    const url = buildFirestoreDocumentPath(
      'gen-lang-client-0345619653',
      CANONICAL_DB,
      'users'
    );
    expect(url).toBe(
      `https://firestore.googleapis.com/v1/projects/gen-lang-client-0345619653/databases/${CANONICAL_DB}/documents/users`
    );
    expect(url).toContain(`/databases/${CANONICAL_DB}/`);
    expect(url).not.toContain('/databases/(default)/');
  });

  it('passes through query strings for conditional writes', () => {
    const url = buildFirestoreDocumentPath(
      'gen-lang-client-0345619653',
      CANONICAL_DB,
      'uid123/settings/notifications',
      '?currentDocument.exists=true'
    );
    expect(url).toContain(`/databases/${CANONICAL_DB}/`);
    expect(url).toContain('?currentDocument.exists=true');
    expect(url).not.toContain('/databases/(default)/');
  });
});

describe('health contract for Firestore configuration', () => {
  it('reports configured=true when the canonical runtime DB is set', () => {
    vi.stubEnv('FIRESTORE_DATABASE_ID', CANONICAL_DB);
    const payload = getHealthPayload();
    expect(payload.services.firestoreDatabaseConfigured).toBe(true);
    expect(payload.services.firestoreNamedDatabaseConfigured).toBe(true);
    expect(payload.firestoreDatabaseConfigured).toBe(true);
    expect(payload.firestoreNamedDatabaseConfigured).toBe(true);
  });

  it('reports named=false when falling back to (default)', () => {
    vi.stubEnv('FIRESTORE_DATABASE_ID', '');
    vi.stubEnv('FIREBASE_FIRESTORE_DATABASE_ID', '');
    vi.stubEnv('VITE_FIREBASE_FIRESTORE_DATABASE_ID', '');
    const payload = getHealthPayload();
    expect(payload.services.firestoreDatabaseConfigured).toBe(false);
    expect(payload.services.firestoreNamedDatabaseConfigured).toBe(false);
    expect(payload.firestoreDatabaseConfigured).toBe(false);
    expect(payload.firestoreNamedDatabaseConfigured).toBe(false);
  });

  it('reports named=true for a legacy env var still pointing at the named DB', () => {
    vi.stubEnv('FIRESTORE_DATABASE_ID', '');
    vi.stubEnv('FIREBASE_FIRESTORE_DATABASE_ID', CANONICAL_DB);
    const payload = getHealthPayload();
    expect(payload.services.firestoreNamedDatabaseConfigured).toBe(true);
  });
});