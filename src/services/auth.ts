import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getAuthInstance } from './firebase';

/**
 * Observable auth service (skill Phase 3). A listener-based pub/sub lets any
 * component subscribe without prop drilling. Wraps Firebase Auth and keeps the
 * redirect-vs-popup sign-in strategy we validated against popup blockers.
 */
export interface SessionUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  provider: string;
  isDemo: boolean;
  source?: FirebaseUser | null;
}

function mapFirebaseUser(fb: FirebaseUser): SessionUser {
  return {
    uid: fb.uid,
    email: fb.email ?? '',
    displayName: fb.displayName ?? fb.email?.split('@')[0] ?? 'User',
    photoURL: fb.photoURL ?? null,
    provider: fb.providerData[0]?.providerId ?? 'unknown',
    isDemo: fb.uid.startsWith('demo-'),
    source: fb,
  };
}

function createDemoUser(): SessionUser {
  return {
    uid: 'demo-local-user',
    email: 'guest@demo.local',
    displayName: 'Guest Explorer',
    photoURL: null,
    provider: 'demo',
    isDemo: true,
    source: null,
  };
}

class AuthService {
  private auth = getAuthInstance();
  private googleProvider = new GoogleAuthProvider();
  private _user: SessionUser | null = null;
  private subs = new Set<(u: SessionUser | null) => void>();

  constructor() {
    this.googleProvider.setCustomParameters({ prompt: 'select_account' });
    onAuthStateChanged(this.auth, (fb) => {
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

  get idToken(): Promise<string | null> {
    return this.auth.currentUser?.getIdToken() ?? Promise.resolve(null);
  }

  /** Returns an unsubscribe function; immediately fires with current state. */
  subscribe(cb: (u: SessionUser | null) => void): () => void {
    this.subs.add(cb);
    cb(this._user);
    return () => this.subs.delete(cb);
  }

  signInWithGoogle = (mode: 'redirect' | 'popup' = 'redirect'): Promise<FirebaseUser> => {
    if (mode === 'popup') {
      return signInWithPopup(this.auth, this.googleProvider).then((r) => r.user);
    }
    // Redirect is robust against popup blockers / 3rd-party cookie blocking.
    // The page reloads after the round-trip; completeRedirectSignIn() finishes it.
    return signInWithRedirect(this.auth, this.googleProvider).then(() => {
      throw new Error('REDIRECT_IN_PROGRESS');
    });
  };

  completeRedirectSignIn = async (): Promise<SessionUser | null> => {
    const result = await getRedirectResult(this.auth);
    if (!result?.user) return null;
    this._user = mapFirebaseUser(result.user);
    this.subs.forEach((cb) => cb(this._user));
    return this._user;
  };

  signInAsDemo = (): SessionUser => {
    this._user = createDemoUser();
    this.subs.forEach((cb) => cb(this._user));
    return this._user;
  };

  signOut = async (): Promise<void> => {
    if (this.auth.currentUser?.uid?.startsWith('demo-') ?? this._user?.uid?.startsWith('demo-')) {
      this._user = null;
      this.subs.forEach((cb) => cb(this._user));
      return;
    }
    await signOut(this.auth);
    this._user = null;
    this.subs.forEach((cb) => cb(this._user));
  };
}

export const authService = new AuthService();

// Re-exported helpers for callers that still want imperative access.
export const onAuth = (cb: (u: SessionUser | null) => void) => authService.subscribe(cb);
export const signInWithGoogle = authService.signInWithGoogle;
export const completeRedirectSignIn = () => authService.completeRedirectSignIn();
export const logOut = () => authService.signOut();
