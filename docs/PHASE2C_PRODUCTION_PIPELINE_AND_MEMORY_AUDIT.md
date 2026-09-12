# PHASE2C — Production Pipeline & Memory Engine Audit

**Date:** 2026-09-12
**Scope:** Verify the production release pipeline and the AI Memory Engine end-to-end against
the live deployment; reproduce the reported voice/image save permission errors; determine why
saved journal entries produced no visible memories; inventory duplicate/obsolete Google Cloud
infrastructure; and emit exactly one verdict.
**Method:** Live Cloud Run / Firestore / Cloud Logging inspection, byte-compare of live vs.
repository security rules, SDK-level and HTTP-level reproduction harnesses against production,
full source walk of the server routes + memory pipeline + journal write paths, and rudimentary
cleanup of all disposable fixtures afterwards.

---

## 1. Reported Issues and Dispositions

### 1.1 “Saving a voice/image journal entry is rejected with a permission error”

**Disposition: NOT REPRODUCIBLE on the current production revision — evidence shows the current
live rules and runtime accept these exact writes.**

Reproduction (disposable user, Firebase Web SDK, named database `gemini-journal` — the same SDK,
database, and payload shapes the browser produces):

| Step | Payload | Result |
|---|---|---|
| `create-text-entry` | `journalEntries` (title/body/mode/tags) | **ok**, readback `true` |
| `create-image-entry` | attachment `url: blob:https://…` + `aiMetadata{modality:'image', modelUsed}` | **ok**, readback `true` |
| `create-voice-entry` | attachment `url: blob:https://…` + `aiMetadata{modality:'voice', transcript,…}` | **ok**, readback `true` |
| `create-memory-candidate` | `memories` `{saved:false, status:'candidate'}` | **ok**, readback `true` |

- Live Firestore security rules for database `gemini-journal` (ruleset
  `06c07f7e-ce2d-4eb5-aca6-c95c95db9958`) are **byte-identical** to the repository
  `firestore.rules`; these rules explicitly permit `blob:`/`https:` attachment URLs and both
  `image` and `voice` `aiMetadata` shapes, and `requireOwnerUid` matches the SDK writes above.
- Git history shows the multimodal support landed across earlier commits (`318aacd` introduced
  genuine Gemini image & voice journaling with `blob:` attachments and `aiMetadata`; `f3f3ce9`
  corrected the `modelUsed` aiMetadata schema against the rules validator). The reported denial
  pattern (image/voice attachment or `modelUsed` field rejected by rules) matches those older
  revisions/rules; the fix is already live on revision `gemini-journal-00027-24n`.
- The audio/image analysis endpoints themselves (`/api/gemini/analyze-image` multipart) return
  200 against production with a live token.

No denial was observed anywhere on the current live revision.

### 1.2 “Three entries were saved but no memories ever appeared in the Memory Engine”

**Disposition: PIPELINE IS FUNCTIONAL END-TO-END, verified live. The empty state is explained by
the extraction trigger contract, not by a backend defect.**

- Extraction endpoint: `POST /api/gemini/extract-memories` returns **200** with real candidates
  against production (see §5 evidence). It is **not** broken.
- Candidate persistence: `memoriesApi.create` with `{saved:false, status:'candidate'}` writes
  successfully (rules-verified above, readback `true`).
- Display: the Memory Engine “Candidates” tab reads `memories` where `status === 'candidate'`
  (`MemoryEngineView.tsx`), so persisted candidates would appear.
- Trigger contract (`EntryEditor.tsx:83`, `useMemoryExtraction.ts`):
  - Auto-extraction runs **only once for a brand-new entry** (`entryId === null`) immediately
    after its first save, and only for as long as the entry is being edited.
  - Existing entries — including entries saved before this feature, or any entry opened by id —
    are **not** auto-reprocessed; they need the manual **“Extract memories”** button in the
    MemoryExtractionBar (`EntryEditor.tsx:328`).
  - Extraction is per-entry deduplicated (`localStorage` content hash), bounded (≤8 candidates),
    and never blocks saving (`runMemoryExtraction` never throws).
- Therefore “no memories appeared” = no candidates were ever persisted for those entries —
  the entries predated or bypassed the new-entry auto-extract trigger and were never run
  through the manual extractor. Behavior is by design; the guidance gap is client UX, not a
  server/rules defect.

### 1.3 “`extract-memories` returned 500 `Internal server error`” (found during this audit)

**Disposition: SELF-INFLICTED BY THE TEST HARNESS — not a production defect.**

- The audit’s first harness passed the request body to `fetch()` as a plain **object**.
  `fetch()` string-coerces it to `"[object Object]"`, which `express.json()` rejects with a
  `SyntaxError` (`… is not valid JSON`). That error bypasses the route handler (whose own
  `try/catch` would have produced `Failed to extract memory candidates`) and lands in the global
  error middleware (`server.ts:1303-1328`), which returns exactly
  `500 {"success":false,"error":"Internal server error"}`.
- Cloud Run request log corroborates: the failing request completed in **0.39 s** with status
  500 — no Gemini call ran (the ~7 s `gemini-3.6-flash` generation minutes before belongs to the
  `analyze-image` call in the same harness).
- The real client serializes correctly (`callAiEndpoint` → `body: JSON.stringify(payload)`,
  `src/services/ai.ts:66`). After fixing the harness to stringify, `extract-memories` returned
  **200** with candidates against production on the next run.
- `parseAndValidateJson` (all three `JSON.parse` sites in `server/gemini/validation.ts`) is
  fully guarded and falls back gracefully; model output parsing cannot throw out of the service.

---

## 2. Live Production Baseline (verified)

| Property | Value |
|---|---|
| Project | `gen-lang-client-0345619653` |
| Cloud Run service / URL | `gemini-journal` → `https://gemini-journal-s7hw7hui2q-uc.a.run.app` |
| Live revision | `gemini-journal-00027-24n` (100% traffic) |
| Image | `gcr.io/gen-lang-client-0345619653/journal-app:495d0e3ede4e98aae34a6f461b6f222ad0f3104b` |
| Port / concurrency / maxScale | 3000 / 80 / 3 |
| Service account | `618285014094-compute@developer.gserviceaccount.com` |
| Region / Firestore region | Cloud Run `us-central1`; Firestore database location **`us-west1`** (cross-region; minor latency, no functional impact) |
| Firestore database | `gemini-journal` (named, Firestore Native, STANDARD edition, no `(default)` DB) |
| Key env | `FIRESTORE_DATABASE_ID=gemini-journal`, `VITE_FIREBASE_PROJECT_ID=gen-lang-client-0345619653`, `NODE_ENV=production`, `APP_URL` set, `ENABLE_SEMANTIC_RETRIEVAL=true` |
| Secrets (Cloud Secret Manager) | `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY` (via env-from secrets) |
| Empty env | `ADMIN_EMAILS`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `SERVICE_URL` |
| Deploy run | `34679308263` (docs push; **completed success**, prod approval passed); CodeQL `34679308335` success |

> **Note (point-in-time snapshot):** this baseline reflects the live production state during the
> Phase 2C audit. It was later superseded in Phase 2D by production revision
> `gemini-journal-00034-t48` (deploy run `34689086516`, 100% traffic) — the current production
> revision as of this commit.

Live Firestore rules for `gemini-journal` = ruleset `06c07f7e-ce2d-4eb5-aca6-c95c95db9958`,
single file, 28 764 characters, byte-identical to `firestore.rules` in this repository.

---

## 3. Release Pipeline (`.github/workflows/deploy.yml`)

Triggered on push to `master`/`release/*`, PRs to `master`, and manual.

1. **validate-and-test** — `npm ci` → `npm audit --audit-level=high` → `npm run typecheck` →
   `npm test` → `npm run build`.
2. **build-and-scan-container** — `docker/build-push-action` + **Trivy** (fails on
   CRITICAL/HIGH). Dockerfile default build args apply here (does not pin the semantic
   retrieval flag).
3. **deploy-staging** (environment `staging`) — builds with
   `--build-arg VITE_ENABLE_SEMANTIC_RETRIEVAL=false`, deploys `gemini-journal-staging`
   (port **8080**, SA `journal-staging-sa@…`), then runs `scripts/smoke-test.mjs`.
   **G3 runtime flag is NOT exported to staging**, so `isSemanticRetrievalEnabled()` resolves
   false and all G3 endpoints report `disabled` there (by design).
4. **deploy-production** (environment `production`, **manual approval required**, `master`
   only) — builds with `VITE_ENABLE_SEMANTIC_RETRIEVAL=true`, deploys `gemini-journal`
   (port **3000**) with `ENABLE_SEMANTIC_RETRIEVAL=true`, then smoke tests.

Live state matches: prod revision `00027-24n` is 100% traffic and `ENABLE_SEMANTIC_RETRIEVAL=true`;
staging `gemini-journal-staging-00041-v97` is 100% traffic on the same image.

### 3.1 Rule-deployment gap (non-blocking)

**The pipeline never deploys `firestore.rules` or the Firestore indexes.** There is no
`firebase deploy --only firestore` step anywhere in CI. The live rules happen to be byte-identical
to the repository today, which means they are currently being pushed *manually*. Any future rules
edit will silently diverge from production unless this step is added. This is a maintenance gap,
not a current defect.

Staging additionally has no rules workflow at all (staging currently shares the prod database,
so rules apply there transitively).

---

## 4. Storage & Data Connect Inventory (duplicate/obsolete infrastructure)

### Storage

- A default bucket exists: `gs://gen-lang-client-0345619653.firebasestorage.app/` — **empty**
  (no objects).
- **No storage rules exist**: no `storage.rules`, no `storage` section in `firebase.json`, no
  storage deploy in CI. The bucket is effectively unmanaged legacy provisioning.
- The application does **not** use Firebase Storage for the reported flows:
  - Image/voice journaling keeps media **in memory** on the server (Multer, ≤10 MB image /
    25 MB audio) and sends it directly to Gemini; the saved attachment is a **`blob:` URL**
    (`URL.createObjectURL(file)`, `src/services/imageJournaling.ts`) — session-only, lost on
    reload.
  - Generic file attachments route through an optional `attachmentStore`, which the editor
    explicitly disables when Firebase Storage is not configured
    (`EntryEditor.tsx:128` — no such config exists).
- Durability implication (non-blocking): multimodal attachment URLs are ephemeral backing
  references; after a page reload the media can no longer be displayed. No source change has
  been made; persisting media would require adding Storage + rules + exporter, a separate
  decision.

### Data Connect / Cloud SQL (duplicate, unused)

- `dataconnect/dataconnect.yaml` targets service `gen-lang-client-0345619653-service`,
  region `asia-east2`, Cloud SQL instance `gen-lang-client-0345619653-instance`, database
  `gen-lang-client-0345619653-database`.
- Live state: the Cloud SQL instance **exists** (`POSTGRES_18`, RUNNABLE, `asia-east2`) but
  contains only the default `postgres` database — the referenced
  `gen-lang-client-0345619653-database` **does not exist**, and no code or runtime step in the
  repository or pipeline consumes Data Connect. This is leftover/experimental scaffolding plus
  one idle Postgres instance.
- `firebase.json` declares `dataconnect.source` but nothing in CI exercises it.

### Legacy services

- `personal-gemini-journal` (a Cloud Run service in the same project, non-`us-central1` suffix,
  distinct naming from the canonical `gemini-journal`) is still deployed. It is not referenced by
  any pipeline step or by `firebase.json` rewrites, which point only at `gemini-journal`.

> **No deletions were performed during this audit.** The resources above are inventoried for review
> only; decommissioning any potentially obsolete resource (Cloud SQL instance / Data Connect
> scaffold, legacy service, storage bucket, hosting block) requires explicit owner approval and a
> separate, evidence-backed effort.

---

## 5. Memory Engine — End-to-End Verified Trace

Live HTTP evidence (final corrected run, disposable user)`:

- `POST /api/gemini/analyze-image` (multipart, 1×1 PNG) → **200**, `success:true`, Gemini summary;
  server wrote the `users/{uid}/aiInteractions` audit row (`skill:'image-journal'`).
- `POST /api/gemini/extract-memories` (`{text:…}` as JSON) → **200**,
  `success:true` with `candidates[]` (e.g. `{type:'project', title:'Phase 2C Reproduction…'}`).
- Cloud Logging (revision `00027-24n`): `[GeminiService] Generation successful with model:
  gemini-3.6-flash` on every live Gemini call in the audit window.

Code path verified from source:

1. **Trigger** — `EntryEditor.tsx:83`
   `useMemoryExtraction(entry, { autoExtract: entryId === null })`; manual button in
   `MemoryExtractionBar.tsx:58` (`run(true)`).
2. **Bounding** — `memoryPipeline.ts`: `MIN_EXTRACTABLE_BODY_CHARS=20`,
   `MAX_EXTRACTION_TEXT_CHARS=12000`, `MAX_CANDIDATES_PER_ENTRY=8`; dedup via per-uid/per-entry
   localStorage content-hash marker (`EXTRACTION_MARKER_STORAGE_KEY`) so the same entry is never
   re-extracted unless forced.
3. **Call** — `src/services/ai.ts:103` → `callAiEndpoint('/api/gemini/extract-memories')`
   (60 s timeout, `JSON.stringify` body, Bearer token).
4. **Server** — `server.ts:580` (`verifyFirebaseToken` + `rateLimiter`, 30 req/min/IP in-memory);
   `server/gemini/service.ts:496 extractMemoryCandidates` via `generateMultimodal` fallback
   ladder; `parseAndValidateJson` always falls back safely.
5. **Persist** — candidates written as `{saved:false, status:'candidate'}` via `memoriesApi.create`
   (create keys include `status`); rules match (`hasOwnership` + candidate shape).
6. **Review** — `MemoryEngineView.tsx` lists `status:'candidate'` under “Candidates”;
   Save/Forget transitions to `saved`/`ignored`/`forgotten`.

### HTTP/API surface (server.ts)

Health/auth: `GET /health`, `GET /api/health`, `GET /api/auth/verify`.

Gemini (all `verifyFirebaseToken` + `rateLimiter`): `POST /api/gemini/{companion-skill, reflect,
summarize, extract-themes, extract-memories, contextual-questions, coach, reframe, ask-my-life}`;
multipart `POST /api/gemini/analyze-image` (10 MB image), `POST /api/gemini/transcribe-voice`
(25 MB audio). G3 (flag-gated): `POST /api/gemini/{ensure-embedding, remove-embedding,
backfill-embeddings, semantic-search}`.

Other: `POST /api/google/places/{autocomplete,details}`; admin: `GET/POST /api/admin/{users,
seed-role, roles}` (`requireAdmin`, verified-email gated); notifications:
`GET/PUT /api/notifications/settings`, `POST /api/notifications/test`.

All Gemini routes write additive audit rows to `users/{uid}/aiInteractions` (never raw media or
raw transcripts) and everything is owner-scoped by `firestore.rules`.

---

## 6. Post-Audit Cleanup

All disposable fixtures created during verification were removed:

- Firestore: `journalEntries`, `memories`, `aiInteractions` (and any other) documents under
  `users/` for the three disposable uids — deleted.
- Auth: the three disposable accounts (`KCweofku2zVMFlzNxk7vLwvrlKh2`, `SE4ftx8U0jXVWEg6Br9gbjCM5Kl1`,
  `4GhRooxYevRRfUyyay1bsfWpuIt1`) — deleted (account lookup returns an empty result).
- No application data, live user data, or real environment config was touched.

---

## 7. Limitations of This Audit

- The reported permission error and the “no memories” observation originate from a user account
  that was not accessed; conclusions are drawn from the **current live revision**, live rules,
  and byte-exact payload reproduction through the public write/read paths.
- Browser-level end-to-end (real `URL.createObjectURL` blob URL from the live origin) was not
  re-executed; the SDK reproduction used an equivalent `blob:https://…` authority, matching the
  rule predicate (`^blob:`), so the rules-level outcome is identical.
- Manual deploy history for `firestore.rules` is not auditable from this repo; the absence of a
  CI rules-deploy step is confirmed structurally.

---

## 8. Non-Blocking Recommendations (for the backlog, not required by this verdict)

1. Add a `firebase deploy --only firestore:rules,firestore:indexes` step to
   `.github/workflows/deploy.yml` so rules drift cannot recur silently.
2. Decide the long-term media story: currently `blob:` URLs are ephemeral. If image/voice
   attachments should survive reload, add Firebase Storage + `storage.rules` + an exporter, and
   wire `attachmentStore` in the editor.
3. Decommission the unused Cloud SQL instance / Data Connect scaffold (or finish it intentionally)
   and the legacy `personal-gemini-journal` service to eliminate duplicate infrastructure.
   Recommendation only — any such decommission requires explicit owner approval and is out of scope
   for the audit; nothing was deleted.
4. Consider surfacing the MemoryExtractionBar (or an equivalent “Extract memories” affordance)
   for long-existing entries so users are not required to know the new-entry-only trigger rule.
5. Optional: co-locate the Firestore database (`us-west1`) with Cloud Run (`us-central1`) to shave
   cross-region latency on the retrieval paths.

---

## Final Verdict

**WORKING_AS_INTENDED**

The reported permission denials do not reproduce on the current live revision (rules and runtime
accept the exact text/image/voice/memory write shapes); `extract-memories` returns 200 with real
candidates; and the Memory Engine lifecycle writes and displays candidates correctly. The “no
memories” result and the single observed 500 are explained by the client trigger contract and by
a test-harness artifact respectively — no application source change is required to resolve any of
the reported issues.