# COMPETITION PHASE 1 — GENUINE MULTIMODAL JOURNALING (IMAGE & VOICE)

**Date:** 2026-09-09
**Application:** JOURNAL∞ — Personal Memory & AI Reflection Engine
**Competition:** Google Cloud Run AI Challenge
**Verdict:** `IMPLEMENTED & VERIFIED LOCALLY — PENDING DEPLOY`

---

## 1. Objective

Replace the **simulated** Voice Journal and Image Journal behavior with genuine,
server-side **Gemini multimodal processing** on Google Cloud Run, and integrate the
returned structured analysis into **editable journal drafts** (never silent
publication), with **audit logging** into the canonical `aiInteractions` collection
so the Privacy Center, archive export, and audit UI remain coherent.

Phase 0 (`docs/PHASE0_RELEASE_CHAIN_BASELINE.md`) locked the release chain and
production traceability (revision `00009-qsk` → image `sha256:89d15534…` → CI run
`34123137485` → commit `5776d6d`). Phase 1 builds on that baseline in the working
tree; **no deployment has happened yet** — this document records the change set and
the verification performed before commit/push/deploy.

---

## 2. What Was Fake (Pre-Phase 1) And What Replaced It

| Area | Before (Phase 0) | After (Phase 1) |
|---|---|---|
| Voice transcription | Mock/placeholder server path; client returned a canned string via framing | Real `POST /api/gemini/transcribe-voice` → Gemini audio `inlineData` → verbatim transcript + generated reflection |
| Voice "AI tags" | Client-side `setTimeout` that appended hardcoded tags (`reflection`, `mindfulness`, `voice`) | Removed entirely; tags/emotion/summary come from Gemini structured output |
| Voice draft | `transcript` was used verbatim as the body; `aiMetadata.transcript = v.body` (round-trip tautology) | Body = Gemini-written reflection (editable), raw transcript kept intact and separable; real `aiMetadata` (`modality`, `transcript`, `summary`, `emotion`, `suggestedTags`, `modelUsed`) |
| Image analysis | Client only rendered `visualAnalysis` panel; no draft integration | Server returns `body` + `summary` + `tags` + `emotion` + `modelUsed` + `visualAnalysis`; new "Use as Journal Draft" button pre-fills an editable entry |
| Upload copy | "Encrypting & Uploading Image..." (misleading) | "Uploading Image... Stored privately under your user account; analyzed in-flight with your authorized Gemini session" |
| Audit trail | Only best-effort text AI interactions | `logAiInteraction` server write into `users/{uid}/aiInteractions` (named database) for image/voice |

**Critical rule enforced:** there is **no fake multimodal path** left in production
flows. Demo users receive an explicit, clearly-labeled offline fallback
(`demo-unavailable` + "sign in to use Gemini") instead of a fabricated result.

---

## 3. Server — Transport & Upload Layer (`server.ts`)

### 3.1 Multer in-memory upload
- `multer.memoryStorage()` — media is held in RAM, **never written to disk**.
- Limits: `fileSize = max(10MB, 25MB)` (mirrors `MAX_IMAGE_BYTES` / `MAX_AUDIO_BYTES`), `files: 1`, `fields: 4`.
- `fileFilter` enforces the exact allow-list of image MIME types
  (`image/jpeg|png|webp|gif|heic|avif`) and audio MIME types
  (`audio/webm|mp4|mpeg|wav|ogg|x-wav|mpeg3`). Everything else → structured 415.

### 3.2 Routes (both `verifyFirebaseToken` + `rateLimiter` gated)
- `POST /api/gemini/analyze-image` — single `image` field + optional `caption` (≤1000 chars).
- `POST /api/gemini/transcribe-voice` — single `audio` field + optional `language` hint.

Both:
1. Derive `uid` **only** from the verified token (`req.auth.uid`), never from client data.
2. Sanitize the uploaded filename via `safeMediaBasename` (informational only, never a path).
3. Call `GeminiService.processImageJournal` / `processVoiceJournal`.
4. Respond with `{ success: true, result }` (the `MultimodalJournalOutput`).
5. Fire-and-forget `logAiInteraction(...)` on success.
6. On error: sanitized `logCloudFormat` log (no full error objects), honest
   production message ("Failed to analyze image"/"Failed to transcribe voice"),
   status passthrough, and `code: MODEL_MODALITY_UNSUPPORTED` passthrough when the
   model genuinely cannot process the modality.

### 3.3 Centralized error handler
A final 4-arg `app.use((error, …))` normalizes:
- Multer file-filter rejection → **415** "Unsupported media type …"
- `LIMIT_*` errors → **413** ("Uploaded media exceeds the allowed size limit.")
- Structured errors with a `.code` string → their own `status` (default 400),
  generic message in production.
- Everything else → **500** JSON (no stack leak).

### 3.4 Security-leaning headers
`Permissions-Policy` now allows the app origin for camera/mic
(`camera=(self), microphone=(self)`) — required for `MediaRecorder` on the same
origin; geolocation/payment/usb remain blocked.

---

## 4. Server — Gemini Multimodal Engine (`server/gemini/service.ts`)

- `generateMultimodal(contents, systemInstruction, temperature, config)` — the
  multimodal variant of `generateWithFallback`, running the **model fallback
  ladder** (`gemini-3.6-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest`
  → `gemini-3.7-flash`) with a per-attempt timeout.
- **Modality-unsupported detection:** if a candidate model reports it does not
  support the media type, the request **fails honestly** with
  `MODEL_MODALITY_UNSUPPORTED` (400) instead of advancing to a model that would
  silently produce a fake result or dropping the media.
- Non-recoverable errors (`INVALID_INPUT`, `OVERSIZED_INPUT`,
  `PROMPT_INJECTION`, invalid/revoked API key) throw immediately without fallback.
- `processImageJournal`/`processVoiceJournal` request structured JSON
  (`responseMimeType: application/json`) with explicit grounding rules, the
  `<UNTRUSTED_USER_CONTENT>` prompt-injection fence, and an anti-fabrication
  mandate, then parse/validate via `parseAndValidateJson` into a
  `MultimodalJournalOutput`.

### Output shape (`MultimodalJournalOutput`)
```ts
{
  body: string;          // first-person journal body (2-5 sentences)
  summary: string;       // ≤ ~30-word summary
  tags: string[];        // 3-5 lowercase tags, capped 8
  emotion: string;       // short emotional descriptor
  modelUsed: string;
  transcript?: string;                 // voice only (verbatim)
  visualAnalysis?: {                   // image only
    observed: string[];
    userProvided: string[];
    aiInferred: string[];
  };
}
```

---

## 5. Client — Voice Flow (GAP 2 closed)

- `src/services/voiceTranscription.ts` — `TranscriptionResult` extended with
  `body`, `summary`, `tags`, `emotion`, `modelUsed`. Live response maps the server
  result (with per-field fallbacks); demo path returns an explicit labeled
  fallback; error mapping keeps typed `VoiceTranscriptionError` kinds
  (`empty-audio`, `duration-exceeded`, `network-error`, `transcription-failed`).
- `src/components/journal/VoiceJournalView.tsx`
  - **Removed** the fake `handleGenerateAiMetadata`/`setTimeout` "Generate AI Tags".
  - Review state now seeds `draftBody` from the Gemini reflection, stores
    `voiceResult`, and offers:
    - **Use Transcript / Use Reflection** toggle (swap body source at any time);
    - **Show raw transcript** collapsible;
    - emotion chip + summary banner;
    - audio-attach privacy control unchanged (raw audio discarded by default).
  - `onSaveDraft` now emits `VoiceDraftPayload` with a full `aiMetadata`
    (`modality: 'voice'`, `transcript`, `summary`, `emotion`, `suggestedTags`, `modelUsed`).
- `src/pages/journal/EntryEditor.tsx` — `handleVoiceDraft` accepts the new payload
  and stamps real `aiMetadata` (previously it fabricated `summary = body.slice(0,500)`
  and `transcript = body`).

---

## 6. Client — Image Flow (GAP 1 closed)

- `src/services/imageJournaling.ts` — `ImageContextOutput` extended with `body`,
  `summary`, `tags`, `emotion`, `modelUsed`. `analyzeImageContext` maps the server
  result (with fallbacks) and keeps the anti-fabrication disclaimer.
- `src/components/journal/ImageJournalView.tsx`
  - New **ImageDraftPayload** + `onUseDraft` prop.
  - Analysis panel now shows a **GEMINI REFLECTION** block: emotion/model chips,
    the generated body, summary, tags, and a **"Use as Journal Draft"** action
    ("nothing is published until you save it").
  - Honest upload copy (see §2).
- `src/pages/journal/EntryEditor.tsx`
  - New top-level **Image Journal** toggle (parity with Voice Journal), rendering
    `ImageJournalView` with `onUseDraft={handleImageDraft}`.
  - New `handleImageDraft` pre-fills title, body, tags (`image-journal` ∪ AI tags),
    and `aiMetadata` (`modality: 'image'`, summary, emotion, suggestedTags, modelUsed).
  - The redundant details-section copy of `ImageJournalView` was removed.

---

## 7. Structured Metadata & Model Alignment

- `src/data/models.ts` — `AiMetadata` gained `modelUsed?: string`.
- `src/journal/types.ts`, `draftEngine.ts`, `store.ts` — `aiMetadata` flows from
  draft → persisted entry unchanged (Phase 0 already stamped `aiMetadata`).
- `src/data/validation.ts` — transcript bound raised from **12 000 → 120 000**
  chars, matching the rules (`isHumanCharCount(data, 1, 120000)`). A 5-minute
  voice memo can legitimately produce a transcript exceeding 12k chars; the old
  bound would have rejected valid entries.
- `firestore.rules` — `isAiMetadata` and skills lists already covered
  `modality`/`transcript` and `image-journal`/`voice-journal`; no rule change
  required for draft integration. (The rules file still carries the earlier
  review tweak in this working tree.)

---

## 8. Audit Logging — `aiInteractions` (named database)

`logAiInteraction(uid, skill, prompt, response, modelUsed?, durationMs?)`:
- Best-effort, **fire-and-forget**; failures log a WARNING and never fail the request.
- Server-authorized via **admin SDK** using
  `getFirestore(app, FIRESTORE_DATABASE_ID)` — targeting the **named** database
  that the client app, Privacy Center wipe, and archive export operate on
  (Phase 0's `getAdminFirestore()` uses the `(default)` database for `/roles`, a
  pre-existing quirk that does **not** apply here).
- Writes the rules-compatible record shape:
  `{ id, uid, skill, prompt, response, contextRefs: [], createdAt, updatedAt,
  modelUsed?, durationMs? }` with length caps (prompt ≤ 50k, response ≤ 100k).
- **Never stores raw media bytes or raw transcripts** — only short metadata and a
  one-line summary, so the audit collection stays lightweight and privacy-safe.
- Skills logged: `image-journal`, `voice-journal` (both already valid per
  `COMPANION_SKILLS` and rules `isValidAiInteraction`).

Because records land in the same named DB + owner-scoped path, the existing
Privacy Center **full wipe** and **archive export** remain coherent for Phase 1 data.

---

## 9. Dependency & Reproducibility Fixes

| Concern | Fix |
|---|---|
| `firebase-admin` had been pinned to `^14.3.0` (namespace `admin.firestore.Timestamp` / `getFirestore` breakage under v14 modular-only) | **Reverted to `^12.7.0`** (installed `12.7.0`; `getFirestore(app, databaseId)` confirmed in `lib/firestore/index.d.ts`) |
| `firebase-tools` had been pulled down to `^10.1.1` (audit-risky old toolchain) | **Reverted to `^15.25.1`**, `npm install` + `npx npm-audit-fix` cleared all high-severity findings |
| `multer` (in-memory upload) + types | Added `multer@^2.3.0`, `@types/multer@^1.4.13` |

`npm audit --audit-level=high` → **exit 0** (14 moderate advisories remain;
all fixes for them require breaking downgrades, per the CI gate policy).

---

## 10. Verification Performed (pre-commit)

| Gate | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | **PASS** (0 errors after `draftEngine.readRecord` narrowing fix + `filename` optional + `MODEL_MODALITY_UNSUPPORTED` code) |
| `npm test` (`vitest run`, 52 files) | **PASS — 390/390** |
| `npm run build` (`vite build` + `esbuild server.ts`) | **PASS** (client bundle + `dist/server.cjs`) |
| `npm audit --audit-level=high` | **PASS** (exit 0) |
| Server integration tests | `server/gemini/__tests__/multimodalRoutes.test.ts` covers both multimodal routes (auth, upload, success, and error JSON) |

Test additions/updates:
- `voiceTranscription.test.ts` — asserts `body/summary/tags/emotion/modelUsed`.
- `imageJournaling.test.ts` — asserts structured output fields.
- `VoiceJournalView.test.tsx` — asserts `onSaveDraft` payload carries the full
  `aiMetadata` (modality/transcript/summary/emotion/suggestedTags/modelUsed).
- `ImageJournalView.test.tsx` — asserts the reflection block renders and the
  "Use as Journal Draft" button invokes `onUseDraft` with body/summary/emotion/tags/modelUsed.

---

## 11. Security Review Highlights (Phase 1 delta)

1. **Media untrusted end-to-end** — MIME allow-list at transport (multer) + semantic
   validation server-side (`validateMultimodalMedia`), prompt-injection fence in
   every system prompt.
2. **Server-side Gemini only** — API key never touches the browser; the client
   forwards a verified ID token; `/api/gemini/*` is `verifyFirebaseToken` + `rateLimiter` gated.
3. **No secret in logs** — `logCloudFormat` + `safeLog` log message/metadata stubs only.
4. **Honest failures** — modality-unsupported gets a truthful client message and a
   dedicated code; no silent fake fallback.
5. **Audit records opaque** — no raw media/transcript in `aiInteractions`.
6. **Permissions-Policy** aligned with the app's own camera/mic usage only (`(self)`).

---

## 12. Deployment Plan (unchanged from Phase 0 pipeline)

1. Commit all changes on `master` with a Phase 1 message.
2. Push → CI `deploy.yml`: validate-and-test (npm ci, audit-high, typecheck, test, build) → build-and-scan-container (Trivy) → **staging** smoke → manual-approval **production** environment gate.
3. After approval, production service `gemini-journal` in `us-central1` deploys a new revision.
4. **Verify in production:**
   - `scripts/smoke-test.mjs` against `https://gemini-journal-s7hw7hui2q-uc.a.run.app` (or `APP_URL`).
   - Cloud Run logs: `[GeminiService …] Generation successful with model: …` for genuine runs; ERROR lines appear only for real failures and carry sanitized messages (never full error objects).
   - Manual QA: record a voice memo → editable reflection with transcript toggle + full `aiMetadata`; upload a photo → analysis panel → "Use as Journal Draft".
   - Firestore (named DB): spot-check `users/{uid}/aiInteractions` records exist for both skills.

---

## 13. Rollback

`gcloud run services update-traffic gemini-journal --region us-central1 --to-revisions=<previous>` — the Phase 0 baseline revision `00009-qsk` (image `sha256:89d15534b8e1db6a002e23ffef60a303a4374ebeb61efe71a4652aefa1336ba5`) remains the rollback target.

---

## 14. Known Limitations / Notes

- Recording uses `MediaRecorder` (`audio/webm` preferred, `audio/mp4` fallback);
  codec availability varies by browser — unsupported recordings surface honest errors.
- Demo sessions get the labeled offline fallback (by design; no credentials in the browser).
- `logAiInteraction` depends on admin credentials; in an environment without a
  service account it degrades to a WARNING log (request unaffected).
- 14 moderate advisories remain in `npm audit` (firebase-tools/admin transitive);
  resolving them requires breaking major downgrades and is intentionally deferred.
- The `(default)`-database quirk for the legacy `/roles` admin write is
  out-of-scope here and documented for follow-up.