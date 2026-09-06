import React from 'react';
import { vi } from 'vitest';
import type { User as FirebaseUser } from 'firebase/auth';
import type { SessionUser, AuthServiceContract } from '../../services/auth';
import { useAuth } from '../AuthContext';

export function makeSession(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    uid: 'uid-1',
    email: 'maya@example.com',
    displayName: 'Maya Lindqvist',
    photoURL: null,
    provider: 'google.com',
    isDemo: false,
    emailVerified: true,
    ...overrides,
  };
}

export interface FakeAuthController {
  service: AuthServiceContract;
  /** Manually emit a session / signed-out event (simulates onAuthStateChanged). */
  emit: (user: SessionUser | null) => void;
  /** Set before clicking sign-in to force a popup failure. */
  failSignInWith: (error: unknown) => void;
  /** Set before mount to force a session-restore failure. */
  failRestoreWith: (error: unknown) => void;
  getState: () => SessionUser | null;
  signInWithGoogle: (mode: 'redirect' | 'popup') => Promise<FirebaseUser | null>;
  signInAsDemo: () => SessionUser;
  signOut: () => Promise<void>;
  completeRedirectSignIn: () => Promise<SessionUser | null>;
}

/**
 * In-memory AuthServiceContract double. Everything is local — no Firebase,
 * no network — so tests drive the full boundary state machine deterministically.
 */
export function createFakeAuth(options?: {
  initialUser?: SessionUser | null;
  /** When false, subscribe() won't emit until asked (tests the initializing state). */
  subscribeEmitsImmediately?: boolean;
}): FakeAuthController {
  const initial = options?.initialUser ?? null;
  const emitImmediately = options?.subscribeEmitsImmediately ?? true;
  const listeners = new Set<(user: SessionUser | null) => void>();
  let current: SessionUser | null = initial;
  let popupError: unknown = null;
  let restoreError: unknown = null;

  const emit = (user: SessionUser | null) => {
    current = user;
    listeners.forEach((cb) => cb(user));
  };

  const service: AuthServiceContract = {
    get currentUser() {
      return current;
    },
    subscribe(cb) {
      listeners.add(cb);
      if (emitImmediately) cb(current);
      return () => listeners.delete(cb);
    },
    signInWithGoogle: vi.fn(async (mode: 'redirect' | 'popup') => {
      if (popupError) throw popupError;
      if (mode === 'redirect') throw new Error('REDIRECT_IN_PROGRESS');
      const user = makeSession();
      emit(user);
      return user.source ?? null;
    }),
    completeRedirectSignIn: vi.fn(async () => {
      if (restoreError) throw restoreError;
      if (current) {
        emit(current);
        return current;
      }
      return null;
    }),
    signInAsDemo: vi.fn(() => {
      const demo = makeSession({
        uid: 'demo-local-user',
        email: 'guest@demo.local',
        displayName: 'Guest Explorer',
        provider: 'demo',
        isDemo: true,
      });
      emit(demo);
      return demo;
    }),
    signOut: vi.fn(async () => {
      emit(null);
    }),
    getIdToken: vi.fn(async () => (current && !current.isDemo ? 'id-token-xyz' : null)),
  };

  return {
    service,
    emit,
    failSignInWith: (error) => {
      popupError = error;
    },
    failRestoreWith: (error) => {
      restoreError = error;
    },
    getState: () => current,
    signInWithGoogle: service.signInWithGoogle,
    signInAsDemo: service.signInAsDemo,
    signOut: service.signOut,
    completeRedirectSignIn: service.completeRedirectSignIn,
  };
}

/** Renders the full auth state so tests can assert the boundary contract. */
export function Probe(): React.ReactElement {
  const { status, user, error, signIn, signOut, signInAsDemo } = useAuth();
  return (
    <div>
      <p data-testid="probe-status">{status}</p>
      {user && <p data-testid="probe-user">{user.email}</p>}
      {error && <p data-testid="probe-error">{error.message}</p>}
      <button data-testid="probe-signin" onClick={() => void signIn()}>
        Sign in
      </button>
      <button data-testid="probe-signout" onClick={() => void signOut()}>
        Sign out
      </button>
      <button data-testid="probe-demo" onClick={signInAsDemo}>
        Demo
      </button>
    </div>
  );
}