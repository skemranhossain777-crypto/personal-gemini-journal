# COMPETITION PHASE 2A — AI MEMORY ENGINE LIFECYCLE ACTIVATION

**Date:** 2026-09-09 (updated 2026-09-10)
**Application:** JOURNAL∞ — Personal Memory & AI Reflection Engine
**Competition:** Google Cloud Run AI Challenge
**Verdict:** `PHASE 2A CONDITIONAL — server/rules/data lifecycle fully verified in production; client LIST/QUERY reads REMAIN BLOCKED in production after a GCP console remediation attempt (re-verified 2026-09-10, still 403 — see §7a)`

---

## 1. Objective

Activate the **AI Memory Engine lifecycle** end-to-end:

> journal entry saved → server-side Gemini extraction of memory candidates →
> persisted as `candidate` memories (`saved:false, status:'candidate'`) →
> explicit user approval in the UI → `saved:true, status:'saved'` → candidates and
> approved memories consumed by the Memories Candidates tab / Memories list and
> Ask My Life context.

Boundaries held (unchanged): no semantic search/embeddings, no Goals/Habits UI
work, no Reflection Reports, no UI redesign, no new database, no auto-approval,
no auth bypass, no AI-architecture rewrite. Rules changes are strictly additive
(enum member additions).

---

## 2. What Shiped (commit `993ca69`, deployed)

| Layer | Change |
|---|---|
| Server | `POST /api/gemini/extract-memories` — `verifyFirebaseToken` + `rateLimiter` gated; calls `GeminiService` memory-extraction skill; returns `{ success, result }` with `candidates[]`, `modelUsed`, `extractedAt`; never receives/stores raw entry body; writes `aiInteractions` audit row (`skill: 'memory-extraction'`, prompt marker `[memory-extraction]`, model, duration) |
| Client lifecycle | `src/services/memoryPipeline.ts` — caps `MAX_EXTRACTION_TEXT_CHARS=12000`, `MIN_EXTRACTABLE_BODY_CHARS=20`, `MAX_CANDIDATES_PER_ENTRY=8`; explicit `memoriesApi.create` of candidates (`saved:false, status:'candidate', sourceEntryIds:[entryId]`); FW‑1a extraction marker (`gemini-journal:memory-extraction:v1`, `attempted` → `done`); never blocks journal save; no autosave during typing |
| UI states | Loading / candidates / none / error / retry (extraction indicator wired into the journal flow) |
| Rules (additive only) | `'memory-extraction'` added to `isValidConversation`/`isValidAiInteraction` enum; no read or write rule changed |
| Tests | New `server/gemini/__tests__/extractMemoryRoutes.test.ts` (route, auth 401, oversize guard, audit spy via `aiAudit.log`); fixed `memoryPipelineFirestore.test.ts` (hoisted `auth`/`authService` mocks); type fixes across pipeline/memories tests |

---

## 3. Automated Verification (all green, working tree)

- `npm test` — **411/411 tests, 55 files**
- `npm run typecheck` — clean
- `npm run build` — clean (vite + server bundle)
- `npm run test:rules` — **135/135 Firestore rules tests** (owner read/write/query, cross-user denial, finish multi-candidate)

---

## 4. Production Deployment

Chain (no CI in repo; manual Cloud Build → Cloud Run):

1. `git commit 993ca69` (`feat: activate ai memory engine lifecycle`, +1014/−5) pushed to `origin/master`.
2. `gcloud builds submit --tag gcr.io/gen-lang-client-0345619653/journal-app:993ca690a711013fa3de27b804846573429c3d92 .`
   → image digest `sha256:b00bcb2255187f4c2bbcfcba8320a8ffbb2172341cb516efd8b9f4b8e698839f`.
3. `gcloud run deploy gemini-journal --image … --region us-central1 --allow-unauthenticated --max-instances 3`
   → revision `gemini-journal-00017-86d` (100% traffic).
4. Canonical URL `https://gemini-journal-s7hw7hui2q-uc.a.run.app` serves the new image.
5. `firebase deploy --only firestore:rules --project gen-lang-client-0345619653`
   → release `cloud.firestore/ai-studio-geminijournalref-…` @ `2026-09-09T14:26:30Z`, ruleset `c39fc47e-0539-49bd-bdde-55e063c84dcc` (content equals working tree).

---

## 5. Production Lifecycle Verification (live, disposable user)

Setup: Firebase Auth REST disposable account (`zATeLSW0v2RLzwF1kmWSKVLYyWi1`) using the web API key.

| Check | Result |
|---|---|
| `POST /api/gemini/extract-memories` (live token) | `success:true`, **5 candidates**, `modelUsed:"gemini-3.1-flash-lite"` |
| Server audit rows written | ✅ 2× `aiInteractions` docs `skill:"memory-extraction"`, `modelUsed:"gemini-3.1-flash-lite"`, `durationMs` 35738/3519 (confirmed server-side with admin SDK) |
| Candidate create (owner, rules) | ✅ 200, `saved:false, status:'candidate'`, `sourceEntryIds:[entryId]` |
| Approve candidate (owner PATCH) | ✅ 200, `saved:true, status:'saved'` |
| Persistence (admin read) | ✅ `mem-phase2a-cand` present as `saved:true, status:'saved', type:'achievement', title:'Shipped AI memory engine'` |
| Owner document `getDoc` | ✅ 200 |
| Cross-user document read | ✅ **403** (two independent runs; no existence leak/404 disclosure) |
| `npm run smoke` (both URLs) | ✅ ALL PASSED (health, /api/health, 401 invalid token, SPA, static) |
| Cleanup | ✅ candidate, audit rows, and 3 disposable auth accounts deleted |

---

## 6. Rules Security Notes

- Production ruleset vs working tree: **identical** (verified via `firebaserules.googleapis.com` Rules API with `x-goog-user-project`).
- Isolation: cross-user reads denied; owner document-level reads/writes/updates/deletes allowed; candidate writes require `status:'candidate'` + `saved:false`-policy fields; no cross-user write path found.

---

## 7. Production Blocker Found (pre-existing, NOT introduced by Phase 2A) — CLIENT LIST/QUERY GATE

### Symptom
A signed-in owner CAN `getDoc` their own documents and write (create/update/delete),
but **every LIST/QUERY read returns `403 PERMISSION_DENIED`** — regardless of
collection (`memories`, `journalEntries`, `interactions`, `aiInteractions`,
`insights`, `timelineEvents`, `goals`, `habits`, `roles`), filter shape, transport,
or endpoint:

- REST `documents:runQuery` (root parent + structuredQuery) → **403**
- REST `ListDocuments` (collection GET) → **403**
- Web SDK `getDocs(query(collection(db,'users',uid,'memories')))` →
  gRPC `Listen` **NOT_FOUND(5)**; client falls back offline and returns **empty**
- Global and regional endpoints (`firestore.googleapis.com`, `us-west1-firestore.googleapis.com`) → identical
- With and without `?key=` (web API key) → identical
- Emulator + **same ruleset** → owner lists **allowed** (135 passing rules tests)
- Prior deployed ruleset had the same `allow read: if isOwner(userId)` structure → **pre-existing**

### Root cause (assessment)
Not the rules. The named database
`ai-studio-geminijournalref-07d208be-ffdc-41ac-9ad4-a205122972b6`
(Firestore Native, ENTERPRISE, `enhancedTextSearchQueryMode: ENHANCED_QUERY_MODE_ENABLED`,
`realtimeUpdatesMode: REALTIME_UPDATES_MODE_ENABLED`, us-west1) is the **only**
database in the project (no `(default)`; verified via `gcloud firestore databases list`
and a `(default)` probe that 404s cleanly). The gate is a **GCP console / Firestore
configuration level** restriction (e.g. Firebase console → Firestore → data-access /
API-key-query settings for the app's web API key), not editable from code or rules.

### Production impact
- Memory Engine candidates cannot be **listed** in the UI; Ask My Life memory context
  (client-assembled list) is empty; ALL signed-in client feeds (interactions, journal,
  insights, timeline, …) are silently empty in production.
- Server-side paths (admin/service-account) are unaffected: extraction, audit, and
  document-level rules ops all verified working.

### Console fix (needs GCP console, out of this repo's reach)
Re-enable client Firestore query access for the app's Firebase web API key on this
database (Firebase console → Build → Firestore → **data-access settings**, and/or
Google Cloud Console → APIs & Services → API key restrictions) so authenticated
client queries resolve. After the fix, re-run §5 and the browser pass (§8).

---

## 7a. Re-verification After GCP Console Remediation Attempt (2026-09-10) — GATE STILL CLOSED

A GCP/Firebase **console configuration change** was applied by the operator to try to
open the §7 gate. The full client-verification checklist was re-run against the live
environment on 2026-09-10. **The client LIST/QUERY gate is unchanged (still 403 / SDK
unreachable).** Evidence:

| Check (all with a live Firebase ID token for a fresh disposable owner) | Result |
|---|---|
| REST `documents:runQuery` (`?key=` web API key) | ❌ **HTTP 403** `PERMISSION_DENIED` |
| REST `documents:runQuery` (`x-goog-api-key` header — the browser/SDK header form) | ❌ **HTTP 403** `PERMISSION_DENIED` |
| REST `documents:runQuery` (api key via header **and** `?key=` both) | ❌ **HTTP 403** `PERMISSION_DENIED` |
| REST `ListDocuments` (collection GET, header key form) | ❌ **HTTP 403** `PERMISSION_DENIED` |
| Web SDK `@firebase/firestore` (12.18.0) `setDoc` | ❌ gRPC **Write stream `NOT_FOUND(5)`** (retries forever, offline) |
| Web SDK `getDocs` / `onSnapshot` (same stack) | ❌ gRPC **Listen `NOT_FOUND(5)`** → offline empty (as before) |
| Web SDK with `experimentalForceLongPolling: true` | ❌ Node still selects gRPC transport → `NOT_FOUND(5)` (WebChannel only exists in a real browser; no browser automation tooling in this environment) |
| Admin SDK + service account (named DB) | ✅ reachable; probe user has **0 docs** under `memories`/`journalEntries`/`aiInteractions` (no stray artifacts) |
| Emulator + same ruleset (135 tests) | ✅ owner list allowed — rules remain exonerated |
| `npm test` / `typecheck` / `build` / `test:rules` | ✅ 411/411 / clean / clean / 135/135 |

Owner document `getDoc` and delete remained reachable from REST (200/200); the
typed-field REST create was also attempted (400 on the hand-built body, cosmetic —
write success was already proven in §5 with the live lifecycle, and rules write paths
are unchanged).

### Conclusion of the attempt
The console change did **not** open the query path on the web API key for this named
database. The §8 browser pass therefore remains blocked by the same environment gate.
Next action still requires a GCP-side change (or a Cloud Run revision that proxies
server-side reads / region-resolves the named DB for the web SDK); this repo cannot
self-heal the gate from code, and no code/rule change is justified by this retest.

---

## 8. Not Yet Verified (blocked by §7 / §7a)

- Browser pass (Google sign-in): extraction indicator states, Candidates tab
  surfacing, Approve/Forget actions, Ask My Life citing an approved memory.
- Emulator parity for client list reads against production (requires §7 fix).
- Re-verified 2026-09-10 after a GCP console remediation attempt: **still blocked**.

---

## 9. Known Limitations (accepted, by design)

- A forced retry after a partial multi-candidate write failure can duplicate already-created
  candidates (marker idempotency covers unchanged entries; documented, not a data-safety leak).
- Extraction is text-only for memory candidates; multimodal entry analysis remains Phase 1 scope.
- Extraction never blocks journal save; a failed extraction leaves entries intact.

---

## 10. Files Touched (commit `993ca69`)

`server.ts`, `server/gemini/index.ts`, `server/gemini/service.ts`,
`server/gemini/types.ts`, `server/gemini/validation.ts`,
`server/gemini/__tests__/extractMemoryRoutes.test.ts`, `src/services/memoryPipeline.ts`,
`src/services/__tests__/memoryPipeline.test.ts`,
`src/data/__tests__/memoryPipelineFirestore.test.ts`, `src/data/__tests__/memoriesFirestore.test.ts`,
`firestore.rules`, `firebase.json`.

---

## 11. Cleanup Performed

- Deleted probe memory `mem-phase2a-cand` and both `memory-extraction` audit rows (admin SDK).
- Deleted the 3 disposable Firebase Auth accounts created for verification.
- 2026-09-10 re-run: `trio1` evidence doc deleted (REST 200); admin-confirmed **0 docs**
  for the fresh probe user; probe auth account deleted (`accounts:delete` 200).
- No repo artifacts left behind; `git status` clean except pre-existing untracked
  `docs/PHASE2_COMPETITION_GAP_ASSESSMENT.md`.