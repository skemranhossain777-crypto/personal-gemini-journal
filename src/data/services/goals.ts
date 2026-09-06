import { createCollectionApi } from '../crud';
import type { Goal } from '../models';
import { validateGoalInput } from '../validation';

const INPUT_KEYS = [
  'title',
  'description',
  'status',
  'progress',
  'targetDate',
  'milestones',
  'relatedEntryIds',
  'tags',
] as const;

/**
 * `users/{uid}/goals` — goals with evidence-backed progress, milestones, and
 * links back to the journal entries that support them.
 */
export const goalsApi = createCollectionApi<Goal>({
  name: 'goals',
  validateInput: validateGoalInput,
  createKeys: INPUT_KEYS,
  updateKeys: INPUT_KEYS,
});

export type { Goal };
