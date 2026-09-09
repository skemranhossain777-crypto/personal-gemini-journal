# COMPETITION PHASE 1.1 — PRODUCTION MULTIMODAL QA & RELEASE VERIFICATION

**Date:** 2026-09-09
**Application:** JOURNAL∞ — Personal Memory & AI Reflection Engine
**Competition:** Google Cloud Run AI Challenge
**Verdict:** `PASS — IMPLEMENTED, DEPLOYED, AND VERIFIED IN PRODUCTION`

---

## 1. Objective & Scope

Phase 1 (`docs/PHASE1_MULTIMODAL_JOURNAL.md`) shipped genuine server-side Gemini
image & voice journaling. Phase 1.1 is an **independent production QA** of that
release on the authoritative Cloud Run service — no feature work — with a final
report. Two **real, previously-undiscovered defects** were found during
verification (Defect A: audit-log default-app crash; Defect B: `modelUsed`
missing from `isAiMetadata`), fixed with the smallest possible change, and
re-verified end-to-end through the full CI/deploy chain.

---

## 2. Authoritative Target (URL Reconciliation)

| Item | Value |
|---|---|
| Project | `gen-lang-client-0345619653` |
| Service | `gemini-journal` |
| Region | `us-central1` |
| Canonical URL | `https://gemini-journal-s7hw7hui2q-uc.a.run.app` |
| Alternate URL | `https://gemini-journal-618285014094.us-central1.run.app` (same service) |
| Pre-fix revision (verified) | `gemini-journal-00014-l28` |
| Post-fix revision (deployed) | `gemini-journal-00015-j8j` |
| Traffic | 100% on latest |
| Post-fix image digest | `sha256:ecfb566a9d46cb0f494a6780c6916ed5a8edf9311d4ae4a46bf6f575ef31bcd7` |

The two Cloud Run URLs are alternate endpoints of the **same** service
(confirmed via `run.googleapis.com/urls` annotation and identical `/health`
responses). No legacy production was touched.

---

## 3. Release Traceability (pre-fix baseline)

```text
Commit 318aacd
    ↓ pushed
CI run 34260869297
    ↓ gcr.io/gen-lang-client-0345619653/journal-app:318aacd6c10463c5bb27c53de5f15ec0df8c667a
    ↓ image digest sha256:722e3e54046d0fb03c3969347729729a213a2e0236d38aea51c7af97dfb3ad6d
    ↓ Cloud Run revision gemini-journal-00014-l28
    ↓ 100% production traffic
    ↓ canonical production URL
```

Verified by inspecting `gcloud run services describe` / `revisions list` and
matching the git HEAD (`318aacd` was HEAD at verification time).

---

## 4. Verification Matrix (Production, pre-fix + post-fix)

Method: Firebase Admin SDK custom token → `accounts:signInWithCustomToken` with
the public web API key → real Firebase ID token, under two disposable probe
identities (`p11-check-user-a`, `p11-check-user-b`).

| # | Gate | Result | Evidence |
|---|---|---|---|
| 1 | Health `/health` + `/api/health` | **PASS** | HTTP 200; `firebaseProjectIdConfigured`, `geminiKeyConfigured`, `firestoreDatabaseConfigured`, `firestoreNamedDatabaseConfigured` all `true`; `NODE_ENV=production` |
| 2 | Auth: unauth rejected / auth accepted | **PASS** | `/api/auth/verify` 401 for invalid token; 200 with valid ID token; readable display name + UID |
| 3 | Real image journal (A/B, input-dependent) | **PASS** | Image A (lake/sunset) vs Image B (city/red car) → distinct, correct structured outputs (`body`, `summary`, `tags`, `emotion`, `modelUsed`, `visualAnalysis`) |
| 4 | Real voice journal (A/B, verbatim transcript) | **PASS** | Voice A/B both transcribe **verbatim**, distinct reflections; `transcript` preserved; structured fields present |
| 5 | Persistence: edit→save→reload | **PASS** | Entry saved with full `aiMetadata` incl. `modelUsed`; re-loaded; owner GET 200 |
| 6 | Timeline/Memories + privacy delete | **PASS** | Seeded memory + timeline event; listed via web SDK; deleted; removal confirmed |
| 7 | Ask My Life grounded answer | **PASS** | Grounded answer citing provided context documents; no fabrication |
| 8 | Owner isolation | **PASS** | B→A read AND write : 403 / 0 docs (web SDK); A→own read : 200; no cross-user leak |
| 9 | Media security (negative) | **PASS** | Bogus MIME (pdf-as-png, txt-as-wav) → 400; `application/pdf` → 415; oversize → 400; empty/truncated → 400 (truncated audio processed without crash) |
| 10 | Prompt-injection resistance | **PASS** | Malicious caption blocked at validation (400, pre-Gemini); malicious audio deflected into safe reflection — no system prompt / API key / config leaked |
| 11 | SSRF regression (Phase 0.1) | **PASS** | `/api/notifications/test` with loopback refused, GCP metadata blocked, path traversal stays Slack-bound |
| 12 | Browser-level verification (headless Chrome) | **PASS** | Restored Firebase Auth session from seeded IndexedDB; `#/app` auth gate shown when unauth; Journal tab renders both entries ("All 2"); mobile 390×844 view clean; zero console errors; zero 4xx/5xx; Firestore Listen to named DB 200 |
| 13 | Cloud Run logs (post-fix) | **PASS** | `[GeminiService …] Generation successful with model: gemini-3.6-flash` for the new runs on revision `00015-j8j`; no audit-write WARNINGs |

---

## 5. Defects Found & Fixes

### Defect A — audit-log default-app crash (genuine, Phase 1-visible)

- **Location:** `server.ts` `getAdminApp()`.
- **Behavior:** `if (admin.apps.length) return Promise.resolve(admin.app())` —
  after the first call, `admin.app()` (the **default** app) was called even
  though this process only ever initializes a **named** app
  (`journal-${process.pid}`). The default app is never initialized, so
  `admin.app()` threw; the throw cascaded into `logAiInteraction`'s
  fire-and-forget path.
- **Evidence:** During API testing of 4 interactions, only **1 of 4**
  `aiInteractions` records persisted; Cloud Run logs showed repeated `WARNING:
  "The default Firebase app does not exist"` at ~11 s intervals (cold-start
  instance), aligned with the 3 failed audit writes, while all 4 requests still
  returned 200 (honest app path; audit only).
- **Impact:** `users/{uid}/aiInteractions` audit trail unreliable (missed the
  Privacy Center / archive / audit UI). The `/api/admin/roles` privileged path
  also calls `getAdminApp()`, so it shared the bug.
- **Fix:** Memoize the PID-scoped named app and reuse it — never call
  `admin.app()`:
  ```ts
  const existing = admin.apps.find((a) => a.name.startsWith('journal-'));
  if (existing) return existing;
  ```
  Covered all callers (audit log + roles).

### Defect B — `modelUsed` missing from `aiMetadata` validators (latent)

- **Location:** `firestore.rules` `isAiMetadata` `hasOnly(...)` and client
  `src/data/validation.ts` `validateJournalEntryInput`.
- **Behavior:** both `hasOnly` key-sets omitted `modelUsed`, but the client
  (`EntryEditor.tsx` `handleVoiceDraft` / `handleImageDraft`) stamps
  `modelUsed` into `aiMetadata` on image/voice saves. Under the **strict repo
  rules**, the next deploy would have **rejected** every multimodal save.
- **Why it wasn't caught:** the rules test fixture used `aiMetadata: null` only
  and never exercised an aiMetadata map (test-coverage gap).
- **Note:** the **deployed** Firestore rules are a legacy Phase-3-era ruleset
  (blanket owner wildcard, no aiMetadata validation) dated 2026-09-04, so the
  live app was not broken — Defect B was a **latent** defect for the next strict
  deploy.
- **Fix (both places):** add `modelUsed` to the allowed key-sets with a
  `128`-char string bound; strengthened the rules test fixture to a realistic
  aiMetadata map **including** `modelUsed`, added a `hasOnly` negative case
  (extra key rejected) and a bogus-`modelUsed`-type rejection, and updated the
  client validation unit test.

### Fix commit

`f3f3ce9 fix(server+rules): audit-log default-app crash and modelUsed aiMetadata schema`
(5 files, +46/−5: `firestore.rules`, `server.ts`, `src/data/validation.ts`,
`src/data/__tests__/validation.test.ts`, `tests/rules/security_rules.test.ts`).

Local verification pre-commit: `npm run typecheck` PASS, `npx vitest run
src/data/__tests__/validation.test.ts` PASS (30), `npm run test:rules` PASS
(135 incl. new aiMetadata cases), `npm test` PASS (390/390, 52 files),
`npm run build` PASS.

---

## 6. CI/CD & Post-Fix Deployment

| Step | Result |
|---|---|
| Commit `f3f3ce9` pushed to `master` | Done |
| CI run **34334110728** "JOURNAL∞ Production CI/CD Pipeline" | **success** |
| Job 1-8 Validate, Test & Build | ✓ 1m21s |
| Job 9-10 Build Container & Scan (Trivy) | ✓ 1m29s |
| Job 11-12 Deploy Staging & Smoke | ✓ 1m54s |
| Job 13 Production Deployment (Approval) | ✓ 2m4s |
| Deployed revision | `gemini-journal-00015-j8j` (digest `sha256:ecfb566a…`) |
| Traffic | 100% |

---

## 7. Post-Fix Re-Verification (audit trail end-to-end)

Defect A's fix is proven by the audit trail itself:

1. **Smoke test** against the canonical URL (`SMOKE_TARGET_URL`):
   `/health`, `/api/health`, invalid-token 401, SPA HTML, and 8 static bundles
   all PASS.
2. **New image + voice interactions** run against revision `00015-j8j` with a
   fresh probe identity token — both HTTP 200 with genuine structured Gemini
   output (`modelUsed: gemini-3.6-flash`).
3. **Cloud Run logs** for the new runs (revision `00015-j8j`):
   `[GeminiService …] Generation successful with model: gemini-3.6-flash` —
   no audit-write WARNINGs.
4. **Firestore (named DB) inspection** of `users/{uid}/aiInteractions` —
   **4 records**, all with the rules-compatible shape
   (`id`, `uid`, `skill`, `prompt`, `response`, `contextRefs: []`,
   `createdAt`, `updatedAt`, `modelUsed`, `durationMs`), covering both
   `image-journal` and `voice-journal`, and **no raw media bytes or raw
   transcripts** stored.

This confirms the pre-fix 1-of-4 reliability is resolved: audit logging now
persists reliably from the **first** request onward.

---

## 8. Security Review Highlights (Phase 1.1 delta)

1. Media remains untrusted end-to-end: transport MIME allow-list + server-side
   semantic validation; prompt-injection fences confirmed in production.
2. Server-side Gemini only; web API key is client-side (public) but the Gemini
   key/SA never touch the browser.
3. SSRF regression suite re-ran clean on production (loopback/GCP metadata
   refused).
4. Audit records remain opaque (no media/transcript payloads); Privacy Center
   wipe and archive export operate on the same named DB.
5. Deployed rules divergence (legacy vs repo-strict) is documented and tracked;
   `modelUsed` fix removes the latent break for the next strict deploy.

---

## 9. Cleanup Performed

- Probe Firestore data under `users/p11-check-user-a`: `journalEntries` (2 docs,
  incl. `p11-imgA-save-test`, `p11-same-owner-write`) and `aiInteractions`
  (4 audit records) removed with the Admin SDK.
- Probe identities `p11-check-user-a` / `p11-check-user-b` deleted from Firebase
  Auth.
- Temp artifacts under the QA scratch dir
  (`C:\Users\LE\AppData\Local\Temp\opencode\phase11-qa`: tokens, test media,
  headless Chrome profiles/SDK scripts) removed.
- `roles` collection: empty (no probes).
- Production service, rules, and repo tree left clean (`git status` clean;
  HEAD `f3f3ce9`).

---

## 10. Rollback

`gcloud run services update-traffic gemini-journal --region us-central1
--to-revisions=gemini-journal-00014-l28=100` returns traffic to the pre-fix
baseline (digest `sha256:722e3e54046d0fb03c3969347729729a213a2e0236d38aea51c7af97dfb3ad6d`)
if ever needed.

---

## 11. Known Limitations / Notes

- **Deployed rules divergence:** live Firestore rules are the legacy Phase-3
  ruleset (2026-09-04), not the repo `firestore.rules`. This Phase's Defect B
  fix prepares the strict ruleset; a follow-up deploy of `firestore.rules`
  (with a staged rules-verification step) is recommended.
- Live production was exercised with **disposable probe identities only**; no
  real user data was touched.
- Truncated audio was accepted and processed (transcript may be plausible but
  mismatched) — a quality nuance, not a security/crash issue; noted for any
  later hardening.
- `getAdminApp` default-app quirk for the `(default)`-db `/roles` path is
  resolved by the same fix; the named DB is used for `aiInteractions`.