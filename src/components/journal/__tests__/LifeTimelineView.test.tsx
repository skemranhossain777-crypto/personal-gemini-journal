import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { LifeTimelineView } from '../LifeTimelineView';
import type { JournalEntry, Memory, Goal, TimelineEvent } from '../../../data/models';

describe('LifeTimelineView component', () => {
  const mockTimestamp = (isoString: string): Timestamp => {
    return Timestamp.fromDate(new Date(isoString));
  };

  const mockEntries: JournalEntry[] = [
    {
      id: 'entry_1',
      uid: 'user1',
      title: 'Stargazing in Kyoto',
      body: 'Quiet night looking up at constellations with hot tea.',
      mode: 'evening',
      mood: 5,
      energy: 90,
      tags: ['kyoto', 'stargazing', 'peace'],
      location: { lat: 35.0, lng: 135.7, placeName: 'Kyoto Observatory' },
      attachments: [],
      favorite: true,
      archived: false,
      private: false,
      aiMetadata: null,
      createdAt: mockTimestamp('2026-09-01T20:00:00Z'),
      updatedAt: mockTimestamp('2026-09-01T20:00:00Z'),
    },
    {
      id: 'entry_2',
      uid: 'user1',
      title: 'Project Kickoff Meeting',
      body: 'Decided on key roadmap milestones.',
      mode: 'work',
      mood: 4,
      energy: 80,
      tags: ['work', 'project'],
      location: null,
      attachments: [],
      favorite: false,
      archived: false,
      private: false,
      aiMetadata: null,
      createdAt: mockTimestamp('2025-05-15T09:00:00Z'),
      updatedAt: mockTimestamp('2025-05-15T09:00:00Z'),
    },
  ];

  const mockMemories: Memory[] = [
    {
      id: 'mem_1',
      uid: 'user1',
      type: 'place',
      title: 'Himalayan Trekking Expedition',
      narrative: 'Reached 4,000 meters above sea level.',
      importance: 5,
      confidence: 0.98,
      sourceEntryIds: ['entry_1'],
      tags: ['travel', 'trekking'],
      saved: true,
      status: 'saved',
      occurredAt: mockTimestamp('2026-08-10T12:00:00Z'),
      createdAt: mockTimestamp('2026-08-10T12:00:00Z'),
      updatedAt: mockTimestamp('2026-08-10T12:00:00Z'),
    },
  ];

  const mockGoals: Goal[] = [
    {
      id: 'goal_1',
      uid: 'user1',
      title: 'Finish Journaling Engine',
      description: 'Build timeline and AI memory integration',
      status: 'completed',
      progress: 100,
      targetDate: mockTimestamp('2026-09-05T00:00:00Z'),
      milestones: [],
      relatedEntryIds: ['entry_1'],
      tags: ['coding'],
      createdAt: mockTimestamp('2026-08-01T00:00:00Z'),
      updatedAt: mockTimestamp('2026-09-05T00:00:00Z'),
    },
  ];

  it('renders timeline header with total moment stats and search input', () => {
    render(
      <LifeTimelineView
        entries={mockEntries}
        memories={mockMemories}
        goals={mockGoals}
      />
    );

    expect(screen.getByText(/Your Life Timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Moments/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search life events/i)).toBeInTheDocument();
  });

  it('renders event titles and allows opening detail modal and source navigation', async () => {
    const user = userEvent.setup();
    const onOpenEntry = vi.fn();

    render(
      <LifeTimelineView
        entries={mockEntries}
        memories={mockMemories}
        goals={mockGoals}
        onOpenEntry={onOpenEntry}
      />
    );

    expect(screen.getByText('Stargazing in Kyoto')).toBeInTheDocument();
    expect(screen.getByText('Himalayan Trekking Expedition')).toBeInTheDocument();

    // Click on event card to open modal detail
    await user.click(screen.getByText('Stargazing in Kyoto'));

    // Modal should display full narrative & tags
    expect(screen.getByText('Narrative & Content')).toBeInTheDocument();
    expect(
      screen.getAllByText('Quiet night looking up at constellations with hot tea.').length
    ).toBeGreaterThanOrEqual(1);

    // Click View Source Entry in modal
    const sourceEntryBtn = screen.getByRole('button', { name: /View Source Entry/i });
    await user.click(sourceEntryBtn);

    expect(onOpenEntry).toHaveBeenCalledWith('entry_1');
  });

  it('filters timeline by year and event type', async () => {
    const user = userEvent.setup();

    render(
      <LifeTimelineView
        entries={mockEntries}
        memories={mockMemories}
        goals={mockGoals}
      />
    );

    // Select Year 2025
    const year2025Btn = screen.getByRole('button', { name: /2025/i });
    await user.click(year2025Btn);

    expect(screen.getByText('Project Kickoff Meeting')).toBeInTheDocument();
    expect(screen.queryByText('Stargazing in Kyoto')).not.toBeInTheDocument();
  });

  it('toggles mobile filter bar correctly', async () => {
    const user = userEvent.setup();

    render(
      <LifeTimelineView
        entries={mockEntries}
        memories={mockMemories}
        goals={mockGoals}
      />
    );

    const filterBtn = screen.getByRole('button', { name: /Filters/i });
    await user.click(filterBtn);

    expect(screen.getByText(/Event Type Filters/i)).toBeInTheDocument();
  });
});
