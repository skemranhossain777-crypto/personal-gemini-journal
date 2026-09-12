# Phase 2B-2 — G3 Semantic Retrieval Implementation (Closure)

**Status:** IMPLEMENTATION COMPLETE — COMMITTED, AWAITING PRODUCTION VERIFICATION
**Scope:** G3 (P1) — generative semantic retrieval (true embedding-based retrieval) for Ask My Life and Semantic Search, backed by server-side Gemini embeddings and Firestore KNN vector search.
**Repository:** `D:\Apersonontherun\Google-Programmed\gemini-journal-reflections`
**Baseline commit:** `fc6e4bb` (assessment: `docs/PHASE2B2_G3_SEMANTIC_RETRIEVAL_ASSESSMENT.md`).
**Push baseline:** `master` (remote `origin`).

> Evidence labeling matches the assessment: **REPOSITORY EVIDENCE** = fact observed in this repository (`path:line`). **LOCAL/EMULATOR VERIFICATION** = observed test output on the developer machine against the Firestore/Auth emulators or vm. **CI VERIFICATION** = observed in the repository's GitHub Actions workflow after push. **VERIFIED EXTERNAL FACT** = confirmed from an authoritative Google source. **PRODUCTION VERIFICATION** = observed against the live Cloud Run deployment — **nothing in this document claims production verification; it has not occurred yet.**

---

## 1. Executive Summary

G3 is implemented, committed, and emulator-verified: the server now embeds each journal entry and approved memory with `gemini-embedding-001` (768-dim, L2-normalized) at write time, stores the vector in locked, owner-partitioned Firestore subcollections (`users/{uid}/entryEmbeddings`, `users/{uid}/memoryEmbeddings`), and answers Ask My Life and Semantic Search through server-side `findNearest` (KNN) retrieval via `firebase-admin`. Gemini embeddings are never exposed to the browser; every protected route derives ownership from the verified Firebase ID token; both features degrade gracefully to their legacy client/keyword engines when the feature flags are off or retrieval fails.

Verification performed in this task, in order of strength:

- **LOCAL/EMULATOR VERIFICATION (complete):** `152/152` emulator tests (138 security-rules + 14 journal integration including 7 new G3 vector-store tests), `449/449` unit tests across 57 files, TypeScript `tsc --noEmit` clean, and the production build — all green at commit time.
- **CI VERIFICATION (pending at document creation):** the repository workflow (`.github/workflows/deploy.yml`) runs `npm ci → audit → typecheck → test → build → Docker scan → Cloud Run deploy` after push. CI results and any automatic deployment are recorded in section 16 after push.
- **PRODUCTION VERIFICATION (not performed):** see section 16 checklist. Full G3 closure is **not** claimed.

---

## 2. Scope and Non-goals

### In scope (G3)
- Server-side document + query embeddings (Gemini Embedding API via the already-installed `@google/genai`).
- Firestore KNN (`findNearest`) retrieval for Ask My Life (entries + approved memories) and Semantic Search (entries).
- Embedding write/search surface: `ensureEmbedding`, `removeEmbedding`, `backfillEmbeddings`, `semanticSearch`, and server-side retrieval inside Ask My Life.
- Client best-effort sync hooks and flag-gated wiring in EntryEditor, MemoryEngineView, and SemanticSearchView.
- Vector indexes in `firestore.indexes.json` and client lockdown of embedding subcollections in `firestore.rules`.
- Feature flags `ENABLE_SEMANTIC_RETRIEVAL` (server) and `VITE_ENABLE_SEMANTIC_RETRIEVAL` (client), both **default off**.

### Non-goals (explicitly out of scope for G3)
Booking, payments, provider integrations, notifications, weather, maps, voice, collaboration, public links, new agents, habits, goals, Reflection Reports, On This Day, home-dashboard aggregation, a general-purpose RAG platform, knowledge graph, and enterprise search features. **None were touched.**

---

## 3. Previous Architecture Limitation

Before G3 the repository contained **no embeddings, no vector indexes, and no semantic retrieval** (ASSESSMENT section 2.1: zero matches for `embedding`/`vector`/`findNearest`/`VectorValue`). Both "semantic" features were client-side keyword/regex/intent scorers (`src/services/askMyLife.ts:150`, `src/services/semanticSearch.ts:148`) operating on arrays the client already held via real-time subscriptions. Synonyms and paraphrases scored zero unless a literal token matched. The web SDK cannot run Firestore vector queries, and the Gemini Embedding API must not be exposed to the browser, so the design moved retrieval server-side.

---

## 4. Implemented Architecture

```
browser (Firebase Auth token)
   │  POST /api/gemini/ensure-embedding | remove-embedding | backfill-embeddings | semantic-search
   │  POST /api/gemini/ask-my-life            (w/ server-side retrieval when enabled)
   ▼
Cloud Run `gemini-journal` (firebase-admin, named DB `gemini-journal`)
   ├─ GeminiService.embedDocuments/embedQuery   → gemini-embedding-001, 768-dim, L2-normalized
   └─ EmbeddingStore                             → FieldValue.vector writes
        users/{uid}/entryEmbeddings/{entryId}    (entry vectors, + private/archived/occurredAt mirrors)
        users/{uid}/memoryEmbeddings/{memoryId}  (approved-memory vectors)
   └─ findNearest(embedding, queryVector, DOT_PRODUCT, distanceResultField='distance')
```

Key architectural properties (all change from the baseline):

1. **Write time embedding only** — entries embed after autosave/save; memories embed only at approval.
2. **Idempotent, versioned** — a sha256 `textHash` of the canonical embedding input on every vector doc; unchanged text → read-only `unchanged`; changed text → re-embed + replace.
3. **Server-only, owner-partitioned, rules-locked** — vector subcollections sit under `users/{uid}`, are written only by the Admin SDK, and are denied to all clients in `firestore.rules` (`allow read, write: if false`).
4. **Flag-gated, graceful** — flags default off; when off, Ask My Life and Semantic Search run exactly as before (legacy client engines) and the new endpoints report `disabled`/`empty`.
5. **Fallback on failure** — any retrieval failure inside Ask My Life degrades to the client-provided context documents; it never hard-fails the route.

---

## 5. Repository File Inventory

### Server (implementation)
| File | Adds |
|---|---|
| `server/gemini/embeddings.ts` | Constants + pure helpers: model pin `gemini-embedding-001`, `EMBEDDING_OUTPUT_DIM=768`, `RETRIEVAL_CANDIDATE_LIMIT=40`, `RETRIEVAL_CANDIDATE_LIMIT_FILTERED=100`, `RETRIEVAL_DISTANCE_THRESHOLD=0.35`, `RETRIEVAL_DISTANCE_RESULT_FIELD='distance'`, `RETRIEVAL_MAX_CONTEXT_DOCS=15`, `MAX_BACKFILL_BATCH=50`, `l2Normalize`, `computeTextHash`, `buildEmbeddingText`, `toMatchScore`, `normalizePageSize` |
| `server/gemini/embeddingStore.ts` | `EmbeddingStore`: `hasEmbeddings`, `ensureEmbedding`, `removeEmbedding`, `backfillEmbeddings`, `retrieveContext` (Ask My Life), `semanticSearchEntries` |
| `server/gemini/service.ts` | `embedContentBatch`, `embedDocuments`, `embedQuery` on `GeminiService` (batched, truncated to 768, L2-normalized) |
| `server/gemini/types.ts` | G3 types: `EmbeddingSourceType`, `EmbeddingTaskType`, `EmbeddingTextInput`, `EnsureEmbedding*`, `RemoveEmbedding*`, `BackfillEmbeddings*`, `SemanticSearchServer*`, `AskMyLifeRetrievalFilters` |
| `server.ts` | Lazy `EmbeddingStore` binding, `isSemanticRetrievalEnabled` (default off), 4 new protected routes, refactored `askMyLifeHandler` with server-retrieval + fallback |

### Client (flag-gated, best-effort)
| File | Adds |
|---|---|
| `src/services/embeddingSync.ts` | Client adapter: `isSemanticRetrievalEnabledClient` (default off), `ensureEmbedding`, `removeEmbedding`, `backfillEmbeddings`, `runSemanticSearchServer` |
| `src/journal/useEmbeddingSync.ts` | `useEmbeddingSync` hook — fires best-effort entry embed on create/in-place edit |
| `src/pages/journal/EntryEditor.tsx` | Hook wiring; `removeEmbedding` on delete |
| `src/components/journal/MemoryEngineView.tsx` | `ensureEmbedding` on approve + on edit; `removeEmbedding` on forget/delete |
| `src/components/journal/SemanticSearchView.tsx` | Debounced server KNN search; candidate-narrowing + semantic score overrides |
| `src/journal/index.ts` | Exports `useEmbeddingSync` + `EmbeddingSyncController` |

### Configuration / security
| File | Change |
|---|---|
| `firestore.indexes.json` | 2 flat KNN vector indexes (768-dim) on `entryEmbeddings.embedding` / `memoryEmbeddings.embedding` |
| `firestore.rules` | `entryEmbeddings`/`memoryEmbeddings` → `allow read, write: if false` (server-only authoring) |
| `vitest.rules.config.ts` | `hookTimeout: 60000` (infra time budget for emulator init on the developer machine) |

### Tests
| File | Adds |
|---|---|
| `server/gemini/__tests__/embeddings.test.ts` (new) | 13 tests: normalization, hashing, text construction, score/page-size mapping, `embedContentBatch`/`embedDocuments`/`embedQuery` incl. task types, truncation, empty input, auth-failure → 401, generic failure → 500, empty response |
| `server/gemini/__tests__/serverRoutes.test.ts` | 10 G3 route-guard tests: 401s, input validation, flag-off `disabled` behavior, legacy ask-my-life parity, no-retrieval-without-uid |
| `tests/integration/journalEngine.integration.test.ts` | 7 G3 vector-store tests against the live emulator (real `FieldValue.vector` + `findNearest`): idempotent ensure, legacy-parity retrieval, opt-out filters, date filter, semantic ranking + threshold, cross-uid isolation, backfill idempotency |
| `tests/rules/security_rules.test.ts` | 10 G3 rules tests: read/write/delete denied for owner/intruder/anon on both embedding collections |

---

## 6. Embedding Model and Vector Configuration

- **Model:** `gemini-embedding-001` (pinned; `EMBEDDING_MODEL`). `text-embedding-004` is deprecated and deliberately unused. A future move to `gemini-embedding-002` (auto-normalizing, no `taskType`) is a one-line pin change plus a re-backfill.
- **Dimensionality:** `768` (`EMBEDDING_OUTPUT_DIM`), produced via `config.outputDimensionality` (MRL truncation), well under the Firestore 2048-dim limit and matching the declared vector indexes.
- **Task types:** `RETRIEVAL_DOCUMENT` + optional `title` for stored documents; `RETRIEVAL_QUERY` for user questions.
- **Normalization:** manual `l2Normalize` on every returned/truncated vector (MRL-truncated `gemini-embedding-001` output is **not** auto-normalized), stored again via `FieldValue.vector(l2Normalize(_))` — so `DOT_PRODUCT` distance equals cosine similarity (R2 cosine invariant, unit-test asserted).
- **Canonical embedding input:** `buildEmbeddingText` = `title + body/narrative + tags`, capped at `EMBEDDING_TEXT_LIMIT` (12,000, mirrored with `validateTextInput`).
- **Distance:** `DOT_PRODUCT`, `distanceResultField: 'distance'` (avoids the reserved `__dist__`).
- **Threshold:** `RETRIEVAL_DISTANCE_THRESHOLD = 0.35` (dot ≈ cosine) — a tunable constant documented for calibration on a labeled eval set.

---

## 7. Data Model and Lifecycle

### Embedding document shape (`users/{uid}/entryEmbeddings|memoryEmbeddings/{sourceId}`)
```
{ uid, sourceId, sourceType: 'entry'|'memory',
  embedding: VectorValue (768, unit-norm),
  textHash: sha256 hex (64),
  private: bool, archived: bool,        // mirrored for entries (opt-out filters)
  occurredAt: Timestamp | serverTimestamp,
  createdAt, updatedAt }
```

### Lifecycle invariants (REPOSITORY EVIDENCE)
| Event | Behavior | Where |
|---|---|---|
| Entry created / edited | `useEmbeddingSync` fires `ensureEmbedding`; server re-embeds only when text changed (hash) | `src/journal/useEmbeddingSync.ts`, `EmbeddingStore.ensureEmbedding` |
| Entry autosave loop | Repeated identical saves → `unchanged`, no re-embed | hash dedup |
| Entry deleted | `removeEmbedding('entry', id)` (best-effort, fire-and-forget); stray in-flight ensure is inert because the source doc is already gone (`source-not-found`) | `src/pages/journal/EntryEditor.tsx`, `emitStore` |
| Memory approved | `ensureEmbedding('memory', id)` fires after `saveMemory`; non-saved memories are skipped server-side (`saved !== true` → `skipped`) | `MemoryEngineView.tsx`, `embeddingStore.ts:195` |
| Memory content edited | `ensureEmbedding('memory', id)` re-fires (hash dedup keeps it a no-op unless text changed) | `MemoryEngineView.tsx` (submitEdit) |
| Memory un-saved (forget) | `removeEmbedding('memory', id)` — vector no longer retrievable | `MemoryEngineView.tsx` (handleForget) |
| Memory deleted | `removeEmbedding('memory', id)` — no orphaned vector left | `MemoryEngineView.tsx` (handleDelete) |
| Backfill | Bounded per request (`MAX_BACKFILL_BATCH=50`), entries + `saved==true` memories only, hash-skipped, idempotent | `EmbeddingStore.backfillEmbeddings` |

---

## 8. Ask My Life Integration

- `askMyLifeHandler` (server.ts) is now exported and route-wired under `verifyFirebaseToken` + `rateLimiter`.
- When `ENABLE_SEMANTIC_RETRIEVAL=true` and a verified uid + non-empty question are present, the server embeds the question, checks `hasEmbeddings(uid)`, runs `EmbeddingStore.retrieveContext` (entry KNN@40 + memory KNN@min(20,40)), and only then calls the model with the retrieved `ContextDocument[]`; `retrieval` is reported as `server`.
- **Legacy parity preserved:** private and archived entries are retrievable by default (identical to the old client engines); saved memories are retrievable; `includePrivate`/`includeArchived` exist as explicit opt-outs. Date range filtering is honored for `startDate`/`endDate`.
- **Ranking:** dot-product (cosine) similarity ordering with a small keyword tiebreak (`keywordBoost`, capped at 10), compressed to ≤ 15 documents for the model.
- **Fallback:** flag off → exactly the legacy behavior (`retrieval: 'disabled'`); retrieval store empty → `retrieval: 'empty'`; any retrieval throw → catch → client-provided `contextDocuments` retained (`retrieval: 'empty'`), never a route failure.

---

## 9. Semantic Search Integration

- New `POST /api/gemini/semantic-search` (auth + rate-limited): embeds the query, returns ranked `{ entryId, score }` hits (0–100 match %, threshold-excluded), `retrieval: 'server' | 'empty' | 'disabled'`.
- Candidate budget: 40 unfiltered, 100 when structured filters are supplied (giving the local engine room to apply filters verbatim over the narrowed set).
- Client (`SemanticSearchView.tsx`): 400 ms debounced server call gates the local engine — the KNN-narrowed entry set flows through the existing `executeSemanticSearch` filters, then displayed scores are overridden with semantic values (`Semantic: NN% similarity. ...`). Flag off / empty / failure → identical legacy local search.

---

## 10. Feature Flags

| Flag | Owner | Default | Meaning |
|---|---|---|---|
| `ENABLE_SEMANTIC_RETRIEVAL === 'true'` | Server (Cloud Run env) | **off** | Enables server embedding + KNN on all G3 routes and Ask My Life retrieval |
| `VITE_ENABLE_SEMANTIC_RETRIEVAL === 'true'` | Client (Vite build-time) | **off** | Gates all client adapter calls (`embeddingSync.ts`); when off the client never calls G3 endpoints |

- Both defaults are asserted by `isSemanticRetrievalEnabled()` / `isSemanticRetrievalEnabledClient()` and locked by route-guard tests (flag-off → `disabled`, legacy behavior).
- No build config, `Dockerfile`, `.env`, or apphosting file enables either flag (REPOSITORY EVIDENCE verified by repository grep).

---

## 11. Security Model

1. **Owner derivation:** every G3 route reads `uid` only from `req.auth.uid`, populated by `verifyFirebaseToken` (JWT verify + admin auth lookup). No client-supplied uid is ever used as an authorization boundary.
2. **Path safety:** embedding/source paths are always built server-side from the verified uid + validated `sourceType`/`sourceId`; `sourceId` must be a plain string ID.
3. **Cross-user isolation:** KNN scopes to `users/{uid}/entryEmbeddings` / `memoryEmbeddings`; integration test proves `semanticSearchEntries('mallory', ...)` returns `empty` when another user's vectors exist.
4. **Rules lockdown:** `entryEmbeddings`/`memoryEmbeddings` are `allow read, write: if false` for all clients — the browser cannot read or write vector data directly (10 rules assertions).
5. **No vector exfiltration:** handlers return only ids/scores/context summaries; raw vectors never leave the server. Ask My Life returns the same context-document shape the legacy client already received.
6. **Rate limiting:** `rateLimiter` is applied to all four new endpoints and to Ask My Life.
7. **Input validation:** `sourceType` whitelist, non-empty `sourceId`/`query`, backfill `limit` clamped, malformed bodies → controlled 400s; retrieval text passes through `validateTextInput` / `buildEmbeddingText`.
8. **Post-filtering is not the security boundary:** ownership is enforced at the KNN query path scope (subcollection under `users/{uid}`) plus the rules lockdown; `private`/`archived`/date filters are data-visibility semantics replicating legacy client parity, not authorization.

---

## 12. Failure and Fallback Behavior

| Failure | Behavior |
|---|---|
| Embedding API auth failure | `GeminiError` 401 → route 401 (G3 endpoints) |
| Embedding API transient failure | `GeminiError` 500 → route 500 |
| Empty embeddings response | `GeminiError` 500 (`EMPTY_RESPONSE`) |
| Client embedding call failure (network/5xx) | `embeddingSync` returns `null` silently — **journal save is never blocked** (calls are fire-and-forget `void`, hook never awaits) |
| No embeddings for user | G3 routes report `disabled`/`empty`; Ask My Life uses client context; Semantic Search uses local engine |
| KNN/retrieval throw in Ask My Life | Server catch → fallback to client-provided context documents, `retrieval: 'empty'` |
| Non-saved memory ensure | `skipped` (no vector written) |
| Missing source / blank text | `source-not-found` / `skipped` (no vector written) |
| Repeated identical text | `unchanged` (no re-embed) |
| Malformed input | controlled 400 |
| Rate limit | standard 429 path of the shared limiter |

---

## 13. Test and Verification Evidence

### Emulator suite (`npm run test:rules`) — **152/152 passed (2/2 files)**
- `tests/rules/security_rules.test.ts` — **138/138**, including the 10 new G3 locked-collection assertions (read/write/delete denied for owner, intruder, and unauthenticated on both embedding collections).
- `tests/integration/journalEngine.integration.test.ts` — **14/14**, including the 7 new G3 vector-store tests that prove real `FieldValue.vector` writes and real `findNearest` KNN against the Firestore emulator (standard edition, `cloud-firestore-emulator-v1.22.0`). No vector retrieval is mocked.

### Unit suite (`npm test`) — **449/449 passed (57/57 files)**
Includes `server/gemini/__tests__/embeddings.test.ts` (13 new) and the 10 new G3 route-guard tests in `server/gemini/__tests__/serverRoutes.test.ts`, plus the untouched pre-existing suites (semanticSearch, views, auth, etc.).

### TypeScript
`npx tsc --noEmit` — exit 0.

### Build
`npm run build` (vite build + esbuild server bundle) — green in Step 4.

### Test-harness corrections applied during verification (documented, not production-code changes)
1. **Named Admin SDK app binding** — `tests/integration/journalEngine.integration.test.ts` initialized a *named* admin app (`'g3-integration'`) but read `admin.firestore()` off the *default* app (`"The default Firebase app does not exist"`). Fixed to `admin.firestore(adminApp)`.
2. **Independent G3 `RulesTestEnvironment` lifecycle** — the first `describe` block's `afterAll` destroyed the shared module-level `testEnv`, so the G3 block's `beforeEach` needed its own environment. The G3 block now creates/clears/cleans its own `g3Env`.
3. `vitest.rules.config.ts` `hookTimeout: 60000` — the emulator suite's `initializeTestEnvironment` measures ~7.7 s standalone and exceeds the vitest default 10 s `hookTimeout` under parallel load; the timeout was raised for execution on the developer machine. No assertions were removed or weakened, and emulator tests now run for real (previously they could not boot here because Java was not on PATH; `scripts/test-rules.mjs` auto-discovers a bundled JRE 21 under the opencode temp directory).

---

## 14. Known Coverage Gaps

These are **coverage gaps, not confirmed production defects** — each behavior is implemented and was present in verification, but no dedicated test pins it:

1. No dedicated route test for **Ask My Life retrieval-failure → client-context fallback** (the `try/catch → retrieval: 'empty'` path in `askMyLifeHandler` when the embedding store throws with a verified uid present). Mitigated by the flag-on/no-uid guard test and the empty-context insufficient-evidence short-circuit test.
2. No dedicated client unit test for the **`embeddingSync` adapter** (`src/services/embeddingSync.ts`). It is flag-gated off by default, constant in the first released revision; add coverage before the flag is enabled in production.

---

## 15. Deployment Plan

Sequence to enable G3 in production (a future, separate task — **not executed here**):

1. **Infra:** ensure named Firestore DB `gemini-journal` (Standard edition) — vector search is GA on Standard.
2. **Indexes:** deploy the two vector indexes (`firebase deploy --only firestore:indexes`); wait for `CREATING → READY` in the console/gcloud before querying (KNN fails against an unbuilt index).
3. **Rules:** deploy `firestore.rules` (`firebase deploy --only firestore:rules`) — gates client access to the new subcollections.
4. **Server:** deploy Cloud Run with `ENABLE_SEMANTIC_RETRIEVAL=true` (alongside existing secrets). Keep client flag **off** first.
5. **Backfill:** run `POST /api/gemini/backfill-embeddings` (auth+rate-limited, batched to 50/request; loop or schedule for full history) — establishes the corpus before enabling retrieval.
6. **Client:** rebuild with `VITE_ENABLE_SEMANTIC_RETRIEVAL=true` and deploy Hosting after the backfill has meaningful coverage.
7. **Observe:** monitor `askMyLife`/`semanticSearch` route success/error rates and Firestore read amplification; calibrate `RETRIEVAL_DISTANCE_THRESHOLD` on a labeled eval set.

---

## 16. Production Verification Checklist

**None of the items below has been performed at the time this document is created.** They are the gate for the full G3 closure (deferred work).

- [ ] Production vector index `entryEmbeddings` / `memoryEmbeddings` exist and are `READY` (dimension 768 matches stored vectors).
- [ ] `ENABLE_SEMANTIC_RETRIEVAL=true` applied to the Cloud Run `gemini-journal` service.
- [ ] Backfill completed (source counts reported and stable across consecutive runs).
- [ ] Ask My Life returns `retrieval: 'server'` with plausible context on a live query.
- [ ] Semantic Search returns `retrieval: 'server'` with ranked entries.
- [ ] Unauthorized cross-account queries return 401 / empty in production.
- [ ] Embedding subcollection client access denied in production (rules deployed and verified).
- [ ] Journal save remains unaffected with the flag on (save latency / failure rate stable).
- [ ] Flag-off rollback path verified in production (legacy behavior restored).

---

## 17. Rollback Plan

G3 is additive and fully flag-gated, so rollback is a configuration reversal with **no code revert required**:

1. **Immediate:** set `ENABLE_SEMANTIC_RETRIEVAL=false` on Cloud Run (server) and rebuild Hosting without `VITE_ENABLE_SEMANTIC_RETRIEVAL` — every G3 route reports `disabled`, Ask My Life and Semantic Search instantly revert to the exact legacy client engines.
2. **Cleanup (optional, later):** delete `users/*/entryEmbeddings` and `users/*/memoryEmbeddings` subcollections, drop the two vector indexes, and redeploy `firestore.rules`/`firestore.indexes.json`.
3. **Data retention:** embeddings are derivable from source documents at any time via backfill; no source data loss is possible.

---

## 18. Deferred Work

- **G3 tuning:** calibrated `RETRIEVAL_DISTANCE_THRESHOLD` and candidate budgets against a labeled eval set (emulator + prod).
- **Dedicated fallback test** for Ask My Life retrieval-failure → client-context (coverage gap #1).
- **`embeddingSync` adapter client test** (coverage gap #2).
- **Scheduled backfill invoker** for continuous history coverage (operations seam only; the endpoint already supports it).
- **Embedding freshness job / version bump path** — pinned-model upgrades (`gemini-embedding-002`) already centralized as a one-line change + re-backfill.
- **Production verification** per section 16.

---

## 19. Final Implementation Status

| Item | Status |
|---|---|
| G3 implementation (server + client + config + tests) | ✅ Complete |
| Emulator verification | ✅ 152/152 |
| Unit verification | ✅ 449/449 |
| TypeScript | ✅ clean |
| Build | ✅ green |
| Committed | ✅ (see commit in this task) |
| Pushed | ✅ (see push result in this task) |
| CI | ⏳ recorded in this task after push |
| Production verification | ❌ NOT performed — staged for a future task |
| Full G3 closure | ⏳ Deferred pending production verification (section 16) |