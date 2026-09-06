import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createAuthService } from '../auth';

describe('Demo Mode Security & AI Guard', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MODE', 'production');
    // @ts-ignore
    vi.stubEnv('DEV', false);
  });
  
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('demo getIdToken() returns null in production-style environment', async () => {
    const svc = createAuthService({ auth: {} as any, api: { onAuthStateChanged: () => {} } as any });
    // @ts-ignore
    svc._user = { isDemo: true, uid: 'demo-local-user', provider: 'demo' };
    
    const token = await svc.getIdToken();
    expect(token).toBeNull();
  });

  it('getIdToken() returns demo-token in development/test environment', async () => {
    vi.stubEnv('MODE', 'test');
    const svc = createAuthService({ auth: {} as any, api: { onAuthStateChanged: () => {} } as any });
    // @ts-ignore
    svc._user = { isDemo: true, uid: 'demo-local-user', provider: 'demo' };
    
    const token = await svc.getIdToken();
    expect(token).toBe('demo-token');
  });
});

import { authService } from '../auth';
import { reflect } from '../ai';
import { askMyLifeQuery } from '../askMyLife';

describe('Demo Mode Security - AI Guard (ai.ts & askMyLife.ts)', () => {
  let originalUser: any;
  beforeEach(() => {
    // @ts-ignore
    originalUser = authService._user;
  });

  afterEach(() => {
    // @ts-ignore
    authService._user = originalUser;
  });

  it('rejects AI operations natively if user is a Demo user', async () => {
    // @ts-ignore
    authService._user = { isDemo: true };
    // @ts-ignore
    await expect(reflect({ prompt: 'test', mode: 'free-write', title: 't' })).rejects.toThrow(/Live Gemini AI is available after signing in/);
  });

  it('askMyLife service guards demo users gracefully without network fetch', async () => {
    // @ts-ignore
    authService._user = { isDemo: true };
    const res = await askMyLifeQuery({ question: 'Why?', entries: [] });
    expect(res.answer).toMatch(/Live Gemini AI is available after signing in/);
    expect(res.confidence).toBe('insufficient');
  });
});

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocationPicker } from '../../components/LocationPicker';

describe('Demo Mode Security - Cloud Isolation (Places)', () => {
  let originalUser: any;
  let fetchSpy: any;

  beforeEach(() => {
    // @ts-ignore
    originalUser = authService._user;
    vi.spyOn(authService, 'getIdToken').mockResolvedValue('mock-token');
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [{ placeId: '1', mainText: 'Paris', secondaryText: 'France', description: 'Paris, France' }] })
    } as Response);
  });

  afterEach(() => {
    // @ts-ignore
    authService._user = originalUser;
    vi.restoreAllMocks();
  });

  it('Demo Places request causes ZERO fetch/network calls and shows sign-in text', async () => {
    // @ts-ignore
    authService._user = { isDemo: true };
    render(<LocationPicker location={null} onLocationChange={() => {}} />);
    
    const input = screen.getByRole('textbox');
    const user = userEvent.setup();
    await user.type(input, 'Par');
    
    // Wait for debounce
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });
    
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await screen.findByText(/Sign in with Google to use live cloud features/)).toBeInTheDocument();
  });

  it('Google-authenticated user behavior still works normally', async () => {
    // @ts-ignore
    authService._user = { isDemo: false, uid: 'real-user' };
    render(<LocationPicker location={null} onLocationChange={() => {}} />);
    
    const input = screen.getByRole('textbox');
    const user = userEvent.setup();
    await user.type(input, 'Par');
    
    // Wait for debounce
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
    });
    
    expect(fetchSpy).toHaveBeenCalledWith('/api/google/places/autocomplete', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer mock-token'
      })
    }));
    expect(await screen.findByText('Paris')).toBeInTheDocument();
  });
});
