import { createCollectionApi } from '../crud';
import type { Conversation } from '../models';
import { validateConversationInput } from '../validation';

const INPUT_KEYS = ['title', 'skill', 'messages', 'summary', 'modelUsed'] as const;

/**
 * `users/{uid}/conversations` — multi-turn Gemini journal-companion sessions
 * (reflect, challenge, coach, summarize, explore, remember, connect, reframe,
 * celebrate).
 */
export const conversationsApi = createCollectionApi<Conversation>({
  name: 'conversations',
  validateInput: validateConversationInput,
  createKeys: INPUT_KEYS,
  updateKeys: INPUT_KEYS,
});

export type { Conversation };
