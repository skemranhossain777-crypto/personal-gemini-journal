# COMPETITION PHASE 0 — RELEASE CHAIN LOCK & BASELINE

**Date:** 2026-09-07
**Application:** JOURNAL∞ — Personal Memory & AI Reflection Engine
**Competition:** Google Cloud Run AI Challenge
**Verdict:** `BASELINE LOCKED`

---

## 1. Git State

```
Branch:            master
Local HEAD:        f70643d9ad57654adad372254b448fde5819e638  (test(privacy): await async integrity badge...)
Remote HEAD:       fef66ad256cbd3fac837b05366b2c1127d6313f3  (origin/master, after fetch)
Working tree:      clean (only untracked file present, see below)
Untracked files:   docs/PHASE72_FINAL_VERIFICATION.md (delivered earlier, not yet committed)
Ahead/Behind:      local 0 ahead, 6 behind remote
```

**Divergence analysis (documented, not corrected):**
Local `master` is **6 commits behind** remote. The 6 remote-only commits are:

| SHA | Commit | Type |
|---|---|---|
| `5776d6d` | Create SECURITY.md | docs-only |
| `d566ef7` | Add CodeQL analysis workflow configuration | CI-only |
| `0aa1970` | Copilot Autofix PR #2 content — SSRF hardening in `server.ts` (Slack/Discord webhook URL pinning) | source |
| `7536236` | Merge PR #2 (alert-autofix-11) | merge |
| `a2eebc6` | Copilot Autofix PR #1 content — SSRF hardening in `server.ts` (identical tree to 0aa1970) | source |
| `fef66ad` | Merge PR #1 (alert-autofix-10) | merge |

- `5776d6d` and `d566ef7` are documentation/CI files only — **no application code change**.
- `0aa1970`/`a2eebc6` are **identical** trees (verified `git diff 7536236 fef66ad` → empty) adding on-the-wire URL re-validation for Slack/Discord webhook dispatch in `server.ts` (additional protocol/hostname/pathname pinning beyond the existing `isAllowedWebhookUrl`).
- **Impact on the deployed image:** none directly. The commit that produced the **current production image** is `5776d6d` (SECURITY.md). The two autofix merge commits were built, scanned, and staged by CI at 16:42 but **remain `waiting` at the production environment approval gate** — they have NOT reached production.

**Important discovery:** GitHub's "Copilot Autofix powered by AI" auto-negotiated and merged two Security code-scanning PRs (#1, #2) into `master` at ~16:42 without manual code review. Their `deploy.yml` runs (`34144526371`, `34144496550`) passed build/scan/staging smoke and are now blocked at the manual production-approval gate. **No deploy occurred.** This is a governance finding (Section 9, weakness P0/P1), not a release-chain break.

---

## 2. Production Traceability

```
Production Revision
gemini-journal-00009-qsk
        ↓
Image digest
sha256:89d15534b8e1db6a002e23ffef60a303a4374ebeb61efe71a4652aefa1336ba5
   (= same digest as productions 00008-58s; tagged gcr.io/.../journal-app:5776d6d… + :latest)
        ↓
CI run (production job)
34123137485  (deploy.yml · push · headSha 5776d6d … · production deployment approved & succeeded)
        ↓
Git SHA
5776d6d92721369afa7a1865cff39bfb13946182
        ↓
Git commit
5776d6d  "Create SECURITY.md"  (docs-only; application code remains f70643d content)
```

**Complete revision → commit map (newly re-verified from registry + CI logs):**

| Revision | Created (UTC) | Image digest | Git commit (tag) | Proven by |
|---|---|---|---|---|
| 00006-s6k | 12:49 | 82b68304… | f70643d (Phase 7 fix) | CI run 34120696166 |
| 00007-99m | 12:52 | d2ca8952… | d566ef7 (CodeQL) | CI run 34123200997 deployed 00007 @ 12:53 |
| 00008-58s | 13:14 | 89d15534… | 5776d6d (SECURITY.md) | CI run 34123137485 deployed 00008 @ 13:14:57 |
| 00009-qsk | 14:55 | 89d15534… | 5776d6d (env-only APP_URL update) | same image as 00008 |

**Conclusion:** Current production `00009-qsk` → `sha256:89d15534…` → CI run `34123137485` → commit `5776d6d` (SECURITY.md) → image tag `:5776d6d…`. The app code under `5776d6d` is *identical* to `f70643d` (verified: both `5776d6d`/`d566ef7` are docs/CI-only). **Fully traceable, no gap.**

> Note: traces for revisions `00001`–`00005` (pre-CI, `cloud-run-source-deploy` images) are not in scope of this phase's chain (they belong to earlier setup).

---

## 3. CI/CD — **PASS**

Verified from `.github/workflows/deploy.yml` (current working copy, which is the post-Phase-7 repaired pipeline):

| Requirement | Status | Evidence |
|---|---|---|
| GCP project `gen-lang-client-0345619653` | ✅ | deploy.yml:115,122,181 |
| Cloud Run service `gemini-journal` | ✅ | deploy.yml:179 |
| Region `us-central1` | ✅ | deploy.yml:182 |
| Port `3000` | ✅ | deploy.yml:184 |
| Production URL = canonical | ✅ | env `APP_URL=${{ secrets.PROD_APP_URL }}` = canonical run.app URL |
| Does NOT target `gemini-journal-production` | ✅ | prod job targets `gemini-journal`; staging targets `gemini-journal-staging` (port 8080, separate SA) |
| Environment approval exists | ✅ | `environment: production`; GitHub env `production` has `required_reviewers` + branch_policy rules |
| Staging/prod separation | ✅ | distinct jobs, SAs (`journal-staging-sa` / prod SA), secrets `GCP_SA_KEY_STAGING`/`GCP_SA_KEY_PROD` |
| Prod smoke after deploy | ✅ | `node scripts/smoke-test.mjs` (deploy.yml:199-203) |
| Revision ready + 100% traffic asserted | ✅ | deploy.yml:190-197 |
| Invalid-token auth test | ✅ | smoke-test.mjs:113-127 (expects 401/400) |
| Static asset checks | ✅ | smoke-test.mjs:147-172 (asset refs each HTTP 200) |
| Trivy HIGH/CRITICAL scan, gate | ✅ | deploy.yml:80-88 (exit-code 1) |

**Caveats (documented, no correction made):**
- `master` **branch protection is NOT enabled** (404 from GitHub API). The `production` environment's `branch_policy` rule is the *only* gate. This is how the autofix PRs merged themselves. Recommend enabling branch protection (Section 9, P1).
- The authenticated (`SMOKE_FIREBASE_ID_TOKEN`) smoke branch is not exercised by CI (no token supplied); valid-token path was verified manually in Phase 7.2 Check E.

---

## 4. Production Health — **PASS**

`GET /health` → HTTP 200, `environment: production`, all flags **true** (verified live, no secrets exposed):

```
geminiKeyConfigured: true
mapsKeyConfigured: true
firebaseProjectIdConfigured: true
firestoreDatabaseConfigured: true
firestoreNamedDatabaseConfigured: true
adminEmailsConfigured: true
```

`GET /api/health` → HTTP 200, same payload. Runtime env clean: `FIRESTORE_DATABASE_ID`, `VITE_FIREBASE_PROJECT_ID`, `NODE_ENV=production`, `APP_URL` canonical; four service secrets bound by reference (values never printed).

---

## 5. Live URL — **PASS**

`https://gemini-journal-s7hw7hui2q-uc.a.run.app`
- `GET /` → **200**, `<title>JOURNAL∞ – Personal Memory & AI Reflection Engine</title>`
- All 8 referenced assets → **200** (`/assets/index-BLaJ6vAp.js`, `index-BDlJBxGJ.css`, firebase-app/auth/firestore, vendor-icons/markdown/motion)
- Unknown paths return the SPA fallback (HTTP 200 HTML) — expected catch-all, no unexpected 404s
- No destructive browser tests run (per phase constraints)

---

## 6. Firestore — **PASS**

Authoritative database confirmed unchanged:

```
Name:  gemini-journal
Type:  FIRESTORE_NATIVE
Region: us-west1
```

- Service env `FIRESTORE_DATABASE_ID` = same database; `firestoreNamedDatabaseConfigured: true`.
- No test data created, no data deleted, rules untouched, bound to Secret Manager refs only.

---

## 7. Release Chain — **PASS**

`Git → CI → Image → Cloud Run → Live URL` is **fully traceable** for the current production revision:
- Commit `5776d6d` (master) → CI run `34123137485` production job → image pushed to GCR `journal-app:5776d6d…` + `:latest` → Cloud Run revision `00009-qsk` (Ready, 100% traffic, ContainerHealthy) → live URL verified 200/200 assets/healthy.

**Boundary condition:** remote `master` now has 4 additional commits (autofix SSRF merges). Those are built/staged but deliberately held at the production approval gate — the chain is traceable *to* current production, and the newer commits are correctly gated. The chain remains locked at `00009-qsk` until an approval is granted (an operator decision, not taken here).

---

## 8. Competition Strengths

Highest-value existing features (all verified in Phase 7.2, live):

1. **Meaningful Cloud Run usage** — server-side Gemini orchestration, Firebase JWT verification (JWKS, no Admin SDK for auth), server-only Google Maps Places proxy, per-IP rate limiting, Security headers, structured Cloud Logging, graceful shutdown. This is a real containerized API+SSR app, not a static site. (server.ts, deploy.yml)
2. **Gemini server-side with 4-model fallback ladder** — `gemini-3.6-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest` → `gemini-3.7-flash` with recoverable-error classification (timeout/429/resource-exhausted/500) and 30s timeout. (server/gemini/service.ts:93-204)
3. **Anti-hallucination & grounding engineering** — attribution blocks, Ask My Life requires evidence citations + `insufficient` confidence instead of fabricating, strict "never invent history" system instructions, JSON-schema outputs with safe fallbacks, temperature per operation. (service.ts)
4. **Prompt-injection / indirect-injection defense in depth** — `<UNTRUSTED_USER_CONTENT>` / `<UNTRUSTED_RETRIEVED_JOURNAL_CONTENT>` wrapping, 14-pattern rejection, context sanitization, append-only `aiInteractions` audit trail. (server/gemini/validation.ts, firestore.rules)
5. **Human-in-the-loop memory engine** — AI proposes memory candidates; only the user can approve/commit/delete (owner-scoped rules, dual create/update validators, immutable pedigree).
6. **Ask My Life RAG** — query intent detection, keyword ranking, context budget (max 15 docs / 12k chars), evidence citations, 10-min cache.
7. **Security posture surface** — 8-zone in-app Threat Model, Privacy Center with account data wipe, CSV formula-injection escaping, SSRF-protected Slack/Discord dispatch, non-root container user.
8. **Demoability** — 5-min demo script, Judge Tour modal, demo mode without sign-in, deep navy/sky design system, accessible (a11y verified, reduced-motion, keyboard path).

---

## 9. Competition Weaknesses (ranked, NOT implemented)

**P0 — critical**
- **P0-1 Multimodal is simulated.** Voice transcription and image journaling return hardcoded samples (`voiceTranscription.ts:61-74`, `imageJournaling.ts:119-152`) — no real Gemini multimodal input. A judge who tries it sees fabricated output; README only implies Gemini-based features. Real implementation (or explicit labeling) is required before claiming Gemini multimodal.

**P1 — high value**
- **P1-1 Governance gap: `master` branch protection disabled.** Copilot Autofix merged two PRs to master with no review; only the production environment gate stopped them. Enable branch protection (require PR review; optionally restrict `latest` pushes).
- **P1-2 Pending autofix deploy runs.** Two `deploy.yml` runs (`34144526371`, `34144496550`) are `waiting` at production approval for the SSRF-hardened master. Operator must decide: approve & verify them as the new baseline, or reject/cancel them (they will otherwise remain queued).
- **P1-3 Local vs remote sync.** Local `master` is 6 commits behind; deploy config on local (`gcr-generic` path) predates CI's `deploy.yml` repairs. Sync local to remote tip before Phase 1 coding begins.
- **P1-4 `GEMINI_API_KEY` / `GOOGLE_MAPS_API_KEY` legacy Cloud Run env vars in earlier revisions** — legacy secret `GEMINI_API_KEY` still exists unreferenced; ensure any new revision (esp. autofix) re-points env-by-secret only. (Verified current 00009 has correct refs; ongoing risk when new revisions deploy.)
- **P1-5 UI data layer vs newer owner-scoped model.** The production journaling UX is still driven by the single `JournalInteraction` entity; the new `users/{uid}/…` collections exist/tested/rules-protected but are not wired into the UI. Judges reading `docs/ARCHITECTURE.md` may see a mismatch; either wire the new layer or document the live path accurately.

**P2 — optional**
- P2-1 Authenticated CI smoke: wire a short-lived Firebase ID token into the production smoke gate (currently skipped).
- P2-2 Competition submission assets: no screenshots exist in the repo. Capture real browser screenshots (Phase 7.2 CDP harness can produce them) into `docs/` before submission.
- P2-3 Add a competition-specific README section / submission doc referencing Phase 0 baseline (this file), live URL, revision, and power-user paths.

---

## 10. Changes Made

```
NONE
```

- No source changes, no rules changes, no secret changes, no traffic changes, no deploys, no approvals.
- No commits, no pushes, no branch protection changes, no CI edits.
- Only read-only verification commands and this documentation file were produced.
- The two pending autofix deployments were intentionally **not approved** (operator decision required).

---

## 11. Final Verdict

```
BASELINE LOCKED
```

Production release chain (`Git → CI → Image → Cloud Run → Live URL`) is fully traceable to commit `5776d6d` / revision `00009-qsk` / digest `sha256:89d15534…`, health is green, live URL serves correctly, Firestore is canonical and untouched, and CI has the required gates (approval, Trivy, smoke, traffic assertions).

Competition improvement work may now begin **from remote `master` tip** (`fef66ad`) via the standard 16-step release policy, with the P0/P1 items above addressed in the appropriate phases. Production remains at `00009-qsk` and untouched until the next approved phase.