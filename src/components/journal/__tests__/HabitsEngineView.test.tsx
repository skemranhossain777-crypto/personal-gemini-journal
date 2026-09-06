import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import { HabitsEngineView } from '../HabitsEngineView';
import type { Habit, JournalEntry } from '../../../data/models';

describe('HabitsEngineView component', () => {
  const mockTimestamp = (isoString: string): Timestamp => {
    return Timestamp.fromDate(new Date(isoString));
  };

  const mockHabits: Habit[] = [
    {
      id: 'h1',
      uid: 'user1',
      name: 'Daily Gratitude Practice',
      description: 'Record 3 things you are thankful for',
      frequency: 'daily',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      streak: 5,
      log: [],
      createdAt: mockTimestamp('2026-08-01T00:00:00Z'),
      updatedAt: mockTimestamp('2026-08-01T00:00:00Z'),
    },
    {
      id: 'h_other',
      uid: 'user_other',
      name: 'Other User Secret Habit',
      description: 'Hidden habit',
      frequency: 'daily',
      daysOfWeek: [],
      streak: 0,
      log: [],
      createdAt: mockTimestamp('2026-08-01T00:00:00Z'),
      updatedAt: mockTimestamp('2026-08-01T00:00:00Z'),
    },
  ];

  const mockEntries: JournalEntry[] = [
    {
      id: 'e1',
      uid: 'user1',
      title: 'Daily Gratitude Reflection',
      body: 'Grateful for morning sunshine and fresh coffee.',
      mode: 'gratitude',
      mood: 5,
      energy: 85,
      tags: ['gratitude'],
      location: null,
      attachments: [],
      favorite: false,
      archived: false,
      private: false,
      aiMetadata: null,
      createdAt: mockTimestamp('2026-09-01T00:00:00Z'),
      updatedAt: mockTimestamp('2026-09-01T00:00:00Z'),
    },
  ];

  it('renders habits header stats and excludes habits from other users', () => {
    render(
      <HabitsEngineView
        habits={mockHabits}
        entries={mockEntries}
        currentUserId="user1"
      />
    );

    expect(screen.getByText(/Habits & Reflective Rhythms/i)).toBeInTheDocument();
    expect(screen.getByText('Daily Gratitude Practice')).toBeInTheDocument();
    expect(screen.queryByText('Other User Secret Habit')).not.toBeInTheDocument();
  });

  it('allows marking habit completed for today', async () => {
    const user = userEvent.setup();
    const onUpdateHabit = vi.fn();

    render(
      <HabitsEngineView
        habits={mockHabits}
        entries={mockEntries}
        currentUserId="user1"
        onUpdateHabit={onUpdateHabit}
      />
    );

    const markBtn = screen.getByRole('button', { name: /Mark Completed Today/i });
    await user.click(markBtn);

    expect(onUpdateHabit).toHaveBeenCalledWith('h1', expect.objectContaining({
      streak: 1,
    }));
  });

  it('triggers habit reflection action', async () => {
    const user = userEvent.setup();
    const onCreateHabitReflection = vi.fn();

    render(
      <HabitsEngineView
        habits={mockHabits}
        entries={mockEntries}
        currentUserId="user1"
        onCreateHabitReflection={onCreateHabitReflection}
      />
    );

    const reflectBtn = screen.getByRole('button', { name: /Reflect/i });
    await user.click(reflectBtn);

    expect(onCreateHabitReflection).toHaveBeenCalledWith(mockHabits[0]);
  });

  it('opens habit creation modal and submits a new habit', async () => {
    const user = userEvent.setup();
    const onCreateHabit = vi.fn();

    render(
      <HabitsEngineView
        habits={mockHabits}
        entries={mockEntries}
        currentUserId="user1"
        onCreateHabit={onCreateHabit}
      />
    );

    const createBtn = screen.getByRole('button', { name: /Create Habit/i });
    await user.click(createBtn);

    expect(screen.getByText(/Create New Habit Anchor/i)).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/Morning Meditation/i);
    await user.type(nameInput, 'Evening Reading');

    const saveBtn = screen.getByRole('button', { name: /Save Habit/i });
    await user.click(saveBtn);

    expect(onCreateHabit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Evening Reading',
      frequency: 'daily',
    }));
  });
});
