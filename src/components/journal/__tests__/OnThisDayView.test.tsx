import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { OnThisDayView } from '../OnThisDayView';
import type { JournalEntry } from '../../../data/models';

describe('OnThisDayView component', () => {
  const mockTimestamp = (isoString: string): Timestamp => {
    return Timestamp.fromDate(new Date(isoString));
  };

  const createEntry = (id: string, uid: string, isoString: string, title: string): JournalEntry => ({
    id,
    uid,
    title,
    body: 'Sample entry body text for testing On This Day.',
    mode: 'free-write',
    mood: 5,
    energy: 90,
    tags: ['reflection'],
    location: { lat: 35.0, lng: 135.7, placeName: 'Kyoto' },
    attachments: [],
    favorite: false,
    archived: false,
    private: false,
    aiMetadata: null,
    createdAt: mockTimestamp(isoString),
    updatedAt: mockTimestamp(isoString),
  });

  const targetDate = new Date('2026-09-06T12:00:00Z');

  it('renders emotional empty state when no historical entries exist for current date', async () => {
    const user = userEvent.setup();
    const onCreateReflection = vi.fn();

    render(
      <OnThisDayView
        entries={[]}
        currentUserId="user1"
        targetDate={targetDate}
        timeZone="UTC"
        onCreateReflection={onCreateReflection}
      />
    );

    expect(screen.getByText(/No Past Memories Recorded for September 6/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Today is a clean canvas. Write a reflection today/i)
    ).toBeInTheDocument();

    const startBtn = screen.getByRole('button', { name: /Start Today's Reflection/i });
    await user.click(startBtn);

    expect(onCreateReflection).toHaveBeenCalledWith();
  });

  it('renders historical groups with "One year ago today...", "Two years ago..." and actions', async () => {
    const user = userEvent.setup();
    const onOpenEntry = vi.fn();
    const onToggleFavorite = vi.fn();
    const onCreateReflection = vi.fn();
    const onCreateMemory = vi.fn();

    const entries = [
      createEntry('e_1yr', 'user1', '2025-09-06T10:00:00Z', 'Trip to Kyoto 2025'),
      createEntry('e_2yr', 'user1', '2024-09-06T10:00:00Z', 'Launch Milestone 2024'),
    ];

    render(
      <OnThisDayView
        entries={entries}
        currentUserId="user1"
        targetDate={targetDate}
        timeZone="UTC"
        onOpenEntry={onOpenEntry}
        onToggleFavorite={onToggleFavorite}
        onCreateReflection={onCreateReflection}
        onCreateMemory={onCreateMemory}
      />
    );

    expect(screen.getByText('One year ago today...')).toBeInTheDocument();
    expect(screen.getByText('Two years ago...')).toBeInTheDocument();
    expect(screen.getByText('Trip to Kyoto 2025')).toBeInTheDocument();
    expect(screen.getByText('Launch Milestone 2024')).toBeInTheDocument();

    // 1. Open Entry Action
    const openBtns = screen.getAllByRole('button', { name: /Open Entry/i });
    await user.click(openBtns[0]);
    expect(onOpenEntry).toHaveBeenCalledWith('e_1yr');

    // 2. Favorite Action
    const favBtns = screen.getAllByRole('button', { name: /Add to favorites/i });
    await user.click(favBtns[0]);
    expect(onToggleFavorite).toHaveBeenCalledWith(entries[0]);

    // 3. Create Reflection Action
    const reflectBtns = screen.getAllByRole('button', { name: /Reflect/i });
    await user.click(reflectBtns[0]);
    expect(onCreateReflection).toHaveBeenCalledWith(entries[0]);

    // 4. Create Memory Action
    const memoryBtns = screen.getAllByRole('button', { name: /Memory/i });
    await user.click(memoryBtns[0]);
    expect(onCreateMemory).toHaveBeenCalledWith(entries[0]);
  });

  it('does NOT reveal historical entries belonging to another user', () => {
    const entries = [
      createEntry('e_mine', 'user1', '2025-09-06T10:00:00Z', 'My Secret'),
      createEntry('e_other', 'user_other', '2025-09-06T10:00:00Z', 'Other User Private Entry'),
    ];

    render(
      <OnThisDayView
        entries={entries}
        currentUserId="user1"
        targetDate={targetDate}
        timeZone="UTC"
      />
    );

    expect(screen.getByText('My Secret')).toBeInTheDocument();
    expect(screen.queryByText('Other User Private Entry')).not.toBeInTheDocument();
  });
});
