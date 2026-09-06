# Authentication Architecture

The journal authenticates users with **Firebase Authentication (Google federated
sign-in)** and wraps every private surface in a React gate. This document
describes the boundary, the state machine, the error taxonomy, the security
contract, and how the scenario coverage is tested.

---

## 1. High-level flow

```
 visitor
   │  visits /  (landing)
   │
   ├── [Demo]  → signInAsDemo()  → local flagged session (isDemo=true)
   │
   └── [Sign in with Google]
         ├── popup ···················· signInWithPopup
         │     └── blocked/cancelled?  → fallback to full-page
         │                               signInWithRedirect
         └── redirect round-trip ····· signInWithRedirect → reload
                                          → completeRedirectSignIn()
                                          → onAuthStateChanged re-emits session
```

After the session is established:

- `#/app` (the journal workspace) renders through `<RequireAuth>`.
- A Firebase **ID token** is fetched once per session and passed to the
  server as `Authorization: Bearer <idToken>` for admin/notification calls.
- `#/design` (the design-system gallery) and `/` (landing) are public.

---

## 2. Layers

### 2.1 `src/services/auth.ts` — the only Firebase-talker

- `createAuthService({ auth, api })` builds an `AuthService` with an injectable
  `FirebaseAuthApi` so tests can swap Firebase for an in-memory double.
- `AuthServiceContract` is what the rest of the app depends on:

  | Member | Purpose |
  | --- | --- |
  | `currentUser` | Current `SessionUser | null` |
  | `subscribe(cb)` | Observable stream; fires immediately with current state |
  | `signInWithGoogle(mode)` | Popup or redirect; redirect rejects with `REDIRECT_IN_PROGRESS` |
  | `completeRedirectSignIn()` | Finishes the redirect round-trip after reload |
  | `signInAsDemo()` | Local-only demo session (uid `demo-local-user`, `isDemo: true`) |
  | `signOut()` | Clears Firebase session (demo sign-out is fully local) |
  | `getIdToken()` | Firebase ID token for API calls; `null` for demo/signed-out |

- `normalizeAuthError(err)` maps arbitrary thrown values (Firebase `AuthError`
  or anything else) into a stable `AuthErrorInfo` (`key`, `code`, `message`,
  `retryable`).

### 2.2 `src/auth/` — the React boundary

Everything inside `src/auth/` is the only place React components may consume
auth state. Components must never import `firebase/auth` directly.

| Module | Responsibility |
| --- | --- |
| `AuthContext.tsx` | `<AuthProvider>` + `useAuth()`. Subscribes once, drives the state machine. |
| `RequireAuth.tsx` | Route gate. Portals children only when `authenticated`. |
| `screens.tsx` | `AuthLoadingScreen`, `UnauthorizedScreen`, `AuthErrorScreen`, `AuthErrorBanner`. |
| `routes.ts` | Minimal route model: `home` `/`, `app` `#/app` (protected), `design` `#/design`. |
| `types.ts` | Status + state shape shared by the boundary. |

### 2.3 `src/App.tsx` — composition

```
<AuthProvider>
  <AppShell/>            // useAuth()
```

Rendering order:

1. `#/design` → gallery (public).
2. `isBusy` → `AuthLoadingScreen`.
3. `restore-failed` → `AuthErrorScreen` (retry/sign-out).
4. Authenticated → `currentUser ? <RequireAuth>{workspace}</RequireAuth>`.
5. Signed out on `#/app` → `RequireAuth fallback=<UnauthorizedScreen/>`.
6. Otherwise → landing (`AuthLanding` reads `error`/`onClearError` from context).

The authenticated workspace payload (Firestore subscriptions, admin flag,
ID token) lives in an effect keyed on `currentUser?.uid`, so a session change
cannot leak another user's data.

### 2.4 Server side

`server.ts` verifies the Firebase ID token on every admin/notification
endpoint and grants the admin role from a **server-side email allow-list**.
The client carries no role decision-making.

---

## 3. State machine

```
initializing ──► authenticated
      │             ▲  │
      │             │  │ sign-out / session loss
      │             │  ▼
      └─► unauthenticated ◄── signing-in
            │                   ▲ (popup)
            │ sign-in           │
            ▼                   │
        restore-failed ──retry──┘  (completeRedirectSignIn)
```

| Status | Meaning | UI |
| --- | --- | --- |
| `initializing` | Restoring session at boot | `AuthLoadingScreen` |
| `signing-in` | Popup/redirect in progress | `AuthLoadingScreen` |
| `authenticated` | Session active (`user` set) | Children via `RequireAuth` |
| `unauthenticated` | No session (or failed sign-in) | Landing / `UnauthorizedScreen` |
| `restore-failed` | Boot restore threw — distinct from "signed out" | `AuthErrorScreen` with retry |

`isBusy = status ∈ { initializing, signing-in }` — drives loading affordances
everywhere (e.g. the sign-in button spinner).

---

## 4. Error taxonomy (`AuthErrorKey`)

| Key | Triggers on | retryable |
| --- | --- | --- |
| `popup-closed` | `auth/popup-closed-by-user` | yes |
| `cancelled` | `auth/cancelled-popup-request` | yes |
| `popup-blocked` | `auth/popup-blocked` (→ redirect fallback first) | yes |
| `unauthorized-domain` | `auth/unauthorized-domain` | **no** — operator fix |
| `operation-not-allowed` | provider not enabled | **no** — operator fix |
| `configuration-not-found` | missing app config | **no** — operator fix |
| `invalid-token` | `invalid-credential`, `user-disabled`, etc. | yes |
| `network-error` | `network-request-failed`, `too-many-requests` | yes |
| `redirect-failed` | `internal-error` during redirect | yes |
| `unknown` | anything else | yes (default) |

Unknown errors keep the raw message rather than masking it. `AuthErrorBanner`
renders the friendly copy in an `role="alert"` region.

---

## 5. Demo mode

`signInAsDemo()` creates a purely local session (`isDemo: true`, provider
`demo`). It never touches Firebase, never produces an ID token
(`getIdToken()` → `null`), and sign-out is a discard-only operation. The UI
shows its Google-less nature (guest prompt, no admin/notification surfaces).

---

## 6. Security contract

- **Public config only in the client.** Vite bundles just the public Firebase
  app config. `GEMINI_API_KEY`, Maps API keys, the admin service-account
  (`sa-keys/`, gitignored), and the admin allow-list exist **only** in
  `server.ts` via server-side env vars.
- **No secret values or internal names in the bundle.** This is enforced in
  CI step 7 (`npm run build` + a scan of `dist/assets/*.js` for `GEMINI_API_KEY`,
  `GOOGLE_MAPS_API_KEY`, `ADMIN_EMAILS`, `private_key`, `service_account` —
  expect no matches).
- **Authorization is server-side.** Admin is derived from a verified ID token
  + server allow-list; the client merely renders the flag the server returned.
- **Owned, per-user data.** Firestore reads/writes are subscripted under the
  authenticated `uid`. The data effect re-runs when the uid changes, so a sign
  in/sign out never surfaces a prior user's entries.
- **Route protection is enforced at render**, not just navigation: any secret
  content renders only inside `<RequireAuth>`.

---

## 7. Testing

Tooling: **vitest** + jsdom + React Testing Library. Run with `npm test`
(`vitest run`), `npm run test:watch`, `npm run typecheck`.

Coverage of the required scenarios:

| # | Scenario | File |
| --- | --- | --- |
| 1 | Fresh visitor starts `unauthenticated` | `src/auth/__tests__/AuthProvider.test.tsx` |
| 2 | Google sign-in reaches `authenticated` | `src/auth/__tests__/AuthProvider.test.tsx` |
| 3 | Reload/refresh restores the persisted session | `src/auth/__tests__/AuthProvider.test.tsx` |
| 4 | Sign-out returns to `unauthenticated` | `src/auth/__tests__/AuthProvider.test.tsx` (+ RequireAuth) |
| 5 | Failed auth surfaces a normalized error, stays signed out | `src/auth/__tests__/AuthProvider.test.tsx` |
| 6 | Direct access to a protected route (no session) → `UnauthorizedScreen`, no content | `src/auth/__tests__/RequireAuth.test.tsx` |

Support files:

- `src/auth/__tests__/helpers.tsx` — in-memory `AuthServiceContract` double
  (`createFakeAuth`), session factory, and a `Probe` that renders the whole
  context state.
- `src/services/__tests__/auth.test.ts` — unit coverage for
  `normalizeAuthError`, `mapFirebaseUser`/`createDemoUser`, and the real
  `AuthService` driving the fake `FirebaseAuthApi` (popup, `REDIRECT_IN_PROGRESS`,
  redirect restore, token `null`/signed-in, demo sign-out without a Firebase call).
- `src/auth/__tests__/routes.test.ts` — route → protection mapping.

Demo and redirect-fallback branches are covered in the service tests and the
`AuthProvider` failure test; real-browser popup flows can't be exercised under
jsdom and are verified manually.

---

## 8. Operations checklist

- [ ] Firebase project has **Google Sign-in** enabled (console → Auth → Sign-in
      method).
- [ ] Every deployed hostname is on the **Authorized domains** list
      (including `localhost` origins used for local dev).
- [ ] Admin emails are populated in the **server-side** allow-list env var —
      never a client value.
- [ ] Re-run `npm run lint`, `npm test`, `npm run build` and the bundle scan
      (section 6) before each deploy.
