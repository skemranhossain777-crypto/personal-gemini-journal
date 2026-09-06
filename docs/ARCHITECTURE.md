# ARCHITECTURE — JOURNAL∞ (Personal AI Journal / "Gemini Journal & Reflections")

- **Repo:** `D:\Apersonontherun\Google-Programmed\gemini-journal-reflections`
- **Date:** 2026-09-05
- **Inputs:** `Project Instruction/Personal Gemini Journal — Master Vibe Coding Instruction.md` (the working spec, "Spec §N"), `docs/PROJECT_STATE.md` (inspection baseline, "STATE §N").
- **Phase:** Design only. **No application code was changed** to produce this document.
- **Ground rules honored:** no skipped phases, no premature implementation of future phases, no architecture rewrites without a documented reason, every feature verified before claiming completeness, UNKNOWN not assumed.

This architecture targets the **production destination** of the project. It is deliberately additive: existing working functionality (`interactions`, Auth, RBAC, notifications, places proxy, security headers, rate limiter, current e2e) is preserved and evolved, never dropped without reason.

---

## 0. Design Principles (derived from the spec)

1. **Private by default** — everything UID-scoped; AI never sees the full journal; private entries honor stricter handling (Spec §24, §32, §36).
2. **Ownership over automation** — AI proposes; the user disposes (memories §8, habits §17, metadata §5).
3. **Single-runtime discipline** — one Node/Express runtime + Firestore + Storage + Secrets; nothing added without a documented need (Spec §41, §37).
4. **Relevance-maximal, token-minimal AI** — retrieval before generation, caches, budgets (Spec §10, §34, §35).
5. **Contest-grade but real-feeling** — the three signature capabilities (Personal Memory Engine, Ask My Life, AI Reflection Loop) are first-class surfaces, not demos (Spec §45).

---

## 1. System Architecture

### Decision
A **single stateless Node 22 + Express service on Cloud Run**, split in production as:

- **Firebase Hosting** (global CDN) serves the built React SPA; rewrites `/api/**` → Cloud Run service `gemini-journal` (existing wiring in `firebase.json` stays).
- **Cloud Run** serves the REST API and, in dev only, serves the SPA via Vite middleware (existing behavior retained).
- **Cloud Firestore** (existing custom DB `ai-studio-geminijournalref-…-b6`) is the system of record; clients write journal data directly (SDK + rules), API calls handle AI/media/admin/export/reconcile.
- **Cloud Storage** hosts media; accessed only via server-issued short-lived signed URLs.
- **Gemini API** is called strictly server-side; the key lives in Secret Manager.
- **Cloud Scheduler** triggers a protected internal reconcile endpoint (timeline derivation, scheduled reflections, batch memory candidates).

### Why
- Proven in the current deployment: Hosting rewrite + Cloud Run + secret-backed Gemini already serve HTTP 200 end-to-end.
- Server-side AI keeps every secret server-side (Spec §5 threat zone "Inter-System Comm").
- Direct client→Firestore writes preserve **offline resilience** and Firestore's sync/latency guarantees (Spec §31), which a server-mediated write path would forfeit.
- One runtime = one image, one rollback unit, low cold-start surface, trivial local dev.

### Alternatives considered
- **Pure Firebase Hosting + Cloud Functions per domain** — rejected: many cold-started containers, more deploy surface, harder local fidelity; current server already centralizes AI + admin + notification logic.
- **Next.js / App Hosting SSR** — rejected: this app is a private SPA; SSR adds cost and no user-visible benefit; not needed for the ambition (Spec §37 lists Cloud Run, not App Hosting).
- **Server-mediated writes (all mutations through API)** — rejected: loses Firestore offline sync and increases latency for the core "capture" action; violates the resilient-journaling intent.
- **Microservices** — rejected: single-user domain; distribution adds coordination cost with zero benefit at this scale.

### Security implications
- One container boundary: fewer secrets, a single place to enforce headers, rate limits, and AI isolation.
- Static assets on Hosting are immutable public files — they must never embed secrets (existing `firebase-applet-config.json` is public by design; keep it that way).
- The internal reconcile endpoint is unauthenticated-by-default in Express unless gated — it must require an internal secret + (optional) IAM identity token, and be firewalled from public internet traffic.

### Scalability implications
- Cloud Run scales instances horizontally and statelessly; no shared in-memory state (rate limiter becomes per-instance — documented limitation, STATE §6.8).
- Firestore scales horizontally for per-UID document workloads; watch hot starvation only if projecting hotspots (avoid `collectionGroup` queries that mingle all users).
- Requests are I/O-bound (Gemini, Firestore, Storage) → high concurrency is safe.

### Cost implications
- Scale-to-zero means near-zero idle cost; AI tokens dominate the bill — the context/retrieval budget is the primary cost lever (Spec §35).
- Static delivery on Hosting CDN is effectively free at this scale.

---

## 2. Frontend Architecture

### Decision
- **React 19 + TypeScript + Vite 6 + Tailwind v4** (existing) + `motion` (existing) + `lucide-react` (existing).
- Adopt the spec project layout (Spec §41) pragmatically: `src/pages/` (dashboard, journal, memories, timeline, ask, profile), `src/features/{journal,memories,timeline,goals,habits,ai,search,settings}/`, keep `src/components/` for shared UI, `src/services/` split into `firebase/`, `gemini/`, `storage/` namespaces, plus `hooks/`, `utils/`, `types/`, `lib/`.
- Introduce **router-based navigation** (react-router-dom) with route-based code splitting. Add the mobile **bottom navigation** (Journal / Memories / Timeline / Ask / Profile) and the **calm dashboard** home (Spec §26, §28).
- Keep the **local-first cache layer** (`data.ts`), upgrading its backing store from `localStorage` to **IndexedDB** (raw or `idb`) so drafts/audio/attachments survive without quota pressure.
- Markdown rendering stays but must be brought behind an allowlist sanitizer (rehype-sanitize), since `react-markdown` does not sanitize by default (XSS surface).
- Design language alignment (Spec §27): existing navy palette already fits "premium, calm, editorial, human" — keep it; enforce generous whitespace, editorial type, subtle motion, meaningful empty states.

### Why
- Feature-first structure matches the spec's growth plan (Phases 3–11) and keeps business logic out of UI (Spec §41).
- Routing gives deep-linkable surfaces (necessary for the 5-route mobile nav and "On This Day" deep links).
- IndexedDB is required once audio and image drafts enter; `localStorage` (≤5 MB) will not hold them.
- Sanitized markdown closes the XSS zone without abandoning existing rendering.

### Alternatives considered
- **No-router manual view switching (current)** — rejected for the dashboard/mobile-nav future: screen-state is not deep-linkable and mobile back-button behavior degrades.
- **TanStack Query / React Query** — rejected as a new dependency now; a hand-rolled repository + hooks layer covers pagination and loading/error/retry states with less surface. Revisit if derived state grows.
- **Next.js** — rejected in §1.
- **CSS Modules vs Tailwind** — Tailwind v4 already in use; keep.

### Security implications
- XSS: markdown sanitize + SVG-file denial (§11) + existing `:focus-visible`/a11y patterns; CSP decision deferred to hardening phase (documented gap, STATE §5).
- Auth tokens live in memory; wipe all local stores on logout (§9).
- Bundle must remain free of server secrets by construction (CI grep check).

### Scalability implications
- Route-level code splitting keeps initial bundle small; pagination is mandatory (Spec §34) — never mount a full-history list.
- IndexedDB minimizes refetch churn on reload and enables offline drafts.

### Cost implications
- Client cost is ~zero (hosting, bandwidth). Reductions in re-renders and duplicated Firestore reads directly lower Firestore read-billing.

---

## 3. Backend Architecture

### Decision
Refactor the single 843-line `server.ts` into a **modular monolith** under `server/` (Spec §41):

```
server/
  index.ts          # bootstrap, env, listen
  app.ts            # middleware + route mounting
  middleware/       # securityHeaders, rateLimiter, verifyFirebaseToken, requireAdmin, errorHandler
  routes/           # health, gemini, places, admin, notifications, export, media, reconcile, telemetry
  services/         # firestore (admin SDK), storage (signed URLs), export, reconciliation
  ai/               # modelLadder, prompts, structuredOutput validators, contextBuilder, retrieval
  security/         # threat-model rules, webhook SSRF guard, upload policy
  utils/
```

Route surface (existing in **bold**, new in *italic*):

- **`GET /api/health`**
- **`POST /api/gemini/reflect`** → evolved into the analysis + companion endpoints below
- *`POST /api/gemini/entry-analysis`* (per-mode summary/metadata + candidate memories)
- *`POST /api/gemini/companion`* (Reflect/Challenge/Coach/Summarize/Explore/Remember/Connect/Reframe/Celebrate over a conversation + retrieved context)
- *`POST /api/gemini/ask-my-life`* (retrieval pipeline + structured response + evidence)
- *`POST /api/gemini/metadata`* (regenerate editable metadata for one entry)
- *`POST /api/gemini/memory-candidates`* (re-analyze one entry/memory on user request)
- **`POST /api/google/places/autocomplete | details`** (keep)
- **`GET/POST /api/admin/*`** (keep; add `GET /api/admin/security-events` read-only log)
- **`GET/PUT/POST /api/notifications/*`** (keep)
- *`GET /api/export?format=json|markdown|csv`* (full user data, server-generated, owner-bound)
- *`POST /api/media/presign`* (upload URL), *`GET /api/media/url`* (read URL)
- *`POST /api/internal/reconcile`* (Cloud Scheduler; derives timeline/reflections/memory candidates)
- *`POST /api/telemetry`* (client error events without PII)

### Why
- Modular structure is required to place **routes, services, middleware, ai** where Spec §41 expects; the current single file cannot host Phase 3–11 surface sanely.
- Keeps one deployable image (simplicity), no microservice overhead.
- Encapsulates the "AI reasoning" and "Tool execution" threat zones behind the `ai/` module so hardening (prompt isolation, schema validation, rate limits) is one place.

### Alternatives considered
- **Cloud Functions for the API** — rejected (§1).
- **GraphQL** — rejected: Firestore is the resolver; REST + typed clients is simpler and debuggable.
- **Keep server.ts as-is** — rejected: explicit, documented reason is code health + the spec-mandated structure.

### Security implications
- Every AI/media/export/admin route re-uses one `verifyFirebaseToken` middleware (ID token via `firebase-admin`, no third-party jwks client — do not regress STATE §1.3).
- `errorHandler` must never leak stack traces to clients.
- Internal reconcile route: secret-gated; also restricted to scheduler source via header check.

### Scalability implications
- Routes are stateless; all mutable state stays in Firestore/Storage; horizontal scale is clean.
- In-memory structures (rate limiter) are per-instance — documented and bounded; production can add Redis/Memorystore only if a global quota is ever required (cost note below).

### Cost implications
- Operational cost unchanged (same image size). Adding Memorystore/Redis would add minimal run cost — deferred until a hard global-quota requirement exists.

---

## 4. Firebase Architecture

### Decision
- **Auth:** Firebase Authentication, **Google Sign-In only** (Spec §3) — keep the existing popup/redirect flow. Demo mode remains a clearly-labeled, removable module (STATE §3), not a second auth provider.
- **Firestore:** existing custom database (`ai-studio-geminijournalref-…-b6`) hosts all user collections (§5). No `(default)` db usage.
- **Storage:** one Cloud Storage bucket, activated only for media phases (§11), rules = owner-scoped.
- **Secrets:** Secret Manager for `GEMINI_API_KEY` (done) + upcoming `INTERNAL_SCHEDULER_SECRET`, `MEDIA_BUCKET` config, admin service identities (via Workload Identity, §17 — no SA keys in repo; current local `sa-keys/firebase-admin.json` must never be promoted or committed).
- **Environment separation (Spec §37):** dev = Emulator Suite (Auth + Firestore + Storage); prod = live project. Add `gemini-journal-staging` (second Cloud Run service + Hosting preview channel + staging Firestore database) only when Phase 3 landings are being previewed.

### Why
- Reuses everything already working (config fallback, custom DB id, rules, deploy scripts).
- Emulator-first dev is the only sane way to test rules (§10, §15) without touching real data.
- Secret Manager + WIF matches Spec §39 and eliminates key sprawl.

### Alternatives considered
- **Auth0/Custom auth** — rejected by Spec §3 (Google only, no custom passwords).
- **Cognito** — rejected: no reason to leave Firebase.
- **Share one Firestore db across dev/staging/prod with namespacing** — rejected: rules/query contamination risk; separate databases are free to create.

### Security implications
- One project-wide trust boundary; rules are the only thing stopping cross-UID access — hence the mandatory rules test matrix (§10, §15).
- Secrets in Secret Manager, referenced by revision-stable version pinning; demo-mode code paths must never see prod Firestore.

### Scalability implications
- Firebase Auth and Firestore scale without operational work; multiple databases allow isolated staging.
- Watch Firestore read amplification: derived projections (timeline/insights) exist specifically to avoid expensive fan-out reads.

### Cost implications
- Emulator dev cost = 0. Storage/metadata only begins when media is added (pay per GB). No per-seat billing. Firestore reads are the main recurring line; indexes and projections are the levers.

---

## 5. Firestore Data Model

### Decision
Adopt the spec's user collections (Spec §4) **additively**, while keeping the existing `interactions` collection live for back-compat and conversations:

| Collection (all under `users/{uid}/`) | Purpose | Key fields |
|---|---|---|
| `users/{uid}` (doc) | profile | `displayName`, `email`, `createdAt`, `settingsRef` |
| `journalEntries/{entryId}` | the core journal entity (Spec §5, §6) | `id, userId, mode` (10-mode union), `title`, `body`, `messages[]?`, `mood?` (neutral 1–5), `energy?`, `tags[]`, `location?` (lat/lng/placeName/address/permission), `attachments[]` (media refs), `collectionIds[]`, `favorite:bool`, `archived:bool`, `archiveHint?`, `private:bool`, `aiMetadata?` (summary/themes/emotions/questions/suggestedActions/model/editable), `draft:bool` + `draftSavedAt`, `embedding?` (vector), `createdAt`, `updatedAt` |
| `conversations/{conversationId}` | companion threads (Spec §7) | `mode/capability`, `messages[]`, `contextRefs[]`, `updatedAt` |
| `memories/{memoryId}` | two-tier memory (Spec §8) | `type` (11 types), `title`, `content`, `sourceEntryIds[]`, `confidence:0–1`, `importance`, `status: candidate|approved|ignored`, `userEdited:bool`, `embedding?`, `createdAt` |
| `goals/{goalId}` | goals (Spec §16) | `title`, `status`, `milestoneIds[]`, `evidenceEntryIds[]`, `progressNote` (AI says *evidence*, never computes %), `createdAt` |
| `habits/{habitId}` | optional habit (Spec §17) | `name`, `evidenceEntryIds[]`, `createdAt` |
| `collections/{collectionId}` | collections (Spec §5) | `name`, `description?`, `entryIds[]` (capped/paginated), `createdAt` |
| `timelineEvents/{eventId}` | derived timeline (Spec §13, §14) | `type` (journal/memory/goal/achievement/trip/milestone/idea/important event), `date`, `title`, `category`, `tags[]`, `sourceRef`, `createdAt` |
| `insights/{insightId}` | daily/weekly/monthly/yearly reflections (Spec §15) | `period`, `generatedAt`, `status: draft|published`, `content`, `evidenceRefs[]` |
| `aiInteractions/{interactionId}` | AI activity audit (Spec §4; renamed role vs legacy `interactions`) | `endpoint`, `modelUsed`, `inputTokens`, `outputTokens`, `latencyMs`, `success`, `errorCode`, `createdAt` — **no user text** |
| `settings/preferences` | AI + privacy prefs (Spec §23, §24) | `aiAssistance`, `personalMemory` (`enabled/askBeforeSaving/allowHistoricalContext`), `writingAssistance`, `privateEntryDefaults`, `reflectionSchedule` |
| `notifications/{notificationId}` | queued notifications | `channel`, `status`, `payloadRef`, `createdAt` |

**Design rules enforced everywhere:**
- Owner-scoped IDs only — every path starts with the caller's `auth.uid`; no client-controlled foreign UIDs (Spec §4, §38).
- Bounds on every field (reuse `isValidInteraction` pattern → `isValidEntry`, `isValidMemory`, …): title ≤200; body ≤120k; messages ≤200; tags ≤25 items × 40 chars; mood/energy 1–5 ints; location lat/lng in range; attachment ref ∝ `users/{uid}/media/…`.
- **Pagination everywhere** (Spec §34); list reads use `limit` + `startAfter`; the sidebar and timeline never load full history.
- **Soft delete:** entries get `deletedAt` tombstone before hard delete at Privacy Center; rules forbid reads of deleted docs only after account purge (kept for undo).
- **Derived-but-materialized:** `timelineEvents`, `insights`, `aiInteractions`, and memory `embedding`s are written by the server/reconciler, not by bursts of client reads.
- Indices: declared in `firestore.indexes.json` at implementation time (state currently empty, STATE §1.6) — at minimum `journalEntries(createdAt desc)`, `journalEntries(archived, createdAt desc)`, `collections(updatedAt)`, `timelineEvents(date desc)`, and a **vector index** for `embedding` (cosine).
- **Migration:** additive — new collections start empty; a backfill job (reconciler) can upgrade eligible `interactions` into `journalEntries` copies for continuity, without deleting the originals.

### Why
- The schema is exactly what Phases 3–11 need (mood/energy/collections/favorite/archive/private/10 modes/editable metadata §5–§6, memory §8, goals §16, timeline §13, prefs §23, audit §4).
- Materialized projections make the Timeline/On This Day/reflections cheap reads.
- Keeping `interactions` avoids breaking working UI and honors "don't delete existing functionality".

### Alternatives considered
- **Extend `interactions` in place** — would entangle chat data with journal entries and blur the audit role the spec assigns to `aiInteractions`; rename semantics would leak everywhere.
- **Denormalize favorites into a `favorites` subcollection** — rejected: a boolean on the entry is simpler, indexable, and matches the spec's entry-centric mental model.
- **No soft-delete** — rejected for undo safety (§30/§31 intent).

### Security implications
- Rules enforce owner-UID on all subcollections + field bounds (defense against runaway writes / IDOR).
- `private` entries: rules allow the owner (of course) but the **server** excludes private entries and memories derived from them from any AI context unless the user flips the explicit pref — a two-layer enforcement (rules for storage, server for AI).
- Vector/embedding fields are computed server-side; rules reject arbitrary client-authored embeddings for other users' safety (only owner can write own row anyway).

### Scalability implications
- Document-per-user workloads are inherently sharded by UID. Projected reads are bounded (≤ a few hundred docs per query with pagination); vector search uses Firestore-native ANN with dedicated index cost.
- Watch total per-user doc growth: memories/insights/timelineEvents are small and safe; `aiInteractions` audit should be **retention-pruned** (e.g., 90-day TTL) to avoid unbounded growth.

### Cost implications
- Each retrieval/reflection write adds small Firestore write+index costs; the dominant cost remains Gemini tokens (kept down by §8 budgets). Vector index and projections cost little at personal scale.

---

## 6. Gemini Architecture

### Decision
Server-side Gemini only (`@google/genai`, existing). Key decisions:

1. **Endpoint→capability matrix** (§4 routes): per-mode entry analysis; 9-capability companion; ask-my-life; memory candidates; metadata regen; scheduled reflections.
2. **Config-driven model ladder** (existing 5-model ladder, kept, extracted to `ai/modelLadder.ts` with testable ordering).
3. **Structured, validated output (Spec §11):** all AI responses that persist use `responseSchema`/JSON mode plus a **server-side validator** (allowlist enums, size caps, type checks, unknown-field drop, coerce/refuse rules). Never persist model output unchecked.
4. **System prompt contract:** user content is passive data; assistant never fabricates journal history, never claims certainty without evidence, never diagnoses, never overuses emoji, no generic motivational clichés; distinguish **Observed / User-provided / AI-inferred** (Spec §7, §32, §33, §20).
5. **Companion default persona:** "thoughtful reflection partner," not customer-service bot; supports Reflect, Challenge, Coach, Summarize, Explore, Remember, Connect, Reframe, Celebrate.
6. **Context budget:** hard cap on input tokens (e.g., system+context ≤ 60 k chars); built by §8 retrieval, never the raw database (Spec §35).
7. **Caching:** stable system prompts + repeated context reuse parameters for cacheable calls to cut latency/repeat token cost.
8. **Failure handling:** ladder fallback on 429/503; exp backoff; friendly client errors; audit to `aiInteractions`.

### Why
- Matches the spec exactly (server-side key, retrieval-before-generation, validated structure, distinct companion behavior).
- The ladder already proved itself in production (STATE §1.3).

### Alternatives considered
- **Vertex AI (Gemini) with endpoint-specific models** — viable upgrade path, deferred: adds IAM + VPC setup with no contest-stage benefit; revisit if quotas pinch.
- **Direct REST calls** — rejected: SDK is already in place.
- **Client-side Gemini** — rejected (Spec §32: never expose server Gemini credentials).

### Security implications
- Injection: input isolation + prompt contract + output schema validation are the mitigation triple (covered by validator unit tests).
- Structured-output rectangles constrain what can ever be persisted (limits prompt-injection blast radius).
- No thin-client bypass: all AI routes require verified ID tokens.

### Scalability implications
- All AI work is external HTTP — CPU-light, network-heavy; Cloud Run concurrency stays high.
- Context caching shifts repeat cost to cheaper cached tokens.

### Cost implications
- Tokens are the #1 line item. Budget + validation + caching + retrieval are the controls (Spec §35). Add per-user per-day AI caps (configurable in settings) to stop runaway quota theft.

---

## 7. Personal Memory Architecture

### Decision
Two-tier memory pipeline exactly per Spec §8:

```
journal entry (saved, respects private/prefs)
  → AI analysis emits memory candidates
      { type, title, snippet, confidence 0–1, importance, sourceHint }
  → server-side validator + threshold gate (candidate accepted only if confidence ≥ threshold)
  → stored in memories/{id} with status:"candidate"
  → user reviews: SAVE MEMORY | IGNORE | EDIT | FORGET
  → approved memories become retrievable context + timeline material; ignored are marked, not deleted (audit); delete removes the memory + derived timelineEvents; "forget" additionally purges memory-derived context from Ask My Life responses going forward
```

- **Consent:** if `personalMemory.askBeforeSaving=false` the pipeline still writes **candidates only**; approval is always a human action. Never silently promote to permanent memory (Spec §8).
- **Types:** person, place, project, goal, achievement, important event, idea, preference, lesson, milestone, recurring theme.
- **Privacy coupling:** memories derived from `private:true` entries inherit a `private` flag; excluded from context unless the explicit pref is on; candidate generation skips private entries by default (Spec §24).
- **Editability:** user edits are stored as overrides (`userEdited:true`, original kept) so AI never clobbers user truth.
- Memory search: memory `embedding` maintained on approval (server, inside the same request that approves) to feed §8.
- Reconcile job also scans recent approved entries for missed candidates when prefs allow.

### Why
- "AI proposes, user disposes" is the spec's ownership principle; candidates-only storage makes consent enforceable and auditable.
- Two-tier is cheap (server just writes a doc) and gives the judge-facing demo moment (approve a memory) Spec §46 wants.

### Alternatives considered
- **Auto-approve low-risk types** — rejected: violates Spec §8 (no silent permanent memory) and erodes trust.
- **Separate memory store (Vector DB)** — rejected: Firestore vector search suffices at this scale; fewer moving parts.

### Security implications
- Memories carry the same owner-UID rules; candidate docs are as protected as entries.
- Confidence/importance are model outputs — bounded and validated; user review is the final authority.
- Deleting a memory must cascade to derived timeline events; leaving orphans would leak context in retrieval.

### Scalability implications
- Per-user memory count is modest; vector index per memory is fine; prune-on-delete keeps it bounded.

### Cost implications
- Candidate generation rides the existing entry-analysis call (no extra request); only approval-time embedding costs an extra small Gemini/embedding call — controlled by §8 budgets.

---

## 8. Retrieval Architecture

### Decision
Server-side retrieval pipeline (Spec §10, §12), used by **Ask My Life**, **companion context**, and **reflection generation**:

```
user question / request
  → intent classification (metadata + keyword heuristics; Gemini small optional)
  → candidate selection:
       • Firestore queries: date range, tags, mood, collections, goals, type (paged)
       • semantic: Firestore vector search (cosine, top-k) over entry/memory embeddings
       • fallback keyword/token filter when embeddings unavailable
  → rerank (recency ⊕ relevance ⊕ importance, lightweights fine)
  → context builder: token-budgeted, cited snippets (never full bodies)
  → Gemini
  → structured response + evidence array (entryIds/memoryIds/goalIds + snippets)
```

### Decisions & budgets
- **Hard budget:** context prompt ≤ 60 k chars; candidate count ≤ 1–2 dozen docs; body truncation (lead paragraphs) with offsets.
- **Privacy filters applied before any Gemini call:** exclude `private` (unless pref), archived, demo-mode entries; hide snippets the user has not permitted.
- **Evidence-first UX:** Ask My Life responses render the evidence list with the answer — this is the "show me the receipts" differentiator (Spec §45).
- Semantic search grading via vector index; if a future date-range+vector query needs a composite, declare it in `firestore.indexes.json`.
- Embedding maintenance: entry analysis and memory approval write/update embeddings server-side; batch backfill via reconcile.

### Why
- "Never send the entire database to Gemini" is an explicit spec rule (§9/§10) — retrieval is the compliance mechanism.
- Vector search gives the semantic "worried about money / proud moments" capability (§12) that keyword matching never will.
- Cited evidence makes answers verifiable and grounded (Spec §7: never pretend to know).

### Alternatives considered
- **Client-side retrieval** — rejected: leaks context construction to the client and duplicates query logic; also slows UI.
- **Keyword-only** — rejected: fails §12 semantic queries.
- **Full-history prompt** — rejected outright (Spec §9/§35).

### Security implications
- Retrieval runs in a verified-token request against owner-scoped queries only; path traversal and N+1 are prevented by bounded queries.
- Async semantic indexing means results may lag by a write — acceptable; note it in UI ("indexing…").

### Scalability implications
- All queries are indexed, paged, and per-UID — no cross-user fan-out; vector search cost grows linearly with a user's docs (fine at personal scale).

### Cost implications
- Vector + query reads are cheap; the embedding write on save adds one embedding call per entry (small). Retrieval saves far more token cost than it spends.

---

## 9. Authentication Architecture

### Decision
- **Firebase Auth, Google provider only** (current + Spec §3). Popup + redirect fallback kept; `firebase-admin` token verification server-side (replaces the old removed `jwks-client`; do not regress).
- **Token lifecycle:** client holds ID token in memory (no persistence); every `/api/*` call sends `Authorization: Bearer <idToken>`; server verifies and reads `uid`/`email`.
- **Logout contract (Spec §3):** on logout, clear app state **and all local caches** (`localStorage` keys `gemini_journal_*`, IndexedDB stores, in-memory state). New user sign-in starts from clean state — no cross-account bleed via cache.
- **Demo mode** (uid `demo-…`): unchanged mechanics but labeled "Demo (not stored)" and removable at build/flag level (Spec §47).
- **Account deletion:** Privacy Center issues account deletion (delete all subcollections + media + memories) then `deleteUser` via Admin SDK from an authenticated admin-authorized endpoint.
- Auth failures are silent on error detail (no enumeration hints beyond Google's own).

### Why
- Keeps the proven flow; logout-wipe satisfies §3 privacy and is cheap insurance against shared-machine leakage.
- Server-side verification is the boundary for every protected route.

### Alternatives considered
- **Cookie sessions over ID tokens** — rejected: SPA + static hosting makes bearer tokens the standard, and CSRF risk is lower without stored cookies.
- **Custom email/password** — rejected by Spec §3.

### Security implications
- Tokens are short-lived; refresh handled by Firebase SDK. No secrets stored client-side.
- Logout wipe means strict cache hygiene; verify IndexedDB is deleted (name the DB deterministically).

### Scalability implications
- Stateless verification scales with Cloud Run; Firebase manages token signing.

### Cost implications
- Firebase Auth is free; no cost driver.

---

## 10. Authorization Architecture

### Decision
Two enforcement layers (Defense in depth, Spec §38).

**Layer A — Firestore Security Rules** (extended from the current owner-scoped rules, STATE §1.4):
- All user subcollections match `/users/{userId}/{collection=**}` guard: `request.auth.uid == userId` + per-collection field validators (`isValidEntry`, `isValidMemory`, `isValidGoal`, `isValidPreferences`, …) applying the bounds in §5.
- No rules allow reads/writes across UIDs; no `collectionGroup` reads over other users' trees.
- Storage rules: `request.auth.uid == user segment of the object path`.
- Rules are **versioned and tested** in emulator against the Spec §38 matrix: authenticated owner ✓, unauthenticated ✗, different authenticated user ✗, malicious document ID ✗, unauthorized collection ✗.

**Layer B — Server-side authorization:**
- `verifyFirebaseToken` on all privileged routes (existing).
- `requireAdmin` (ADMIN_EMAILS, existing) for admin + account-deletion + security-events routes; admin actions are audit-logged.
- Owner-shape checks on server requests: any document ID in URL/body must be prefixed with the caller's uid (IDOR prevention).
- Private-entry AI exclusion enforced server-side (§7/§8), not just by rules.

**Roles:** `user`/`admin` only (existing `AppRole`). No client-side role toggling.

### Why
- Rules alone cannot express "don't feed private entries to AI" — server adds judgment; server alone breaks offline Firestore writes — rules add the storage boundary (Spec §38: never rely on frontend authorization).
- Two layers cover both the storage plane and the reasoning plane.

### Alternatives considered
- **Server-mediated all writes** — rejected (§1) for offline resilience.
- **Custom claims for roles** — rejected: `ADMIN_EMAILS` env seeding is simpler and already tested (22 e2e).

### Security implications
- The rules file becomes security-critical code: emulator tests + code review at every rules change (Fold into Phase 3 deliverable).
- Server must never log private content during auth checks.

### Scalability implications
- Rules execute at Firestore edge — no server cost for enforcement; server layer adds trivial CPU.

### Cost implications
- Rules are free. Emulator tests free. No cost driver.

---

## 11. File/Media Architecture

### Decision
- **Bucket + keys:** one Cloud Storage bucket; object keys `users/{uid}/media/{entryId}/{uuid}.{ext}` so owner-rules are a prefix match.
- **Access:** **signed URLs only** — `POST /api/media/presign` issues a short-lived upload URL (10 min); `GET /api/media/url` issues a short-lived read URL (15 min, cached via `Cache-Control`). No public reads (Spec §21: never expose location/media publicly).
- **Upload policy (server-enforced during presign):** allowlist MIME (`image/jpeg,png,webp,heic`, `audio/mpeg,audio/webm,audio/ogg`, `application/pdf` for exports/attachments); max sizes (image ≤ 10 MB, audio ≤ 25 MB / ≤ 5-min voice note, PDF ≤ 15 MB); **SVG/HTML/script types denied** (XSS); filename sanitized; enforces entry ownership.
- **Image pipeline (private-by-default):** client downscales/re-encodes via `canvas` before upload (resize + EXIF strip client-side) — keeps heavy processing off the server and off third parties. Server performs a final magic-byte sniff on presign.
- **Voice journaling (Spec §19):** uploaded audio → server sends to Gemini (multimodal) for **transcription draft** → stored as a draft entry with the editable transcript; never published as final content silently. Duration/size caps per §35.
- **Attachments in entries:** `attachments[]` stores `{path, type, size, name, blob`}; display uses signed URLs refreshed per view.

### Why
- Cloud Storage is explicitly in the spec (§37) and is the only sane place for audio/images (Firestore 1 MB doc limit).
- Signed URLs keep objects private and revocable without an auth proxy on every byte.
- Client-side processing is privacy-friendly (no third party re-encodes private photos) and free.

### Alternatives considered
- **Firestore base64** — rejected: 1 MB/doc limit, read-cost amplification.
- **Server-side sharp re-encode** — deferred: costs CPU and egress; client canvas covers the need.
- **Firebase Storage SDK direct upload** — rejected in favor of server-presigned URLs so policy is enforced in one audited place (can revisit if SDK rules are preferred; rules on the object path remain the same).

### Security implications
- Upload policy is the "malicious uploads" countermeasure (Spec §32): type/size/path/ownership all server-checked; SVG deny closes persisted-XSS; signed URLs are time-boxed.
- EXIF strip on images avoids leaking GPS metadata (Spec §21).
- Audio is sensitive: transcription output treated as draft text under the same AI-validation rules.

### Scalability implications
- Storage scales indefinitely; signed-URL issuance is stateless (Admin SDK). Client-side processing keeps upload egress flat.

### Cost implications
- Storage/eGRESS only for media actually stored; per-GB rates are low. Thumbnails derived client-side avoid a Cloud Storage image-class processing fee.

---

## 12. Security Architecture

### Decision
Extend the existing 8-zone threat model (STATE §1.3, §5) into a living `server/security/threat-model.md` covering **Spec §32's five zones**; every phase adds to it before code (Spec §32, §43).

Current posture (verified) + additions:

| Threat | Today | Target addition |
|---|---|---|
| Input surfaces | 2 MB JSON, null guards, prompt sanitize | field-bounds validators in rules; per-endpoint caps |
| AI reasoning | prompt isolation | system-prompt contract + schema validation + validator tests |
| Tool execution | 5-model ladder, 30 req/min per-IP | user-granular daily AI caps; mock-AI mode for tests |
| Memory/state | owner rules + undefined-stripping | §5 bounds, retention pruning of `aiInteractions` |
| External integrations | SSRF guard on webhooks | reconcile secret; signed URL policy; upload sniffing |
| Media | n/a | §11 upload/storage/signed-URL policy |
| Secrets | `GEMINI_API_KEY` in Secret Mgr | all secret access via Secret Mgr; WIF for CI (no SA keys) |
| XSS | no unsanitized markdown confirmed | rehype-sanitize; SVG deny; CSP decision revisited |
| Rate limiting | in-memory per instance | document; optional global store later |
| Logging | header/no-PII aim | structured logs redacting content (§14) |

**Hard rules:** no client secrets; no private text in logs; no IDOR (uid-prefixed ids); no raw stack traces to clients; `SECURITY AUDIT` command honored as a standing workflow (Spec §49).

### Why
- Consolidates every zone into a single reviewed artifact and ties each phase's security review to it (Spec §32, §43 step 4).
- The table makes drift visible when new features land.

### Alternatives considered
- **AppSec tooling/linters only** — supplemental, not a substitute for the threat-review step.
- **Third-party WAF** — overkill for contest scale; native headers + limits suffice.

### Security implications
Self-referential by design (this section is the mitigation).

### Scalability implications
- Security rules/checks are edge-side (rules) or O(1) server-side; no throughput regression.

### Cost implications
- Rule tests and threat reviews are free; secrets via Secret Manager cost pennies; optional global rate limiting (Memorystore) deferred for cost.

---

## 13. Error-Handling Architecture

### Decision
- **Client (Spec §30, §44):** every network/AI operation carries explicit `loading | success | failure | retry` states. Drafts persist to IndexedDB on every keystroke/throttle so refresh/offline/API failure never loses writing (Spec §31). Friendly copy: *"We couldn't save your entry. Your draft is still safe locally. Try again."* No stack traces rendered.
- **Server:** centralized `errorHandler` middleware; `AppError` class with stable codes (`RATE_LIMITED`, `AI_TIMEOUT`, `AI_UNAVAILABLE`, `VALIDATION_FAILED`, `NOT_FOUND`, `STORAGE_POLICY`, `INTERNAL`); consistent JSON envelope `{ success:false, error:{ code, message } }`; stack traces logged server-side only.
- **Retries/backoff:** AI + network calls use exponential backoff with jitter (existing Gemini retry logic extended); idempotent saves by `entryId`; media presign idempotent by idempotency key.
- **Offline queue:** when `navigator.onLine === false`, client queues entry writes locally and syncs on reconnect (Firestore offline persistence where compatible — enable for real users; note it is disabled in demo mode).
- **AI-specific failures:** timeout → friendly retry; model ladder exhaustion → `AI_UNAVAILABLE` with "try later", never a blank screen.

### Why
- Draft-safety is a spec imperative (§31) and the emotional-core of a journal — losing a write destroys trust.
- One error contract keeps the client's failure states uniform across Phases 3–11.

### Alternatives considered
- **Auto-retry offline (SW)** — deferred: service-worker sync is possible but adds install complexity; emulator-testable offline queue in-app is sufficient and simpler to verify.
- **Global error boundary per route** — yes, but only as the last-resort screen, not the primary pattern.

### Security implications
- Codes, not stack dumps, to clients; internal details stay server-side; error logs must not echo user text (redaction helper).

### Scalability implications
- Idempotency keys and offline queues are per-client; no shared infrastructure.

### Cost implications
- IndexedDB + queue are free; retried Gemini calls are the only cost risk — cap retries (1–2) and backoff to bound spend.

---

## 14. Observability Architecture

### Decision (Spec §36, §37)
- **Structured logging (JSON):** all requests emit `{ traceId, route, method, status, latencyMs, severity, errorCode?, modelUsed? }`. Trace id propagated from Cloud Run's `X-Cloud-Trace-Context` into Google Cloud Trace automatically.
- **Tracked events (no user text):** auth failures, admin actions, AI latency/failures/model/token counts, Firestore errors, rate-limit hits, upload policy denials, reconcile runs, memory approval/forget, export/delete activity.
- **Cloud Monitoring custom metrics + log-based metrics:** `ai_failures`, `ai_latency_p95`, `gemini_429`, `firestore_errors`, `auth_failures`, `security_events`. Alert policy: p95 AI latency or error-rate thresholds → email/PubSub.
- **Client→server telemetry:** `POST /api/telemetry` receives sanitized client errors (no content, no tokens) and records them.
- **Redaction helper** (`server/security/redact.ts`) guarantees private text never reaches log sinks; unit-tested.
- **Dashboards:** Cloud Run traffic + latency; AI spend estimate from token counters; Firestore QPS/errors.

### Why
- Spec §36 is explicit; without it, the security/competition audits and app errors are guesswork.
- Structured logs also feed the `SECURITY AUDIT` and `COMPETITION AUDIT` workflows.

### Alternatives considered
- **Sentry/3rd-party APM** — rejected: PII in a third party conflicts with privacy stance; GCP-native logging is sufficient and free-ish.

### Security implications
- Logs are a standing leak vector; redaction + no-content discipline is enforced and tested.
- Cloud Logging access itself is admin-only via IAM.

### Scalability implications
- Log volume grows with traffic; use sample rates for debug logs; structured logs are cheap at this scale.

### Cost implications
- Cloud Logging ingest/monitoring cost is fractional; no new paid service introduced.

---

## 15. Testing Architecture

### Decision
Multi-layer suite (Spec §40), run locally and in CI (§17). Existing 22 e2e tests are preserved and **evolved** (they currently boot a mock app; they will target the real routes under emulators with a **mock-AI mode** so CI never needs a live key).

| Layer | Tool | Scope | Key cases |
|---|---|---|---|
| Unit | Vitest | pure logic | prompt builders, validators, context builder, budget caps, model ladder order, error mapping, redaction |
| Firestore rules | `@firebase/rules-unit-testing` vs **emulator** | security matrix (Spec §38) | owner read/write ✓; unauth ✗; other-user ✗; malicious doc id ✗; unauthorized collection ✗; field-bounds violation ✗ |
| Integration | Node test runner / Vitest + Emulator (Auth, Firestore, Storage) | server routes | sign-in → CRUD entry (each mode), memory approve/forget, edit metadata, favorites/archive/private, ask-my-life pipeline with mock AI, export JSON/MD/CSV, account deletion, cross-user attempt → 403 |
| AI validation | Vitest fixtures | schema | malformed/oversized/unknown-field output dropped/coerced; injection-shaped prompts fail validation |
| Auth tests | Emulator-auth + admin SDK | flows | Google sign-in (emulator), expired/invalid token → 401, demo-mode isolation |
| Critical-flow E2E | Playwright + Emulator + mock AI | user journeys (Spec §40) | sign in → create/edit/delete journal → ask Gemini → create/delete memory → search journal → export → logout; and a full **five-serve flow** from §46 (judge path) |
| Smoke | HTTP checks | deployed | `/api/health` + hosting 200 via web.app (existing manual smoke formalized as a script) |

Current gaps to close in Priority Order: rules tests are the highest-value missing layer (STATE §5), then unit tests, then critical-flow e2e.

### Why
- The spec mandates each layer by name (§38, §40); rules tests close the biggest verified security gap (STATE §6.1).
- Mock-AI mode keeps CI hermetic and fast (no quota, no flake).

### Alternatives considered
- **Live-key integration** — used only for pre-release spot checks, never in CI (cost + flakiness).
- **Snapshot testing UI** — rejected: low value/High churn; behavior tests + Playwright journeys instead.

### Security implications
- Rules tests effectively become regression-proofing for the authorization plane.

### Scalability implications
- Emulator suite is local; CI minutes scale with suite size (fast with Vitest concurrency).

### Cost implications
- Emulators + Vitest + Playwright-lite free; no live-GCP calls in CI keeps the Gemini bill at ~zero for development.

---

## 16. Cloud Run Architecture

### Decision
Keep the existing service as the single production deployable, tuned:

- **Region:** `us-central1` (keep; document that live traffic is already served here and probe-verified).
- **Container:** node:22-slim, port 3000 (Dockerfile kept); image pinned by digest in CI (§17).
- **Concurrency:** start at 80 (all external I/O); container CPU = 1, memory = 512 MiB; `min-instances: 0` (scale-to-zero), `max-instances: 10` (cost cap).
- **Health check:** `GET /api/health` on port 3000.
- **Secrets:** `GEMINI_API_KEY` via Secret Manager (already) version-pinned; add `INTERNAL_SCHEDULER_SECRET`.
- **Public surface:** Hosting rewrites `/api/**`; the internal `/api/internal/*` route is gated by the secret and ignored by Hosting public headers.
- **Scheduling:** Cloud Scheduler + Pub/Sub (or HTTP with secret) hits the internal reconcile endpoint (timeline derivation, weekly reflections, memory-candidate batching, retention pruning) — keeps one runtime, no Functions runtime.
- **Revisions & rollback:** CI deploys new revision, promotes traffic; rollback = `gcloud run services update-traffic` to previous revision (documented runbook).

### Why
- Zero change to the working production path; the additions are config/scheduling, not platform.
- Scale-to-zero + max-instances is the cheapest safe posture for a personal journal (Spec §35 cost control).

### Alternatives considered
- **Always-on (min=1) instance** — rejected at contest stage (cost); revisit if cold-start sensitivity is measured (they're ≈ seconds; SPA loads elsewhere).
- **Cloud Functions for the reconciler** — rejected: keep one runtime; Scheduler→Run is enough.

### Security implications
- Internal route must be public-host unreachable; secret-gated; rate-limited; IAM-restricted scheduler identity.

### Scalability implications
- Stateless horizontal scaling; schedule job avoids overlapping runs via in-flight lock in Firestore (reconcile doc with TTL/lease).

### Cost implications
- Scale-to-zero idle ≈ $0; a couple of scheduled instances/day adds pennies.

---

## 17. CI/CD Architecture

### Decision
GitHub Actions on this repo (verified remote `origin` exists):

- **ci.yml** (PRs + pushes): `npm ci` → `tsc --noEmit` (lint) → unit → Firestore rules tests (emulator) → build → e2e-on-emulator (mock AI) → bundle-size/grep secrets check.
- **deploy.yml** (main branch, manual dispatch or tag): 
  1. Build + push image to **Artifact Registry** (digest-pinned).
  2. `gcloud run deploy gemini-journal --revision-suffix` + traffic promote (with rollback metadata).
  3. `firebase deploy --only firestore:rules,firestore:indexes,hosting` (writing rules/indexes only after rules tests pass).
  4. Record revision + URL to the run summary.
- **Identity:** Workload Identity Federation (WIF) — a dedicated GitHub Actions identity; **no SA key in repo**; current local `sa-keys/` stays a dev-only convenience (and is gitignored; never committed). If CI must deploy Firebase rules without WIF, use a short-lived credential from Secret Manager (documented, not ideal).
- **Staging promotion:** optional second workflow later for `gemini-journal-staging`.
- Deployed-rule verification: after deploy, `firebase firestore:rules:get` diff check in CI so drifting rules fail the pipeline (closes STATE §6.1 drift risk).

### Why
- Today every deploy is manual (STATE §6.4); CI/CD removes drift and gives the security checks a home.
- WIF satisfies the no-SA-keys security requirement and Spec §39.

### Alternatives considered
- **Cloud Build** — equivalent; GitHub Actions keeps everything in one place (repo already on GitHub with working `gh`).
- **Manual runbook only** — rejects the observability/security intent of §49/§50 workflows.

### Security implications
- No long-lived credentials in CI; WIF scopes are least-privilege (deploy permissions only on the one project); secrets live in Secret Manager + GitHub secrets for non-GCP secrets.
- Rules drift detection runs on every deploy.

### Scalability implications
- Standard; CI minutes cheap.

### Cost implications
- GitHub Actions free-tier + emulators: near zero; image storage in Artifact Registry pennies.

---

## 18. Production Environment Architecture

### Decision
Three environments (Spec §37: keep dev/prod config separate):

| Env | Auth | Firestore | Gemini | Container | Purpose |
|---|---|---|---|---|---|
| **dev** | Emulator (Auth) | Emulator | Mock AI / optional local key from `GEMINI_API_KEY` (never committed) | local Vite + Express (existing dev flow) | development; rules tests; e2e |
| **staging** (added later, optional) | Firebase Auth (project) | staging Firestore database (custom id `…-staging`) | real key, low quota | `gemini-journal-staging` + Hosting preview channel | preview Phase 3+ before main |
| **prod** | Firebase Auth (project) | existing custom db | real, Secret Manager version-pinned | `gemini-journal` + Hosting `gen-lang-client-0345619653.web.app` | live |

- Env config: `.env.example` grows to document every var (existing); prod config = Secret Manager only; build-time `VITE_*` stays per current bake/Fallback contract for client config.
- **Data lifecycle:** production user data is backup-able (documented export routine); demo sample data (Spec §47) ships as clearly labeled and removable seed docs under a `demo` marker, never mixed into real user paths (demo *mode* already isolates to localStorage by design).
- **Monitoring UI:** Cloud Monitoring dashboard (§14) plus the `SECURITY AUDIT` / `COMPETITION AUDIT` review commands as standing processes.
- **README/CHEATSHEET:** eventually updated per Spec §48 (env vars, AI/memory architecture, Firestore structure, demo instructions, roadmap). Out of scope for this doc.

### Why
- Matches the spec's separation requirement with the least new infrastructure; staging becomes real only when needed (avoid premature infra).
- Keeps the working production stack untouched during Phase 3 additive work.

### Alternatives considered
- **Separate Google Cloud projects for staging/prod** — cleanest isolation; deferred: single-project with extra Firestore database + second service covers preview needs at far less ops cost. Revisit if shared rules/index deploys cause friction.

### Security implications
- Prod secrets never touch local/CI; staging uses its own database so dangerous migrations land there first.
- Demo data is physically separable and removable (Spec §47).

### Scalability implications
- Environments are independent scale domains; promote between them by config, not code forks.

### Cost implications
- Dev = free (emulators/mock). Staging adds a second service (scale-to-zero) + real-key quota. Prod remains the single paid surface. Overall cost stays small.

---

## 19. Contradictions: Existing Project vs. MASTER Spec

Identified during inspection; each has a resolution that is additive and non-destructive.

| # | Area | Existing project | Master spec | Conflict | Resolution |
|---|---|---|---|---|---|
| 1 | Data structure | One entity `interactions` (chat-shaped) | §4 mandates 11 user subcollections incl. `journalEntries`, `memories`, `conversations`, `aiInteractions` | Single interaction doc cannot express mood/energy/collections/favorite/archive/private; audit vs journal conflation | Add new collections (§5); keep `interactions` for back-compat; audit moves to `aiInteractions` |
| 2 | Journal modes | 4 modes: reflect/summarize/brainstorm/chat | §6: 10 modes (Free Write, Morning, Evening, Deep, Gratitude, Idea, Goal, Work, Learning, Travel) | Mode vocabulary mismatched; current modes are AI-interaction types, not journal modes | New `journalEntries.mode` union of 10; legacy `interactions.mode` untouched |
| 3 | Companion behavior | 4 fixed prompts | §7: 9 capabilities (Reflect/Challenge/Coach/Summarize/Explore/Remember/Connect/Reframe/Celebrate) with companion persona | Missing 5 capabilities + persona rules | Companion endpoint with §7 capability set (§6) |
| 4 | AI output | `ReflectApiResponse` struct (no server validation) | §11: validated structured output (summary/themes/emotions/memories/questions/suggestedActions) | Unvalidated model output persisted | JSON-mode + server validator for all persistent AI out (§6) |
| 5 | Memory engine | none | §8 candidates→review→save with types | Entire feature absent | Phase 5 (§7) |
| 6 | Ask My Life / retrieval | none; in-memory sidebar filter only | §9/§10/§12 contextual retrieval + semantic search + evidence | Absent; no embeddings, no vector search | Phase 6 (§8) |
| 7 | Timeline / On This Day | none | §13/§14 | Absent | Phase 7 (projection via reconciler) |
| 8 | Reflections | none | §15 daily/weekly/monthly/yearly | Absent | Phase 7/12 via reconciler + insights |
| 9 | Goals / habits | none | §16/§17 | Absent | Phase 8 |
| 10 | Mood/emotion | mood/energy fields absent | §18 neutral language, no diagnosis | Absent + safety wording | Phase 3 fields + prompt contract |
| 11 | Voice / image | none (location only in §9-phases view; Media n/a) | §19/§20 media, transcription draft, "Observed/User/Inferred" | Absent | Phase 9 (§11) |
| 12 | Privacy Center | export stub (single-entry MD only) | §22 full export JSON/MD/CSV + delete memories/journal/account | Absent | Phase 10 + §3§ server export |
| 13 | AI settings | none | §23 all AI features configurable | Absent | Phase 10 settings/preferences |
| 14 | Private mode | no private flag | §24 stricter handling + "don't use for long-term memory" | Absent | Phase 3 field + server AI-exclusion (§7/§8) |
| 15 | Dashboard/nav | single editor view; sidebar only | §26 calm dashboard; §28 mobile bottom nav (Journal/Memories/Timeline/Ask/Profile) | Mobile IA absent; home isn't a dashboard | Frontend decision (§2) |
| 16 | Export | single Markdown entry | §25 JSON/Markdown/CSV (PDF-addable) whole-data export | Partial | Phase 10 server export route |
| 17 | Demo | "demo user" = localStorage sandbox | §47 labeled demo *sample data*, removable, never mixed with real data | Demo-mode not sample-data; cannot demo memory/Ask/Timeline | Keep mode; add labeled sample-data seed in Phase 12 |
| 18 | Project layout | `src/components` flat + root `server.ts` + root `e2e-test.ts` | §41 features/ pages/ server/ tests/ structure | Flat layout; server single file | Refactor in Phase 3 (§3) |
| 19 | Tests | only server 22-e2e (mock app) | §38 rules tests; §40 unit/integration/rules/AI/auth/critical-flow | Rules untested, no unit/UI tests; "e2e" isn't true deployed e2e | Layered suite (§15) |
| 20 | Observability | no structured logs/CT/CM; no trace ids; possible unredacted error bodies | §36/§37 Cloud Logging + Cloud Monitoring; don't log private text | Absent | §14 + redaction helper |
| 21 | Media/storage | no Cloud Storage use | §37 "Cloud Storage where required"; §32 malicious uploads | Absent | §11 |
| 22 | Secrets/deploy | GEMINI_API_KEY in Secret Mgr ✓; local SA key `sa-keys/firebase-admin.json` (gitignored) | §39 never commit; §37 dev/prod separation | Local SA exists (validity UNKNOWN); no CI/WIF; manual deploys | WIF in §17; SA never promoted; rotation documented |
| 23 | Rules/index drift | `firestore.indexes.json` empty; rules deploy state UNKNOWN | §38 test rules | Cannot prove deployed state | CI diff-check (§17) |
| 24 | Naming | package `react-example`; title "Gemini Journal & Reflections"; `firebase-blueprint.json` documents old model; `metadata.json` declares server-side Gemini | Spec names product JOURNAL∞; blueprint should track real schema | Naming/docs/impl drift | Consistency pass in Phase 12; blueprint updated alongside §5 |
| 25 | Observability too-detailed | server may log request bodies with user text in errors (unverifiable) | §36/§32 do not log private text | Potential over-logging | Redaction + log-shaped audits (§14) — mark remediation |

---

## 20. Open Items / UNKNOWN (carried from PROJECT_STATE, not assumed)

- Deployed state of `firestore.rules` / indexes: **UNKNOWN** → CI diff-check (§17) closes it.
- `sa-keys/firebase-admin.json` validity/rotation and whether any deployed service depends on it: **UNKNOWN** → use WIF; rotate/delete if unused.
- Live Firestore contents and indexes actually in use: **UNKNOWN** → first rule/index backfill must be additive and diff-checked.
- Mapping `vite` build-time `VITE_*` bakes + `firebase-applet-config.json` drift: verified working today; a build-time assertion should be added so drift fails fast (add to Phase 3).

---

## 21. Stop Point

Per instruction: **architecture documentation is complete; nothing has been implemented.** The next allowed step is explicit user approval, after which **Phase 3 (Journal engine)** begins — all additive (§5 data model, §10 rules, §3 backend modularization, §2 frontend navigation) and verified under §15 before any completeness claim.