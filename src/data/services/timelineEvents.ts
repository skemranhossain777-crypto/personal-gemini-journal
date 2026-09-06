import { createCollectionApi } from '../crud';
import type { TimelineEvent } from '../models';
import { validateTimelineEventInput } from '../validation';

const INPUT_KEYS = [
  'type',
  'title',
  'description',
  'occurredAt',
  'year',
  'month',
  'day',
  'source',
  'tags',
] as const;

/**
 * `users/{uid}/timelineEvents` — a visual personal timeline. `year/month/day`
 * are precomputed so On-This-Day and year/month queries stay index-friendly.
 */
export const timelineEventsApi = createCollectionApi<TimelineEvent>({
  name: 'timelineEvents',
  validateInput: validateTimelineEventInput,
  createKeys: INPUT_KEYS,
  updateKeys: INPUT_KEYS,
});

export type { TimelineEvent };