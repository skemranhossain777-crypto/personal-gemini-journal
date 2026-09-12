# Phase 2D — Production Hardening & Consolidation

**Status:** COMPLETE — VERIFIED IN PRODUCTION
**Date:** 2026-09-12

---

## 1. Scope & Commit Boundary

Phase 2D tightens the production experience in four workstreams:

- **A. Memory Engine UX clarification** — give the seed user a clear, non-blocking
  path from memory extraction to a reviewable candidates list, with honest copy and
  an explicit "open candidates" action that deep-links straight into the Memory
  Engine's Candidate tab. No auto-extract changes, no pipeline changes.
- **B. Firestore rules & index deployment hardening** — the production pipeline now
  validates the Firebase config, runs the Firestore security-rules emulator suite on
  every push, and (on the approval-gated production job) deploys the reviewed rules
  **and** index configuration, then verifies that the live rules are byte-identical
  to the repo source.
- **C. Multimodal attachment contract** — correct the misleading "stored under your
  user account" copy in the image journal and surface an explicit "session-only"
  notice for media previews, matching the real contract (blob URLs live in memory
  only; nothing is uploaded to cloud storage).
- **D. Infrastructure consolidation inventory** — read-only census of project
  resources with a required/classification table and evidence. **No deletions.**

Commit boundary (two focused commits, both pushed to `master` and green in CI):

| Commit | Message | Files |
|---|---|---|
| `c194997` | `feat: harden memory UX, Firestore rules CI deploy, and attachment contract` | 12 |
| `2e73b97` | `fix: portable rules-suite temp path and Java 21 in CI runner` | 2 |

Untracked before this phase (not part of the Phase 2D commit, left as-is):
`docs/PHASE2C_PRODUCTION_PIPELINE_AND_MEMORY_AUDIT.md`.

## 2. Baseline

- Repo HEAD at phase start: `495d0e3ede4e98aae34a6f461b6f222ad0f3104b`.
- Production: Cloud Run `gemini-journal` (us-central1),
  `https://gemini-journal-s7hw7hui2q-uc.a.run.app`, GCP project
  `gen-lang-client-0345619653`, Firestore named DB `gemini-journal` (us-west1).
- Production deploy identity (CI): `journal-prod-sa@gen-lang-client-0345619653.iam.gserviceaccount.com`,
  key configured as GitHub secret `GCP_SA_KEY_PROD`.
- Pipeline: single GitHub Actions workflow `.github/workflows/deploy.yml`, 4 jobs,
  environment-gated production deploy.
- Local tools: Node 22, firebase-tools 15.29.0 (package.json `^15.25.1`),
  Vitest 5, Java 21 bundled JRE for the rules emulator.

## 3. Accepted Phase 2C Findings

Carried forward unchanged from Phase 2C (already verified in production):

- Live Firestore rules on `gen-lang-client-0345619653` DB `gemini-journal` are the
  ruleset `06c07f7e-ce2d-4eb5-aca6-c95c95db9958`, byte-identical to repo
  `firestore.rules` (28764 chars).
- Memory auto-extraction runs **only** for brand-new entries
  (`autoExtract: entryId === null`); editing an existing entry uses the manual
  button. Extraction never throws and never blocks journaling.
- Memory candidates persist with `saved:false, status:'candidate'` and are surfaced
  in the Memory Engine; extraction is idempotent via the dedup marker
  `gemini-journal:memory-extraction:v1`.
- Image/voice/attachment media are analyzed in-memory and never stored to cloud
  Storage (no storage rules, no upload path).
- Production robots are honestly blocked; all smoke tests pass on the live revision.

## 4. Memory Engine UX — Before / After

Workstream A implements the UX clarification requested in Phase 2C (A5) without any
behavioral change to extraction.

| Surface | Before | After |
|---|---|---|
| `MemoryExtractionBar` idle state | button only; no guidance | new `hint` line shown at idle ("New entries are reviewed for memory candidates automatically. Extraction never changes or blocks your writing." / existing entries: "Memory extraction is optional and never changes your entry. Any candidates appear in the Memory Engine for your review.") with `role="note"` |
| Extraction success with candidates | status text only | new **Review candidates** button (ArrowRight, `data-testid=review-memory-candidates-button`) shown when `candidatesCreated > 0`; invokes `onReviewCandidates` |
| Status containers | no ARIA semantics | `role="status"` on running/success/error so screen readers announce state |
| Memory Engine tab | always opens on "Saved" | optional `initialTab?: TabMode` prop (`'candidates' | 'saved' | 'ignored_forgotten' | 'all'`) |
| Navigation | (no path from journal to candidates) | `ResponsiveNavigationShell` holds `memoryOpenTab`; the journal's **Review candidates** action clears the editor/composer, switches to the Memories tab, and opens Memory Engine on Candidate tab (`#/memories/candidates` fed via `initialTab`). Normal Memories navigation resets `memoryOpenTab` so the default tab stays "Saved". |
| Props threaded | — | `EntryEditor` gains `onReviewCandidates?`; `JournalWorkspace` gains `onOpenMemoryCandidates?`; both optional so existing usages/tests are unaffected. |

All extraction behavior, dedup, and persistence are untouched (Phase 2C guarantees
preserved).

## 5. Firestore Rules & Index Deployment Hardening — Before / After

Workstream B moves rule/index deployment into the reviewed, approval-gated path.

| | Before | After |
|---|---|---|
| Deploy | not in pipeline (rules only verified once manually) | production job runs `npx firebase deploy --only firestore:rules,firestore:indexes --project gen-lang-client-0345619653 --non-interactive` (step **13c**) immediately after the container deploy and before the smoke tests |
| Config validation | none in CI | new **4a** `node scripts/validate-firebase-config.mjs`: asserts `.firebaserc` default project, exactly one Firestore DB target (`gemini-journal`), rules/index files exist, `firestore.indexes.json` is an object with an `indexes` array, and no `storage` section |
| Rules behavior tests | not in CI | new **4b** `npm run test:rules` (Firestore + Auth emulators, 152 assertions) runs on every push/PR on the Linux runner (new **Setup Java 21** step; `scripts/test-rules.mjs` now writes its throwaway emulator config to the OS temp dir so it is portable to CI) |
| Drift check | none | new **13d** `node scripts/verify-firestore-rules.mjs "$TOKEN"`: resolves the named-DB release `cloud.firestore/gemini-journal`, downloads the current ruleset, and fails the deploy if it differs from repo `firestore.rules` (with transient-error retry) |
| Scope | — | Rules/index deploy gated by the existing `production` environment approval; deliberately **not** on the staging path (rules are project-global; staging has no approval gate) |
| IAM (additions to `journal-prod-sa`) | `run.admin`, `artifactregistry.writer`, `iam.serviceAccountUser` | **+** `serviceusage.serviceUsageViewer` (preflight API check), `serviceusage.serviceUsageConsumer` (quota project for rules API), `firebaserules.admin` (rules compile/release permissions), `datastore.indexAdmin` (index deploy) |

Verified in production on run `34689086516`: rules compiled ("compiled successfully"),
reported "latest version already up to date, skipping upload" (unchanged ruleset,
expected), indexes deployed with no drift, and **13d** confirmed the live ruleset
still matches repo `firestore.rules`.

## 6. Multimodal Attachment Contract

Confirmed contract and the Phase 2D UI corrections:

- **Entries/attachments are real and durable** only as Firestore documents; media
  bytes are **never** persisted to any storage backend. In short: *the journal entry metadata is
  stored in Firestore, but image/audio bytes and their `blob:` previews are session-only and are
  not durably stored* — the only durable model record for a multimodal beat is the entry document
  plus its `attachment` metadata (URL/URL type/mime/name).
- Image & voice journaling create `blob:` URLs via `URL.createObjectURL()` — in-memory
  previews that live only for the page session. The image (in-memory multer) is sent
  directly to `/api/gemini/analyze-image`; no upload, no stored copy.
- The manual File picker path (`handleAddFile` in `EntryEditor`) attempts
  `getStorageInstance()` on the default Firebase Storage bucket
  (`users/{uid}/attachments/{id}`), which does **not** exist (no `storage` section in
  `firebase.json`, no storage rules) and therefore fails with a toast — uploads are
  unsupported by design this phase.
- `ImageJournalView` previously claimed "Stored privately under your user account" —
  false. **Fixed** to: "Sent directly to Gemini for analysis; the preview stays on
  this device only for this session and is not uploaded to cloud storage."
- New persistent notice in `AttachmentList` when attachments exist
  (`data-testid=session-only-media-note`): "Media previews are kept on this device and
  are available only for this session."
- No new storage rules, bucket, upload handler, or persistence claim introduced.
- Phase 2D comments in section 1 and this section make the boundary explicit.

## 7. Infrastructure Consolidation Inventory

| # | Resource | Type | Health / Notes |
|---|---|---|---|
| 1 | `personal-gemini-journal-9e084` project | GCP project (legacy) | No CI reference; legacy naming; described as legacy |
| 2 | Cloud Run `gemini-journal` (us-central1) | service | HEALTHY — serves 100% traffic; revision `gemini-journal-00034-t48` |
| 3 | Cloud Run `gemini-journal-staging` | service | HEALTHY — CI staging job deploys + smoke-tests it |
| 4 | Cloud SQL `gen-lang-client-0345619653-instance` (PostgreSQL 18, asia-east2, RUNNABLE) | instance | Idle; only default `postgres` DB; nothing connects to it; leftover Firebase Data Connect scaffold |
| 5 | Firestore DB `gemini-journal` (us-west1) | DB | HEALTHY — primary production DB |
| 6 | Storage bucket `gen-lang-client-0345619653.firebasestorage.app` | bucket | Empty; no `storage` rules; unreferenced by app beyond a failing upload path |
| 7 | `firebase.json` hosting block → `gemini-journal` | config | Vestigial; production served directly by Cloud Run; never deployed in CI |
| 8 | `dataconnect/` directory | source scaffold | Present; references a DB that does not exist; no deploy step; no code references |
| 9 | GitHub secrets `GCP_SA_KEY_STAGING`, `GCP_SA_KEY_PROD`, `STAGING_APP_URL`, `PROD_APP_URL` | secret store | HEALTHY — used by pipeline |
| 10 | SAs `journal-staging-sa`, `journal-prod-sa` | IAM | HEALTHY — pipeline identities |
| 11 | Scheduler / Pub/Sub / Tasks / other triggers | compute | Not configured (no `schedules` reference, no workers); nothing found in firebase.json/CI |
| 12 | `roles/editor` on `618285014094-compute@developer.gserviceaccount.com` | IAM | Broad legacy grant on the service's runtime/default SA (unchanged this phase) |

## 8. Classification Table

| # | Resource | Classification | Rationale / Evidence |
|---|---|---|---|
| 2 | Cloud Run `gemini-journal` | **REQUIRED** | Production service, 100% traffic |
| 3 | Cloud Run `gemini-journal-staging` | **REQUIRED** | CI staging deploy + smoke |
| 5 | Firestore DB `gemini-journal` | **REQUIRED** | Primary data store for all features |
| 4 | Cloud SQL instance | **UNUSED BUT RETAIN FOR REVIEW** | RUNNABLE, single empty `postgres` DB; no app/CI connection; likely Data Connect pre-step |
| 7 | `firebase.json` hosting block | **UNUSED BUT RETAIN FOR REVIEW** | No deploy references; could serve a future custom-domain static front |
| 6 | Storage bucket | **UNKNOWN — MORE EVIDENCE REQUIRED** | Empty but auto-created with project; app code references default bucket only in the failing upload path; decommissioning needs owner confirmation of no future Storage use |
| 8 | `dataconnect/` scaffold | **UNKNOWN — MORE EVIDENCE REQUIRED** | Could signal intended relational layer; no active config |
| 1 | Legacy project `personal-gemini-journal-9e084` | **SAFE TO DECOMMISSION ONLY AFTER APPROVAL** | No CI/code reference; explicit owner confirmation required before any action |
| 9 | GitHub secrets + 10. CI SAs | **REQUIRED** | Pipeline identities |
| 11 | Scheduler/PubSub/Tasks | **UNKNOWN — MORE EVIDENCE REQUIRED** | Evidence of absence only; verify in GCP console before concluding |
| 12 | `roles/editor` on compute SA | **REFERENCED** (retained) | Runtime + Smoke identity; see Risks |

No deletions performed this phase.

## 9. Evidence by Resource

- Cloud Run prod: `gcloud run services describe gemini-journal --region=us-central1`
  → `latestReadyRevisionName=gemini-journal-00034-t48`, traffic 100%,
  image `journal-app:2e73b9704f0c94d12cdcc9a7a3198ae8ae0fe0c2`.
- Rules: `verify-firestore-rules.mjs` (locally and CI 13d) — release
  `projects/gen-lang-client-0345619653/releases/cloud.firestore/gemini-journal` →
  ruleset equal to repo `firestore.rules`.
- IAM: `gcloud projects get-iam-policy` filters for `journal-prod-sa` / compute SA
  (roles enumerated in section 5 and 7.12).
- CI: run `34689086516` — 4/4 jobs pass (JSON pull: `conclusion:success`).
- Empty Cloud SQL: `POSTGRES_18` RUNNABLE; only `postgres` database; no connection
  strings in code or CI.
- Bucket: `firebase.json` has no `storage` section; bucket present in GCS.

## 10. What Did NOT Change

- Memory extraction logic, dedup marker, and persistence semantics.
- `firestore.rules` content (still the audited Phase 2C ruleset — deploy reported
  "already up to date").
- `firestore.indexes.json` content.
- No new DB, service, pipeline, bucket, or storage rules; no deletes.
- Auto-extract remains new-entry-only; existing entries stay manual.
- No secrets, keys, or credentials committed; no new `.env`.
- Cloud Run env vars / runtime binary contract unchanged.

## 11. Tests Added / Updated

| File | Type | Count |
|---|---|---|
| `src/components/journal/__tests__/MemoryExtractionBar.test.tsx` | NEW | 5 (running state; idle hint + manual extraction; Review-candidates button → `onReviewCandidates` once; success w/o candidates hides button; error → retry) |
| `src/components/journal/__tests__/MemoryEngineView.test.tsx` | NEW | 2 (default tab "saved" filters candidates; `initialTab='candidates'` opens Candidate tab) |
| `scripts/test-rules.mjs` | UPDATED | temp emulator config now written to OS temp dir (portable to Linux CI); no behavioral change |

Suites after the phase (local + CI, identical): unit `59 files / 456 tests`,
rules emulator `2 files / 152 assertions`. Related rendered views re-run for the
Workstream C copy changes (ImageJournalView, VoiceJournalView, EntryEditor — 13 tests).

## 12. Files Changed (This Phase)

Across `c194997` and `2e73b97` (14 unique files):

`.github/workflows/deploy.yml`, `scripts/test-rules.mjs`,
`scripts/validate-firebase-config.mjs` (new), `scripts/verify-firestore-rules.mjs` (new),
`src/components/journal/AttachmentList.tsx`, `ImageJournalView.tsx`,
`MemoryEngineView.tsx`, `MemoryExtractionBar.tsx`,
`__tests__/MemoryEngineView.test.tsx` (new), `__tests__/MemoryExtractionBar.test.tsx` (new),
`src/components/navigation/ResponsiveNavigationShell.tsx`,
`src/pages/journal/EntryEditor.tsx`, `src/pages/journal/JournalWorkspace.tsx`,
(this document).

## 13. CI / CD Changes

- Stage 1 (validate-and-test): + **4a** config validation, + **Setup Java 21**,
  + **4b** rules emulator suite (after unit tests, before build).
- Stage 4 (deploy-production, approval gated): + **Setup Node.js**, + `npm ci`,
  + **13c** `firebase deploy --only firestore:rules,firestore:indexes`,
  + **13d** drift verification; all before Production Smoke Tests.
- Rules/index deploy intentionally not duplicated on the staging path.
- Deployment order preserved: validate → build/scan → staging + smoke → (approval) →
  prod deploy → rules/index deploy → rules verify → prod smoke.

## 14. Verification Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm test` (Vitest, jsdom) | PASS — 456 tests / 59 files |
| `npm run test:rules` (emulators) | PASS — 152 assertions / 2 files |
| `npm run build` (vite + esbuild server) | PASS |
| `node scripts/validate-firebase-config.mjs` | PASS |
| CI run `34689086516` (commit `2e73b97`) | **SUCCESS** — 4/4 jobs (validate-and-test 1m38s, container build+scan 36s, staging deploy+smoke 1m52s, production deploy 2m16s) |
| Commit `c194997` intermediate run | N/A (superseded by `2e73b97` run; its earlier run only failed on the pre-existing rules-suite temp-path bug, since fixed) |
| Production revision | `gemini-journal-00034-t48`, image `journal-app:2e73b9704f...` (matches pushed HEAD) |
| Traffic | 100% → `gemini-journal-00034-t48` |
| Rules deploy (13c) | PASS — compiled; "already up to date" (content unchanged); indexes deployed |
| Rules drift check (13d) | PASS — live ruleset == `firestore.rules` |
| Production smoke tests | PASS |
| Authoritative URL | `https://gemini-journal-s7hw7hui2q-uc.a.run.app` |

IAM additions to `journal-prod-sa` were applied, then the production job re-ran to
completion; the final run above includes the index deploy and rules verification.

## 15. Risks & Open Items

- **Deploy-time IAM surface on `journal-prod-sa`** grew by four roles
  (Service Usage viewer/consumer, Firebase Rules admin, Datastore index admin) plus
  pre-existing run.admin/artifact-registry/SA-user. These are the minimum needed for
  the approved `firebase deploy --only firestore:*` path; revisit/scope further only if
  the deploy command is changed.
- **Broad legacy grants** remain: `roles/editor` on the runtime compute SA, and several
  legacy SAs/keys (e.g. `firebase-adminsdk`, `ais-gemini-key-*`) are untouched. A
  least-privilege clean-up of the *service runtime* SA is worth a dedicated follow-up.
- **No durable media storage** (by design). Attaching files errors politely via toast;
  session-only preview note now matches behavior.
- **Dependabot** reports 5 moderate vulnerabilities on the default branch (pre-existing,
  unrelated to this phase; not introduced by any commit here).
- **GitHub Actions deprecations**: checkout@v4 / setup-node@v4 / setup-java@v4 /
  google-github-actions auth@v2 + setup-gcloud@v2 run on Node 20 (auto-forced to Node 24).
  Migrate to newest major versions in a forward-compat pass.
- **`dataconnect/` scaffold + Cloud SQL instance + storage bucket + hosting block** remain
  classified UNUSED/UNKNOWN and are intentionally not touched; each needs an explicit
  owner decision before any action.
- Rules "skip upload when unchanged" means 13c is also a read-back check; 13d remains the
  authoritative drift guard for this repo.

## 16. Approval-Required Items

| Item | Needed from | Action if approved |
|---|---|---|
| Retain the four new `journal-prod-sa` roles (or document as replaced by a pre-provisioned rules-deploy SA) | Production owner | Keep roles as deployed; optionally rotate `GCP_SA_KEY_PROD` afterward |
| Decommission legacy project `personal-gemini-journal-9e084` | Owner | Separate, explicit teardown (never in this pipeline) |
| Remove Cloud SQL instance / `dataconnect/` scaffold / storage bucket / hosting block | Owner | One-off GCP/`firebase.json` changes outside this phase |
| Decide least-privilege target for the runtime compute SA | Owner | Replace `roles/editor` with scoped set + re-run smoke |
| Optional: migrate GH Actions to latest action major versions | Maintainer | Forward-compat PR |

## 17. Verdict

**PATCH**

(PATCH: focused, low-risk hardening — UX honesty + an explicit review path for memory
candidates, rules/index deploy moved into the reviewed production pipeline with a
byte-level drift guard, in-session media copy corrected, and a read-only infrastructure
census. Everything shipped is verified locally and in production: 4/4 CI jobs green,
rules live-matching repo, revision `gemini-journal-00034-t48` serving 100% traffic,
production smoke passing. No redesign, no data-model change, and no new surface that
requires a project decision to ship. Items needing an owner are tracked in §16 and
explicitly out of this phase.)