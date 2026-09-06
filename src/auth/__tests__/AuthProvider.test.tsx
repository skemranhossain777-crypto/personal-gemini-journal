import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '../AuthContext';
import { createFakeAuth, makeSession, Probe } from './helpers';

const renderProbe = (service: ReturnType<typeof createFakeAuth>['service']) =>
  render(
    <AuthProvider service={service}>
      <Probe />
    </AuthProvider>,
  );

describe('AuthProvider — authentication lifecycle', () => {
  it('1 · starts unauthenticated when no session exists', async () => {
    const controller = createFakeAuth({ initialUser: null });
    renderProbe(controller.service);

    await waitFor(() => expect(screen.getByTestId('probe-status')).toHaveTextContent('unauthenticated'));
    expect(screen.queryByTestId('probe-user')).not.toBeInTheDocument();
    expect(screen.queryByTestId('probe-error')).not.toBeInTheDocument();
  });

  it('2 · Google sign-in transitions to an authenticated session', async () => {
    const user = userEvent.setup();
    const controller = createFakeAuth({ initialUser: null });
    renderProbe(controller.service);

    await user.click(screen.getByTestId('probe-signin'));

    await waitFor(() => expect(screen.getByTestId('probe-status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('probe-user')).toHaveTextContent('maya@example.com');
    expect(controller.service.currentUser?.isDemo).toBe(false);
    expect(controller.signInWithGoogle).toHaveBeenCalled();
  });

  it('3 · refresh after login restores the persisted session', async () => {
    // A reload bootstraps the provider with the persisted Firebase session.
    const controller = createFakeAuth({ initialUser: makeSession({ uid: 'uid-9' }) });
    renderProbe(controller.service);

    await waitFor(() => expect(screen.getByTestId('probe-status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('probe-user')).toHaveTextContent('maya@example.com');
  });

  it('4 · sign-out returns to the unauthenticated state', async () => {
    const user = userEvent.setup();
    const controller = createFakeAuth({ initialUser: makeSession() });
    renderProbe(controller.service);

    await waitFor(() => expect(screen.getByTestId('probe-status')).toHaveTextContent('authenticated'));

    await user.click(screen.getByTestId('probe-signout'));

    await waitFor(() => expect(screen.getByTestId('probe-status')).toHaveTextContent('unauthenticated'));
    expect(screen.queryByTestId('probe-user')).not.toBeInTheDocument();
    expect(controller.signOut).toHaveBeenCalled();
  });

  it('5 · failed authentication surfaces an error and stays unauthenticated', async () => {
    const user = userEvent.setup();
    const controller = createFakeAuth({ initialUser: null });
    controller.failSignInWith({
      code: 'auth/popup-closed-by-user',
      message: 'The popup was closed.',
    });
    renderProbe(controller.service);

    await waitFor(() => expect(screen.getByTestId('probe-status')).toHaveTextContent('unauthenticated'));
    await user.click(screen.getByTestId('probe-signin'));

    await waitFor(() => expect(screen.getByTestId('probe-error')).toHaveTextContent(/sign-in window was closed/i));
    expect(screen.getByTestId('probe-status')).toHaveTextContent('unauthenticated');
    expect(screen.queryByTestId('probe-user')).not.toBeInTheDocument();
  });

  it('demo sign-in creates a local flagged session; sign-out clears it', async () => {
    const user = userEvent.setup();
    const controller = createFakeAuth({ initialUser: null });
    renderProbe(controller.service);

    await user.click(screen.getByTestId('probe-demo'));
    await waitFor(() => expect(screen.getByTestId('probe-status')).toHaveTextContent('authenticated'));
    expect(controller.service.currentUser?.isDemo).toBe(true);

    await user.click(screen.getByTestId('probe-signout'));
    await waitFor(() => expect(screen.getByTestId('probe-status')).toHaveTextContent('unauthenticated'));
  });

  it('a failed session restore is a distinct, retryable state', async () => {
    const controller = createFakeAuth({ initialUser: null, subscribeEmitsImmediately: false });
    controller.failRestoreWith({ code: 'auth/network-request-failed', message: 'offline' });
    renderProbe(controller.service);

    await waitFor(() => expect(screen.getByTestId('probe-status')).toHaveTextContent('restore-failed'));
    expect(screen.getByTestId('probe-error')).toHaveTextContent(/network problem/i);
  });
});