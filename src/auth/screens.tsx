import React from 'react';
import { AlertTriangle, ArrowLeft, Lock, RotateCcw, ShieldAlert, Sparkles } from 'lucide-react';
import { Button, Spinner, Text } from '../components/ui';
import { useAuth } from './AuthContext';

interface ScreenShellProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  actions?: React.ReactNode;
}

function ScreenShell({ title, description, icon, actions }: ScreenShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4 text-ink-mid">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">{icon}</div>
        <div className="space-y-2">
          <Text as="h1" variant="displaySm">
            {title}
          </Text>
          {description && <Text variant="body">{description}</Text>}
        </div>
        {actions && <div className="flex flex-col items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Full-screen busy state while the session is being established. */
export const AuthLoadingScreen: React.FC<{ label?: string }> = ({ label = 'Restoring your session…' }) => (
  <div
    role="status"
    aria-live="polite"
    className="flex h-screen flex-col items-center justify-center gap-4 bg-page text-ink-mid"
  >
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface-4 text-accent shadow-glow">
      <Sparkles className="h-6 w-6" aria-hidden="true" />
    </div>
    <Spinner size="md" />
    <p className="text-xs font-medium text-ink-low">{label}</p>
  </div>
);

/**
 * Access-denied state for a protected route reached without a session
 * (e.g. direct navigation to `#/app`).
 */
export const UnauthorizedScreen: React.FC<{ onHome?: () => void }> = ({ onHome }) => {
  const { signIn, isBusy } = useAuth();
  return (
    <ScreenShell
      title="This page is a private space."
      description="You need to sign in to open the journal. Nothing here is visible without an authenticated session."
      icon={
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-danger/40 bg-danger/10 text-danger">
          <Lock className="h-7 w-7" aria-hidden="true" />
        </div>
      }
      actions={
        <>
          <Button onClick={() => void signIn()} loading={isBusy}>
            Sign in with Google
          </Button>
          {onHome && (
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-3.5 w-3.5" />} onClick={onHome}>
              Back to home
            </Button>
          )}
        </>
      }
    />
  );
};

/** Session-restore failure — distinct from "not signed in" (needs a retry). */
export const AuthErrorScreen: React.FC<{ onHome?: () => void }> = ({ onHome }) => {
  const { error, retryRestore, signIn, signOut, isBusy } = useAuth();
  return (
    <ScreenShell
      title="We couldn't restore your session."
      description={error?.message ?? 'Something went wrong while restoring your sign-in.'}
      icon={
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-warning/40 bg-warning/10 text-warning">
          <ShieldAlert className="h-7 w-7" aria-hidden="true" />
        </div>
      }
      actions={
        <div role="alert" className="w-full">
          <div className="flex flex-col items-center gap-2">
            <Button onClick={() => void retryRestore()} loading={isBusy} icon={<RotateCcw className="h-3.5 w-3.5" />}>
              Try again
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void signIn()}>
              Sign in manually
            </Button>
            <div className="flex items-center gap-3">
              {onHome && (
                <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-3.5 w-3.5" />} onClick={onHome}>
                  Back to home
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          </div>
        </div>
      }
    />
  );
};

/** Small inline alert used by screens to surface the last auth error. */
export const AuthErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div
    role="alert"
    className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-left"
  >
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
    <Text variant="caption">{message}</Text>
  </div>
);
