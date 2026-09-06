import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { GoalsEngineView } from '../GoalsEngineView';
import type { Goal, JournalEntry } from '../../../data/models';

describe('GoalsEngineView component', () => {
  const mockTimestamp = (isoString: string): Timestamp => {
    return Timestamp.fromDate(new Date(isoString));
  };

  const mockGoals: Goal[] = [
    {
      id: 'g1',
      uid: 'user1',
      title: 'Launch SaaS App',
      description: 'Build full-stack AI journaling application',
      status: 'active',
      progress: 75,
      targetDate: mockTimestamp('2026-10-01T00:00:00Z'),
      milestones: [
        { id: 'm1', title: 'Complete Gemini integration', done: true },
        { id: 'm2', title: 'Deploy production stack', done: false },
      ],
      relatedEntryIds: ['e1'],
      tags: ['coding', 'saas'],
      createdAt: mockTimestamp('2026-08-01T00:00:00Z'),
      updatedAt: mockTimestamp('2026-08-01T00:00:00Z'),
    },
    {
      id: 'g_other',
      uid: 'user_other',
      title: 'Other User Secret Goal',
      description: 'Should be hidden',
      status: 'active',
      progress: 50,
      targetDate: null,
      milestones: [],
      relatedEntryIds: [],
      tags: [],
      createdAt: mockTimestamp('2026-08-01T00:00:00Z'),
      updatedAt: mockTimestamp('2026-08-01T00:00:00Z'),
    },
  ];

  const mockEntries: JournalEntry[] = [
    {
      id: 'e1',
      uid: 'user1',
      title: 'Gemini Integration Complete',
      body: 'Finished AI companion skills integration.',
      mode: 'work',
      mood: 5,
      energy: 90,
      tags: ['coding'],
      location: null,
      attachments: [],
      favorite: false,
      archived: false,
      private: false,
      aiMetadata: null,
      createdAt: mockTimestamp('2026-08-15T00:00:00Z'),
      updatedAt: mockTimestamp('2026-08-15T00:00:00Z'),
    },
  ];

  it('renders goal header stats and filters out goals from other users', () => {
    render(
      <GoalsEngineView
        goals={mockGoals}
        entries={mockEntries}
        currentUserId="user1"
      />
    );

    expect(screen.getByText(/Personal Goals & Milestones/i)).toBeInTheDocument();
    expect(screen.getByText('Launch SaaS App')).toBeInTheDocument();
    expect(screen.queryByText('Other User Secret Goal')).not.toBeInTheDocument();
  });

  it('allows completing a goal and updating milestones', async () => {
    const user = userEvent.setup();
    const onUpdateGoal = vi.fn();

    render(
      <GoalsEngineView
        goals={mockGoals}
        entries={mockEntries}
        currentUserId="user1"
        onUpdateGoal={onUpdateGoal}
      />
    );

    // Toggle milestone
    const milestoneItem = screen.getByText('Deploy production stack');
    await user.click(milestoneItem);

    expect(onUpdateGoal).toHaveBeenCalledWith('g1', expect.objectContaining({
      progress: 100,
      status: 'completed',
    }));
  });

  it('triggers goal reflection action', async () => {
    const user = userEvent.setup();
    const onCreateGoalReflection = vi.fn();

    render(
      <GoalsEngineView
        goals={mockGoals}
        entries={mockEntries}
        currentUserId="user1"
        onCreateGoalReflection={onCreateGoalReflection}
      />
    );

    const reflectBtn = screen.getByRole('button', { name: /Reflect/i });
    await user.click(reflectBtn);

    expect(onCreateGoalReflection).toHaveBeenCalledWith(mockGoals[0]);
  });

  it('opens goal creation modal and submits a new goal', async () => {
    const user = userEvent.setup();
    const onCreateGoal = vi.fn();

    render(
      <GoalsEngineView
        goals={mockGoals}
        entries={mockEntries}
        currentUserId="user1"
        onCreateGoal={onCreateGoal}
      />
    );

    const createBtns = screen.getAllByRole('button', { name: /Create New Goal/i });
    await user.click(createBtns[0]);

    expect(screen.getByRole('heading', { name: /Create New Goal/i })).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText(/Run a 10K Marathon/i);
    await user.type(titleInput, 'Learn Rust Programming');

    const saveBtn = screen.getByRole('button', { name: /Save Goal/i });
    await user.click(saveBtn);

    expect(onCreateGoal).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Learn Rust Programming',
      status: 'active',
      progress: 0,
    }));
  });
});
