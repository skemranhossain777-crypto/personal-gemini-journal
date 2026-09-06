import { createCollectionApi } from '../crud';
import type { Collection } from '../models';
import { validateCollectionInput } from '../validation';

const INPUT_KEYS = ['name', 'description', 'color', 'entryIds'] as const;

/**
 * `users/{uid}/collections` — user-curated folders that group journal entries
 * by theme or project.
 */
export const collectionsApi = createCollectionApi<Collection>({
  name: 'collections',
  validateInput: validateCollectionInput,
  createKeys: INPUT_KEYS,
  updateKeys: INPUT_KEYS,
});

export type { Collection };