import { createCollectionApi } from '../crud';
import type { Memory } from '../models';
import { validateMemoryInput } from '../validation';

const INPUT_KEYS = [
  'type',
  'title',
  'narrative',
  'importance',
  'confidence',
  'sourceEntryIds',
  'tags',
  'saved',
  'status',
  'occurredAt',
] as const;

/**
 * `users/{uid}/memories` — the personal memory engine: AI-candidate memories
 * that the user reviews, edits, saves, or forgets. `saved` gates AI use.
 */
export const memoriesApi = createCollectionApi<Memory>({
  name: 'memories',
  validateInput: validateMemoryInput,
  createKeys: INPUT_KEYS,
  updateKeys: INPUT_KEYS,
});

/**
 * User Review Operations for Memory Engine
 * CRITICAL RULE: Gemini extracts memory candidates with saved: false, status: 'candidate'.
 * Conversion to permanent memory REQUIRES explicit user action.
 */

export async function saveMemory(memoryId: string): Promise<Memory> {
  return memoriesApi.update(memoryId, {
    saved: true,
    status: 'saved',
  });
}

export async function ignoreMemory(memoryId: string): Promise<Memory> {
  return memoriesApi.update(memoryId, {
    saved: false,
    status: 'ignored',
  });
}

export async function forgetMemory(memoryId: string): Promise<Memory> {
  return memoriesApi.update(memoryId, {
    saved: false,
    status: 'forgotten',
  });
}

export async function deleteMemory(memoryId: string): Promise<void> {
  return memoriesApi.remove(memoryId);
}

export type { Memory };
