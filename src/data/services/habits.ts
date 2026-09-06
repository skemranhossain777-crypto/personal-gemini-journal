import { createCollectionApi } from '../crud';
import type { Habit } from '../models';
import { validateHabitInput } from '../validation';

const INPUT_KEYS = ['name', 'description', 'frequency', 'daysOfWeek', 'streak', 'log'] as const;

/**
 * `users/{uid}/habits` — optional habit tracking with a bounded daily log.
 * Habits are never auto-created by AI without user confirmation.
 */
export const habitsApi = createCollectionApi<Habit>({
  name: 'habits',
  validateInput: validateHabitInput,
  createKeys: INPUT_KEYS,
  updateKeys: INPUT_KEYS,
});

export type { Habit };
