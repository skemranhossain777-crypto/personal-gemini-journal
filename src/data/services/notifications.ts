import { createCollectionApi } from '../crud';
import type { Notification } from '../models';
import { validateNotificationInput } from '../validation';

const INPUT_KEYS = ['kind', 'title', 'body', 'data', 'read'] as const;

/**
 * `users/{uid}/notifications` — in-app notification queue (reflection prompts,
 * memory suggestions, goal reminders, system notices).
 */
export const notificationsApi = createCollectionApi<Notification>({
  name: 'notifications',
  validateInput: validateNotificationInput,
  createKeys: INPUT_KEYS,
  updateKeys: INPUT_KEYS,
});

export type { Notification };
