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
        timelineEvents={[]}
      />
    );

    // Verify core navigation tabs are rendered
    expect(screen.getByRole('navigation', { name: /Desktop Primary Navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Mobile Bottom Navigation/i })).toBeInTheDocument();
  });

  it('switches tabs smoothly between Home, Journal, Memories, Timeline, Ask My Life, and Profile', async () => {
    const user = userEvent.setup();

    render(
      <ResponsiveNavigationShell
        currentUserId="user1"
        entries={[mockEntry]}
        memories={[]}
        goals={[]}
        timelineEvents={[]}
      />
    );

    // Default tab: Home
    expect(screen.getByText(/Today's Journal/i)).toBeInTheDocument();

    // Click Memories tab
    const memoriesNavBtns = screen.getAllByRole('button', { name: /Memories/i });
    await user.click(memoriesNavBtns[0]);
    expect(await screen.findByText(/Personal Memory Engine/i, {}, { timeout: 4000 })).toBeInTheDocument();

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
        timelineEvents={[]}
      />
    );

    const mobileNav = screen.getByRole('navigation', { name: /Mobile Bottom Navigation/i });
    const buttons = mobileNav.querySelectorAll('button');

    expect(buttons.length).toBe(6);
    buttons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('min-w-[44px]');
    });
  });

  it('renders all six primary nav tabs and hides dev/experimental surfaces', () => {
    render(
      <ResponsiveNavigationShell
        currentUserId="user1"
        entries={[mockEntry]}
        memories={[]}
        goals={[]}
        timelineEvents={[]}
      />
    );

    const desktopNav = screen.getByRole('navigation', { name: /Desktop Primary Navigation/i });
    const tabs = desktopNav.querySelectorAll('button');
    expect(tabs.length).toBe(6);

    const labels = Array.from(tabs).map((b) => b.textContent ?? '');
    expect(labels).toEqual(
      expect.arrayContaining(['Home', 'Journal', 'Memories', 'Timeline', 'Ask My Life', 'Privacy']),
    );

    // Dev/experimental surfaces must not be reachable from the primary nav.
    expect(screen.queryByText(/Design System/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/On This Day/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Voice Journal/i)).not.toBeInTheDocument();
  });
});
