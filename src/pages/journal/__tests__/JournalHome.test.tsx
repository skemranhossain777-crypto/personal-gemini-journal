import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import type { Collection, JournalEntry } from '../../../data';
import { JournalHome } from '../JournalHome';
import { expectAxeClean } from '../../../test/a11y';

const TS = new Timestamp(1_752_000_000, 0);

function makeEntry(overrides: Partial<JournalEntry>): JournalEntry {
  const entry: JournalEntry = {
    id: 'e1',
    uid: 'u1',
    title: 'Untitled',
    body: '',
    mode: 'free-write',
    mood: null,
    energy: null,
    tags: [],
    location: null,
    attachments: [],
    favorite: false,
    archived: false,
    private: false,
    aiMetadata: null,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  };
  entry.tags = [...(overrides.tags ?? [])];
  entry.attachments = [...(overrides.attachments ?? [])];
  return entry;
}

const COLLECTIONS: Collection[] = [
  { id: 'c1', uid: 'u1', name: 'Work', description: '', color: '#8ab4f8', entryIds: ['e1'], createdAt: TS, updatedAt: TS },
  { id: 'c2', uid: 'u1', name: 'Travel', description: '', color: '#f28b82', entryIds: ['e2'], createdAt: TS, updatedAt: TS },
];

function renderHome(options: {
  entries?: JournalEntry[];
  collections?: Collection[];
  canUseCollections?: boolean;
  loading?: boolean;
} = {}) {
  const props = {
    entries: options.entries ?? [],
    collections: options.collections ?? [],
    loading: options.loading ?? false,
    canUseCollections: options.canUseCollections ?? false,
    onNewEntry: vi.fn(),
    onOpenEntry: vi.fn(),
    onToggleFavorite: vi.fn(),
    onToggleArchive: vi.fn(),
  };
  const utils = render(
    <main>
      <JournalHome {...props} />
    </main>,
  );
  return { ...utils, ...props };
}

describe('JournalHome', () => {
  it('renders entries and opens one from its title button', async () => {
    const user = userEvent.setup();
    const { onOpenEntry } = renderHome({
      entries: [makeEntry({ id: 'e1', title: 'Morning pages', body: 'First light.' })],
    });

    expect(screen.getByRole('heading', { name: 'Journal' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Open entry: Morning pages/i }));
    expect(onOpenEntry).toHaveBeenCalledWith('e1');
  });

  it('opens the entry when clicking anywhere on the card', async () => {
    const user = userEvent.setup();
    const { onOpenEntry } = renderHome({
      entries: [makeEntry({ id: 'e2', title: 'Long walk', body: 'Detail.' })],
    });
    await user.click(screen.getByText(/Detail\./i));
    expect(onOpenEntry).toHaveBeenCalledWith('e2');
  });

  it('filters by title, body, and tag through search', async () => {
    const user = userEvent.setup();
    const { onOpenEntry } = renderHome({
      entries: [
        makeEntry({ id: 'e1', title: 'Focus session', body: 'Deep work.', tags: ['pomodoro'] }),
        makeEntry({ id: 'e2', title: 'Rant', body: 'Trains are late again.', tags: [] }),
        makeEntry({ id: 'e3', title: 'Dream', body: 'A blue door.', tags: ['lucid'] }),
      ],
    });

    await user.type(screen.getByRole('searchbox', { name: 'Search entries' }), 'trains');
    expect(screen.getAllByText(/late again/i)).toHaveLength(1);
    expect(onOpenEntry).not.toHaveBeenCalled();
  });

  it('filters by tag through search', async () => {
    const user = userEvent.setup();
    renderHome({
      entries: [
        makeEntry({ id: 'e1', title: 'A', body: 'x', tags: ['pomodoro'] }),
        makeEntry({ id: 'e2', title: 'B', body: 'y', tags: ['other'] }),
      ],
    });
    await user.type(screen.getByRole('searchbox', { name: 'Search entries' }), 'pomodoro');
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByText('B')).not.toBeInTheDocument();
  });

  it('switches between All, Favorites, and Archived tabs', async () => {
    const user = userEvent.setup();
    renderHome({
      entries: [
        makeEntry({ id: 'e1', title: 'Fav one', favorite: true }),
        makeEntry({ id: 'e2', title: 'Gone', archived: true }),
        makeEntry({ id: 'e3', title: 'Live', favorite: false }),
      ],
    });

    expect(screen.getByText('Fav one')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.queryByText('Gone')).not.toBeInTheDocument(); // All hides archived

    await user.click(screen.getByRole('tab', { name: /Favorites/i }));
    expect(screen.getByText('Fav one')).toBeInTheDocument();
    expect(screen.queryByText('Live')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Archived/i }));
    expect(screen.getByText('Gone')).toBeInTheDocument();
    expect(screen.queryByText('Fav one')).not.toBeInTheDocument();
  });

  it('fires new-entry and toggle callbacks without navigating', async () => {
    const user = userEvent.setup();
    const { onNewEntry, onOpenEntry, onToggleFavorite, onToggleArchive } = renderHome({
      entries: [makeEntry({ id: 'e1', title: 'T', body: 'b' })],
    });

    await user.click(screen.getByRole('button', { name: /^New$/i }));
    expect(onNewEntry).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Add to favorites' }));
    expect(onToggleFavorite).toHaveBeenCalled();
    expect(onOpenEntry).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Archive entry' }));
    expect(onToggleArchive).toHaveBeenCalled();
    expect(onOpenEntry).not.toHaveBeenCalled();
  });

  it('filters entries by collection', async () => {
    const user = userEvent.setup();
    renderHome({
      canUseCollections: true,
      collections: COLLECTIONS,
      entries: [
        makeEntry({ id: 'e1', title: 'Work note', body: 'a' }),
        makeEntry({ id: 'e2', title: 'Travel log', body: 'b' }),
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Work' }));
    expect(screen.getByText('Work note')).toBeInTheDocument();
    expect(screen.queryByText('Travel log')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Work' }));
    expect(screen.getByText('Travel log')).toBeInTheDocument();
  });

  it('shows a friendly empty state with an action', async () => {
    const user = userEvent.setup();
    const { onNewEntry } = renderHome({});
    expect(screen.getByText('Your first entry is waiting')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /New entry/i }));
    expect(onNewEntry).toHaveBeenCalled();
  });

  it('has no axe accessibility violations with a populated list', async () => {
    renderHome({
      canUseCollections: true,
      collections: COLLECTIONS,
      entries: [
        makeEntry({ id: 'e1', title: 'Sunrise', body: 'Gold over the hills.', mood: 4, energy: 80, tags: ['morning'], favorite: true }),
        makeEntry({ id: 'e2', title: 'Storm', body: 'The wind pressed the window.', archived: true }),
        makeEntry({ id: 'e3', title: 'Garden', body: 'Tomatoes are turning red.' }),
      ],
    });
    await waitFor(() => expect(screen.getByText('Sunrise')).toBeInTheDocument());
    await expectAxeClean(document.body);
  });
});
