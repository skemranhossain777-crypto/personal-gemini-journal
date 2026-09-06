import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser,
  type UserCredential,
} from 'firebase/auth';
import { getAuthInstance } from './firebase';

/**
 * Authentication boundary — the ONLY module that talks to Firebase Auth.
 *
 * Everything else talks to `AuthServiceContract` (or the React `useAuth()`
 * context in `src/auth/`). The service is deliberately testable: create
 * instances with `createAuthService({ auth, api })` and inject fakes.
 *
 * Security boundary (frontend): only the *public* Firebase config
 * (`firebase-applet-config.json` / `VITE_FIREBASE_*`) is ever bundled for the
 * client. Gemini keys, Maps keys, the admin service-account, and the admin
 * allow-list never leave the server (`server.ts`).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  provider: string;
  isDemo: boolean;
  emailVerified: boolean;
  /** The underlying Firebase user, if this session is Firebase-backed. */
  source?: FirebaseUser | null;
}

/** Machine-readable categories of auth failures (frontend can branch on these). */
export type AuthErrorKey =
  | 'popup-closed'
  | 'popup-blocked'
  | 'cancelled'
  | 'unauthorized-domain'
  | 'operation-not-allowed'
  | 'configuration-not-found'
  | 'invalid-token'
  | 'network-error'
  | 'redirect-failed'
  | 'unknown';

export interface AuthErrorInfo {
  key: AuthErrorKey;
  /** Original Firebase `error.code` when available (e.g. `auth/invalid-credential`). */
  code: string | null;
  message: string;
  /** True when retrying the same action is likely to succeed. */
  retryable: boolean;
}

/** Map a thrown value (Firebase AuthError or anything else) to a stable shape. */
export function normalizeAuthError(err: unknown): AuthErrorInfo {
  const anyErr = err as { code?: unknown; message?: unknown };
  const code = typeof anyErr?.code === 'string' ? anyErr.code : null;
  const rawMessage = typeof anyErr?.message === 'string' ? anyErr.message : '';

  switch (code) {
    case 'auth/popup-closed-by-user':
      return { key: 'popup-closed', code, message: 'The sign-in window was closed. Please try again.', retryable: true };
    case 'auth/cancelled-popup-request':
      return { key: 'cancelled', code, message: 'Sign-in was cancelled.', retryable: true };
    case 'auth/popup-blocked':
      return {
        key: 'popup-blocked',
        code,
        message:
          'Your browser blocked the sign-in popup. Open the app in a new tab, or continue exploring in demo mode.',
        retryable: true,
      };
    case 'auth/unauthorized-domain':
      return {
        key: 'unauthorized-domain',
        code,
        message: 'This domain has not been authorized for sign-in yet. Try from another tab or demo mode.',
        retryable: false,
      };
    case 'auth/operation-not-allowed':
      return { key: 'operation-not-allowed', code, message: 'Google sign-in is not enabled for this project yet.', retryable: false };
    case 'auth/configuration-not-found':
      return { key: 'configuration-not-found', code, message: 'Authentication is not fully configured for this project.', retryable: false };
    case 'auth/invalid-credential':
    case 'auth/user-disabled':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return { key: 'invalid-token', code, message: 'Your session is no longer valid. Please sign in again.', retryable: true };
    case 'auth/network-request-failed':
    case 'auth/too-many-requests':
      return { key: 'network-error', code, message: 'A network problem interrupted sign-in. Check your connection and try again.', retryable: true };
    case 'auth/internal-error':
      return { key: 'redirect-failed', code, message: 'Sign-in could not be completed. Please try again.', retryable: true };
    default:
      return {
        key: code ? 'unknown' : 'unknown',
        code,
        message: rawMessage || 'Authentication failed. Please try again.',
        retryable: true,
      };
  }
}

/** Minimal Firebase surface the service needs, injectable in tests. */
export interface FirebaseAuthApi {
  signInWithPopup(auth: Auth, provider: GoogleAuthProvider): Promise<UserCredential>;
  signInWithRedirect(auth: Auth, provider: GoogleAuthProvider): Promise<void>;
  getRedirectResult(auth: Auth): Promise<UserCredential | null>;
  signOut(auth: Auth): Promise<void>;
  onAuthStateChanged(auth: Auth, cb: (u: FirebaseUser | null) => void): () => void;
}

const realAuthApi: FirebaseAuthApi = {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
};

/** Contract consumed by the app boundary and tests. */
export interface AuthServiceContract {
  readonly currentUser: SessionUser | null;
  subscribe(cb: (user: SessionUser | null) => void): () => void;
  signInWithGoogle(mode: 'redirect' | 'popup'): Promise<FirebaseUser>;
  completeRedirectSignIn(): Promise<SessionUser | null>;
  signInAsDemo(): SessionUser;
  signOut(): Promise<void>;
  /** Firebase ID token for authorized API calls, or null for demo/signed-out. */
  getIdToken(): Promise<string | null>;
}

export interface AuthServiceOptions {
  auth: Auth;
  api?: FirebaseAuthApi;
}

export function mapFirebaseUser(fb: FirebaseUser): SessionUser {
  return {
    uid: fb.uid,
    email: fb.email ?? '',
    displayName: fb.displayName ?? fb.email?.split('@')[0] ?? 'User',
    photoURL: fb.photoURL ?? null,
    provider: fb.providerData[0]?.providerId ?? 'unknown',
    isDemo: false,
    emailVerified: Boolean(fb.emailVerified),
    source: fb,
  };
}

export function createDemoUser(): SessionUser {
  return {
    uid: 'demo-local-user',
    email: 'guest@demo.local',
    displayName: 'Guest Explorer',
    photoURL: null,
    provider: 'demo',
    isDemo: true,
    emailVerified: false,
    source: null,
  };
}

/**
 * Observable auth service. `signInWithGoogle('redirect')` triggers a full-page
 * redirect — the returned promise rejects with `REDIRECT_IN_PROGRESS` so the
 * caller knows the page is about to reload; `completeRedirectSignIn()` finishes
 * the round-trip when the SPA boots back up.
 */
export class AuthService implements AuthServiceContract {
  private readonly auth: Auth;
  private readonly api: FirebaseAuthApi;
  private readonly googleProvider = new GoogleAuthProvider();
  private _user: SessionUser | null = null;
  private subs = new Set<(u: SessionUser | null) => void>();

  constructor(options: AuthServiceOptions) {
    this.auth = options.auth;
    this.api = options.api ?? realAuthApi;
    this.googleProvider.setCustomParameters({ prompt: 'select_account' });
    this.api.onAuthStateChanged(this.auth, (fb) => {
      this._user = fb ? mapFirebaseUser(fb) : null;
      this.subs.forEach((cb) => cb(this._user));
    });
  }

  get currentUser(): SessionUser | null {
    return this._user;
  }

  get firebaseUser(): FirebaseUser | null {
    return this.auth.currentUser;
  }

  getIdToken(): Promise<string | null> {
    if (this._user?.isDemo) {
      return Promise.resolve('demo-token');
    }
    return this.auth.currentUser?.getIdToken() ?? Promise.resolve(null);
  }

  get idToken(): Promise<string | null> {
    return this.getIdToken();
  }

  /** Returns an unsubscribe function; immediately fires with the current state. */
  subscribe(cb: (u: SessionUser | null) => void): () => void {
    this.subs.add(cb);
    cb(this._user);
    return () => {
      this.subs.delete(cb);
    };
  }

  signInWithGoogle = (mode: 'redirect' | 'popup' = 'redirect'): Promise<FirebaseUser> => {
    if (mode === 'popup') {
      return this.api.signInWithPopup(this.auth, this.googleProvider).then((r) => r.user);
    }
    // Redirect is robust against popup blockers / 3rd-party cookie blocking.
    // The page reloads after the round-trip; completeRedirectSignIn() finishes it.
    return this.api.signInWithRedirect(this.auth, this.googleProvider).then(() => {
      throw new Error('REDIRECT_IN_PROGRESS');
    });
  };

  completeRedirectSignIn = async (): Promise<SessionUser | null> => {
    const result = await this.api.getRedirectResult(this.auth);
    if (!result?.user) return null;
    this._user = mapFirebaseUser(result.user);
    this.subs.forEach((cb) => cb(this._user));
    return this._user;
  };

  signInAsDemo = (): SessionUser => {
    const demo = createDemoUser();
    this._user = demo;
    this.subs.forEach((cb) => cb(this._user));
    return demo;
  };

  signOut = async (): Promise<void> => {
    const uid = this._user?.uid ?? this.auth.currentUser?.uid;
    if (uid?.startsWith('demo-')) {
      this._user = null;
      this.subs.forEach((cb) => cb(this._user));
      return;
    }
    await this.api.signOut(this.auth);
    this._user = null;
    this.subs.forEach((cb) => cb(this._user));
  };
}

export function createAuthService(options: AuthServiceOptions): AuthService {
  return new AuthService(options);
}

/** App-wide singleton built against the real Firebase instance. */
export const authService = createAuthService({ auth: getAuthInstance() });

// Re-exported helpers for imperative callers.
export const onAuth = (cb: (u: SessionUser | null) => void) => authService.subscribe(cb);
export const signInWithGoogle = authService.signInWithGoogle;
export const completeRedirectSignIn = () => authService.completeRedirectSignIn();
export const logOut = () => authService.signOut();