# Gemini Journal & Reflections Studio

A secure, user-authenticated journaling and thought-partner web application powered by **Google Gemini 3.x Flash** (5-model fallback ladder) and **Google Cloud Firestore**, secured by **Firebase Authentication** with strict per-user document isolation and zero hardcoded credentials.

Docs: [**feature.md**](feature.md) catalogues the full feature set · [**CHEATSHEET.md**](CHEATSHEET.md) is the developer/ops quick reference.

---

## Architecture & Tech Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **User Identity** | Firebase Authentication | Secure login via Google Sign-In with federated authentication (no stored passwords). |
| **Backend Database** | Cloud Firestore | User-isolated document storage under `/users/{userId}/interactions/{interactionId}`. |
| **AI Processing Engine** | Gemini 3.x Flash API (5-model fallback ladder) | Generates replies, executive summaries, and proactive brainstorming suggestions. |
| **Secret Management** | Secret Manager / Env Vars | Securely stores `GEMINI_API_KEY` and Firebase credentials without exposing secrets. |
| **Server & Frontend** | Express + React + Vite | Unified full-stack server proxying AI requests and serving the SPA. |

---

## Agentic Threat Modeling (8 Threat Zones)

| Threat Zone | Identified Risk | Implemented Countermeasure | Verification Status |
| :--- | :--- | :--- | :--- |
| **1. Input Surfaces** | Malicious payloads, prompt injection, overlong buffers crashing servers. | Express strict JSON limit (2MB), defensive payload null-guards, prompt sanitization + **12k-char prompt cap**. | Enforced in Express backend (`server.ts`) |
| **2. Planning & Reasoning** | Indirect prompt injection tricking Gemini into executing unauthorized commands. | User inputs treated strictly as passive data; dedicated system instructions isolate reflection text. | Enforced in Gemini helper |
| **3. Tool Execution** | Model outages, 429 quota exhaustion, or 503 service downtime breaking app state. | Automated **5-model Fallback Ladder** (`gemini-3.7-flash` → `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-flash-latest` → `gemini-3.1-flash-lite`) + transient-503 retry + **per-IP rate limiter** (30 req/min). | Tested & active |
| **4. Memory & State** | Cross-user data leakage or unauthorized read/write of journal entries. | Owner-bound Firestore Security Rules (`request.auth.uid == userId`) + `isValidInteraction` shape validation + recursive undefined stripping. | Deployed to Firestore |
| **5. Inter-System Comm** | Exposing Gemini API key to client browsers or committing secrets to git. | Zero client-side secrets; Gemini calls run exclusively server-side via environment variables / Secret Manager; security headers on every response. | Strict server proxy |
| **6. Maps API Exposure** | Google Maps/Places API keys exposed client-side, enabling quota theft or abuse. | Places Autocomplete/Details proxied server-side with restricted `GOOGLE_MAPS_API_KEY`; client uses a separate Maps JS key with HTTP-referrer restrictions. | Dual-Key Isolation |
| **7. RBAC Privilege Escalation** | Regular users elevating to admin or accessing admin endpoints / other users' data. | `ADMIN_EMAILS` env allow-list; server verifies Firebase ID token + email on every admin request; `/roles` client writes are denied in rules; role writes only via Admin SDK. | Server-Side RBAC |
| **8. Webhook Credential Leakage** | Slack/Discord webhook URLs leaked or used to inject spam / SSRF requests. | Webhooks stored under user-isolated settings path; dispatched **server-side only** with host allow-listing (`*.slack.com`, `*.discord.com`, loopback) to block SSRF. | Server-Only Dispatch |

---

## 1. Firestore Security Rules

To ensure strict user data isolation, the application enforces owner-bound access control. Documents located at `/users/{userId}/interactions/{interactionId}` are only accessible when the authenticated user's UID matches the path.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    // Interaction shape + type/size validation (see firestore.rules for full version)
    function isValidInteraction(data) {
      return data is map
        && ('id' in data && data.id is string && data.id.size() <= 128)
        && ('userId' in data && data.userId is string && data.userId == request.auth.uid)
        && ('title' in data && data.title is string && data.title.size() <= 200)
        && ('mode' in data && data.mode is string && data.mode.size() <= 24)
        && ('messages' in data && data.messages is list
            && data.messages.size() <= 200 && data.messages.all(m is map));
    }

    match /users/{userId} {
      allow read, create, update, delete: if isOwner(userId);

      match /interactions/{interactionId} {
        allow read: if isOwner(userId);
        allow create, update: if isOwner(userId) && isValidInteraction(request.resource.data);
        allow delete: if isOwner(userId);
      }

      match /settings/{settingId} {
        allow read, write: if isOwner(userId);
      }
    }

    match /roles/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow create, update, delete: if false; // Admin SDK only — blocks self-assignment
    }
  }
}
```

The `/roles` collection deliberately denies all client writes; role assignment is a privileged,
server-only operation performed via the Firebase Admin SDK. Exact deployed rules live in [`firestore.rules`](firestore.rules).

To deploy rules from the CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 2. Secret Management Setup (Google Cloud Secret Manager)

To adhere to zero-hardcoding standards, operational secrets such as `GEMINI_API_KEY` are stored in Google Cloud Secret Manager.

```bash
# 1. Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# 2. Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 3. Grant the Cloud Run runtime service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 3. Cloud Run Deployment & Campaign Verification

### Enable Required GCP APIs
```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com
```

### Build & Deploy to Google Cloud Run
Deploy the application with container configuration and secret injection:

```bash
gcloud run deploy gemini-journal-reflections \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port 3000
```

### Required Campaign Verification Label
Attach the mandatory campaign resource label to register the service for automated challenge verification:

```bash
gcloud run services update gemini-journal-reflections \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 4. Functional Stability & User Walkthrough Verification

Every user interaction has a corresponding verification scenario:

### Test Case 1: Landing Page & Unauthenticated State
- **Step 1.1**: Open the root URL (`/`).
- **Expected Result**: The landing page appears with high-contrast typography, presenting the value proposition, security highlights, and the "Sign In with Google" button. No private journal records are visible.
- **Step 1.2**: Click the "Security Posture" button in the navbar.
- **Expected Result**: The Threat Model modal opens, displaying the 8 Threat Zones table and the deployed `firestore.rules` snippet.

### Test Case 2: Federated Google Authentication
- **Step 2.1**: Click "Sign In with Google" on the landing page.
- **Expected Result**: The Google OAuth popup opens. Complete the sign-in flow.
- **Step 2.2**: Upon successful authentication, the user is redirected to the private reflection dashboard. The top navigation updates with the user's Google profile image and name.

### Test Case 3: Creating a Multi-Turn Journal Reflection
- **Step 3.1**: Enter a title (e.g., "Project Launch Strategy") or leave it blank for auto-titling.
- **Step 3.2**: Select the "Thoughtful Reflection" mode tab.
- **Step 3.3**: Click an inspiration prompt or type: *"Today we planned our Q3 rollout. I felt excited but concerned about deadline constraints."*
- **Step 3.4**: Click the "Reflect" button or press `Enter`.
- **Expected Result**:
  - Processing indicator appears.
  - Gemini 3.x Flash (first model of the 5-model fallback ladder) analyzes the input and responds with an empathetic, constructive reflection rendered in clean markdown.
  - An executive summary card and tags (e.g. `#Planning`, `#Productivity`) appear below the turn.
  - The Firestore status pill displays "Saved to Firestore" with a green checkmark.
  - The left sidebar updates in real-time, displaying the new entry under the user's history.
- **Step 3.5**: Click the download icon in the editor header.
- **Expected Result**: The entry downloads as a standalone `.md` file (mode, timestamps, thread, summary, tags).
- **Step 3.6**: Edit the entry title; stop typing and wait ~1 second.
- **Expected Result**: A "Saving title…" indicator appears, then the title persists to Firestore automatically (debounced autosave).

### Test Case 4: Multi-Turn Continuous Dialogue
- **Step 4.1**: In the same active reflection, click the follow-up chip: *"Give me 3 concrete action steps for tomorrow based on this."*
- **Step 4.2**: Click "Reflect".
- **Expected Result**: Gemini receives the full conversation history and provides three tailored action steps. Both the prompt and reply are saved to Firestore, incrementing the turn counter in the history sidebar.

### Test Case 5: Mode Switching (Summarization & Brainstorming)
- **Step 5.1**: Click "New Reflection".
- **Step 5.2**: Switch mode to "Executive Summary".
- **Step 5.3**: Enter a detailed note and submit.
- **Expected Result**: Gemini formats its response as a structured executive summary highlighting key themes and core takeaways.
- **Step 5.4**: Switch mode to "Brainstorm Ideas".
- **Expected Result**: Gemini provides creative brainstorming angles, fresh perspectives, and lateral thinking solutions.

### Test Case 6: Real-Time History & Search Filtering
- **Step 6.1**: In the left sidebar, enter a keyword in the search input (e.g. "Strategy").
- **Expected Result**: Only reflections matching the title, tags, or content remain visible.
- **Step 6.2**: Click on a different past entry in the list.
- **Expected Result**: The editor smoothly loads the past entry with all historical multi-turn messages, executive summaries, and tags.

### Test Case 7: Transaction Integrity & Error Recovery
- **Step 7.1**: Simulate a network disconnection or rate limit.
- **Expected Result**: The user's input is NOT deleted or cleared. A red transaction warning banner displays a "Retry Save" button allowing one-click retry.
- **Step 7.2**: The server's 5-model fallback ladder automatically fails over across models (`gemini-3.7-flash` &rarr; `gemini-3.6-flash` &rarr; `gemini-3.5-flash` &rarr; `gemini-flash-latest` &rarr; `gemini-3.1-flash-lite`) before reporting any unrecoverable error.

### Test Case 8: Secure Deletion
- **Step 8.1**: Hover over an entry in the history sidebar and click the trash can icon.
- **Step 8.2**: Confirm the deletion in the confirmation dialog (a styled modal replaces the browser-native confirm prompt).
- **Expected Result**: The entry is deleted from the user's isolated Firestore collection (`/users/{uid}/interactions/{id}`) and immediately disappears from the history list.

### Test Case 9: Sign Out & State Teardown
- **Step 9.1**: Click the Sign Out button in the navigation bar.
- **Expected Result**: The session is destroyed, local state is reset, and the user is returned to the unauthenticated landing screen.

---

## 5. Local Development

```bash
npm install       # install dependencies
npm run dev       # Express + Vite dev server on http://localhost:3000
npm run lint      # TypeScript type-check
npm run build     # production build → dist/ (frontend + server bundle)
npm start         # run the production server
npm run e2e       # 22-test synthetic E2E suite (admin RBAC + notifications)
```

Copy `.env.example` to `.env.local` and fill in `GEMINI_API_KEY` plus the `VITE_FIREBASE_*` values. Full variable reference, API endpoint table, deploy commands, and troubleshooting are in [**CHEATSHEET.md**](CHEATSHEET.md).
