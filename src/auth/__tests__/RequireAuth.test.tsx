import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';
import { RequireAuth } from '../RequireAuth';
import { AuthLoadingScreen } from '../screens';
import { createFakeAuth, makeSession } from './helpers';

function ProtectedWorkspace() {
  const { signOut } = useAuth();
  return (
    <div>
      <div data-testid="protected-content">SECRET JOURNAL WORKSPACE</div>
      <button data-testid="protected-signout" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}

function renderGate(service: ReturnType<typeof createFakeAuth>['service'], fallback?: React.ReactNode) {
  return render(
    <AuthProvider service={service}>
      <RequireAuth fallback={fallback}>
        <ProtectedWorkspace />
      </RequireAuth>
    </AuthProvider>,
  );
}

describe('RequireAuth — protected route boundary', () => {
  it('6 · direct access without a session renders the unauthorized state, not the content', async () => {
    const controller = createFakeAuth({ initialUser: null });
    renderGate(controller.service);

    await waitFor(() => expect(screen.getByText(/private space/i)).toBeInTheDocument());
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('6 · direct access while the session is still restoring shows the loading screen', async () => {
    const controller = createFakeAuth({ initialUser: null, subscribeEmitsImmediately: false });
    renderGate(controller.service);

    expect(screen.getByText(/restoring your session/i)).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('6 · a custom fallback is used when provided', async () => {
    const controller = createFakeAuth({ initialUser: null });
    renderGate(controller.service, <div data-testid="custom-denied">CUSTOM ACCESS DENIED</div>);

    await waitFor(() => expect(screen.getByTestId('custom-denied')).toBeInTheDocument());
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('authenticated users see the protected content', async () => {
    const controller = createFakeAuth({ initialUser: makeSession() });
    renderGate(controller.service);

    await waitFor(() => expect(screen.getByTestId('protected-content')).toBeInTheDocument());
    expect(screen.queryByText(/private space/i)).not.toBeInTheDocument();
  });

  it('content disappears immediately after sign-out while on a protected surface', async () => {
    const user = userEvent.setup();
    const controller = createFakeAuth({ initialUser: makeSession() });
    renderGate(controller.service);

    await waitFor(() => expect(screen.getByTestId('protected-content')).toBeInTheDocument());

    await user.click(screen.getByTestId('protected-signout'));

    await waitFor(() => expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument());
    expect(screen.getByText(/private space/i)).toBeInTheDocument();
  });
});

describe('AuthLoadingScreen', () => {
  it('announces the busy state with a polite live region', () => {
    const { container } = render(<AuthLoadingScreen label="Securing your journal…" />);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });
});
