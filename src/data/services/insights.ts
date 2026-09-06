import { createCollectionApi } from '../crud';
import type { Insight } from '../models';
import { validateInsightInput } from '../validation';

const INPUT_KEYS = [
  'kind',
  'title',
  'narrative',
  'content',
  'periodStart',
  'periodEnd',
  'themes',
  'sourceIds',
  'saved',
] as const;

/**
 * `users/{uid}/insights` — AI reflections (daily/weekly/monthly/yearly/pattern).
 * `saved` defaults to false so nothing is persisted to the user's long-term
 * context without an explicit choice.
 */
export const insightsApi = createCollectionApi<Insight>({
  name: 'insights',
  validateInput: validateInsightInput,
  createKeys: INPUT_KEYS,
  updateKeys: INPUT_KEYS,
});

export type { Insight };
