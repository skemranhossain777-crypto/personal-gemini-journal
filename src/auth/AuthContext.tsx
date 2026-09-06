import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  authService,
  normalizeAuthError,
  type AuthErrorInfo,
  type AuthServiceContract,
  type SessionUser,
} from '../services/auth';
import type { AuthContextValue, AuthState } from './types';

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }
  return ctx;
};

function initialAuthState(): AuthState {
  return { status: 'initializing', user: null, error: null };
}

export interface AuthProviderProps {
  /** Injectable for tests; defaults to the app singleton. */
  service?: AuthServiceContract;
  children: React.ReactNode;
}

/**
 * The single React-side authentication boundary. Subscribes to the auth
 * service once, drives the status state machine, and exposes `useAuth()` so
 * gates (`<RequireAuth>`, screens, the landing page) never touch Firebase
 * directly.
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ service = authService, children }) => {
  const [state, setState] = useState<AuthState>(initialAuthState);
  const serviceRef = useRef(service);
  serviceRef.current = service;
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const current = serviceRef.current;
    let cancelled = false;

    const unsub = current.subscribe((user: SessionUser | null) => {
      if (cancelled) return;
      setState((prev) => {
        if (user) {
          return { status: 'authenticated', user, error: null };
        }
        // Signed-out emission: a session ended, or the initial restore found none.
        const wasBusy = prev.status === 'initializing' || prev.status === 'signing-in';
        return {
          status: prev.status === 'authenticated' || wasBusy ? 'unauthenticated' : prev.status,
          user: null,
          error: prev.status === 'restore-failed' ? prev.error : null,
        };
      });
    });

    // Finish a pending redirect round-trip if one is in flight. A non-null
    // result is also emitted through the listener above; this call additionally
    // lets us surface a restore failure as a first-class state.
    current.completeRedirectSignIn().catch((err: unknown) => {
      if (cancelled) return;
      setState((prev) => {
        if (prev.user || prev.status !== 'initializing') return prev;
        return { status: 'restore-failed', user: null, error: normalizeAuthError(err) };
      });
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      unsub();
    };
  }, [service]);

  const update = useCallback((patch: Partial<AuthState>) => {
    if (!mountedRef.current) return;
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const signIn = useCallback(async () => {
    update({ status: 'signing-in', error: null });
    try {
      try {
        await serviceRef.current.signInWithGoogle('popup');
      } catch (error) {
        const anyErr = error as { code?: string; message?: string };
        if (anyErr?.code === 'auth/popup-blocked' || anyErr?.code === 'auth/cancelled-popup-request') {
          try {
            await serviceRef.current.signInWithGoogle('redirect');
          } catch (redirectErr) {
            if ((redirectErr as { message?: string })?.message !== 'REDIRECT_IN_PROGRESS') {
              throw redirectErr;
            }
          }
          // Full-page redirect: the listener re-emits the session after reload.
          return;
        }
        throw error;
      }
      // Successful popup sign-in is delivered through the subscription listener.
    } catch (err) {
      update({ status: 'unauthenticated', error: normalizeAuthError(err) });
    }
  }, [update]);

  const signInAsDemo = useCallback(() => {
    const demo = serviceRef.current.signInAsDemo();
    update({ status: 'authenticated', user: demo, error: null });
  }, [update]);

  const signOut = useCallback(async () => {
    try {
      await serviceRef.current.signOut();
    } finally {
      update({ status: 'unauthenticated', user: null, error: null });
    }
  }, [update]);

  const retryRestore = useCallback(async () => {
    update({ status: 'signing-in', error: null });
    try {
      const user = await serviceRef.current.completeRedirectSignIn();
      update(user ? { status: 'authenticated', user, error: null } : { status: 'unauthenticated', user: null, error: null });
    } catch (err) {
      update({ status: 'restore-failed', user: null, error: normalizeAuthError(err) });
    }
  }, [update]);

  const clearError = useCallback(() => {
    setState((prev) => (prev.error ? { ...prev, error: null } : prev));
  }, []);

  const getAccessToken = useCallback(() => serviceRef.current.getIdToken(), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      error: state.error,
      signIn,
      signInAsDemo,
      signOut,
      retryRestore,
      clearError,
      getAccessToken,
      isBusy: state.status === 'initializing' || state.status === 'signing-in',
    }),
    [state, signIn, signInAsDemo, signOut, retryRestore, clearError, getAccessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export type { AuthErrorInfo };