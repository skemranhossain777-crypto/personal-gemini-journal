import type { QuerySnapshot, QueryDocumentSnapshot } from 'firebase/firestore';
import type { BaseEntity } from './models';

/**
 * Cursor-based pagination. A `Page` exposes the current items plus an opaque
 * `next` cursor (the trailing `QueryDocumentSnapshot`) that consumers hand
 * back to the next `list()` call for `startAfter(...)`. `hasMore` is derived
 * by fetching `limit + 1` records, so pages never overreach and no cursor
 * document is required up-front.
 */

export interface Page<T> {
  items: T[];
  /** Pass to the next `list({ after })` call to continue the page set. */
  next: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export interface ListOptions {
  limit?: number;
  /** Continue from a previous page's `next` cursor. */
  after?: QueryDocumentSnapshot | null;
}

const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export function normalizePageOptions(options: ListOptions = {}): { limit: number; after: QueryDocumentSnapshot | null } {
  const limit =
    typeof options.limit === 'number' ? Math.min(Math.max(1, Math.floor(options.limit)), MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
  return { limit, after: options.after ?? null };
}

export function buildPage<T extends BaseEntity>(snapshot: QuerySnapshot, requestLimit: number): Page<T> {
  const docs = snapshot.docs as QueryDocumentSnapshot<T>[];
  const hasMore = docs.length > requestLimit;
  const items = (hasMore ? docs.slice(0, requestLimit) : docs).map((d) => d.data());
  return {
    items,
    next: items.length > 0 ? snapshot.docs[Math.min(docs.length, requestLimit) - 1] : null,
    hasMore,
  };
}

export type { QueryDocumentSnapshot };