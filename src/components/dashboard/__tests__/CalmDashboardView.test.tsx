import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { CalmDashboardView } from '../CalmDashboardView';
import type { JournalEntry, Memory, Goal, TimelineEvent } from '../../../data/models';

describe('CalmDashboardView component', () => {
  const mockEntry: JournalEntry = {
    id: 'entry_today',
    uid: 'user1',
    title: 'Today Journal Entry',
    body: 'Written today with peaceful reflection.',
    mode: 'morning',
    mood: 5,
    energy: 90,
    tags: ['morning'],
    location: null,
    attachments: [],
    favorite: true,
    archived: false,
    private: false,
    aiMetadata: null,
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  const mockMemory: Memory = {
    id: 'mem_1',
    uid: 'user1',
    type: 'achievement',
    title: 'Personal Milestone',
    narrative: 'Achieved quiet focus',
    importance: 5,
    confidence: 0.9,
    sourceEntryIds: ['entry_today'],
    tags: [],
    saved: true,
    occurredAt: Timestamp.fromDate(new Date()),
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  const mockGoal: Goal = {
    id: 'goal_1',
    uid: 'user1',
    title: 'Daily Reflection Streak',
    description: 'Write daily',
    status: 'active',
    progress: 60,
    targetDate: null,
    milestones: [],
    relatedEntryIds: ['entry_today'],
    tags: [],
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  };

  it('renders serene greeting, primary journaling CTA, reflection prompt, active goals, and memories', () => {
    render(
      <CalmDashboardView
        entries={[mockEntry]}
        memories={[mockMemory]}
        goals={[mockGoal]}
        timelineEvents={[]}
        currentUserId="user1"
        onOpenComposer={vi.fn()}
        onSelectEntry={vi.fn()}
        onNavigateToTab={vi.fn()}
      />
    );

    expect(screen.getByText(/Today's Journal/i)).toBeInTheDocument();
    expect(screen.getByText('Written Today')).toBeInTheDocument();
    expect(screen.getByText(/Daily Reflection Prompt/i)).toBeInTheDocument();
    expect(screen.getAllByText(/On This Day/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Active Goals/i)).toBeInTheDocument();
    expect(screen.getByText(/Personal Memories/i)).toBeInTheDocument();
  });

  it('displays meaningful empty states and welcome banner for a new user', () => {
    render(
      <CalmDashboardView
        entries={[]}
        memories={[]}
        goals={[]}
        timelineEvents={[]}
        currentUserId="user1"
        onOpenComposer={vi.fn()}
        onSelectEntry={vi.fn()}
        onNavigateToTab={vi.fn()}
      />
    );

    expect(screen.getByText(/Welcome to Your Personal Sanctuary/i)).toBeInTheDocument();
    expect(screen.getByText(/You haven't written in your journal today yet/i)).toBeInTheDocument();
    expect(screen.getByText(/No active goals yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Your memory bank is ready/i)).toBeInTheDocument();
  });

  it('triggers onOpenComposer when "Write Today\'s Journal Entry" button is clicked', async () => {
    const user = userEvent.setup();
    const handleOpenComposer = vi.fn();

    render(
      <CalmDashboardView
        entries={[]}
        memories={[]}
        goals={[]}
        timelineEvents={[]}
        currentUserId="user1"
        onOpenComposer={handleOpenComposer}
        onSelectEntry={vi.fn()}
        onNavigateToTab={vi.fn()}
      />
    );

    const writeBtn = screen.getByRole('button', { name: /Write Today's Journal Entry/i });
    await user.click(writeBtn);

    expect(handleOpenComposer).toHaveBeenCalled();
  });

  it('triggers navigation callback when tab view all is clicked', async () => {
    const user = userEvent.setup();
    const handleNavigate = vi.fn();

    render(
      <CalmDashboardView
        entries={[mockEntry]}
        memories={[mockMemory]}
        goals={[mockGoal]}
        timelineEvents={[]}
        currentUserId="user1"
        onOpenComposer={vi.fn()}
        onSelectEntry={vi.fn()}
        onNavigateToTab={handleNavigate}
      />
    );

    const viewGoalsBtn = screen.getAllByRole('button', { name: /View All/i })[0];
    await user.click(viewGoalsBtn);

    expect(handleNavigate).toHaveBeenCalledWith('goals');
  });
});
