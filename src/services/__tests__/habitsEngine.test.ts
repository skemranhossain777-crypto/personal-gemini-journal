import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  filterUserHabits,
  assertHabitOwnership,
  calculateStreak,
  logHabitCompletion,
  calculateHabitsStats,
  findHabitJournalEvidence,
  suggestHabitsFromJournal,
  toMidnight,
} from '../habitsEngine';
import type { Habit, JournalEntry } from '../../data/models';

describe('habitsEngine service', () => {
  const mockTimestamp = (isoString: string): Timestamp => {
    return Timestamp.fromDate(new Date(isoString));
  };

  const createHabit = (id: string, uid: string, name: string, streak = 0): Habit => ({
    id,
    uid,
    name,
    description: 'Habit description text',
    frequency: 'daily',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    streak,
    log: [],
    createdAt: mockTimestamp('2026-01-01T00:00:00Z'),
    updatedAt: mockTimestamp('2026-01-01T00:00:00Z'),
  });

  const createEntry = (id: string, uid: string, title: string, body: string): JournalEntry => ({
    id,
    uid,
    title,
    body,
    mode: 'free-write',
    mood: 5,
    energy: 90,
    tags: ['habit'],
    location: null,
    attachments: [],
    favorite: false,
    archived: false,
    private: false,
    aiMetadata: null,
    createdAt: mockTimestamp('2026-09-01T00:00:00Z'),
    updatedAt: mockTimestamp('2026-09-01T00:00:00Z'),
  });

  it('filters habits by user ownership boundary', () => {
    const habits = [
      createHabit('h1', 'user1', 'User 1 Habit'),
      createHabit('h2', 'user2', 'User 2 Habit'),
    ];

    const result = filterUserHabits(habits, 'user1');
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('h1');
  });

  it('asserts habit ownership and throws on security violation', () => {
    const habit = createHabit('h1', 'user1', 'My Habit');

    expect(() => assertHabitOwnership(habit, 'user1')).not.toThrow();
    expect(() => assertHabitOwnership(habit, 'user2')).toThrow(/Security Violation/);
  });

  it('calculates consecutive completion streaks correctly', () => {
    const today = new Date(2026, 8, 6); // Sep 6, 2026
    const yesterday = new Date(2026, 8, 5);
    const dayBefore = new Date(2026, 8, 4);

    const log = [
      { date: Timestamp.fromDate(today), done: true },
      { date: Timestamp.fromDate(yesterday), done: true },
      { date: Timestamp.fromDate(dayBefore), done: true },
    ];

    const streak = calculateStreak(log, today);
    expect(streak).toBe(3);
  });

  it('logs habit completion and updates active streak', () => {
    const habit = createHabit('h1', 'user1', 'Morning Meditation');
    const today = new Date(2026, 8, 6);

    const updated = logHabitCompletion(habit, today, true);
    expect(updated.log.length).toBe(1);
    expect(updated.streak).toBe(1);

    // Toggle off
    const toggledOff = logHabitCompletion(updated, today, false);
    expect(toggledOff.streak).toBe(0);
  });

  it('finds journal evidence belonging strictly to current user', () => {
    const habit = createHabit('h1', 'user1', 'Morning Meditation');
    const userEntries = [
      createEntry('e1', 'user1', 'Morning Meditation Session', 'Felt so calm during meditation today.'),
      createEntry('e2', 'user1', 'Unrelated Entry', 'Discussed project architecture.'),
      createEntry('e3', 'user2', 'Morning Meditation Secret', 'Other user meditation entry'), // Should be excluded
    ];

    const evidence = findHabitJournalEvidence(habit, userEntries, 'user1');
    expect(evidence.length).toBe(1);
    expect(evidence[0].id).toBe('e1');
  });

  it('suggests candidate habits from repeated journal patterns without auto-creating them', () => {
    const userEntries = [
      createEntry('e1', 'user1', 'Morning Meditation', 'Practiced meditation and deep breathing.'),
      createEntry('e2', 'user1', 'Mindfulness Log', 'Did another meditation session.'),
    ];

    const suggestions = suggestHabitsFromJournal(userEntries, [], 'user1');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].name).toBe('Morning Meditation');
    expect(suggestions[0].requiresUserConfirmation).toBe(true); // CRITICAL RULE: Requires confirmation
  });
});
