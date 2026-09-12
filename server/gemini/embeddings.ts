import crypto from 'crypto';
import { MAX_INPUT_LENGTH } from './validation';

// ─── Generative Semantic Retrieval (G3) constants ───────────────────────────
// Centralizing the model pin + dimension so a future move to
// `gemini-embedding-2` (auto-normalizing, no `taskType`) is a one-line change
// plus a re-backfill. `text-embedding-004` is deprecated and must not be used.

export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_OUTPUT_DIM = 768;
export const EMBEDDING_TASK_DOCUMENT: 'RETRIEVAL_DOCUMENT' = 'RETRIEVAL_DOCUMENT';
export const EMBEDDING_TASK_QUERY: 'RETRIEVAL_QUERY' = 'RETRIEVAL_QUERY';

/** Candidate budget per KNN query. Well under the documented 1000-result cap. */
export const RETRIEVAL_CANDIDATE_LIMIT = 40;
/** Raised when the caller supplies structured filters (shrinks the corpus). */
export const RETRIEVAL_CANDIDATE_LIMIT_FILTERED = 100;

/** Firestore distance-result field name. Note: `__dist__` is reserved. */
export const RETRIEVAL_DISTANCE_RESULT_FIELD = 'distance';

/**
 * Minimum cosine similarity (dot product on unit vectors) for a candidate to
 * count as evidence. Kept as a tunable constant — calibrate on a labeled eval
 * set during tuning (equivalent to an unlocked release knob).
 */
export const RETRIEVAL_DISTANCE_THRESHOLD = 0.35;

/** Ask My Life compression invariant: at most this many documents in context. */
export const RETRIEVAL_MAX_CONTEXT_DOCS = 15;

/** Backfill batch cap per request (Cloud Run request-budget safety). */
export const MAX_BACKFILL_BATCH = 50;

/** Length cap mirrored with validateTextInput's MAX_INPUT_LENGTH. */
export const EMBEDDING_TEXT_LIMIT = MAX_INPUT_LENGTH;

/**
 * L2-normalizes a vector in place of scale-invariance. Required because
 * MRL-truncated `gemini-embedding-001` outputs are NOT auto-normalized; with
 * unit vectors, DOT_PRODUCT distance equals cosine similarity.
 */
export function l2Normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (!Number.isFinite(norm) || norm === 0) return vector.slice();
  return vector.map((v) => v / norm);
}

/** Deterministic sha256 hex digest used for embedding-staleness idempotency. */
export function computeTextHash(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Builds the canonical embedding-input text for a content unit, mirroring what
 * the Ask My Life / Semantic Search engines read today (title + body + tags;
 * memories use title + narrative + tags). Capped to the embedding input budget.
 */
export function buildEmbeddingText(input: {
  title?: string;
  body?: string;
  narrative?: string;
  tags?: string[];
}): string {
  const parts: string[] = [];
  if (input.title && input.title.trim()) parts.push(input.title.trim());
  if (input.body && input.body.trim()) parts.push(input.body.trim());
  if (input.narrative && input.narrative.trim()) parts.push(input.narrative.trim());
  if (input.tags && input.tags.length > 0) {
    const cleanTags = input.tags.map((t) => String(t).trim()).filter(Boolean);
    if (cleanTags.length > 0) parts.push(`tags: ${cleanTags.join(', ')}`);
  }
  const raw = parts.join('\n\n');
  return raw.length > EMBEDDING_TEXT_LIMIT ? raw.slice(0, EMBEDDING_TEXT_LIMIT) : raw;
}

/** Maps a dot-product similarity (≈ cosine) to the UI's 0..100 match score. */
export function toMatchScore(similarity: number): number {
  const clamped = Math.max(0, Math.min(1, similarity));
  return Math.round(clamped * 100);
}

/** Clamps a pagination page size to the documented 100 cap. */
export function normalizePageSize(pageSize: number): number {
  if (!Number.isInteger(pageSize) || pageSize < 1) return 6;
  return Math.min(100, pageSize);
}