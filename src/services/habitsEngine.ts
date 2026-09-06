import type { Habit, HabitLogEntry, HabitFrequency, JournalEntry } from '../data/models';
import { toDate } from '../journal/format';
import { Timestamp } from 'firebase/firestore';

export interface HabitSuggestionProposal {
  id: string;
  name: string;
  description: string;
  frequency: HabitFrequency;
  daysOfWeek: number[];
  reasoning: string;
  evidenceJournalIds: string[];
  requiresUserConfirmation: boolean;
}

export interface HabitStats {
  total: number;
  activeStreaks: number;
  longestStreak: number;
  completedTodayCount: number;
}

/**
 * Filter habits strictly by user ownership boundaries.
 */
export function filterUserHabits(habits: Habit[], currentUserId: string): Habit[] {
  if (!currentUserId) return [];
  return habits.filter((h) => h.uid === currentUserId);
}

/**
 * Validate habit ownership boundaries. Throws error if violated.
 */
export function assertHabitOwnership(habit: Habit, currentUserId: string): void {
  if (!currentUserId || habit.uid !== currentUserId) {
    throw new Error(`Security Violation: Habit ${habit.id} does not belong to user ${currentUserId}`);
  }
}

/**
 * Normalizes a Date to midnight (00:00:00.000) for clean date-only comparisons.
 */
export function toMidnight(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculate consecutive completion streak from a habit log up to today or yesterday.
 */
export function calculateStreak(log: HabitLogEntry[], referenceDate: Date = new Date()): number {
  if (!log || log.length === 0) return 0;

  // Extract dates where done === true and normalize to midnight
  const completedDates = log
    .filter((e) => e.done)
    .map((e) => {
      const d = toDate(e.date);
      return d ? toMidnight(d).getTime() : null;
    })
    .filter((t): t is number => t !== null);

  if (completedDates.length === 0) return 0;

  const completedSet = new Set(completedDates);
  const todayMidnight = toMidnight(referenceDate).getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Streak can start today or yesterday
  let checkTime = todayMidnight;
  if (!completedSet.has(todayMidnight)) {
    checkTime = todayMidnight - ONE_DAY_MS;
    if (!completedSet.has(checkTime)) {
      return 0;
    }
  }

  let streak = 0;
  while (completedSet.has(checkTime)) {
    streak++;
    checkTime -= ONE_DAY_MS;
  }

  return streak;
}

/**
 * Log or toggle completion for a specific date on a habit, and update streak.
 */
export function logHabitCompletion(
  habit: Habit,
  targetDate: Date = new Date(),
  done: boolean = true
): Habit {
  const targetMidnight = toMidnight(targetDate).getTime();
  const existingLog = habit.log || [];

  // Filter out any previous log entry for the same date
  const filteredLog = existingLog.filter((e) => {
    const d = toDate(e.date);
    return d ? toMidnight(d).getTime() !== targetMidnight : true;
  });

  const newLogEntry: HabitLogEntry = {
    date: Timestamp.fromDate(toMidnight(targetDate)),
    done,
  };

  const updatedLog = [...filteredLog, newLogEntry];
  const newStreak = calculateStreak(updatedLog, targetDate);

  return {
    ...habit,
    log: updatedLog,
    streak: newStreak,
  };
}

/**
 * Calculate overall summary stats for user's habits.
 */
export function calculateHabitsStats(habits: Habit[], referenceDate: Date = new Date()): HabitStats {
  const total = habits.length;
  let activeStreaks = 0;
  let longestStreak = 0;
  let completedTodayCount = 0;

  const todayMidnight = toMidnight(referenceDate).getTime();

  for (const h of habits) {
    const s = calculateStreak(h.log || [], referenceDate);
    if (s > 0) activeStreaks++;
    if (s > longestStreak) longestStreak = s;

    const loggedToday = (h.log || []).some((e) => {
      const d = toDate(e.date);
      return e.done && d && toMidnight(d).getTime() === todayMidnight;
    });
    if (loggedToday) completedTodayCount++;
  }

  return {
    total,
    activeStreaks,
    longestStreak,
    completedTodayCount,
  };
}

/**
 * Find journal entries that serve as evidence for a habit.
 */
export function findHabitJournalEvidence(
  habit: Habit,
  userEntries: JournalEntry[],
  currentUserId: string
): JournalEntry[] {
  assertHabitOwnership(habit, currentUserId);

  const ownEntries = userEntries.filter((e) => e.uid === currentUserId && !e.archived);
  const habitNameLower = habit.name.toLowerCase();
  const keywords = habitNameLower.split(/\s+/).filter((w) => w.length > 3);

  return ownEntries.filter((entry) => {
    const text = `${entry.title} ${entry.body}`.toLowerCase();
    if (text.includes(habitNameLower)) return true;
    if (entry.tags && entry.tags.some((t) => t.toLowerCase().includes(habitNameLower))) return true;
    return keywords.some((kw) => text.includes(kw));
  });
}

/**
 * Gemini Habit Suggestion Engine based on repeated journal behavior.
 * CRITICAL RULE: NEVER auto-creates habits. Returns suggestions requiring user confirmation.
 */
export function suggestHabitsFromJournal(
  userEntries: JournalEntry[],
  existingHabits: Habit[],
  currentUserId: string
): HabitSuggestionProposal[] {
  const ownEntries = userEntries.filter((e) => e.uid === currentUserId && !e.archived);
  const existingNames = new Set(existingHabits.map((h) => h.name.toLowerCase()));

  // Pattern detectors for common reflective habits
  const patterns = [
    {
      name: 'Morning Meditation',
      keywords: ['meditat', 'mindful', 'breathed', 'stillness', 'zen'],
      desc: 'Practice 10 minutes of morning mindfulness and presence.',
      frequency: 'daily' as HabitFrequency,
      days: [0, 1, 2, 3, 4, 5, 6],
    },
    {
      name: 'Daily Gratitude Practice',
      keywords: ['gratitude', 'thankful', 'grateful', 'blessed', 'apprec'],
      desc: 'Record 3 things you are grateful for each day.',
      frequency: 'daily' as HabitFrequency,
      days: [0, 1, 2, 3, 4, 5, 6],
    },
    {
      name: 'Evening Reflection & Reading',
      keywords: ['reading', 'book', 'pages', 'read chapter', 'novel'],
      desc: 'Read and reflect before sleeping.',
      frequency: 'daily' as HabitFrequency,
      days: [0, 1, 2, 3, 4, 5, 6],
    },
    {
      name: 'Weekly Workout & Movement',
      keywords: ['run', 'workout', 'gym', 'exercise', 'marathon', 'walk'],
      desc: 'Maintain regular physical movement and exercise.',
      frequency: 'weekly' as HabitFrequency,
      days: [1, 3, 5],
    },
  ];

  const suggestions: HabitSuggestionProposal[] = [];

  for (const p of patterns) {
    if (existingNames.has(p.name.toLowerCase())) continue;

    const matchingEntries = ownEntries.filter((entry) => {
      const text = `${entry.title} ${entry.body}`.toLowerCase();
      return p.keywords.some((kw) => text.includes(kw));
    });

    if (matchingEntries.length >= 2) {
      suggestions.push({
        id: `sug_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: p.name,
        description: p.desc,
        frequency: p.frequency,
        daysOfWeek: p.days,
        reasoning: `Gemini detected ${matchingEntries.length} journal reflections mentioning ${p.name.toLowerCase()}.`,
        evidenceJournalIds: matchingEntries.map((e) => e.id),
        requiresUserConfirmation: true,
      });
    }
  }

  return suggestions;
}
