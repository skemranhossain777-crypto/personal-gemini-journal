# PROJECT STATE — JOURNAL∞ (Gemini Journal & Reflections)

- **Repo:** `D:\Apersonontherun\Google-Programmed\gemini-journal-reflections`
- **Date of inspection:** 2026-09-05
- **Governing spec:** `Project Instruction/Personal Gemini Journal - Master Vibe Coding Instruction.md` (JOURNAL∞ — "Write your life. Understand yourself. Remember what matters."; loop: CAPTURE → UNDERSTAND → REMEMBER → REFLECT → ACT → CAPTURE AGAIN)
- **Purpose of this pass:** Full repository inspection only. **No application code was modified or deleted** during this review. One new file was added: this document (`docs/PROJECT_STATE.md`).
- **Scope rule:** Anything not verifiable from the repo, live deployment, or GCP/Firebase inspection is marked **UNKNOWN**. No assumptions were filled in.

---

## 1. Current Architecture

### 1.1 Runtime topology

```
Browser (React 19 SPA, static assets)
   │
   ├─ Express server (Node 22, node:22-slim) on :3000
   │     • serves dist/ (production) or Vite middleware (dev)
   │     • API: /api/health, /api/gemini/reflect, /api/google/places/*,
   │            /api/admin/*, /api/notifications/*
   │     • Firebase Hosting rewrites  /api/**  → Cloud Run "gemini-journal" (us-central1)
   │     • Hosting rewrite            /**     → index.html (SPA fallback)
   │
   ├─ Firebase Auth (Google provider only) → UID-scoped Firestore
   │     • Firestore doc path: /users/{userId}/interactions/{interactionId}
   │     • Demo mode: clients with uid prefix "demo-" use localStorage, NOT Firestore
   │
   └─ Gemini API: called ONLY server-side (env/Secret Manager GEMINI_API_KEY)
```

- Hosting live site: `https://gen-lang-client-0345619653.web.app`
- Cloud Run service `gemini-journal`, region `us-central1`
  - Canonical URL (from `gcloud`): `https://gemini-journal-s7hw7hui2q-uc.a.run.app` (HTTP 200 verified)
  - Regional URL also serves: `https://gemini-journal-618285014094.us-central1.run.app` (HTTP 200 verified)
  - Latest live revision: `gemini-journal-00005-czm`
  - Env injected at runtime: `GEMINI_API_KEY` (Secret Manager, key name `GEMINI_API_KEY`, version `latest`) and `VITE_FIREBASE_PROJECT_ID`. All other `VITE_*` config is baked at build time / falls back to the committed client config (see 1.4).

### 1.2 Frontend (`src/`)

- **Framework:** React 19.0.1 + TypeScript (~5.8.2) + Vite 6.2.3 (ES2022, bundler resolution, `@/*` → repo root).
- **Styling:** Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config` file). Design system is in `src/index.css`: page bg `#070B16`, panels `#0E1730`/`#15224A`/`#17254F`, borders `#223056`, accent sky-400/600, success emerald, danger red; custom scrollbars, `::selection` sky tint, `:focus-visible` sky outline, `prefers-reduced-motion` guard, and keyframe utilities (aurora, float, shimmer, typing-dots, progress-fill, slide-down-in, pulse-soft, pop-in, spin-slow).
- **State/services** (`src/services/`):
  - `firebase.ts` — lazy singletons; falls back to `firebase-applet-config.json` when `VITE_*` build vars are absent.
  - `auth.ts` — pub/sub auth service; Google popup/redirect; demo user (`demo-user@example.com`, uid `demo-...`).
  - `ai.ts` — client wrapper for `POST /api/gemini/reflect`, 60s timeout, typed errors.
  - `firestore.ts` — Firestore CRUD for interactions; full demo (localStorage) mode; offline detection (`navigator.onLine`).
  - `data.ts` — local-first cache layer (`gemini_journal_local_store_v1`).
  - `toast.ts` — pub/sub toast bus.
- **Components** (`src/components/`): `App.tsx` (view router: loading/landing/dashboard; skip-link, offline banner, CommandPalette, Toaster, reduced-motion config), `JournalEditor.tsx` (4 mode tabs, `MAX_CHARS 12000`, autosave + save states, char bar, typing dots, export), `HistorySidebar.tsx` (in-memory search over title/summary/tags/content, mode filter, skeletons, delete), `Navbar.tsx` (logo, Shield/ThreatModel, Bell/NotificationSettings, Admin Badge/Dashboard, Plus, LogOut, Ctrl+K hint), `AuthLanding.tsx`, `LocationPicker.tsx` (Google Maps JS API + Places autocomplete, static map preview), `CommandPalette.tsx` (Ctrl+K, combobox), `Modal.tsx` (focus trap, ARIA), `Toaster.tsx`, `ConfirmDialog.tsx`, `AdminBadge.tsx`, `ThreatModelModal.tsx`, `NotificationSettings.tsx`, `AdminDashboard.tsx`, plus `hooks/useFocusTrap.ts` and `lib/animations.ts`.
- **Types** (`src/types/index.ts`): verified complete — `ReflectionMode` = `reflect | summarize | brainstorm | chat`; `JournalInteraction`, `JournalMessage`, `JournalLocation`, `ReflectApiResponse`, admin/RBAC types, notification types.
- **Bundling:** `vite.config.ts` manualChunks for react/firebase/markdown/icons; chunk warning limit 800 kB; `DISABLE_HMR` watch toggle.

### 1.3 Backend (`server.ts`, repo root, 843 lines)

- Express 4.21.2, `express.json({ limit: '2mb' })`.
- Security headers on every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer-when-downgrade`, `Permissions-Policy` (camera/mic/geolocation/payment/usb all disabled). CSP intentionally omitted (documented rationale: SPA relies on inline styles / Vite runtime).
- In-memory per-IP rate limiter on the Gemini endpoint: 30 req / 60 s → HTTP 429. Map cleanup every 5 min. Not distributed — per-instance only.
- Routes:
  - `GET /api/health`
  - `POST /api/gemini/reflect` (rate-limited): calls GoogleGenAI with a 5-model fallback ladder (`gemini-3.7-flash` → `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-flash-latest` → `gemini-3.1-flash-lite`); returns reply + 1-line summary + 3–5 tags + `modelUsed`. Prompt sanitization: user text treated as passive plain data.
  - `POST /api/google/places/autocomplete`, `POST /api/google/places/details` (server-side `GOOGLE_MAPS_API_KEY`; client uses a separate referrer-restricted Maps JS key — dual-key isolation).
  - `GET /api/admin/users`, `POST /api/admin/seed-role`, `POST /api/admin/roles` (Firebase ID-token verification + `ADMIN_EMAILS`-based admin check server-side; no client role toggling).
  - `GET /api/notifications/settings`, `PUT /api/notifications/settings`, `POST /api/notifications/test` (Slack/Discord webhooks dispatched server-side only; SSRF guard; webhook URLs never returned to the client after save).
- Dev vs prod: Vite middleware when `process.env.NODE_ENV !== 'production'`, else static `dist/` with SPA fallback (`app.get('*', ...)`).
- Env loading: dotenv `.env`, then `.env.local` (overrides); Cloud Run/Secret Manager take precedence.

### 1.4 Firebase / Firestore / Auth

- Project: `gen-lang-client-0345619653` (project number 618285014094).
- Custom Firestore database: `ai-studio-geminijournalref-07d208be-ffdc-41ac-9ad4-a205122972b6` (not `(default)`).
- **Data model:** Phase 3 added an owner-scoped data layer — see `docs/DATA_LAYER.md` and `src/data/`. Live/shipping model remains the single `JournalInteraction` entity (see "Existing Features"); the new `users/{uid}/{journalEntries,conversations,insights,memories,timelineEvents,goals,habits,collections,notifications,aiInteractions,settings}` collections are implemented, type-checked, unit-tested, and security-rule-tested but **not yet wired into the UI**. Legacy `interactions` subcollection preserved and still serving. `roles/{uid}` is read-only for its owner; writes are server-only.
- Firestore rules (`firestore.rules`, `rules_version = '2'`): owner-scoped — `request.auth.uid == userId` at `/users/{userId}` and descendant `/**`; helper functions `isOwner`, `isMessage`, `isValidInteraction` enforce the bounds above and reject forged `userId`.
- Auth: Google sign-in only. All reads/writes UID-scoped. Users with `demo-` uid prefix live entirely in localStorage.
- Client config: `firebase-applet-config.json` committed as fallback (builds on Cloud Run get no `VITE_*` args); contents are public by design (apiKey/appId/oAuthClientId for Google sign-in).

### 1.5 AI integration

- `@google/genai` server-side only. `GEMINI_API_KEY` from env / Secret Manager. Client never touches the key (stored in Secret Manager on Cloud Run, key name `GEMINI_API_KEY:latest`).
- Reflect endpoint produces: prose reply, 1-line summary, 3–5 tags, model used; store into the interaction.

### 1.6 Deployment config

- `Dockerfile`: node:22-slim, 2-stage (`npm ci` → build → `npm ci --omit=dev`); VITE build args via `ARG/ENV`; EXPOSE 3000; `CMD node dist/server.cjs`.
- `firebase.json`: hosting `public` → `dist`; rewrites `/api/**` → Cloud Run `gemini-journal` us-central1; `**` → `index.html`.
- `.firebaserc`: default project `gen-lang-client-0345619653`; Cloud Run service used by Hosting rewrites: `gemini-journal`.
- `firestore.indexes.json`: empty arrays (no composite indexes declared). Firestore query needs beyond single-field scans are met today with in-memory filtering.
- `.gitignore`: ignores `node_modules`, `dist`, `.firebase`, logs, `.env*` (except `.env.example`), `sa-keys/`.
- `.dockerignore`: excludes envs, dist, node_modules, .git, logs, README, etc.
- Build tooling: Vite for client; server compiled to single `dist/server.cjs` (esbuild via package scripts). Both `package-lock.json` and `bun.lock` present.

### 1.7 Docs / supporting files present

- `README.md` (architecture + 8-zone threat model overview), `CHEATSHEET.md` (commands/env table/deployment), `feature.md` (multi-turn reflections, 4 modes, structured metadata block, location pinning), `metadata.json` (declares `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`), `firebase-blueprint.json` (entity spec).

---

## 2. Existing Features (verified)

| Area | Status | Where |
|---|---|---|
| Landing page (aurora, feature cards) | ✅ | `AuthLanding.tsx` |
| Google sign-in + logout | ✅ | `auth.ts`, `Navbar.tsx` |
| Demo mode (localStorage, `demo-` uid) | ✅ | `firestore.ts` |
| Multi-turn journaling with AI | ✅ | `JournalEditor.tsx`, `/api/gemini/reflect` |
| 4 reflection modes (reflect/summarize/brainstorm/chat) | ✅ | `types`, `JournalEditor`, `ai.ts` |
| AI 1-line summary + 3–5 tags + model name | ✅ | reflect API + store |
| Autosave + save-state UI (saving/saved/error) | ✅ | `JournalEditor.tsx` |
| Single-entry Markdown export | ✅ | `JournalEditor.tsx` |
| History sidebar: list, search (in-memory), mode filter, delete | ✅ | `HistorySidebar.tsx` |
| Location pinning via Google Maps/Places (server proxy + referrer-restricted client key) | ✅ | `LocationPicker.tsx`, places routes |
| Command palette (Ctrl+K, combobox) | ✅ | `CommandPalette.tsx` |
| Accessibility: skip-link, focus trap, ARIA, reduced-motion guard | ✅ | `App.tsx`, `Modal.tsx`, `useFocusTrap.ts`, `index.css` |
| Offline banner | ✅ | `App.tsx` / `firestore.ts` |
| Admin dashboard + server-side RBAC (`ADMIN_EMAILS` seed, role assignment) | ✅ | `AdminDashboard.tsx`, admin routes |
| Slack/Discord webhook notifications (server-only dispatch, SSRF guard) | ✅ | `NotificationSettings.tsx`, notification routes |
| Security headers + rate limiter (30/min on Gemini) | ✅ | `server.ts` |
| Threat-model modal (8 zones, live rules preview) | ✅ | `ThreatModelModal.tsx` |
| E2E suite (admin RBAC + notifications, 22 tests) | ✅ | `e2e-test.ts` |

---

## 3. Missing Features (vs. the JOURNAL∞ spec) — Phase Map

Spec is 16 phases. Current build covers **Phase 1** (foundation/design) and **Phase 2** (auth) substantially; **Phases 3 and 4** are partial; the rest are not started.

| Spec phase | Requirement | Current state |
|---|---|---|
| 3. Journal engine | **10 capture modes** (spec lists dedicated modes beyond Q&A chat) | ❌ Only 4 modes today (`reflect/summarize/brainstorm/chat`) |
| 3. Journal engine | Per-entry **mood / energy** scoring | ❌ Absent |
| 3. Journal engine | Per-entry **tags** (auto + user-editable) | ⚠️ 3–5 AI tags exist, not user-editable |
| 3. Journal engine | **Collections** / favorites / archive / private flags | ❌ Absent |
| 3. Journal engine | Autosave drafts | ⚠️ Autosave exists; versioned draft snapshots not verifiable |
| 3. Journal engine | Save-state fidelity & offline queue | ⚠️ Save states exist; offline write queue not verifiable |
| 3. Journal engine | AI-generated **editable** metadata | ❌ Metadata is auto-only |
| 3. Journal engine | Full entry CRUD (edit/archive/restore/export) | ⚠️ Create/read/delete exist; no update-with-metadata, archive, restore |
| 4. Companion | All spec'd companion capabilities (asking questions back, etc.) | ⚠️ Only reflect/summarize/brainstorm/chat; not the full capability set |
| 5. Memory engine | Long-term memory / highlights / patterns | ❌ Not started |
| 6. Ask My Life | Natural-language Q&A over history | ❌ Not started |
| 7. Timeline | Chronological browsing/calendar insights | ❌ Not started (sidebar is in-memory list only) |
| 8. Goals & habits | Goal tracking derived from entries | ❌ Not started |
| 9. Voice/media | Voice notes, media attachments, more location depth | ❌ Location only |
| 10. Privacy center | Export/delete/privacy controls | ⚠️ Export stub only; no privacy center |
| 11. Search | Engineered search over entries | ❌ Not started (in-memory filter only) |
| 12. (per spec misc) | Demo data, guidance, polish | ❌ No demo seed data verified (only runtime "demo user") |
| 13–16 | Deploy/verify/harden/docs | ✅ Deployed & verified live; **no automated Firestore-rules tests**; screenshots/demo assets not verified |

**Key blocker for Phases 3–11:** the current schema expresses a chat interaction, not a journal entry. The spec fields (mood, energy, collections, favorite, archive, private, editable metadata, 10 modes) cannot be represented without an additive data-model change (e.g., a new `journalEntries` collection alongside `interactions`). Future phases (5–9, 11) also require this richer model.

---

## 4. Technical Debt

1. **Interaction-model ceiling** — the entire spec gap above stems from one narrow entity. Additive extension needed; do not rewrite working paths.
2. **Single 843-line `server.ts`** at repo root — no `server/` module split; growing routes will be hard to test/maintain.
3. **`public/assets/aistudio/.gitignore`** containing `*` is a stray stub (leftover export artifact); benign, but noise.
4. **No unit / component tests besides the data layer** — `src/data/**` now has 80 unit tests and the rules suite has 124 emulator-backed tests, but the React UI remains untested.
5. **`Bun` + `npm` both in use** (`bun.lock` and `package-lock.json`); lockfile divergence risk.
6. **Empty `firestore.indexes.json`** — intentional: the current CRUD lists use single-field ordering only; composite indexes are documented as anticipated in `docs/DATA_LAYER.md` and should be added + deployed when timeline/search query features land.
7. **CSP omitted** — documented, but re-evaluating for production hardening is expected for later phases.
8. **Rate limiter is per-instance, in-memory** — Cloud Run autoscaling resets it per container; not a shared quota.
9. **Meta/product naming drift** — package name `react-example`, product title "Gemini Journal & Reflections" vs spec name "JOURNAL∞"; minor consistency task later.
10. **Auth demo path** (`demo-` uid) grows alongside real features — contains logic duplicated by the Firestore path in `firestore.ts`.

---

## 5. Security Risks (current state)

| Risk | Current mitigation | Gap / note |
|---|---|---|
| Prompt injection via entries | User text treated as data; system instruction isolation | No injection test; indirect-injection surface grows as more history feeds prompts in later phases |
| Gemini key exposure | Server-only, Secret Manager | ✅ |
| Cross-user Firestore access | Owner-UID rules + server-side checks | Rules deployed state **UNKNOWN** (file reviewed; last `firebase deploy` of rules not independently verified) |
| Quota theft on Gemini | Per-IP rate limit (30/min) | Per-instance only; add CDN/load-balancer-level limiting before public scale |
| Places API abuse | Dual-key split (server key + referrer-restricted client key) | ✅ |
| Admin escalation | `ADMIN_EMAILS` + server-verified ID token + 22 E2E tests | Managing roles requires server redeploy w/ env; no admin audit log |
| Webhook abuse / SSRF | Server-only dispatch, SSRF guard, URLs never returned after save | E2E covers test+save; live Slack/Discord delivery not verifiable from repo |
| Secrets in git | `.env*` & `sa-keys/` gitignored | Local file `sa-keys/firebase-admin.json` exists (service-account JSON) — validity/rotation **UNKNOWN**; never commit/print |
| Known public client config | `firebase-applet-config.json` committed by design | Ensure no server-bearing secrets are ever added there |
| CORS/CSP | Headers set; CSP intentionally off | Revisit for production hardening |
| Admin SDK usage | Server-side `firebase-admin` (SA key) | If the local SA is promoted to prod credentials, rotate + use Secret Manager |

---

## 6. Deployment Risks

1. **Rules/index drift** — no **CI** validates `firestore.rules` / `firestore.indexes.json` against the deployed database, though the rules are now verified against the emulator locally (`npm run test:rules`, 124 tests). Deployed rules/index state still needs verification before/after the next `firebase deploy`.
2. **Env baked vs injected** — Vite build vars use baked ARG/ENV fallback; if `firebase-applet-config.json` ever drifts from real Firebase config, builds deploy a broken auth config. No build-time assertion.
3. **Hosting ↔ Cloud Run coupling** — Hosting rewrites `/api/**` to service `gemini-journal`; a rename or region change breaks all API calls. No canary/rollback plan documented.
4. **No CI/CD** — deploys are manual (`gcloud run deploy`, `firebase deploy --only hosting`). History is good, but every manual deploy risks drift.
5. **Two live hostnames for the same service** — both `*.run.app` URLs return HTTP 200; ensure any future domain mapping/custom domain points at the canonical service URL.
6. **package-lock vs bun.lock divergence** — `npm ci` in Dockerfile is reproducible only if lockfile matches; favor one package manager.
7. **Secret rotation** — `GEMINI_API_KEY:latest` + SA key have no documented rotation schedule.
8. **No backup/export routine** for Firestore contents beyond per-entry MD export.

---

## 7. Test Coverage

- ✅ `src/data/**` unit suite: **80 tests** (`npm test`) — paths, pagination, errors, validation (all collections incl. settings flag maps), generic CRUD (auth scoping, demo-session refusal, caller-supplied `uid` rejection, validation-on-write, unsafe ids).
- ✅ **Journal engine + UI suites:** `src/journal/` (draft engine, stores, attachments) and `src/pages/journal/` + `src/components/journal/` (React Testing Library incl. axe a11y checks) — **130 tests total** across 14 files (`npm test`), incl. the never-lose-newest-text and crash-recovery guarantees.
- ✅ **Firestore rules emulator suite:** **124 tests** in `tests/rules/security_rules.test.ts` (`npm run test:rules`) — owner/non-owner/unauthenticated matrix, update-bypass attempts (uid rewrite, immutable-key tamper), malicious/oversized/reserved/path-separator ids, collection traversal probing, cross-account isolation, legacy interactions + roles. Emulator limitation handled: rules use bounded-size + index-probe validators (no `.all()`).
- ✅ **Journal engine integration suite (emulator):** **7 tests** in `tests/integration/journalEngine.integration.test.ts` — real crud-seam store + DraftEngine against Firestore (server timestamps, rapid-edit coalescing, in-place update, crash recovery, server adoption, re-create, list order). Runs under its own `demo-journal-integration` project so parallel `clearFirestore()` can't race the rules suite.
- ✅ `e2e-test.ts` (22 tests, `npx tsx e2e-test.ts`): admin RBAC (401s, 403s, seed-role, roles, invalid role, missing targetUid), notifications settings CRUD + test dispatch (Slack/Discord/invalid/missing params), location-context unit check. Uses a **mock** token verifier + in-memory "Firestore" + local webhook receivers — no live GCP.
- ❌ No coverage of `/api/gemini/reflect` (no live-key test), Places routes, or any React component.
- ✅ Manual prod smoke: `/api/health` HTTP 200 via web.app rewrite; both `.run.app` URLs 200; hosting bundle served post-`3be1bbd`.

---

## 8. Recommended Implementation Order

Follow the spec phase discipline: **do not skip phases; do not implement future phases early; no architecture rewrites without a documented reason.**

1. **Phase 3 — Journal engine (in progress).** The additive `journalEntries` data model + rules + validation exist (`src/data/`, verified by 80 unit + 124 rules tests), and the engine now ALSO has a wired, tested UI + local-first autosave layer: `src/journal/` (draft engine with localStorage mirror, retry/backoff, crash recovery, Firestore + demo stores), journal components/pages (`#/journal`, `#/journal/:id`, `#/journal/new`), 7 emulator-backed integration tests, and 130 unit/RTL tests incl. axe a11y. Remaining: live deploy + manual verification of the new UI. Keep `interactions` working (done — legacy matches preserved in rules, no removal/replacement).
2. **Phase 4 — Companion.** Expand AI capabilities on top of the new entry model (mode-specific prompts, editable AI metadata, safe context windows).
3. **Phase 5 — Memory engine** (highlights/patterns from entries).
4. **Phase 6 — Ask My Life** (natural-language Q&A over history).
5. **Phase 7 — Timeline** (calendar/chronological views; declare + deploy Firestore indexes).
6. **Phase 8 — Goals & habits.**
7. **Phase 9 — Voice/media** (extend from today's location-only).
8. **Phase 10 — Privacy center** (export everything, delete account/data).
9. **Phase 11 — Search.**
10. **Cross-cutting hardening (after core phases):** Firestore security-rule tests via emulator; CI/CD; shared rate limiting; CSP decision; secret rotation + SA key policy; unit/component tests; consolidate package manager; resolve metadata/product naming per spec; remove stray `public/assets/aistudio` stub.

Anything in the open risk tables (e.g., deployed-rules verification, SA-key rotation) should be closed as part of the phase in which it first becomes reachable.

---

## 9. Verification / UNKNOWN items

- Deployment of `firestore.rules`/indexes to the custom database: **UNKNOWN** (files reviewed only).
- `GEMINI_API_KEY` value / quota / billing state: **UNKNOWN** (secret; end-to-end reflect call not run this pass).
- `sa-keys/firebase-admin.json` validity, rotation, and whether it is used by any deployed service: **UNKNOWN** (never print/commit).
- Live Firestore content (counts, real user data): not queried this pass; client-side counts only.
- Whether the Firestore custom DB requires composite indexes for future queries: **UNKNOWN** until Phase 7/11 queries are implemented.
- Demo-data/screenshots assets for the spec's marketing phase: **UNKNOWN** (not present in repo).

---

## 10. READY_FOR_IMPLEMENTATION

✅ Repository inspection is complete. The architecture, existing features, missing features, technical debt, security risks, deployment risks, and recommended order are documented above.

🟢 **READY_FOR_IMPLEMENTATION** — authorized to begin **Phase 3 (Journal engine)** per the master spec: an **additive** journal-entries data model + rules + UI, implemented without deleting or replacing any existing functionality, verified end to end before any completeness claim.

> Awaiting explicit user confirmation before any implementation code is written.