# Feature Overview — Gemini Journal & Reflections Studio

A secure, user-authenticated journaling and thought-partner web app. Users write multi-turn journal entries and Gemini 3.x Flash analyzes them into empathetic reflections, executive summaries, and brainstorm ideas — all stored in per-user-isolated Cloud Firestore partitions.

---

## 1. Core Journaling

### Multi-Turn Reflections
- **Continuous dialogue**: every new message extends the same entry so Gemini sees the full conversation history (`history[]` is replayed on each request).
- **Follow-up chips**: one-click prompts (e.g., *"Give me 3 concrete action steps for tomorrow"*) after the first turn.
- **Message timeline**: user entries and Gemini replies rendered in a clean chat timeline with timestamps, sender labels, and markdown rendering (`react-markdown`).

### Four Reflection Modes
| Mode | Behavior |
| :--- | :--- |
| `reflect` (Thoughtful Reflection) | Empathetic guidance, cognitive-pattern spotting, grounded wisdom |
| `summarize` (Executive Summary) | Crisp summary of key emotions, themes, and actionable lessons |
| `brainstorm` (Brainstorm Ideas) | Fresh angles, lateral-thinking solutions, next steps |
| `chat` (Continuous Dialogue) | Warm, conversational multi-turn companion with probing questions |

### Structured Metadata
- Every AI reply returns a **1-line executive summary**, **3–5 tags**, and the **actual model used** (parsed from a `---METADATA---` block server-side).
- Executive summary card + tags render below the thread.
- Auto-titling when the title is left blank (first prompt is truncated to 40 chars).

### Location Pinning (Optional)
- Pin any entry to a real place via Google Places autocomplete (server-proxied).
- Coordinates + place name + address are stored on the entry and injected as **location context** into the AI system prompt (geographic/cultural relevance).
- Dark-themed map preview with a dropped marker.

### Editing & Export
- **Title autosave**: in-place title edits save to Firestore after a 900 ms debounce (with a *"Saving title…"* indicator). No data is lost by switching entries.
- **Export to Markdown**: any entry downloads as a `.md` file (mode, timestamps, location, model, full thread, summary, tags).
- **Copy message**: per-reply copy-to-clipboard with feedback.
- **Live word count & read time** in the composer footer.
- **Keyboard shortcuts**: `Enter` sends, `Shift+Enter` inserts a new line (works for follow-ups and first entries).

---

## 2. AI Engine (Resilience First)

- Calls run **exclusively server-side** — the `GEMINI_API_KEY` never reaches the browser.
- **5-Model Fallback Ladder** (preference order), so transient 503s / quota exhaustion degrade gracefully instead of failing:

  `gemini-3.7-flash` → `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-flash-latest` → `gemini-3.1-flash-lite`

- **2-attempt retry** on transient "high demand" 503s before falling back to the next model.
- **30 s request timeout** per model attempt; the client also enforces a 60 s deadline.
- **Mode-aware system instructions** plus hard rules that keep user input as passive data (prompt-injection countermeasure).
- **Rate limited**: 30 requests / minute / IP on `/api/gemini/reflect`.

---

## 3. Authentication & Accounts

- **Google federated sign-in** via Firebase Authentication (no stored passwords).
- **Popup-first** strategy with automatic **full-page redirect fallback** for popup-blocked browsers and third-party-cookie restrictions.
- **Instant Demo Mode**: explore the full workspace locally (localStorage-backed) without signing in — "Connect Google" one-tap upgrade path in the navbar.
- Clear error handling for disabled providers, unauthorized domains, and blocked popups, with a *"Open in New Tab"* escape hatch.

---

## 4. Storage & Local-First UX

- Entries live at `/users/{userId}/interactions/{interactionId}` in Firestore, **orderBy `updatedAt` desc**.
- **Real-time subscriptions** (`onSnapshot`) keep history in sync across sessions and devices.
- **localStorage cache**: instant reads on login; the cloud is a mirror, not a gate — the UI never waits on the network.
- **Demo mode** persists to a separate `gemini_journal_demo_` localStorage key so real data is never mixed in.
- **Guaranteed transaction integrity**: the input buffer only clears **after** a verified save; failures keep your text and show a *Retry Save* banner.

---

## 5. Security Posture (8 Threat Zones)

Summarized here; full table is in the in-app **Security Posture** modal.

| # | Zone | Countermeasure |
| :- | :--- | :--- |
| 1 | Input Surfaces | 2 MB JSON limit, 12 k prompt cap, null-guards |
| 2 | Planning & Reasoning | User input as passive data + hardened system instructions |
| 3 | Tool Execution | 5-model fallback ladder + transient-503 retry + rate limiter |
| 4 | Memory & State | Owner-bound Firestore rules + recursive `undefined` stripping |
| 5 | Inter-System Comm | Zero client-side secrets; strict server proxy for Gemini |
| 6 | Maps API Exposure | Places proxied server-side; separate restricted client key |
| 7 | RBAC Escalation | Server-side `ADMIN_EMAILS` allow-list; role writes only via Admin SDK |
| 8 | Webhook Leakage | Webhooks dispatched server-side only; host allow-list (Slack/Discord/loopback) |

Additional production hardening:
- **Security headers** on every response (`nosniff`, `DENY` framing, referrer & permissions policies).
- **Firestore Security Rules** with full shape validation (`isValidInteraction`): enforces type/size bounds and owner-only access, and **denies all client writes to `/roles`** (privilege-escalation proof).

---

## 6. Notifications (Slack & Discord)

- Configure webhook URLs + enable toggles per user, persisted under `/users/{userId}/settings/notifications`.
- Choose **which modes notify** (reflect / summarize / brainstorm / chat).
- **Test button** per channel validates the webhook end-to-end.
- Dispatch happens **server-side after each saved entry**; outbound URLs are restricted to `*.slack.com` / `*.discord.com` (+ loopback) to block SSRF misuse.

---

## 7. Admin Dashboard (RBAC)

- Admin access is seeded from `ADMIN_EMAILS` (comma-separated env var) and **verified by the server** on every request — no client-side role toggling.
- `GET /api/admin/users` lists users with role, interaction count, and last-active.
- `POST /api/admin/roles` assigns/revokes roles via the **Firebase Admin SDK** (bypasses client rules, gated behind `requireAdmin`).
- Dashboard UI: stat cards (users, interactions, admin seed), user table with role badges, refresh.

---

## 8. UI / UX Polish

- **Dark theme** throughout, cohesive `#0A0A0B` palette with amber accents and a serif title font.
- **Delete confirmation modal** replaces `window.confirm` (title-aware message, explicit destructive action).
- **Journaling stats footer**: total entries, total words written, and current-day **streak**.
- **Relative timestamps** ("2h ago", weekday, or short date) with full date on hover/tooltip.
- **Skeleton loaders** while the history list streams in from Firestore.
- **Offline banner** when the browser loses connectivity — drafts are preserved locally.
- **Dismissible toasts** (success/error/info).
- **Persistent welcome state** with 4 click-to-fill inspiration prompts.
- **Responsive layout**: desktop split-pane (history + editor) collapses to a mobile tab switcher.

---

## 9. Performance & Tooling

- **Vendor bundle splitting** (`vite.config.ts`): `react`, `firebase`, `markdown`, `icons` cached independently; app chunk reduced ~1.09 MB → ~266 KB (gzip ~78 KB).
- TypeScript strict lint via `tsc --noEmit`.
- **22-test synthetic E2E suite** (`e2e-test.ts`) covering unauthenticated access, admin RBAC, notification settings CRUD, webhook dispatch, and edge cases.
- Health endpoint `/api/health` reports `geminiKeyConfigured` and `mapsKeyConfigured` for easy smoke tests.