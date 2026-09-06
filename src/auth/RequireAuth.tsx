import React from 'react';
import { useAuth } from './AuthContext';
import { AuthErrorScreen, AuthLoadingScreen, UnauthorizedScreen } from './screens';

/**
 * Protected-route gate.
 *
 *   initializing / signing-in → loading screen
 *   restore-failed            → error screen (with retry)
 *   unauthenticated           → `fallback` (access denied)
 *   authenticated             → `children`
 *
 * Wrap any surface that must never render without a session.
 */
export const RequireAuth: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback,
}) => {
  const { status } = useAuth();

  if (status === 'initializing' || status === 'signing-in') {
    return <AuthLoadingScreen />;
  }
  if (status === 'restore-failed') {
    return <AuthErrorScreen />;
  }
  if (status === 'authenticated') {
    return <>{children}</>;
  }
  return <>{fallback ?? <UnauthorizedScreen />}</>;
};

export default RequireAuth;
