import { createCollectionApi } from '../crud';
import type { AiInteraction } from '../models';
import { validateAiInteractionInput } from '../validation';

const INPUT_KEYS = ['skill', 'prompt', 'response', 'contextRefs', 'modelUsed', 'durationMs'] as const;

/**
 * `users/{uid}/aiInteractions` — append-only audit trail of Gemini calls with
 * the exact user-owned context (`contextRefs`) that was retrieved and sent.
 * This is what makes "Ask My Life" auditable and privacy-preserving.
 *
 * NOTE: audit entries are meant to be created once and read later; `update` is
 * intentionally restricted by the security rules to `none` for writes.
 */
export const aiInteractionsApi = createCollectionApi<AiInteraction>({
  name: 'aiInteractions',
  validateInput: validateAiInteractionInput,
  createKeys: INPUT_KEYS,
  updateKeys: INPUT_KEYS,
  readonlyKeys: ['skill', 'prompt', 'response', 'contextRefs', 'durationMs'],
});

export type { AiInteraction };
