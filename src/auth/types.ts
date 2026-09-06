import type { SessionUser, AuthErrorInfo } from '../services/auth';

/**
 * Auth boundary state machine.
 *
 *   initializing  → authenticated | unauthenticated | restore-failed
 *   signing-in    → authenticated | unauthenticated
 *   authenticated → unauthenticated (sign-out / session loss)
 *   restore-failed→ unauthenticated | authenticated (retry)
 */
export type AuthStatus =
  | 'initializing'
  | 'signing-in'
  | 'authenticated'
  | 'unauthenticated'
  | 'restore-failed';

export interface AuthState {
  status: AuthStatus;
  user: SessionUser | null;
  error: AuthErrorInfo | null;
}

export interface AuthContextValue extends AuthState {
  /** Attempt Google Sign-In (popup → redirect fallback). Never throws. */
  signIn: () => Promise<void>;
  /** Start an anonymous demo exploration session (no Firebase account). */
  signInAsDemo: () => void;
  /** End the current session. */
  signOut: () => Promise<void>;
  /** Re-attempt session restoration after a `restore-failed` state. */
  retryRestore: () => Promise<void>;
  /** Clear the last auth error so the UI returns to a neutral state. */
  clearError: () => void;
  /** Firebase ID token for authorized API calls, null for demo/signed-out. */
  getAccessToken: () => Promise<string | null>;
  /** True while the session is being established (initializing or signing-in). */
  isBusy: boolean;
}
