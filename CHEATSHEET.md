# Development & Operations Cheatsheet

Quick reference for working on **Gemini Journal & Reflections Studio**. See `README.md` (deployment/verification) and `feature.md` (feature deep-dive).

---

## 1. Common Commands

```bash
npm install              # install dependencies
npm run dev              # start dev server (Express + Vite middleware) on :3000
npm run lint             # TypeScript type-check (tsc --noEmit)
npm run e2e              # synthetic E2E suite — admin RBAC + notifications (22 tests)
npm run build            # production build (vite build + server bundle to dist/)
npm start                # run the production server (node dist/server.cjs) on :3000
```

> **Environments**: `.env` then `.env.local` are loaded in that order (server-side only). Vite env vars must be `VITE_`-prefixed. Never commit `.env*` or `sa-keys/` (gitignored).

---

## 2. Environment Variables

| Variable | Side | Required | Purpose |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | server | ✅ | Gemini API key (Secret Manager on Cloud Run) |
| `APP_URL` | server | – | Hosted URL (OAuth callbacks / self-links) |
| `VITE_FIREBASE_PROJECT_ID` | client | ✅ | Firebase project id |
| `VITE_FIREBASE_APP_ID` | client | ✅ | Firebase web app id |
| `VITE_FIREBASE_API_KEY` | client | ✅ | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | client | ✅ | `<project>.firebaseapp.com` |
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | client | ✅ | Custom Firestore database id |
| `VITE_FIREBASE_STORAGE_BUCKET` | client | – | Storage bucket url |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | client | – | Firebase sender id |
| `GOOGLE_MAPS_API_KEY` | server | * | Places autocomplete/details (server proxy) |
| `VITE_GOOGLE_MAPS_CLIENT_ID` | client | * | Maps JS API key (map preview) |
| `ADMIN_EMAILS` | server | * | Comma-separated admin allow-list |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | server | * | Admin SDK service-account JSON (default `sa-keys/firebase-admin.json`) |

`*` = required only if that feature is enabled. ReCAPTCHA/App Check: `VITE_RECAPTCHA_SITE_KEY`, `VITE_APPCHECK_DEBUG_TOKEN`.

---

## 3. Model Fallback Ladder

Preference order (first success wins; 2 attempts per model on transient 503s, 30 s timeout):

```
gemini-3.7-flash   ← first choice
gemini-3.6-flash
gemini-3.5-flash
gemini-flash-latest  (contended alias, high 503 rate)
gemini-3.1-flash-lite (last resort)
```

- Fatal on `API_KEY_INVALID` (no fallback — config problem, not capacity).
- **Client timeout**: 60 s on `/api/gemini/reflect`.

---

## 4. API Endpoints

| Method | Path | Auth | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/api/health` | none | `{ status, geminiKeyConfigured, mapsKeyConfigured }` |
| POST | `/api/gemini/reflect` | none* | Runs fallback ladder; `{ prompt, mode, title, location?, history? }` → `{ reply, summary, tags, modelUsed }`. **Rate limited** 30 req/min/IP. Prompt capped at 12,000 chars. |
| POST | `/api/google/places/autocomplete` | none* | Places proxy → `{ suggestions }` |
| POST | `/api/google/places/details` | none* | Places detail → `{ lat, lng, placeName, address }` |
| POST | `/api/admin/seed-role` | Bearer token | Returns `{ isAdmin }` from `ADMIN_EMAILS` allow-list |
| GET | `/api/admin/users` | Bearer token + admin | User listing (Admin SDK) |
| POST | `/api/admin/roles` | Bearer token + admin | `{ targetUid, role: 'admin'\|'user' }` via Admin SDK |
| GET | `/api/notifications/settings` | Bearer token | User Slack/Discord settings |
| PUT | `/api/notifications/settings` | Bearer token | Save settings |
| POST | `/api/notifications/test` | Bearer token | Send test webhook |

`*` = no bearer token, but server-side hardening applies (rate limit, payload caps, key-only outbound call).

---

## 5. Firestore Schema

```
/users/{userId}                            ← user doc (isOwner guard)
/users/{userId}/interactions/{interactionId}
  { id, userId, title, mode, messages[], summary?, tags[]?, modelUsed?,
    location? { lat, lng, placeName, address? }, createdAt, updatedAt }
/users/{userId}/settings/notifications     ← { enabled, notifyOn[], slackWebhookUrl?, discordWebhookUrl? }
/roles/{uid}                               ← { role, assignedBy, assignedAt } — client writes DENIED
```

Security rules: owner-only access via `request.auth.uid == userId`; interaction writes validated by `isValidInteraction`; `/roles` writes are `false` for all clients.

---

## 6. Deployment

### Firestore rules
```bash
firebase deploy --only firestore:rules
```

### Cloud Run
```bash
gcloud services enable run.googleapis.com secretmanager.googleapis.com firestore.googleapis.com
gcloud run deploy gemini-journal-reflections \
  --source . --platform managed --region us-central1 --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" --port 3000
gcloud run services update gemini-journal-reflections \
  --update-labels=dev-tutorial=cloud-run-ai-challenge --region=us-central1
```

### Firebase Hosting (static + API rewrite)
`firebase.json` rewrites `/api/**` to the `gemini-journal` Cloud Run service and everything else to `/index.html`.

```bash
npm run build
firebase deploy --only hosting
```

### Secret Manager
```bash
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 7. Troubleshooting & Gotchas

| Symptom | Likely cause / fix |
| :--- | :--- |
| 500 "GEMINI_API_KEY environment variable is not configured" | Key missing in `GEMINI_API_KEY` (or Cloud Run secret) |
| All models exhausted | Check quota/model availability; ensure `API_KEY_INVALID` isn't the error (that one is fatal immediately) |
| 429 "Too many requests" | Rate limiter hit (30 req/min) — wait and retry |
| Google sign-in popup fails | Provider/domain not enabled in Firebase console; try **Instant Demo Mode** or open in a new tab |
| Maps preview blank | `VITE_GOOGLE_MAPS_CLIENT_ID` missing; Places autocomplete needs `GOOGLE_MAPS_API_KEY` on the server |
| Webhook dispatch silently skipped | URL must be `*.slack.com` / `*.discord.com` (SSRF guard) |
| Type-check errors | `npm run lint`; watch for `currentMessages` redeclaration in `JournalEditor.tsx` |
| Bundle is big | Vendor chunks (`react`/`firebase`/`markdown`/`icons`) are split and cached — expected |
| E2E mock webhooks fail | Tests target `127.0.0.1` — loopback is allow-listed in the webhook guard |

---

## 8. Quick Feature Map (files)

| Area | File(s) |
| :--- | :--- |
| App shell / auth routing | `src/App.tsx` |
| Journal editor & composer | `src/components/JournalEditor.tsx` |
| History sidebar + stats | `src/components/HistorySidebar.tsx` |
| Landing page | `src/components/AuthLanding.tsx` |
| Security modal (8 zones) | `src/components/ThreatModelModal.tsx` |
| Delete confirmation | `src/components/ConfirmDialog.tsx` |
| Notifications UI | `src/components/NotificationSettings.tsx` |
| Admin dashboard | `src/components/AdminDashboard.tsx` |
| Firebase/Auth/Firestore services | `src/services/{firebase,auth,firestore,data,ai,toast}.ts` |
| Types | `src/types/index.ts` |
| Express server (API, Gemini, auth, webhooks) | `server.ts` |
| Firestore rules | `firestore.rules` |
| Build config | `vite.config.ts`, `package.json`, `firebase.json`, `Dockerfile` |
| Feature docs | `feature.md` |