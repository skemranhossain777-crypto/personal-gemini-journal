import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore, DocumentSnapshot } from 'firebase-admin/firestore';
import type {
  ContextDocument,
  EmbeddingSourceType,
  EnsureEmbeddingInput,
  EnsureEmbeddingResult,
  RemoveEmbeddingInput,
  BackfillEmbeddingsInput,
  BackfillEmbeddingsResult,
  SemanticSearchHit,
} from './types';
import {
  EMBEDDING_MODEL,
  MAX_BACKFILL_BATCH,
  RETRIEVAL_CANDIDATE_LIMIT,
  RETRIEVAL_DISTANCE_RESULT_FIELD,
  RETRIEVAL_DISTANCE_THRESHOLD,
  RETRIEVAL_MAX_CONTEXT_DOCS,
  buildEmbeddingText,
  computeTextHash,
  l2Normalize,
  toMatchScore,
} from './embeddings';

export interface EmbeddingStoreDeps {
  db: Firestore;
  embedQuery: (text: string) => Promise<number[]>;
  embedDocuments: (items: { text: string; title?: string }[]) => Promise<number[][]>;
}

export interface RetrieveContextOptions {
  startDate?: string;
  endDate?: string;
  includePrivate?: boolean; // default true — preserves legacy behavior (private entries ARE retrievable today)
  includeArchived?: boolean; // default true — preserves legacy behavior (archived entries ARE retrievable today)
  candidateLimit?: number;
}

export interface RetrieveContextResult {
  mode: 'server' | 'empty';
  documents: ContextDocument[];
}

export interface SemanticSearchResult {
  mode: 'server' | 'empty';
  hits: SemanticSearchHit[];
}

interface VectorCandidate {
  sourceId: string;
  sourceType: EmbeddingSourceType;
  dist: number;
  private: boolean;
  archived: boolean;
  date: string;
  text?: string;
  title?: string;
}

/**
 * Firestore-backed wrapper around the Gemini embedding API. Handles the G3
 * write path (ensure/backfill/remove), the Ask My Life retrieval path
 * (entry + memory vector KNN with known-legacy parity), and the Semantic Search
 * KNN path. Usernames/collection paths are always derived server-side from the
 * verified uid — never from client-provided document paths.
 *
 * Design notes:
 * - Every query is scoped under `users/{uid}`, so a single-field vector index
 *   per collection is sufficient (no `uid` composite required).
 * - `private` / `archived` are MIRRORED onto the embedding doc and are honored
 *   ONLY as explicit opt-out filters. Default retrieval includes both, matching
 *   today's client engines exactly (they operate over the full subscribed list).
 * - Vectors are L2-normalized unit vectors, so DOT_PRODUCT distance == cosine
 *   similarity.
 */
export class EmbeddingStore {
  private readonly db: Firestore;
  private readonly embedQuery: EmbeddingStoreDeps['embedQuery'];
  private readonly embedDocuments: EmbeddingStoreDeps['embedDocuments'];

  constructor(deps: EmbeddingStoreDeps) {
    this.db = deps.db;
    this.embedQuery = deps.embedQuery;
    this.embedDocuments = deps.embedDocuments;
  }

  // ─── internal helpers ──────────────────────────────────────────────────────

  private embCol(uid: string, sourceType: EmbeddingSourceType) {
    return this.db.collection('users').doc(uid).collection(`${sourceType}Embeddings`);
  }

  private sourceCol(uid: string, sourceType: EmbeddingSourceType) {
    return this.db.collection('users').doc(uid).collection(sourceType === 'entry' ? 'journalEntries' : 'memories');
  }

  private buildText(sourceType: EmbeddingSourceType, data: Record<string, any>): { text: string; title: string } {
    const title = String(data?.title ?? '');
    const body = String(data?.body ?? '');
    const narrative = String(data?.narrative ?? '');
    const tags = Array.isArray(data?.tags) ? data.tags.map((t: any) => String(t)).filter(Boolean) : [];
    return {
      title,
      text: buildEmbeddingText({ title, body, narrative, tags }),
    };
  }

  private toEventDate(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value.slice(0, 10);
    if (typeof value === 'number') return new Date(value).toISOString().slice(0, 10);
    if (typeof value === 'object') {
      const v: any = value;
      if (typeof v.toDate === 'function') return v.toDate().toISOString().slice(0, 10);
      if (typeof v.seconds === 'number') return new Date(v.seconds * 1000).toISOString().slice(0, 10);
    }
    return '';
  }

  private async runKnn(
    uid: string,
    sourceType: EmbeddingSourceType,
    vector: number[],
    limit: number
  ): Promise<VectorCandidate[]> {
    const ref = this.embCol(uid, sourceType);
    const query: any = (ref as any).findNearest({
      vectorField: 'embedding',
      queryVector: vector,
      limit,
      distanceMeasure: 'DOT_PRODUCT',
      distanceResultField: RETRIEVAL_DISTANCE_RESULT_FIELD,
    });
    const snap: any = await query.get();
    const candidates: VectorCandidate[] = [];
    snap.forEach((doc: any) => {
      candidates.push({
        sourceId: String(doc.id),
        sourceType,
        dist: Number(doc.get(RETRIEVAL_DISTANCE_RESULT_FIELD) || 0),
        private: doc.get('private') === true,
        archived: doc.get('archived') === true,
        date: this.toEventDate(doc.get('occurredAt')),
      });
    });
    return candidates;
  }

  private keywordBoost(terms: string[], candidate: VectorCandidate): number {
    const title = (candidate.title || '').toLowerCase();
    const text = (candidate.text || '').toLowerCase();
    let boost = 0;
    for (const term of terms) {
      if (title.includes(term)) boost += 6;
      else if (text.includes(term)) boost += 1.5;
    }
    return Math.min(boost, 10);
  }

  private queryTerms(question: string): string[] {
    return question
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 2);
  }

  // ─── public API ────────────────────────────────────────────────────────────

  /** True when at least one vector exists for the user (both collections). */
  async hasEmbeddings(uid: string): Promise<boolean> {
    const [entrySnap, memorySnap] = await Promise.all([
      this.embCol(uid, 'entry').limit(1).get(),
      this.embCol(uid, 'memory').limit(1).get(),
    ]);
    return !entrySnap.empty || !memorySnap.empty;
  }

  /**
   * Embed-and-store one source document. Idempotent via text hash: re-running
   * with unchanged title/body/tags is a no-op read.
   */
  async ensureEmbedding(uid: string, input: EnsureEmbeddingInput): Promise<EnsureEmbeddingResult> {
    const { sourceType, sourceId } = input;
    const sourceRef = this.sourceCol(uid, sourceType).doc(sourceId);
    const [sourceSnap, existingSnap] = await Promise.all([
      sourceRef.get(),
      this.embCol(uid, sourceType).doc(sourceId).get(),
    ]);
    if (!sourceSnap.exists) {
      return { sourceType, sourceId, status: 'source-not-found', textHash: '' };
    }
    const data = sourceSnap.data() || {};
    if (sourceType === 'memory' && data.saved !== true) {
      return { sourceType, sourceId, status: 'skipped', textHash: '' };
    }
    const { text, title } = this.buildText(sourceType, data);
    if (!text.trim()) {
      return { sourceType, sourceId, status: 'skipped', textHash: '' };
    }
    const textHash = computeTextHash(text);
    if (existingSnap.exists && existingSnap.get('textHash') === textHash) {
      return { sourceType, sourceId, status: 'unchanged', textHash };
    }

    const vector = (await this.embedDocuments([{ text, title }]))[0];
    if (!vector || vector.length === 0) {
      throw new Error('Embedding API returned an empty vector.');
    }

    const occurredAtValue = data?.occurredAt ?? data?.createdAt;
    const occurredAt = this.toEventDate(occurredAtValue) ? new Date(this.toEventDate(occurredAtValue)) : null;
    const now = new Date();
    await this.embCol(uid, sourceType).doc(sourceId).set({
      uid,
      sourceId,
      sourceType,
      embedding: FieldValue.vector(l2Normalize(vector)),
      textHash,
      private: sourceType === 'entry' ? data.private === true : false,
      archived: sourceType === 'entry' ? data.archived === true : false,
      occurredAt: occurredAt || FieldValue.serverTimestamp(),
      createdAt: now,
      updatedAt: now,
    });
    return { sourceType, sourceId, status: 'written', textHash };
  }

  /** Deletes a source embedding (idempotent). */
  async removeEmbedding(uid: string, input: RemoveEmbeddingInput): Promise<void> {
    await this.embCol(uid, input.sourceType).doc(input.sourceId).delete();
  }

  /**
   * One-shot backfill for existing content. Bounded per request (default 50)
   * so Cloud Run requests stay within budget; a scheduled invoker can loop.
   */
  async backfillEmbeddings(uid: string, input: BackfillEmbeddingsInput = {}): Promise<BackfillEmbeddingsResult> {
    const budget = Math.min(
      Math.max(Number.isInteger(input.limit) ? (input.limit as number) : MAX_BACKFILL_BATCH, 1),
      MAX_BACKFILL_BATCH
    );

    const [entrySnap, memorySnap] = await Promise.all([
      this.sourceCol(uid, 'entry').limit(budget).get(),
      this.sourceCol(uid, 'memory').where('saved', '==', true).limit(budget).get(),
    ]);

    interface Pending {
      sourceType: EmbeddingSourceType;
      sourceId: string;
      text: string;
      title: string;
      data: Record<string, any>;
    }
    const pending: Pending[] = [];
    entrySnap.forEach((doc: DocumentSnapshot) => {
      const data = doc.data() || {};
      const { text, title } = this.buildText('entry', data);
      if (text.trim()) pending.push({ sourceType: 'entry', sourceId: doc.id, text, title, data });
    });
    memorySnap.forEach((doc: DocumentSnapshot) => {
      const data = doc.data() || {};
      const { text, title } = this.buildText('memory', data);
      if (text.trim()) pending.push({ sourceType: 'memory', sourceId: doc.id, text, title, data });
    });

    const evaluated = pending.slice(0, budget);
    const existingRefs = evaluated.map((p) => this.embCol(uid, p.sourceType).doc(p.sourceId));
    const existingDocs = await this.db.getAll(...existingRefs);

    const hashes = evaluated.map((p) => computeTextHash(p.text));
    const unchanged = new Set<number>();
    for (let i = 0; i < evaluated.length; i++) {
      const existing = existingDocs[i];
      if (existing.exists && existing.get('textHash') === hashes[i]) unchanged.add(i);
    }

    interface ToWrite extends Pending {
      hashIndex: number;
    }
    const toWrite: ToWrite[] = [];
    evaluated.forEach((p, i) => {
      if (!unchanged.has(i)) toWrite.push({ ...p, hashIndex: i });
    });
    const unchangedCount = unchanged.size;

    if (toWrite.length > 0) {
      const vectors = await this.embedDocuments(
        toWrite.map((p) => ({ text: p.text, title: p.title }))
      );
      const now = new Date();
      await Promise.all(
        toWrite.map((p, idx) => {
          const vector = vectors[idx];
          if (!vector || vector.length === 0) return Promise.resolve();
          const dateStr = this.toEventDate(p.data?.occurredAt ?? p.data?.createdAt);
          const occurredAt = dateStr ? new Date(dateStr) : null;
          return this.embCol(uid, p.sourceType).doc(p.sourceId).set({
            uid,
            sourceId: p.sourceId,
            sourceType: p.sourceType,
            embedding: FieldValue.vector(l2Normalize(vector)),
            textHash: hashes[p.hashIndex],
            private: p.sourceType === 'entry' ? p.data.private === true : false,
            archived: p.sourceType === 'entry' ? p.data.archived === true : false,
            occurredAt: occurredAt || FieldValue.serverTimestamp(),
            createdAt: now,
            updatedAt: now,
          });
        })
      );
    }

    return {
      processed: evaluated.length,
      written: toWrite.length,
      unchanged: unchangedCount,
      missing: 0,
      sourceCounts: { entries: entrySnap.size, memories: memorySnap.size },
      modelUsed: EMBEDDING_MODEL,
    };
  }

  /**
   * Ask My Life retrieval: exact legacy parity by default (private + archived
   * entries retrievable, saved memories retrievable), enhanced with cosine
   * ranking + a small keyword tiebreak. Returns ≤ 15 documents, pre-sorted.
   */
  async retrieveContext(
    uid: string,
    question: string,
    vector: number[],
    opts: RetrieveContextOptions = {}
  ): Promise<RetrieveContextResult> {
    if (!vector || vector.length === 0) return { mode: 'empty', documents: [] };

    const entryLimit = opts.candidateLimit ?? RETRIEVAL_CANDIDATE_LIMIT;
    const [entryCandidates, memoryCandidates] = await Promise.all([
      this.runKnn(uid, 'entry', vector, entryLimit),
      this.runKnn(uid, 'memory', vector, Math.min(20, entryLimit)),
    ]);

    const includePrivate = opts.includePrivate !== false;
    const includeArchived = opts.includeArchived !== false;

    let candidates: VectorCandidate[] = [...entryCandidates, ...memoryCandidates]
      .filter((c) => c.dist >= RETRIEVAL_DISTANCE_THRESHOLD)
      .filter((c) => includePrivate || !c.private)
      .filter((c) => includeArchived || !c.archived)
      .filter((c) => {
        if (opts.startDate && c.date && c.date < opts.startDate) return false;
        if (opts.endDate && c.date && c.date > opts.endDate) return false;
        return true;
      })
      .sort((a, b) => b.dist - a.dist);

    if (candidates.length === 0) return { mode: 'empty', documents: [] };

    candidates = candidates.slice(0, Math.max(RETRIEVAL_MAX_CONTEXT_DOCS, entryLimit));

    const terms = this.queryTerms(question);
    const loaded = await Promise.all(
      candidates.map((c) => this.sourceCol(uid, c.sourceType).doc(c.sourceId).get())
    );

    const documents: ContextDocument[] = [];
    loaded.forEach((doc: DocumentSnapshot, idx: number) => {
      const data = doc.data() || {};
      const { title, text } = this.buildText(candidates[idx].sourceType, data);
      const content =
        candidates[idx].sourceType === 'entry' ? String(data?.body ?? '') : String(data?.narrative ?? '');
      candidates[idx].title = title;
      candidates[idx].text = text;
      documents.push({
        id: candidates[idx].sourceId,
        title: title || 'Untitled Entry',
        content: content || text,
        type: candidates[idx].sourceType,
        date: candidates[idx].date || this.toEventDate(data?.createdAt),
        tags: Array.isArray(data?.tags) ? data.tags.map((t: any) => String(t)) : [],
      });
    });

    const ranked = documents
      .map((doc, idx) => ({
        doc,
        rank: candidates[idx].dist + this.keywordBoost(terms, candidates[idx]) * 0.01,
      }))
      .sort((a, b) => b.rank - a.rank);

    return {
      mode: ranked.length > 0 ? 'server' : 'empty',
      documents: ranked.slice(0, RETRIEVAL_MAX_CONTEXT_DOCS).map((r) => r.doc),
    };
  }

  /** Semantic Search KNN over entry embeddings → ranked ids with match scores. */
  async semanticSearchEntries(uid: string, vector: number[], pageSize: number): Promise<SemanticSearchResult> {
    if (!vector || vector.length === 0) return { mode: 'empty', hits: [] };
    const limit = Math.min(Math.max(pageSize, 1), 100);
    const candidates = await this.runKnn(uid, 'entry', vector, limit);
    const hasAny = await this.hasEmbeddings(uid);
    if (candidates.length === 0 && !hasAny) return { mode: 'empty', hits: [] };

    const hits: SemanticSearchHit[] = candidates
      .filter((c) => c.dist >= RETRIEVAL_DISTANCE_THRESHOLD)
      .sort((a, b) => b.dist - a.dist)
      .map((c) => ({ entryId: c.sourceId, score: toMatchScore(c.dist) }));
    return { mode: 'server', hits };
  }
}