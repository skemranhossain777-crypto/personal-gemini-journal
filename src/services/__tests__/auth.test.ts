import { describe, expect, it, vi } from 'vitest';
import type { User as FirebaseUser, UserCredential } from 'firebase/auth';
import {
  createAuthService,
  createDemoUser,
  mapFirebaseUser,
  normalizeAuthError,
  type AuthServiceOptions,
  type FirebaseAuthApi,
} from '../auth';

/** Fully controllable fake of the Firebase surface the service needs. */
class FakeAuthEnv {
  currentUser: FirebaseUser | null = null;
  redirectUser: FirebaseUser | null = null;
  private listeners = new Set<(u: FirebaseUser | null) => void>();

  fire(user: FirebaseUser | null): void {
    this.currentUser = user;
    this.listeners.forEach((l) => l(user));
  }

  makeUser(overrides: Partial<FirebaseUser> = {}): FirebaseUser {
    return {
      uid: 'uid-1',
      email: 'maya@example.com',
      displayName: 'Maya Lindqvist',
      photoURL: null,
      emailVerified: true,
      providerData: [{ providerId: 'google.com' }],
      getIdToken: vi.fn(async () => 'id-token-abc'),
      ...(overrides as Partial<FirebaseUser>),
    } as unknown as FirebaseUser;
  }

  options(overrides: Partial<FirebaseAuthApi> = {}): AuthServiceOptions {
    const api: FirebaseAuthApi = {
      onAuthStateChanged: (_auth, cb) => {
        this.listeners.add(cb);
        cb(this.currentUser);
        return () => this.listeners.delete(cb);
      },
      signInWithPopup: async (): Promise<UserCredential> => {
        const user = this.makeUser();
        this.fire(user);
        return { user } as UserCredential;
      },
      signInWithRedirect: async (): Promise<void> => {},
      getRedirectResult: async (): Promise<UserCredential | null> =>
        this.redirectUser ? ({ user: this.redirectUser } as UserCredential) : null,
      signOut: async (): Promise<void> => {
        this.fire(null);
      },
      ...overrides,
    };
    return { auth: {} as never, api };
  }
}

describe('normalizeAuthError', () => {
  it('maps known Firebase codes to stable, retryable categories', () => {
    expect(normalizeAuthError({ code: 'auth/popup-closed-by-user' } as unknown)).toMatchObject({
      key: 'popup-closed',
      retryable: true,
    });
    expect(normalizeAuthError({ code: 'auth/popup-blocked' } as unknown)).toMatchObject({
      key: 'popup-blocked',
      retryable: true,
    });
    expect(normalizeAuthError({ code: 'auth/network-request-failed' } as unknown)).toMatchObject({
      key: 'network-error',
      retryable: true,
    });
    expect(normalizeAuthError({ code: 'auth/unauthorized-domain' } as unknown)).toMatchObject({
      key: 'unauthorized-domain',
      retryable: false,
    });
    expect(normalizeAuthError({ code: 'auth/operation-not-allowed' } as unknown)).toMatchObject({
      key: 'operation-not-allowed',
      retryable: false,
    });
  });

  it('falls back to a human-readable unknown error for non-Firebase throws', () => {
    const res = normalizeAuthError(new Error('something exploded'));
    expect(res.key).toBe('unknown');
    expect(res.message).toContain('something exploded');
    expect(res.retryable).toBe(true);
  });
});

describe('mapping', () => {
  it('maps a Firebase user into a plain SessionUser', () => {
    const fb = new FakeAuthEnv().makeUser();
    const mapped = mapFirebaseUser(fb);
    expect(mapped).toMatchObject({
      uid: 'uid-1',
      email: 'maya@example.com',
      displayName: 'Maya Lindqvist',
      provider: 'google.com',
      isDemo: false,
      emailVerified: true,
    });
  });

  it('creates an explicit demo session that is clearly flagged', () => {
    const demo = createDemoUser();
    expect(demo.isDemo).toBe(true);
    expect(demo.provider).toBe('demo');
  });
});

describe('AuthService (injected fakes, no network)', () => {
  it('starts signed-out and emits the current state to new subscribers', async () => {
    const env = new FakeAuthEnv();
    const svc = createAuthService(env.options());
    const seen: Array<null | object> = [];
    const unsubscribe = svc.subscribe((u) => seen.push(u));
    expect(svc.currentUser).toBeNull();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeNull();
    unsubscribe();
  });

  it('signs in with Google popup and notifies subscribers with the session', async () => {
    const env = new FakeAuthEnv();
    const svc = createAuthService(env.options());
    const seen: Array<{ uid: string; isDemo: boolean } | null> = [];
    svc.subscribe((u) => seen.push(u && { uid: u.uid, isDemo: u.isDemo }));

    await svc.signInWithGoogle('popup');

    expect(svc.currentUser?.uid).toBe('uid-1');
    expect(svc.currentUser?.isDemo).toBe(false);
    expect(seen.at(-1)).toEqual({ uid: 'uid-1', isDemo: false });
  });

  it('rejects redirect sign-in with REDIRECT_IN_PROGRESS (page is reloading)', async () => {
    const env = new FakeAuthEnv();
    const svc = createAuthService(env.options());
    await expect(svc.signInWithGoogle('redirect')).rejects.toThrow('REDIRECT_IN_PROGRESS');
  });

  it('restores a pending redirect result as a session, or null when none', async () => {
    const env = new FakeAuthEnv();
    const svc = createAuthService(env.options());

    await expect(svc.completeRedirectSignIn()).resolves.toBeNull();

    env.redirectUser = env.makeUser();
    const restored = await svc.completeRedirectSignIn();
    expect(restored?.uid).toBe('uid-1');
    expect(restored?.isDemo).toBe(false);
  });

  it('returns null token while signed out and emits a real token when signed in', async () => {
    const env = new FakeAuthEnv();
    const svc = createAuthService(env.options());
    expect(await svc.getIdToken()).toBeNull();
    env.fire(env.makeUser());
    expect(svc.currentUser).not.toBeNull();
    const token = await svc.currentUser?.source?.getIdToken?.();
    expect(token).toBe('id-token-abc');
  });

  it('signs out real sessions and notifies subscribers', async () => {
    const env = new FakeAuthEnv();
    const svc = createAuthService(env.options());
    env.fire(env.makeUser());
    const seen: Array<null | object> = [];
    svc.subscribe((u) => seen.push(u));

    await svc.signOut();

    expect(svc.currentUser).toBeNull();
    expect(seen.at(-1)).toBeNull();
  });

  it('demo sign-in sets a local session and clears it without calling Firebase', async () => {
    const env = new FakeAuthEnv();
    const spySignOut = vi.fn(async () => {});
    const svc = createAuthService(env.options({ signOut: spySignOut }));

    const demo = svc.signInAsDemo();
    expect(demo.isDemo).toBe(true);
    expect(svc.currentUser?.isDemo).toBe(true);

    await svc.signOut();
    expect(svc.currentUser).toBeNull();
    expect(spySignOut).not.toHaveBeenCalled();
  });
});