import { createCollectionApi } from '../crud';
import { SETTINGS_DOC_ID, type UserPreferences } from '../models';
import { validatePreferencesInput } from '../validation';

const INPUT_KEYS = [
  'aiPreferences',
  'writingAssistant',
  'notificationPreferences',
  'language',
  'timezone',
] as const;

/**
 * `users/{uid}/settings/preferences` — a single preferences document (id is
 * fixed) carrying the user's AI / writing / notification choices. Created
 * lazily on first save.
 */
export const settingsApi = createCollectionApi<UserPreferences>({
  name: 'settings',
  fixedDocId: SETTINGS_DOC_ID,
  validateInput: validatePreferencesInput,
  createKeys: INPUT_KEYS,
  updateKeys: INPUT_KEYS,
});

export type { UserPreferences };
export { SETTINGS_DOC_ID };