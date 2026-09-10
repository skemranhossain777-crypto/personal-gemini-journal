import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { ResponsiveNavigationShell } from '../ResponsiveNavigationShell';
import type { JournalEntry } from '../../../data/models';

describe('ResponsiveNavigationShell component & UX responsiveness', () => {
  const mockEntry: JournalEntry = {
    id: 'entry_1',
    uid: 'user1',
    title: 'Sample Journal Entry',
    body: 'Sample body text for responsive shell test.',
    mode: 'free-write',
    mood: 4,
    energy: 80,
    tags: ['sample'],
    location: null,
    attachments: [],
    favorite: false,
    archived: false,
    private: false,
    aiMetadata: null,
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  it('renders sidebar on desktop and bottom navigation bar for mobile', () => {
    render(
      <ResponsiveNavigationShell
        currentUserId="user1"
        entries={[mockEntry]}
        memories={[]}
        goals={[]}
        habits={[]}
        timelineEvents={[]}
      />
    );

    // Verify core navigation tabs are rendered
    expect(screen.getByRole('navigation', { name: /Desktop Primary Navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Mobile Bottom Navigation/i })).toBeInTheDocument();
  });

  it('switches tabs smoothly between Home, Journal, Memories, Growth, Timeline, Ask My Life, and Profile', async () => {
    const user = userEvent.setup();

    render(
      <ResponsiveNavigationShell
        currentUserId="user1"
        entries={[mockEntry]}
        memories={[]}
        goals={[]}
        habits={[]}
        timelineEvents={[]}
      />
    );

    // Default tab: Home
    expect(screen.getByText(/Today's Journal/i)).toBeInTheDocument();

    // Click Memories tab
    const memoriesNavBtns = screen.getAllByRole('button', { name: /Memories/i });
    await user.click(memoriesNavBtns[0]);
    expect(await screen.findByText(/Personal Memory Engine/i, {}, { timeout: 4000 })).toBeInTheDocument();

    // Click Growth tab
    const growthNavBtns = screen.getAllByRole('button', { name: /Growth/i });
    await user.click(growthNavBtns[0]);
    expect(await screen.findByText(/Habits & Reflective Rhythms/i, {}, { timeout: 4000 })).toBeInTheDocument();

    // Click Timeline tab
    const timelineNavBtns = screen.getAllByRole('button', { name: /Timeline/i });
    await user.click(timelineNavBtns[0]);
    expect(await screen.findByText(/Your Life Timeline/i, {}, { timeout: 4000 })).toBeInTheDocument();

    // Click Profile tab
    const profileNavBtns = screen.getAllByRole('button', { name: /Privacy/i });
    await user.click(profileNavBtns[0]);
    expect(await screen.findByText(/Privacy & Data Governance Center/i, {}, { timeout: 4000 })).toBeInTheDocument();
  }, 15000);

  it('verifies bottom navigation items have min-h-[44px] and min-w-[44px] touch target sizes', () => {
    render(
      <ResponsiveNavigationShell
        currentUserId="user1"
        entries={[mockEntry]}
        memories={[]}
        goals={[]}
        habits={[]}
        timelineEvents={[]}
      />
    );

    const mobileNav = screen.getByRole('navigation', { name: /Mobile Bottom Navigation/i });
    const buttons = mobileNav.querySelectorAll('button');

    expect(buttons.length).toBe(7);
    buttons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('min-w-[44px]');
    });
  });

  it('renders all seven primary nav tabs and hides dev/experimental surfaces', () => {
    render(
      <ResponsiveNavigationShell
        currentUserId="user1"
        entries={[mockEntry]}
        memories={[]}
        goals={[]}
        habits={[]}
        timelineEvents={[]}
      />
    );

    const desktopNav = screen.getByRole('navigation', { name: /Desktop Primary Navigation/i });
    const tabs = desktopNav.querySelectorAll('button');
    expect(tabs.length).toBe(7);

    const labels = Array.from(tabs).map((b) => b.textContent ?? '');
    expect(labels).toEqual(
      expect.arrayContaining(['Home', 'Journal', 'Memories', 'Growth', 'Timeline', 'Ask My Life', 'Privacy']),
    );

    // Dev/experimental surfaces must not be reachable from the primary nav.
    expect(screen.queryByText(/Design System/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Voice Journal/i)).not.toBeInTheDocument();
  });

  it('renders the real user name and email in the sidebar footer, never the UID', () => {
    render(
      <ResponsiveNavigationShell
        currentUserId="firebase-uid-123"
        user={{
          uid: 'firebase-uid-123',
          displayName: 'Sheikh Emran Hossain',
          email: 'skemranhossain777@gmail.com',
          photoURL: null,
          providerData: [],
        }}
        entries={[]}
        memories={[]}
        goals={[]}
        habits={[]}
        timelineEvents={[]}
      />
    );

    expect(screen.getByText('Sheikh Emran Hossain')).toBeInTheDocument();
    expect(screen.getByText('skemranhossain777@gmail.com')).toBeInTheDocument();
    expect(screen.queryByText('firebase-uid-123')).not.toBeInTheDocument();
  });

  it('renders the Google profile photo as the avatar with no-referrer policy', () => {
    render(
      <ResponsiveNavigationShell
        currentUserId="firebase-uid-123"
        user={{
          uid: 'firebase-uid-123',
          displayName: 'Sheikh Emran Hossain',
          email: 'skemranhossain777@gmail.com',
          photoURL: 'https://lh3.googleusercontent.com/photo.jpg',
          providerData: [],
        }}
        entries={[]}
        memories={[]}
        goals={[]}
        habits={[]}
        timelineEvents={[]}
      />
    );

    const avatar = screen.getByAltText('Sheikh Emran Hossain profile photo');
    expect(avatar).toBeInTheDocument();
    expect(avatar.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('falls back to initials from the Google provider displayName when top-level profile is missing', () => {
    render(
      <ResponsiveNavigationShell
        currentUserId="firebase-uid-123"
        user={{
          uid: 'firebase-uid-123',
          displayName: null,
          email: null,
          photoURL: null,
          providerData: [
            { providerId: 'google.com', displayName: 'Sheikh Emran Hossain', email: 'skemranhossain777@gmail.com', photoURL: null },
          ],
        }}
        entries={[]}
        memories={[]}
        goals={[]}
        habits={[]}
        timelineEvents={[]}
      />
    );

    expect(screen.getByText('Sheikh Emran Hossain')).toBeInTheDocument();
    expect(screen.getByText('skemranhossain777@gmail.com')).toBeInTheDocument();
    expect(screen.queryByText('firebase-uid-123')).not.toBeInTheDocument();
  });

  it('shows a readable email-derived identity and not the UID for minimal profiles', () => {
    render(
      <ResponsiveNavigationShell
        currentUserId="firebase-uid-123"
        user={{ uid: 'firebase-uid-123', displayName: null, email: 'skemranhossain777@gmail.com', photoURL: null }}
        entries={[]}
        memories={[]}
        goals={[]}
        habits={[]}
        timelineEvents={[]}
      />
    );

    expect(screen.getByText('skemranhossain777')).toBeInTheDocument();
    expect(screen.getByText('skemranhossain777@gmail.com')).toBeInTheDocument();
    expect(screen.queryByText('firebase-uid-123')).not.toBeInTheDocument();
  });

  it('triggers the sign-out handler from the sidebar identity footer', async () => {
    const user = userEvent.setup();
    const handleSignOut = vi.fn();

    render(
      <ResponsiveNavigationShell
        currentUserId="firebase-uid-123"
        user={{ uid: 'firebase-uid-123', displayName: 'Sheikh Emran Hossain', email: 'skemranhossain777@gmail.com', photoURL: null }}
        entries={[]}
        memories={[]}
        goals={[]}
        habits={[]}
        timelineEvents={[]}
        onSignOut={handleSignOut}
      />
    );

    await user.click(screen.getByRole('button', { name: /Sign Out/i }));
    expect(handleSignOut).toHaveBeenCalledTimes(1);
  });
});
