import { createCollectionApi } from '../crud';
import type { JournalEntry } from '../models';
import { validateJournalEntryInput } from '../validation';

const INPUT_KEYS = [
  'title',
  'body',
  'mode',
  'mood',
  'energy',
  'tags',
  'location',
  'attachments',
  'favorite',
  'archived',
  'private',
  'aiMetadata',
] as const;

/**
 * `users/{uid}/journalEntries` — free-form reflection entries with optional
 * mood/energy, tags, location, attachments, and AI-generated metadata.
 */
export const journalEntriesApi = createCollectionApi<JournalEntry>({
  name: 'journalEntries',
  validateInput: validateJournalEntryInput,
  createKeys: INPUT_KEYS,
  updateKeys: INPUT_KEYS,
});

export type { JournalEntry };