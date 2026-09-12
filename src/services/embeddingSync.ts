import { authService } from './auth';
import type {
  BackfillEmbeddingsResult,
  EnsureEmbeddingResult,
  SemanticSearchHit,
  SemanticSearchServerInput,
} from '../../server/gemini/types';

/**
 * Client adapter for the G3 generative semantic retrieval write/search surface.
 *
 * Feature flag: mirrors the server's ENABLE_SEMANTIC_RETRIEVAL via the Vite
 * build-time flag VITE_ENABLE_SEMANTIC_RETRIEVAL (default off). Every call is
 * best-effort and never throws: a gated-off or failing server keeps the
 * existing in-app engines completely unchanged.
 */
export const isSemanticRetrievalEnabledClient = (): boolean =>
  import.meta.env.VITE_ENABLE_SEMANTIC_RETRIEVAL === 'true';

async function postGemini<T>(path: string, body: unknown): Promise<T | null> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = await authService.getIdToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // Unauthenticated: the server 401s and the caller treats it as "skip".
  }
  let resp: Response;
  try {
    resp = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    return null;
  }
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data?.success === false) return null;
  return (data?.result ?? data) as T;
}

/** Embeds a just-saved source document. Server is idempotent via text hash. */
export async function ensureEmbedding(
  sourceType: 'entry' | 'memory',
  sourceId: string
): Promise<EnsureEmbeddingResult | null> {
  if (!isSemanticRetrievalEnabledClient()) return null;
  return postGemini<EnsureEmbeddingResult>('/api/gemini/ensure-embedding', { sourceType, sourceId });
}

/** Removes a deleted source document's embedding. */
export async function removeEmbedding(
  sourceType: 'entry' | 'memory',
  sourceId: string
): Promise<void> {
  if (!isSemanticRetrievalEnabledClient()) return;
  await postGemini('/api/gemini/remove-embedding', { sourceType, sourceId });
}

/** Backfills embeddings for existing content (operations seam; n/a to UI flows). */
export async function backfillEmbeddings(
  limit?: number
): Promise<BackfillEmbeddingsResult | null> {
  if (!isSemanticRetrievalEnabledClient()) return null;
  return postGemini<BackfillEmbeddingsResult>('/api/gemini/backfill-embeddings', { limit });
}

/**
 * Server-side KNN semantic search. Returns ranked entry ids + match scores.
 * Returns null when the flag is off, the server says disabled/empty, or the
 * call failed — callers then fall back to the local keyword engine.
 */
export async function runSemanticSearchServer(
  input: SemanticSearchServerInput
): Promise<{ hits: SemanticSearchHit[]; retrieval: string } | null> {
  if (!isSemanticRetrievalEnabledClient()) return null;
  const result = await postGemini<{ results: SemanticSearchHit[]; retrieval: string }>(
    '/api/gemini/semantic-search',
    input
  );
  if (!result) return null;
  return { hits: result.results ?? [], retrieval: result.retrieval ?? 'server' };
}