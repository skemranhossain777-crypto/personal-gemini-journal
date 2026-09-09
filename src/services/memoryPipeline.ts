import type { JournalEntry, Memory, MemoryType } from '../data';
import { MEMORY_TYPES, memoriesApi } from '../data';
import type { MemoryCandidate, MemoryCandidateOutput } from '../../server/gemini/types';
import { extractMemoryCandidates } from './ai';
import { authService } from './auth';

/**
 * Memory extraction pipeline — the client-side wiring for the AI Memory Engine.
 *
 * When a journal entry is saved, the pipeline calls the existing
 * `/api/gemini/extract-memories` endpoint and persists the returned candidates
 * ONLY as un-saved proposals (`saved: false`, `status: 'candidate'`). Explicit
 * user approval (Save/Forget in the Memory Engine) is what turns them into
 * permanent memories — this pipeline never auto-approves.
 *
 * Guarantees:
 * - Never throws: failures surface as `{ status: 'error' }` reports so a Gemini
 *   outage can never break journaling.
 * - Idempotent: a per-entry content-hash marker prevents duplicate extraction
 *   for the same unchanged journal (localStorage, per-uid).
 * - Bounded: input is capped to the server's prompt limit and candidates are
 *   capped so a malformed model response cannot spam the review queue.
 * - Demo sessions are skipped (the demo environment runs fully local).
 */

export const MAX_EXTRACTION_TEXT_CHARS = 12000;
export const MIN_EXTRACTABLE_BODY_CHARS = 20;
export const MAX_CANDIDATES_PER_ENTRY = 8;
export const MEMORY_NARRATIVE_MAX_CHARS = 20000;
export const MEMORY_TITLE_MAX_CHARS = 200;

export const EXTRACTION_MARKER_STORAGE_KEY = 'gemini-journal:memory-extraction:v1';

export interface ExtractionMarker {
  /** Hash of the journal body that the marker refers to. */
  hash: string;
  state: 'attempted' | 'done';
  at: number;
}

export type ExtractionReport =
  | { status: 'done'; created: string[]; candidates: MemoryCandidate[]; modelUsed: string; sourceEntryId: string }
  | { status: 'empty'; sourceEntryId: string }
  | { status: 'duplicate'; sourceEntryId: string }
  | { status: 'demo'; sourceEntryId: string }
  | { status: 'error'; message: string; sourceEntryId: string };

export interface MemoryPipelineDeps {
  extract?: (input: { text: string }) => Promise<MemoryCandidateOutput>;
  create?: (input: Record<string, unknown>) => Promise<Memory>;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  isDemo?: boolean;
  uid?: string;
}

type MarkerMap = Record<string, Record<string, ExtractionMarker>>;

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * FNV-1a 32-bit hash — stable within/between sessions for the same browser.
 * Used only for extraction dedup, so a single long-lived hash is intentional.
 */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function readMarkerMap(storage: Pick<Storage, 'getItem'> | null): MarkerMap {
  if (!storage) return {};
  try {
    const raw = storage.getItem(EXTRACTION_MARKER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as MarkerMap) : {};
  } catch {
    return {};
  }
}

function writeMarkerMap(storage: Pick<Storage, 'getItem' | 'setItem'> | null, map: MarkerMap): void {
  if (!storage) return;
  try {
    storage.setItem(EXTRACTION_MARKER_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Privacy/storage failure is non-fatal — the pipeline still runs; worst
    // case is a re-extraction on a later save (dedup is best-effort here).
  }
}

export function getExtractionMarker(
  uid: string,
  entryId: string,
  storage: Pick<Storage, 'getItem'> | null = defaultStorage()
): ExtractionMarker | null {
  return readMarkerMap(storage)[uid]?.[entryId] ?? null;
}

export function setExtractionMarker(
  uid: string,
  entryId: string,
  marker: ExtractionMarker,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = defaultStorage()
): void {
  const map = readMarkerMap(storage);
  map[uid] = map[uid] ?? {};
  map[uid][entryId] = marker;
  writeMarkerMap(storage, map);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The body text sent to Gemini: trimmed, non-empty (≥ MIN_EXTRACTABLE_BODY_CHARS)
 * and capped at the server's prompt limit (`MAX_INPUT_LENGTH`).
 */
export function extractionTextForEntry(entry: JournalEntry): string | null {
  const body = (entry.body ?? '').trim();
  if (body.length < MIN_EXTRACTABLE_BODY_CHARS) return null;
  return body.slice(0, MAX_EXTRACTION_TEXT_CHARS);
}

/** Sanitizes + normalizes one model candidate into a rule-valid Memory payload. */
export function buildCandidateInput(sourceEntryId: string, candidate: MemoryCandidate): Record<string, unknown> | null {
  const type: MemoryType = (MEMORY_TYPES as readonly string[]).includes(candidate.type) ? candidate.type : 'idea';
  const title = String(candidate.title ?? 'Untitled Memory').trim().slice(0, MEMORY_TITLE_MAX_CHARS);
  const narrative = String(candidate.narrative ?? '').trim().slice(0, MEMORY_NARRATIVE_MAX_CHARS);
  if (!title || !narrative) return null;
  return {
    type,
    title,
    narrative,
    importance: clamp(Number(candidate.importance) || 3, 1, 5),
    confidence: clamp(Number(candidate.confidence) || 0.8, 0, 1),
    sourceEntryIds: [sourceEntryId],
    tags: [],
    saved: false,
    status: 'candidate',
    occurredAt: null,
  };
}

/**
 * Runs extraction for a single saved journal entry. Always resolves to a report
 * (never throws). Persists candidates as un-saved `candidate` proposals that the
 * user reviews in the Memory Engine.
 */
export async function runMemoryExtraction(
  entry: JournalEntry,
  options: { force?: boolean; deps?: MemoryPipelineDeps } = {}
): Promise<ExtractionReport> {
  const { force = false, deps = {} } = options;
  const sourceEntryId = entry.id;
  const storage = deps.storage !== undefined ? deps.storage : defaultStorage();
  const isDemo = deps.isDemo ?? authService.currentUser?.isDemo ?? false;
  if (isDemo) return { status: 'demo', sourceEntryId };

  const uid = deps.uid ?? authService.currentUser?.uid;
  if (!uid) {
    return { status: 'error', message: 'Sign in to extract memory candidates from your entries.', sourceEntryId };
  }

  const text = extractionTextForEntry(entry);
  if (!text) return { status: 'empty', sourceEntryId };

  const hash = hashText(text);
  const marker = getExtractionMarker(uid, sourceEntryId, storage);
  if (!force && marker && marker.hash === hash) {
    return { status: 'duplicate', sourceEntryId };
  }

  const extract = deps.extract ?? extractMemoryCandidates;
  let output: MemoryCandidateOutput;
  try {
    output = await extract({ text });
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Memory extraction failed. Gemini is unavailable right now.',
      sourceEntryId,
    };
  }

  const parsedCandidates: MemoryCandidate[] = (output?.candidates ?? [])
    .slice(0, MAX_CANDIDATES_PER_ENTRY)
    .map((c) => {
      const type: MemoryType = (MEMORY_TYPES as readonly string[]).includes(c.type) ? c.type : 'idea';
      const title = String(c.title ?? 'Untitled Memory').trim().slice(0, MEMORY_TITLE_MAX_CHARS);
      const narrative = String(c.narrative ?? '').trim().slice(0, MEMORY_NARRATIVE_MAX_CHARS);
      return {
        type,
        title,
        narrative,
        importance: clamp(Number(c.importance) || 3, 1, 5),
        confidence: clamp(Number(c.confidence) || 0.8, 0, 1),
      };
    })
    .filter((c) => c.title.length > 0 && c.narrative.length > 0);

  // Mark the entry as processed BEFORE persisting so a later save of the same
  // content cannot re-trigger extraction while candidates are being written.
  setExtractionMarker(uid, sourceEntryId, { hash, state: 'attempted', at: Date.now() }, storage);

  const create = deps.create ?? memoriesApi.create;
  const created: string[] = [];
  for (const candidate of parsedCandidates) {
    try {
      const saved = await create({
        type: candidate.type,
        title: candidate.title,
        narrative: candidate.narrative,
        importance: candidate.importance,
        confidence: candidate.confidence,
        sourceEntryIds: [sourceEntryId],
        tags: [],
        saved: false,
        status: 'candidate',
        occurredAt: null,
      });
      created.push(saved.id);
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Could not save memory candidates.',
        sourceEntryId,
      };
    }
  }

  setExtractionMarker(uid, sourceEntryId, { hash, state: 'done', at: Date.now() }, storage);

  return { status: 'done', created, candidates: parsedCandidates, modelUsed: output.modelUsed ?? '', sourceEntryId };
}

/** Convenience alias for the fire-and-forget UI trigger. */
export function triggerMemoryExtraction(
  entry: JournalEntry,
  options?: { force?: boolean; deps?: MemoryPipelineDeps }
): Promise<ExtractionReport> {
  return runMemoryExtraction(entry, options);
}