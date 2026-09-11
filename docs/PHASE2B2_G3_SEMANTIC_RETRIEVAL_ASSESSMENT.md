# Phase 2B-2 — G3 Semantic Retrieval Architecture Assessment

**Status:** ASSESSMENT COMPLETE — RECOMMENDATION READY
**Scope:** G3 (P1) — semantic retrieval (true embedding-based retrieval) for Ask My Life, Semantic Search, and approved memories.
**Mode:** Assessment-only. No source code, tests, config, rules, dependencies, indexes, collections, or deployments were changed. One document was produced and committed.
**Repository:** `D:\Apersonontherun\Google-Programmed\gemini-journal-reflections`
**Branch / baseline:** `master` @ `4e274537a3d1703a8fab742f0c06a64353ea710b` (clean tree at start and end).
**Production baseline:** `https://gemini-journal-s7hw7hui2q-uc.a.run.app` (project `gen-lang-client-0345619653`, us-central1, revision `gemini-journal-00023-k7d*` @ 100%); Firestore named database `gemini-journal`.

> Evidence labeling used throughout: **REPOSITORY EVIDENCE** = fact observed in this repository (file:line). **VERIFIED EXTERNAL FACT** = fact confirmed from an authoritative Google source (URL cited). **ARCHITECTURAL INFERENCE** = reasoned design conclusion built from the two above. **RECOMMENDATION** = this assessment's design decision.

---

## 1. Executive Summary

**Recommendation (one sentence):** JOURNAL∞ should implement G3 as a *server-side retrieval service* that embeds each journal entry and approved memory with a Gemini embedding model at write time, stores the vector in a dedicated owner-partitioned Firestore subcollection, and resolves Ask My Life and Semantic Search queries through server-side `findNearest` (KNN) retrieval — because the Firestore web SDK cannot run vector queries and the Gemini Embedding API must not be exposed to the browser, while the existing server (Cloud Run + `firebase-admin`) already satisfies every prerequisite (vector-capable Node SDK, Gemini Embedding API access via the installed `@google/genai`, owner-partitioned data, sanitization, rate limiting, audit).

The assessment passed the core premise check: **the repository today contains no embeddings, no vector indexes, and no semantic retrieval** — every "semantic" feature is client-side keyword/regex/intent scoring (`src/services/askMyLife.ts`, `src/services/semanticSearch.ts`). All prerequisite platform capabilities are verified available: Firestore KNN vector search (GA, dimensions ≤ 2048, supported on the project's Standard-edition `gemini-journal` database) and Gemini Embedding models (via the already-installed `@google/genai` ^2.4.0 → resolved 2.21.0). No new infrastructure, no production readiness claims, and no beyond-G3 expansion were made in this document.

---

## 2. Baseline State

### 2.1 Premise assertion

- **REPOSITORY EVIDENCE — PASSED.** `rg`-level inspection of the repository found **zero** occurrences of `embedding`, `vector`, `findNearest`, or `VectorValue` in `src/`, `server/`, `tests/`, `scripts/`, `firestore.rules`, or `firestore.indexes.json`. The premise "current retrieval is entirely keyword/regex/intent based; nothing in the repo is genuinely semantic" is TRUE.
- **REPOSITORY EVIDENCE — indexes.** `firestore.indexes.json` declares `"indexes": []` (only `fieldOverrides` disabling free-text indexing on `body`, `narrative`, `description`, etc.). There is no vector index configured anywhere.
- **REPOSITORY EVIDENCE — data model.** `src/data/models.ts` `JournalEntry` (line 144) and `Memory` (line 163) **do not** define an `embedding` or `vector` field.

### 2.2 Current retrieval flow (exactly as built)

| Feature | Engine | Where it runs | Input | Query semantics |
|---|---|---|---|---|
| **Ask My Life** | `askMyLifeQuery()` (`src/services/askMyLife.ts:150`) | Client browser | `{ question, entries, memories, goals, timelineEvents }` (all passed as props from live subscriptions) | `detectQueryIntent()` (line 24) regex intents + date heuristics; `scoreAndRankDocuments()` (line 64) term-overlap scoring; top doc compression to **max 15 docs / 12,000 chars** (`scoreAndRankDocuments`, lines 116–127). Selected `ContextDocument[]` sent to `POST /api/gemini/ask-my-life`. |
| **Semantic Search** | `executeSemanticSearch()` (`src/services/semanticSearch.ts:148`) | Client browser | `{ entries, collections, memories, goals }` + `SemanticSearchFilters` (query, startDate, endDate, tag, mood, theme, person, place, goal, collection, page, pageSize) | `parseQueryIntent()` (line 42) regex emotion/theme/keyword extraction; per-entry keyword/emotion/theme scoring with 8 hard filters; pagination in memory. No embeddings involved. |

### 2.3 Data provisioning (the constraint that matters)

- **REPOSITORY EVIDENCE.** `src/App.tsx` subscribes to real-time Firestore snapshots: `journalEntriesApi.subscribe` (line 228), `memoriesApi.subscribe` (line 232), `goalsApi.subscribe` (line 236), `habitsApi.subscribe` (line 240), `timelineEventsApi.subscribe` (line 244), `insightsApi.subscribe` (line 248). Arrays flow through `ResponsiveNavigationShell.tsx` which mounts `AskMyLifeView` (line 515) and `SemanticSearchView` (line 553). Both retrieval engines therefore operate **entirely on data the client already holds** via listeners.
- **CONSEQUENCE (ARCHITECTURAL INFERENCE).** A move to true vector retrieval changes *where* query-time computation runs, not how the UI renders. Detailed design in §9–§11.

### 2.4 Why the baseline cannot produce genuine semantic retrieval

- **REPOSITORY EVIDENCE.** Both engines match literal tokens/sub-strings. Synonyms, paraphrases, concepts expressed in different words ("the night I almost quit" vs. "I wanted to give up") score zero in `scoreAndRankDocuments` unless a shared token happens to appear (`src/services/askMyLife.ts:75-107`). Regex intent lists (`semanticSearch.ts:53-82`) are closed sets; anything outside them defaults to keyword matching.
- **VERIFIED EXTERNAL FACT.** This is the exact failure mode vector retrieval (dense embeddings) is designed to fix, per Google's own RAG guidance (URL: `https://ai.google.dev/gemini-api/docs/embeddings`) and Firestore's vector-search documentation (URL: `https://firebase.google.com/docs/firestore/vector-search`).

### 2.5 Baseline accounting

- **REPOSITORY EVIDENCE.** G3 is defined in `docs/PHASE2_COMPETITION_GAP_ASSESSMENT.md` as P1, next after G1 (memory engine, closed in `docs/PHASE2A_MEMORY_ENGINE_IMPLEMENTATION.md`) and G2 (view activation, closed in `docs/PHASE2B1_VIEW_ACTIVATION.md`). G3 remains OPEN. `docs/PROJECT_STATE.md` documents the runtime topology (client = Firebase Hosting SPA; server = Cloud Run `gemini-journal`, region us-central1; server owns `GEMINI_API_KEY` and talks to Firestore via `firebase-admin`).

---

## 3. Repository Evidence

### 3.1 Data models

- **REPOSITORY EVIDENCE.** `src/data/models.ts`: `JournalEntry` (line 144) — `id, uid, title, body, mode, mood, energy, tags, location, attachments, aiMetadata, favorite, archived, private, createdAt, updatedAt, occurredAt`. `Memory` (line 163) — `id, uid, type, title, narrative, status, tags, sourceEntryIds, sourceMemoryIds, createdAt, updatedAt, reviewedAt, confidence`. `AiMetadata` (line 93). No embedding/vector field on either model.
- **REPOSITORY EVIDENCE — path safety.** `src/data/paths.ts`: `MAX_DOC_ID_LENGTH = 128` (line 13), `assertSafeId` (line 18), `requireOwnerUid` (line 37), `buildCollectionPath` (line 48), `buildDocPath` (line 53). All server and client writes route through these guards.
- **REPOSITORY EVIDENCE — CRUD factory.** `src/data/crud.ts` `createCollectionApi` generates the client CRUD layer; `src/data/services/journalEntries.ts` defines `INPUT_KEYS` (includes `aiMetadata`, **excludes** any embedding field) — so the client cannot today write vectors even if one were added.

### 3.2 Server flows

- **REPOSITORY EVIDENCE — server bootstrap.** `server.ts`: `resolveFirestoreDatabaseId` (line 129), `buildFirestoreDocumentPath` (line 143), `getAdminApp` (line 154), `getAdminFirestore` (line 189), Firestore instance bound to named DB `gemini-journal` (line 207 via `getFirestore(await getAdminApp(), FIRESTORE_DATABASE_ID)`).
- **REPOSITORY EVIDENCE — security seam.** `verifyFirebaseTokenAsync` (line 268) + `verifyFirebaseToken` (line 328): JWT verify + `admin.auth()` lookup on every protected route. Demo-mode short-circuit only outside production (line 276).
- **REPOSITORY EVIDENCE — rate limiting.** `rateLimiter` (server.ts:55): in-memory per-IP limiter applied to every Gemini route (observed at `server.ts:504`, `516`, `528`, `540`, `552`, `576`, `588`, `600`, `612`). `x-forwarded-for` trusted only in production (line 48).
- **REPOSITORY EVIDENCE — audit.** `aiAudit.log()` (server.ts:234) appends every AI interaction to `users/{uid}/aiInteractions/{id}` via the admin SDK (route call sites at `server.ts:559` for extract-memories, and the ask-my-life route `server.ts:612`).
- **REPOSITORY EVIDENCE — Gemini service.** `server/gemini/service.ts`: imports `GoogleGenAI` from `@google/genai` (line 1); `GeminiService` (line 46) with lazy client `getClient()` (line 72) using `GEMINI_API_KEY` env/secret (line 74); model fallback ladder `gemini-3.6-flash → gemini-3.1-flash-lite → gemini-flash-latest → gemini-3.7-flash` (lines 52–55); `generateWithFallback` (line 97); `extractMemoryCandidates` (line 488); `askMyLife` (line 665).
- **REPOSITORY EVIDENCE — types.** `server/gemini/types.ts`: `ContextDocument` (line 157), `EvidenceCitation` (line 166), `AskMyLifeInput` (line 174), `AskMyLifeOutput` (line 180).
- **REPOSITORY EVIDENCE — validation & sanitization.** `server/gemini/validation.ts`: `MAX_INPUT_LENGTH = 12000` (line 3), `PROMPT_INJECTION_PATTERNS` (line 6), `validateTextInput` (line 24), `sanitizeRetrievedContext` (line 53). Used by `askMyLife` server flow to harden retrieved context before it reaches the model — directly relevant to retrieved text in §12.

### 3.3 Security rules

- **REPOSITORY EVIDENCE.** `firestore.rules`:
  - Owner-only helpers `isAuthenticated` / `isOwner` (lines 45–50); strict owner partition model documented in header (lines 3–39).
  - `journalEntries`: validator `isValidJournalEntry` (line 168), match block `users/{userId}/journalEntries/{entryId}` with `read/create/update/delete` and `immutableUnchanged` (lines 189–195).
  - `memories`: validator `isValidMemory` (line 200), match block (lines 215–221).
  - **No** match rule exists for any vector/embedding collection today — one must be added (design detail §8.5, §12).

### 3.4 Deployment & CI/CD

- **REPOSITORY EVIDENCE.** `.github/workflows/deploy.yml`: Node 22; `npm ci` → `audit` → `typecheck` → `test` → `build`; Docker image build + scan; deploy to Cloud Run `gemini-journal` (us-central1); secrets from Secret Manager (`GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `ADMIN_EMAILS`, `FIREBASE_SERVICE_ACCOUNT_JSON`).
- **REPOSITORY EVIDENCE.** `firebase.json`: named database `gemini-journal` bound to `firestore.rules` + `firestore.indexes.json` (lines 5–11); Hosting `dist/` with `/api/**` rewrite → Cloud Run `gemini-journal` (lines 35–42); Firestore emulator on 127.0.0.1:8080 (lines 12–16). `.firebaserc`: project `gen-lang-client-0345619653`.
- **REPOSITORY EVIDENCE.** `.env.example` documents `VITE_FIREBASE_FIRESTORE_DATABASE_ID="gemini-journal"` and the server secrets (`GEMINI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `ADMIN_EMAILS`, etc.).

### 3.5 Tests (inventoried; none for vector retrieval)

- **REPOSITORY EVIDENCE.** Existing coverage that must remain green: `server/gemini/__tests__/` (askMyLifeAi, aiSecurityAdversarial, authVerification, extractMemoryRoutes, firestoreConfig, geminiService, memoryAiValidation, multimodalRoutes, serverRoutes), `src/services/__tests__/semanticSearch.test.ts`, `src/components/journal/__tests__/SemanticSearchView.test.tsx`, `tests/integration/journalEngine.integration.test.ts`, `tests/rules/security_rules.test.ts`, plus auth/comp-as components. **No** `askMyLife.test.ts`, no vector/embedding tests, and no Firestore-emulator vector tests exist.
- **REPOSITORY EVIDENCE — tracked counts (prior closure docs).** `docs/PHASE2B1_VIEW_ACTIVATION.md` records 422/422 tests and 135/135 rules passing at G2 close; these numbers are the regression ceiling for any G3 implementation and are **not** re-asserted as implementation results here.

---

## 4. Verified External Platform Facts

All facts below were confirmed against authoritative Google sources at assessment time (2026-09-11) and are labeled **VERIFIED EXTERNAL FACT**. Anything not in this section is treated as unverified.

### 4.1 Firestore KNN vector search

1. **GA and availability.** Vector search for Firestore in Native mode is generally available (GA announced in the 2026-01-15 release notes), including KNN vector indexes and nearest-neighbor queries. — Source: `https://docs.cloud.google.com/firestore/native/docs/release-notes` (2026-01-15 item).
2. **Common usage.** Store a vector field on a document, create a vector index, then run `findNearest` queries; Firestore **does not generate the embeddings for you** — you bring them from an external embedder (e.g., Gemini Embedding API). — Sources: `https://firebase.google.com/docs/firestore/vector-search` and `https://docs.cloud.google.com/firestore/native/docs/vector-search`.
3. **Dimension limit.** A vector field is limited to **2048 dimensions**; the nearest-neighbor query vector must be ≤ 2048 dimensions. — Source: `https://docs.cloud.google.com/firestore/docs/reference/rest/v1/StructuredQuery` (`FindNearest.queryVector` and vector index docs).
4. **Result-cap limit.** Nearest-neighbor queries return **at most 1,000 results**; this is a documented Firestore Standard-edition query limitation. — Source: `https://firebase.google.com/docs/firestore/vector-search` (limits table) and the Node SDK limit docstring (see §4.3.3).
5. **No real-time listeners.** "Vector search does not support real-time snapshot listeners" — vector results are request/response only. — Source: `https://firebase.google.com/docs/firestore/vector-search`.
6. **Client-library restriction (critical).** "Only the Python, Node.js, Go, and Java client libraries support vector search." The **web/admin-web JS SDK does not support vector queries**. — Source: `https://firebase.google.com/docs/firestore/vector-search`. (This is the single most decisive fact for the architecture — see §5.)
7. **Distance measures.** `EUCLIDEAN`, `COSINE`, `DOT_PRODUCT` (preferred with unit-normalized vectors); optional `distanceThreshold` and `distanceResultField`. — Sources: `https://firebase.google.com/docs/firestore/vector-search`, `https://docs.cloud.google.com/firestore/docs/reference/rest/v1/StructuredQuery`, and the Node SDK declares it (see §4.3.3).
8. **Vector index management.** Vector indexes are declared as index fields with `vectorConfig` (`dimension`, `flat`); docs show both Terraform and the index-definition JSON (`firestore.indexes.json`) format, plus creation via `gcloud`. — Sources: `https://firebase.google.com/docs/firestore/query-data/indexing`, `https://firebase.google.com/docs/reference/firestore/indexes` (illustrates `"vectorConfig": {"dimension": 256, "flat": {}}` nested under a `fields` entry with `"__name__"`), and `https://docs.cloud.google.com/firestore/native/docs/standard-indexing`.
9. **Standard edition support.** Vector indexes and vector search are available on **Standard edition** databases (the docs' Standard-edition page documents creating vector indexes in the console / gcloud, and the 1,000-result cap is the Standard-specific limit). The project's named database `gemini-journal` is Standard edition (repository evidence: `docs/PHASE2A_MEMORY_ENGINE_IMPLEMENTATION.md` / `docs/PHASE2A_*` migration record). — Source: `https://docs.cloud.google.com/firestore/native/docs/standard-indexing`.
10. **GA REST/order guarantee.** `StructuredQuery` executes `findNearest` after `from/where/select/orderBy/offset/limit`; ordering of equal distances is not guaranteed. — Source: `https://docs.cloud.google.com/firestore/docs/reference/rest/v1/StructuredQuery`.

### 4.2 Gemini Embedding API

1. **Models.** `gemini-embedding-001` (text, 3072 dims default; MRL-truncatable to 768/1536/3072 with **manual L2-normalization of truncated vectors**); `gemini-embedding-2` (newest; multimodal; **auto-normalizes** truncated dimensions; no `taskType`). `text-embedding-004` is **deprecated**. — Sources: `https://ai.google.dev/gemini-api/docs/embeddings`, `https://ai.google.dev/gemini-api/docs/models/gemini-embedding-001`, and GitHub issue `https://github.com/simonw/llm-gemini/issues/102` (deprecation of `text-embedding-004`).
2. **Task types.** For RAG use `RETRIEVAL_QUERY` for the query and `RETRIEVAL_DOCUMENT` for documents (both supported by `gemini-embedding-001`); `title` param improves retrieval-document embeddings. — Source: `https://ai.google.dev/gemini-api/docs/embeddings` and `https://ai.google.dev/gemini-api/docs/models/gemini-embedding-001`.
3. **Input limits.** Models have a maximum token input (8192 tokens per the embedding docs); oversized inputs are truncated/error per `autoTruncate` behavior. — Source: `https://ai.google.dev/gemini-api/docs/embeddings`.
4. **SDK support.** `@google/genai` exposes `ai.models.embedContent({ model, contents, config })` with `config.taskType` and `config.outputDimensionality`. — Sources: `https://ai.google.dev/api/embeddings` (Node.js example) and `https://ai.google.dev/gemini-api/docs/embeddings`.

### 4.3 Installed SDK verification (repository-grounded)

1. **REPOSITORY EVIDENCE — `@google/genai`** resolves to **2.21.0** (`node_modules/@google/genai/package.json`). `node_modules/@google/genai/dist/node/node.d.ts` declares `interfaces EmbedContentConfig` / `EmbedContentParameters` (lines 3867, 3917) with `taskType` (line ~3877) and `outputDimensionality` (line ~3888), and the Models client method `embedContent: (params: types.EmbedContentParameters) => Promise<types.EmbedContentResponse>` (line 10933). **No new dependency is required to call the Gemini Embedding API server-side.**
2. **REPOSITORY EVIDENCE — `firebase-admin`** resolves to **12.7.0** (`package.json:26`), which pulls `@google-cloud/firestore` **7.11.6** (`node_modules/@google-cloud/firestore/package.json`).
3. **REPOSITORY EVIDENCE — Firestore Node vector API present.** `node_modules/@google-cloud/firestore/types/firestore.d.ts` declares: `VectorValue` class + `static vector(values?: number[]): VectorValue` (lines 2762, 2849); `Query.findNearest` positional legacy form (line 2083) and new object form (line 2120) with `VectorQueryOptions` (line 3258) exposing `vectorField`, `queryVector`, `limit`, `distanceMeasure`, `distanceResultField`, `distanceThreshold`; `VectorQuery` (line 2728) and `VectorQuerySnapshot` (line 2220). The positional form's docstring states `limit` max is **1000**. **The installed Node admin SDK can build and execute KNN vector queries today.**

### 4.4 What remains verified-but-not-present

- **REPOSITORY EVIDENCE.** No vector index, no embedding service, no retrieval route exists in this repository. Everything in §5–§13 is therefore an *assessment/recommendation*, not a present capability.

---

## 5. Architecture Options Comparison

Evaluated against eight criteria. Weighting reflects G3 goals (genuine semantic retrieval) plus the project's hard constraints (owner privacy, sandboxed demo, no secret leakage, existing CI/CD and Cloud Run topology).

| # | Option | Architecture |
|---|---|---|
| **A** | **Server-side Firestore KNN (dedicated embedding subcollection)** | Server (Cloud Run) embeds entries/memories at write time and stores vectors in `users/{uid}/entryEmbeddings/…` + `users/{uid}/memoryEmbeddings/…`. Queries: client → server → server embeds query → `admin` `findNearest` on the owner's vectors → hyrid re-rank → returns IDs/context. |
| **B** | Server-side Firestore KNN, vector stored **on the entry/memory doc** | Same query path as A, but `embedding` lives on `journalEntries/{id}` / `memories/{id}` directly. |
| **C** | Third-party vector store (Pinecone / pgvector / Vertex AI Vector Search) | Embeddings written to an external vector database; query path server → external store. |
| **D** | Client-side "semantic" scoring (status quo, improved) | Keep client keyword/regex engines; add better dictionaries/fuzzy hashing, no embeddings, no vector index. |
| **E** | Everything server-embedded but full corpus sent up for server scoring | Client ships the whole text corpus to a server route; server embeds locally or scores; no vector index. |

### 5.1 Criterion matrix

Legend: ✅ strong, ⚠️ partial/acceptable, ❌ weak/fails. **VERIFIED EXTERNAL FACT** citations in brackets.

| Criterion | A | B | C | D | E |
|---|---|---|---|---|---|
| Genuine semantic retrieval (synonym/paraphrase recall) — the actual G3 requirement | ✅ | ✅ | ✅ | ❌ [3.4, §4.2] | ⚠️ (embed at request time only) |
| Privacy: data stays in owner's Firestore partition / Google Cloud | ✅ | ✅ | ⚠️ (data leaves Firestore to vendor) | ✅ | ⚠️ (whole corpus over transit each query) |
| Query must run server-side (web SDK can't do vector search) [§4.1 #6] | ✅ | ✅ | ✅ | n/a | n/a |
| No real-time listeners for vector search [§4.1 #5] | ✅ (queried on demand; rendering still uses subscribed lists) | ✅ | ✅ | n/a | n/a |
| Owner-flows/security rules unchanged in spirit | ✅ (new rules block; additive) | ⚠️ (rules/model/schema churn on core docs; client DELETE/UPDATE paths must tolerate a server-only field; `INPUT_KEYS` conflict) | ⚠️ (rules can't protect external store; IAM + sync complexity) | ✅ | ✅ |
| Cost | ⚠️ (Firestore vector index storage on Standard; per-embedding API calls) | ⚠️ (same but entry docs get larger — every full-entry read carries a 768-dim array) | ❌ (vendor + egress; overkill at personal scale) | ✅ | ❌ (largest token/bandwidth profile) |
| Latency at personal-journal scale (hundreds–thousands of doc units) | ✅ sub-100ms KNN + ≤12000-char embed | ✅ | ⚠️ (network hop) | ✅ | ❌ |
| Engineering risk / blast radius | Low (new subcollections; additive; server-only writes) | Medium (core-doc schema + rules + client write-path coupling) | High (new infra, IAM, sync/backfill from Firestore) | None (but does not deliver G3) | Medium-High (client sends raw private corpus; larger payloads, validation surface) |
| Fits existing GeminiService / aiAudit / rate-limit seams | ✅ | ✅ | ⚠️ | n/a | ✅ |
| Emulator/demo dev path | ⚠️ (vector queries need real emulator support — see §17 risk R7) | ⚠️ (same) | ❌ | ✅ | ✅ |

### 5.2 Recommendation ranking

**A is the recommended option.** Rationale: it is the only option that (a) delivers genuinely semantic retrieval, (b) keeps all private text inside the user's existing owner-partitioned Firestore, (c) uses only already-installed SDKs (`@google/genai` 2.21.0 for embedding, `@google-cloud/firestore` 7.11.6 for `findNearest`), (d) is additive to the existing security/audit/rate-limit architecture, and (e) matches the deployment topology (server already owns `GEMINI_API_KEY` and the admin SDK).

**Why not B:** storing the 768-dim vector on `journalEntries`/`memories` inflates every subscribed entry read, conflicts with the client `INPUT_KEYS` write layer (`src/data/services/journalEntries.ts`), and forces validator churn on the two most security-tight rules blocks (`isValidJournalEntry` line 168, `isValidMemory` line 200). Dedicated subcollections isolate the vector index, keep core reads lean, and let the server be the only writer.

**Why not C:** at this product's scale (a personal journal, hundreds to low-thousands of leaf documents per user), a third-party vector DB adds an IAM/egress/backfill surface disproportionate to the gains and moves private text outside the user-honoring Google Cloud data path. A future large-corpus migration can be revisited without changing Option A's write schema (the embedding doc is the same shape).

**Why not D:** it would not satisfy G3; it only polishes the existing keyword approach. The gap assessment explicitly defines G3 as dense/semantic retrieval. It is retained only as the fallback if vector search is found non-functional in the emulator (§17, R7).

**Why not E:** it contradicts the documented invariant "never sends the entire database" (`src/services/askMyLife.ts:15`) and multiplies server bandwidth/token cost per query.

---

## 6. Recommended Architecture

**RECOMMENDATION — Option A "Embed-on-write, query-server-side".**

```
 QUESTIONS / QUERIES                      STORED CONTENT
 ──────────────────                        ─────────────────────
 SemanticSearchView ──┐                     entryEmbeddings/{id}
 AskMyLifeView ───────┤  POST /api/…        { uid, sourceId, dim=768,
                      ▼                     vector, textHash, ts }
 ┌────────────────────────────┐   │ server
 │ Cloud Run  gemini-journal  │   │ 1. verifyFirebaseToken
 │  GeminiService (embed)     │   │ 2. rateLimiter
 │  Firestore admin findNearest│   │ 3. validation/sanitization
 └────────────────────────────┘   │ 4. aiAudit.log
                      │  returns ranked doc IDs + scores + (AskML body)
                      ▼
 Client maps IDs → subscribed entry/memory objects → existing UI render
```

**Pipeline at a high level:**

1. **Write path (server-owned, idempotent).** When an entry or a saved memory is created/updated (hook at the existing save seams — mirroring `useMemoryExtraction` and `memoryPipeline.ts` marker approach), a server route computes the 768-dim embedding via `GeminiService`, then writes/overwrites a doc in `users/{uid}/entryEmbeddings/{sourceEntryId}` or `users/{uid}/memoryEmbeddings/{sourceMemoryId}` carrying `{ uid, sourceId, embedding (VectorValue), textHash, updatedAt }`. Deleting a source doc deletes its embedding doc.
2. **Backfill (idempotent).** A server route enumerates the owner's entries/memories missing an embedding doc (or whose `textHash` is stale) in bounded batches and fills them — reusing `memoryPipeline.ts`'s marker/idempotency philosophy, but persisted server-side instead of `localStorage` (`EXTRACTION_MARKER_STORAGE_KEY`, `src/services/memoryPipeline.ts:32`).
3. **Query path (server resolves retrieval).**
   - **Ask My Life:** client POSTs `{ question, dateFilter }`; server embeds the question (`RETRIEVAL_QUERY`), `findNearest` over the owner's `entryEmbeddings ∪ memoryEmbeddings` (± parallel queries, ± optional pre-filters `private/archived`), re-ranks with a cheap keyword boost (reuse of current intent/date logic semantics), compresses to **≤15 docs / ≤12,000 chars** (the same invariant as today, `src/services/askMyLife.ts:116-127`), sanitizes, and passes the context into the existing `GeminiService.askMyLife` (line 665), then `aiAudit.log` and returns the same `AskMyLifeOutput` shape the UI already consumes.
   - **Semantic Search:** client POSTs `{ query, filters, page, pageSize }`; server embeds the query, KNN-retrieves scored entry IDs (with filter-aware composite vector index, §8.4), returns `{ entryId, score, matchedFilters }`. The client keeps the real-time subscribed entry objects for rendering and only maps returned IDs → objects (preserving snapshots/reactivity; §2.3). Snippets/relevance explanations continue to be derived client-side from the local copy (reusing `createPreviewSnippet`, `semanticSearch.ts:100`).
4. **Feature flags / rollout.** New endpoints added but only exposed after both the write path and index are deployed (§14). Existing client engines remain as the non-vectorized fallback until cutover.

**Non-goals (scope guard).** No change to habits/goals/reports/On This Day/dashboard retrieval; no offline vector store; no client-visible Gemini key; no claims that this is shipped or production-verified — it is an assessment with a recommendation.

---

## 7. Embedding Model and Dimensionality Design

**RECOMMENDATION.** Use **`gemini-embedding-001` at `outputDimensionality: 768`** for both documents and queries, with `RETRIEVAL_DOCUMENT` (`title: entry.title`) for stored content and `RETRIEVAL_QUERY` for queries, and **manual L2 normalization** of the stored 768-dim vector (required because MRL-truncated `gemini-embedding-001` outputs are not auto-normalized — VERIFIED EXTERNAL FACT §4.2 #1).

Reasoning tied to verified constraints:

- **Capacity.** Firestore vector fields ≤ 2048 dims [VERIFIED §4.1 #3]. `gemini-embedding-001` default is 3072; must be truncated anyway. 768 is an officially supported MRL dimension [VERIFIED §4.2 #1] and keeps each stored vector ≈ 6 KB (768 float64), which is negligible in a dedicated embedding doc and keeps embedding API cost minimal. 1536 is an acceptable alternative if benchmarking demands it.
- **Normalization.** Because we store a truncated vector, we L2-normalize before writing (so `DOT_PRODUCT` = cosine similarity, the documented recommendation [VERIFIED §4.1 #7]). Queries likewise L2-normalize the query vector before `findNearest`, and use `DOT_PRODUCT` as the distance measure to get scale-invariant ranking. (If implementation prefers, `COSINE` avoids manual normalization at slightly higher cost.)
- **Model stability.** Pin the model name in a single server constant (e.g., `EMBEDDING_MODEL = 'gemini-embedding-001'`) mirroring the existing `GeminiService` model-ladder pattern (`server/gemini/service.ts:52-55`), so a future move to `gemini-embedding-2` (auto-normalizing, multimodal, no `taskType`) is a one-line change plus, if applicable, re-backfill. **Do not** use deprecated `text-embedding-004` [VERIFIED §4.2 #1].
- **Input budget.** `MAX_INPUT_LENGTH = 12000` chars (server/gemini/validation.ts:3) is well under the 8192-token embedding input cap for the target languages; embed the same text the model reads today (title + body + tags for entries; title + narrative + tags for memories) after `validateTextInput`. `sanitizeRetrievedContext` is only for the *output* context path, not the embedding input.
- **Batching.** `embedContent` accepts multiple contents in one call [VERIFIED §4.2 #4]; backfill should batch 10–20 docs per call to control latency/cost.

---

## 8. Indexes, Data Model, and Lifecycle Design

### 8.1 Data model (new subcollections)

**RECOMMENDATION** — two new owner-partitioned subcollections, writeable only by the server:

```
users/{uid}/entryEmbeddings/{sourceEntryId}
  uid: string                       (=== uid, for defense-in-depth + filter)
  sourceId: string                  (=== doc id; entry id)
  sourceType: 'entry'               (enum for future-proofing)
  embedding: VectorValue            (768-dim, L2-normalized)
  textHash: string                  (sha256 of embedded text) — idempotency/staleness
  private: boolean                  (mirror of source.private, for pre-filter)
  archived: boolean                 (mirror of source.archived, for pre-filter)
  occurredAt: timestamp | null      (mirror of source.occurredAt for range filters)
  updatedAt: timestamp              (source write time)

users/{uid}/memoryEmbeddings/{sourceMemoryId}   (same shape, sourceType: 'memory',
                                                private=false, archived=false)
```

- **REPOSITORY EVIDENCE — why the mirror fields.** The client already subscribes to full docs; but vector search **pre-filters** are evaluated server-side, so the vector doc must carry the filter keys (`private`, `archived`, `occurredAt`) locally [ARCHITECTURAL INFERENCE over §4.1 #5/#6]. This avoids KNN-with-join-on-client and keeps the KNN index composite scope narrow.
- **RECOMMENDATION — exclusion rules.** `private: true` entries and memory-doc-source behavior must be preserved exactly as the current views treat them: Ask My Life currently includes non-archived subscriptions but the UI gates private entries on the server path; the assessment recommends the retrieval pre-filter default to `private == false` (Ask My Life) with an owner-facing option, and **always** `archived == false`, matching the current app's browse semantics. Final exclusion policy must be confirmed from the current view logic before implementation (open question Q3, §17).

### 8.2 Write lifecycle (idempotent, server-owned)

1. **Create/update entry or memory** → client save hook (the same seam as `useMemoryExtraction`/`memoryPipeline`) optionally invokes `POST /api/gemini/ensure-embedding` (server) or a batched `POST /api/gemini/backfill-embeddings`. Server recomputes embedding whenever `textHash(body,title,narrative,tags)` differs — same content-hash idempotency pattern as `src/services/memoryPipeline.ts:19`.
2. **Delete entry/memory** → server route deletes the corresponding embedding doc (or a background sweep marks orphans by `sourceId`).
3. **Backfill** → enumerate owner content in batches; skip docs whose `textHash` matches; write only the delta; cap work per request (e.g., 50 docs/request) to stay inside Cloud Run's request budget; run repeatedly until clean. Mark progress with the doc `updatedAt`/presence (no new storage vehicle needed).

### 8.3 Vector index declaration

**RECOMMENDATION (deployment-time config, VERIFIED format §4.1 #8).** Two indexes in `firestore.indexes.json` (or equivalent Terraform/gcloud) — collection-scoped, one per subcollection — with `queryScope: "COLLECTION"` and a composite including the pre-filter fields:

```json
{
  "indexes": [
    {
      "collectionGroup": "entryEmbeddings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "archived", "order": "ASCENDING" },
        { "fieldPath": "embedding", "vectorConfig": { "dimension": 768, "flat": {} } }
      ]
    },
    {
      "collectionGroup": "memoryEmbeddings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "uid", "order": "ASCENDING" },
        { "fieldPath": "embedding", "vectorConfig": { "dimension": 768, "flat": {} } }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Notes:
- **Dimension must exactly match the stored vectors (768)** — vectors of other dimensionality are excluded from the index [VERIFIED §4.1 #3, §4.3.3].
- **Scene of deployment is a config/terraform change**, deliberately out of scope for this assessment-only task; flag the `firebase-tools` vector-index reconciliation bugs (§17 R6) and prefer `gcloud firestore indexes composite create` / Terraform for reliable idempotent deploys.
- Flat (`flat: {}`) is the documented flat-index type and is appropriate at personal scale (exhaustive, exact search).

### 8.4 Query index matching rules

[ARCHITECTURAL INFERENCE] A `findNearest` on `collection('users').doc(uid).collection('entryEmbeddings')` must either (a) be a path-scoped query without pre-filters (covered by a single-field vector index on `embedding`), or (b) include an equality pre-filter on every non-vector field used in `where(...)` (covered by the composite above). The recommendation chooses (b) because `archived`/`private`/`uid` pre-filters are always applied. The exact composite/path-scope combination must be validated against the deployed index names before enabling the endpoints (§14 step 5).

### 8.5 Firestore rules addition

**RECOMMENDATION — additive, matches repo style.** Add a `match` block before the closing `}` of `firestore.rules` for both subcollections, server-write-able and owner-read-able, validating the embedding doc shape:

```text
function isValidEmbeddingDoc(data) {
  return data.uid is string
    && data.uid.size() >= 1 && data.uid.size() <= 128
    && data.sourceId is string
    && data.embedding is list
    && data.embedding.size() == 768
    && data.textHash is string
    && data.private is bool
    && data.archived is bool
    && ('occurredAt' in data) == false || data.occurredAt is timestamp
    && data.updatedAt is timestamp;
}

match /users/{userId}/entryEmbeddings/{id} {
  allow read:    if isOwner(userId);
  allow create:  if isOwner(userId) && isValidEmbeddingDoc(request.resource.data);
  allow update:  if isOwner(userId) && isValidEmbeddingDoc(request.resource.data);
  allow delete:  if isOwner(userId);
}
match /users/{userId}/memoryEmbeddings/{id} { /* identical */ }
```

- Actually the server admin SDK bypasses rules entirely — this block exists as defense-in-depth so a compromised *or future* client write still enforces shape/partitioning; keep it in lockstep with the server validator. Add a `768`-length check only if the rules engine allows it (list-size checks are supported; element-type probes would need the repo's probe pattern).

---

## 9. Retrieval & Ranking Design

**RECOMMENDATION — "KNN-first, keyword-boost, budget-bounded hybrid".**

1. **Query embedding.** Normalize the query text (`validateTextInput`), embed with `taskType: RETRIEVAL_QUERY`, L2-normalize the query vector.
2. **Candidate stage.** Run `findNearest({ vectorField: 'embedding', queryVector, limit: K, distanceMeasure: 'DOT_PRODUCT', distanceResultField: '__dist__' })` over `entryEmbeddings` (and, for Ask My Life, `memoryEmbeddings` in parallel). `K = 40` candidates is the recommended budget (well under the 1000 cap [VERIFIED §4.1 #4]) to leave room for the filter + compression pass.
3. **Filter pass.** Apply client-equivalent filters in the server layer on the candidates: `private`/`archived` exclusion, date bounds (mirroring `detectQueryIntent` dateBounds, `askMyLife.ts:51-59`), and the Semantic Search structured filters (date/tag/mood/theme/person/place/goal/collection parity — behaviors defined in `semanticSearch.ts:182-254`) for those that cannot be pushed into pre-filters.
4. **Hybrid boost.** Add a small server-side keyword bonus (reusing tokenization/scoring concepts already in `scoreAndRankDocuments` and `parseQueryIntent`) so exact-title/date matches rank above pure neighbors — preserves today's dependable precision on entity/tag queries while adding semantic recall.
5. **Compression / budget.** For Ask My Life, keep the exact invariant "≤ 15 selected docs / ≤ 12,000 chars" (current engine, `askMyLife.ts:116-127`); for Semantic Search, cap at `pageSize ≤ 100`, consistent with the current pagination contract (`semanticSearch.ts:336-351`).
6. **Distance threshold.** A recommended floor of e.g. `DOT_PRODUCT ≥ 0.35` (equivalent cosine) with configurable constant; anything below is "insufficient evidence" → the same `confidence: 'insufficient'` / `hasSufficientEvidence: false` path (`askMyLife.ts:236-246`). Exact threshold must be tuned during implementation on real data (open question Q5).
7. **Evidence shape.** Return the same evidence-citation shape (`EvidenceCitation`, `server/gemini/types.ts:166`) resolved from the real source docs; the model's "cite your sources" behavior is unchanged (`GeminiService.askMyLife`, line 665).

---

## 10. Ask My Life Integration Design

- **RECOMMENDATION.** New route `POST /api/gemini/ask-my-life` remains the same URL **shape** but gains a server-side retrieval path:
  - Input: `{ question }` + optional `{ dateFilter }` (client no longer sends `contextDocuments`). This actually **strengthens** the "never sends the entire database" invariant in `src/services/askMyLife.ts:15` — nothing but the question leaves the client.
  - Output: unchanged `AskMyLifeOutput` (`types.ts:180`) so `askMyLifeQuery()` (`src/services/askMyLife.ts:150`) and `AskMyLifeView.tsx` require only the request-body change.
  - Server: `verifyFirebaseToken` → `rateLimiter` → validate → embed query → KNN (§9) → retrievered context → `aiAudit.log` → `GeminiService.askMyLife` (line 665). Threat-model additions in §12 (careful: server now pulls text straight from Firestore and passes to the model — continue to run `sanitizeRetrievedContext` on it).
- **Fallback.** If `entryEmbeddings` are missing/empty for a user (never backfilled, or demo mode), return today's client-side path unchanged (`askMyLife.ts:224-246`), so no regression for pre-backfill peers. The server should return a `retrieval: 'server' | 'client'` hint so the client may skip its local scoring.

---

## 11. Semantic Search Integration Design

- **RECOMMENDATION.** New route `POST /api/gemsearch/semantic` (or `POST /api/retrieval/semantic-search`) returns `{ results: [{ entryId, score, matchedFilters? }], total, page, pageSize, totalPages, hasMore }`, preserving the `SemanticSearchPage` contract (`semanticSearch.ts:26-33`) but keyed by `entryId` instead of the full `entry` object.
- **Client wiring.** `SemanticSearchView.tsx` keeps its real-time `entries` prop for rendering; when a query/filter is present it calls the new endpoint and maps `entryId → entry` from the subscribed list; the local `executeSemanticSearch` becomes a client-side fallback (demo/pre-backfill) only. Filter parity and snippet generation (`createPreviewSnippet`, `semanticSearch.ts:100`) remain client-side so the UI behavior stays identical.
- **Pre-filter strategy.** For SQL/date/tag/mood filters the server applies them as `where` pre-filters (composite vector index, §8.4) where indexable, otherwise in the post-candidate filter pass (§9 step 3) — the latter is correct enough at this scale and avoids index sprawl. Pagination is applied after ranking.

---

## 12. Security & Privacy Impact

Privacy model is unchanged in *spirit*: **every private document remains under `users/{uid}/…`, readable only by its owner** (firestore.rules, lines 7–39). Server-side retrieval does not create a new trust boundary — the server already holds the Firestore admin key for `extract-memories`/`ask-my-life`/audit. New considerations:

1. **Secrets.** Embedding happens **server-side**; `GEMINI_API_KEY` never reaches the browser (it already lives only in Cloud Run + Secret Manager — repository evidence `deploy.yml`, `service.ts:74`). This is a strict requirement on implementation.
2. **User isolation.** Every KNN query must be executed against `collection('users').doc(<verified uid>).collection(...)`; the vector index includes `uid` as the first equality pre-filter (§8.4). A user can never see another user's vectors. Verified uid comes from `verifyFirebaseToken` (server.ts:268).
3. **Rules consistency.** New `entryEmbeddings`/`memoryEmbeddings` blocks enforce owner-only access and shape (line `isValidEmbeddingDoc` in §8.5). Since the server bypasses rules, the server validator (mirroring `validateTextInput` + shape checks) is the real gate; rules are defense-in-depth for client attempts.
4. **Injection surface (prompt).** Retrieved text is now the primary model input; continue forcing `sanitizeRetrievedContext` (validation.ts:53) after retrieval and before `GeminiService.askMyLife`, exactly as the audit path intends today. Embedding input is not prompt-injectable (no completion), but query text still goes through `validateTextInput`/`PROMPT_INJECTION_PATTERNS`.
5. **Rate limiting & audit.** New endpoints sit behind `rateLimiter` (server.ts:55) and every AI generation is `aiAudit.log`-ed; add audit for retrieval-only calls too (they contain the user's query).
6. **Private/archived integrity.** Pre-filter rules ensure `private` entries are only retrievable by their owner context and `archived` entries follow current browse semantics (§8.1); confirmed policy is an open question (Q3).
7. **No data export.** Vector docs are derived copies of owned content; a user's Firestore export (existing export view) must include them or they must be rebuildable from source (they are — textHash + embed on demand). Note this in the export feature's docs during implementation.

---

## 13. Testing, Quality & Regression Safety

**Principles:** additive tests only; **no existing test is modified or removed**; the 422/422 test and 135/135 rules baselines (from `PHASE2B1`) remain the gate; new capabilities are tested at unit/integration/rules levels with the same frameworks (Vitest, `@firebase/rules-unit-testing`).

1. **Unit (server, Vitest mock `@google/genai`):** `embedDocument` / `embedQuery` — model pinned, `outputDimensionality=768`, L2 normalization invariant (`sum(vec[i]^2)≈1`); `textHash` determinism; input truncation at 12000 (validation.ts:3).
2. **Unit (retrieval):** KNN result mapping → `ContextDocument`/evidence shape; filter pass parity table against `semanticSearch.ts` behaviors (each of the 8 filters); compression budget `≤15 docs / ≤12000 chars`; threshold gating → `confidence:'insufficient'`.
3. **Route integration (mock Firestore/LDAP):** `verifyFirebaseToken` + `aiAudit.log` + `rateLimiter` on new routes; DB-id binding to `gemini-journal` (mirror `firestoreConfig.test.ts`); error paths (unauthenticated, rate-limited, empty corpus, model failure) — pattern: existing `askMyLifeAi.test.ts`, `serverRoutes.test.ts`.
4. **Security/adversarial:** prompt-injection query strings rejected (`validation.ts:39`); cross-uid vector-query attempt returns empty (uid pre-filter enforced); oversized payloads rejected.
5. **Firestore emulator vector support:** **must be investigated first** (R7). If the emulator exposes `findNearest`/`VectorValue`, add an integration test creating docs in `entryEmbeddings`, building a vector index, and asserting KNN ordering. If not, gate: run those tests against a `@google-cloud/firestore` emulator with pinned behavior or mark them `it.skip` with a documented reason — **never fake a passing result**.
6. **Rules:** add rule tests for the new `entryEmbeddings`/`memoryEmbeddings` blocks (owner read yes; other-user read no; invalid shape create denied; immutable uid) via `tests/rules/security_rules.test.ts` patterns.
7. **Regression:** full existing suite (`npm test`, `npm run test:rules`) green; `npm run typecheck` and `npm run build` green; smoke script (`scripts/smoke-test.mjs`) still passes post-deploy with new endpoints exercised.

---

## 14. Rollout & Deployment Plan

Assessment-only → **no steps were executed**; this is the recommended ordering for implementation:

1. **Investigate emulator support (gating, R7).** Confirm `findNearest`/`VectorValue` in the Firestore emulator for the pinned `firebase-tools ^15` before writing integration tests.
2. **Server write path** behind a config flag (`ENABLE_G3_RETRIEVAL !== 'true'` default off): embedding service methods, embedding write route, markers/`textHash`, delete hook.
3. **Rules + schema docs:** add §8.5 blocks + unit/rule tests; update `docs/PROJECT_STATE.md` model listing (docs only).
4. **Index deployment (config/terraform, verified format §4.1 #8) with tolerance for firebase-tools vector-index quirks (R6):** deploy `entryEmbeddings` + `memoryEmbeddings` composite vector indexes explicitly via `gcloud`/Terraform; the CI `deploy.yml` gains (or documents) the index step.
5. **Backfill route (idempotent)** and run against a real account under the flag; verify index utilization query-profile.
6. **Query endpoints + client cutover** behind the flag: Ask My Life request-shape change (client stops sending `contextDocuments`), Semantic Search ID-mapping path.
7. **Perf/quality gate:** latency budget (embed ≈ 0.3–1s; KNN < 100ms at this scale); distance-threshold tune (Q5); full test suite; production smoke test.
8. **Old-engine removal:** keep client fallback until backfill coverage > 90% of active users for ≥ 1 release, then remove under a separate change.

**Configuration/rollback:** flag toggles retrieval off instantly (client reverts to the current in-repo engine, which stays in the bundle until step 8).

---

## 15. Competition Scope & Verification Evidence

This section certifies that this assessment stayed within the G3 mandate (and how each constraint was checked):

| Constraint | Status | Evidence |
|---|---|---|
| Source-code changes to `src/` / `server/` / `tests/` / config / rules | **None made** | `git status` clean except the deliverable doc; commit contains the doc only |
| No embeddings were generated, no API called | **Held** | No embedding/vector references introduced; doc-only change |
| No Firestore collections / indexes / migrations / backfills created | **Held** | Index/rules design is *recommended* (§8) but was not applied; no deployment |
| No dependency/env changes | **Held** | `package.json`/lockfiles untouched; only documented `@google/genai` 2.21.0 and `@google-cloud/firestore` 7.11.6 as installed facts |
| No expansion of G3 into habits / goals / reports / On This Day / dashboard | **Held** | Scoped to Ask My Life + Semantic Search + memories only (§5–§11) |
| No production-readiness claim | **Held** | Document is an assessment; verdict is "RECOMMENDATION READY", not "shipped/verified in prod" |
| No platform capability claimed without authoritative verification | **Held** | §4 distinguishes VERIFIED EXTERNAL FACT (URL-cited) vs REPOSITORY EVIDENCE vs ARCHITECTURAL INFERENCE |
| No fabricated test counts / results | **Held** | Test inventory is from repository files; 422/135 figures are cited from prior closure docs, not re-asserted |
| One deliverable document | **Held** | `docs/PHASE2B2_G3_SEMANTIC_RETRIEVAL_ASSESSMENT.md` (this file) |

Git evidence: `git diff 4e27453..HEAD --stat` shows a single added file; `git status` clean after commit.

---

## 16. Effort & Cost Estimate

**Effort (recommendation, not performed).**
- Server embedding service + write/backfill routes + delete hooks: ~1 day.
- Retrieval endpoints (Ask My Life integration, Semantic Search ID mapping, filters): ~1–1.5 days.
- Rules + rule tests + unit/integration tests + index configs + CI step docs: ~0.5–1 day.
- Threshold tuning, emulator investigation, QA/smoke, production flag rollout: ~0.5–1 day.
- **Total: ~3–4 engineer-days** (matches the G3 estimate of 2–3 days in `PHASE2_COMPETITION_GAP_ASSESSMENT.md`, with the vector-index/emulator investigation as the realistic adder). Human effort was **zero in this assessment**; this is a plan cost.

**Runtime cost (est., Standard edition, named DB `gemini-journal`).**
- Embedding API: at ~2–3k tokens/doc and ~$0.10–0.15 per 1M tokens for text-embedding-class models, ≈ 2,000 entries/user ≈ ~5–7M tokens ≈ **<$0.01/user total**; re-embeds on edits only (hash-gated).
- Firestore: vector storage index + companion composite indexes for embedding docs — fractional storage at 6 KB × ~2,000 = ~12 MB/user indexing; Standard edition index/read costs are small at this scale. **Personal-journal scale ⇒ sub-cent marginal cost.** No new vendor line item (Option C rejected for cost among other reasons, §5.2).

---

## 17. Risks & Open Questions

| ID | Risk / question | Severity | Mitigation / disposition |
|---|---|---|---|
| R1 | Firestore web SDK cannot run vector queries [VERIFIED §4.1 #6] — the *reason* the design is server-resident | — (accepted) | Architecture chose Option A; no client KNN path exists or is needed |
| R2 | `gemini-embedding-001` truncated dims must be L2-normalized manually [VERIFIED §4.2 #1] | Medium | Unit test asserting unit-norm after embedding; `DOT_PRODUCT` requirement documented |
| R3 | `text-embedding-004` deprecated [VERIFIED §4.2 #1] | Low | Pinned `gemini-embedding-001`; constant centralizes future switch |
| R4 | Vector search lacks real-time listeners [VERIFIED §4.1 #5] | Medium | Rendering still uses subscribed lists; only ranking is on-demand (§2.3, §11) |
| R5 | Result cap 1000 + dim ≤ 2048 are Standard-edition constraints [VERIFIED §4.1 #4] | Low | K=40 budget; 768 dims far under cap |
| R6 | `firebase-tools` has open vector-index reconciliation bugs (deploy drift, `__name__` field mismatch) | Medium | Use `gcloud firestore indexes composite create` / Terraform for index lifecycle; document in CI |
| R7 | Firestore **emulator** vector-search support for pinned versions is unverified | **High (gating)** | Investigation step 1 in §14; if unsupported, integration tests run against a real (throwaway) project DB or are explicitly skipped with reason — never faked |
| R8 | Ask My Life currently lets the *client* select context; moving selection server-side changes `evidence` attribution | Medium | Keep evidence citations from source docs; contract-compatible response shape masks the change |
| R9 | `private`/`archived` exclusion policy must mirror current views exactly | Medium | Open question Q3; resolve from `AskMyLifeView`/`SemanticSearchView` behavior before cutover |
| R10 | Distance threshold is not yet empirically tuned | Medium | Open question Q5; config constant + QA on real corpus |
| R11 | Backfill volume vs. Cloud Run request budget at first enable | Medium | Batch ≤50 docs/request; idempotent resume via `textHash`/presence |
| R12 | Named DB `gemini-journal` Standard edition supports vector indexes [VERIFIED §4.1 #9], but no live index build was exercised in this assessment | Low | Explicitly created via gcloud/Terraform during implementation and verified by query-profile before client cutover |

**Open questions explicitly deferred to implementation (not answerable assessment-only):**
- **Q1** — Does the Firestore emulator for the pinned `firebase-tools ^15` / `@google-cloud/firestore 7.11.6` implement `findNearest`/`VectorValue` correctly?
- **Q2** — React-native/hosted exact client behavior for `VectorValue` projection: can the server `select` the vector field out of query responses to reduce payload, and is that verified against 7.11.6's `VectorQuerySnapshot`?
- **Q3** — Confirm exact `private`/`archived` handling parity with `SemanticSearchView` / `AskMyLifeView` today (which subscriptions are passed, and how `private` is gated).
- **Q4** — Whether `taskType: RETRIEVAL_DOCUMENT` `title` should be the entry title or a synthesized label; A/B on retrieval quality later.
- **Q5** — Empirical `DOT_PRODUCT` threshold for the corpus language/mix; needs a labeled eval set (small, owner-curated).

---

## 18. Final Recommendation

**Verdict: ASSESSMENT COMPLETE — RECOMMENDATION READY.**

Proceed with **Option A — server-side Firestore KNN retrieval**: embed entries and approved memories with `gemini-embedding-001 @ 768 dims` (L2-normalized, `RETRIEVAL_DOCUMENT`), store vectors in owner-partitioned `entryEmbeddings`/`memoryEmbeddings` subcollections with composite flat vector indexes (`uid` + `archived` + `embedding`, dim 768), and resolve Ask My Life and Semantic Search queries via server-side `findNearest` using `DOT_PRODUCT`, a hybrid keyword-boosted ranking, a 15-doc/12,000-char compression budget, `sanitizeRetrievedContext`, `rateLimiter`, and `aiAudit`. Roll out behind a config flag with the existing client engines retained as the pre-backfill fallback; create vector indexes via gcloud/Terraform; and treat **emulator vector-search verification (R7)** as the gate before writing integration tests.

Previous phases are closed (G1 memory engine, G2 view activation). G3 remains **OPEN** pending the implementation work recommended above; this assessment provides the architecture decision, verified platform facts, security model, costs, rollout order, and test plan needed to begin that work.

---

*Assessment performed 2026-09-11 on branch `master` @ `4e274537a3d1703a8fab742f0c06a64353ea710b`. Evidence labels per §15. No production resources were modified.*