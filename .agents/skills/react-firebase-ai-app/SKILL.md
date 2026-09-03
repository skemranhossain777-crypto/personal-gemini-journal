---
name: react-firebase-ai
description: Full-stack guide for building React + TypeScript applications with Firebase backend (Auth, Firestore, AI Logic/Gemini). Covers project scaffolding, authentication, cloud persistence, generative AI features, security rules, and deployment. Use when building any AI-powered web app on this stack.
---

# React + Firebase + AI Logic — Full-Stack Skill

## Overview

This skill covers every layer of a production-quality **React + Firebase** application:

- **Frontend**: Vite + React 18 + TypeScript
- **Backend**: Firebase Auth · Cloud Firestore · Firebase AI Logic (Gemini)
- **Security**: App Check (reCAPTCHA Enterprise) · Firestore rules
- **Styling**: Plain CSS design tokens (no Tailwind)
- **Icons**: Lucide React

Use this skill for any project that combines user authentication, cloud-synced data, and generative AI features.

---

## Process

### Phase 1 — Scaffold the Project

#### 1.1 Create the Vite app

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
npm install firebase lucide-react
```

#### 1.2 Standard folder layout

```
src/
  components/      # UI components (Navbar, modals, cards…)
  services/        # firebase.ts · auth.ts · firestore.ts · ai.ts · data.ts
  types/           # Shared TypeScript interfaces
  App.tsx          # Root: routing + top-level state
  index.css        # Design system (CSS variables)
firestore.rules    # Firestore security rules
firebase.json      # Hosting + Firestore + emulator config
.env.example       # Template – commit this
.env.local         # Real secrets – never commit
```

#### 1.3 Environment variables

```bash
# .env.local  (gitignored)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_RECAPTCHA_SITE_KEY=         # production reCAPTCHA Enterprise key
VITE_APPCHECK_DEBUG_TOKEN=       # local dev only – leave blank in prod
```

Commit `.env.example` with all keys blank so teammates know what's needed.

---

### Phase 2 — Firebase Initialization

**Rule: lazy singleton.** Initialize every Firebase service the first time it is called, never at module load. This prevents import-order crashes and keeps bundle splitting clean.

```typescript
// src/services/firebase.ts
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAI, GoogleAIBackend, AI } from 'firebase/ai';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// ── Singletons ────────────────────────────────────────────────────────────────
let _app: FirebaseApp | null = null;
let _ai: AI | null = null;
let _appCheckInit = false;

export function getFirebaseApp(): FirebaseApp {
  if (!_app) {
    _app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
  }
  return _app;
}

// App Check MUST be initialized before any AI Logic call.
function ensureAppCheck(): void {
  if (_appCheckInit) return;
  _appCheckInit = true;

  const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  if (debugToken) {
    // Allows local dev without a real reCAPTCHA site key
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  }

  initializeAppCheck(getFirebaseApp(), {
    provider: new ReCaptchaEnterpriseProvider(
      import.meta.env.VITE_RECAPTCHA_SITE_KEY ?? 'unused-in-debug-mode'
    ),
    isTokenAutoRefreshEnabled: true,
  });
}

export function getAIService(): AI {
  ensureAppCheck();
  if (!_ai) {
    _ai = getAI(getFirebaseApp(), { backend: new GoogleAIBackend() });
  }
  return _ai;
}
```

---

### Phase 3 — Authentication

Observable auth state with a listener-based pub/sub so any component can subscribe without prop drilling.

```typescript
// src/services/auth.ts
import {
  getAuth, onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, User as FBUser,
} from 'firebase/auth';
import { getFirebaseApp } from './firebase';
import type { User } from '../types';

function mapFirebaseUser(fb: FBUser): User {
  return {
    uid:         fb.uid,
    email:       fb.email ?? '',
    displayName: fb.displayName ?? fb.email?.split('@')[0] ?? 'User',
    photoURL:    fb.photoURL ?? null,
    provider:    fb.providerData[0]?.providerId ?? 'unknown',
  };
}

class AuthService {
  private auth   = getAuth(getFirebaseApp());
  private _user: User | null = null;
  private subs   = new Set<(u: User | null) => void>();

  constructor() {
    onAuthStateChanged(this.auth, (fb) => {
      this._user = fb ? mapFirebaseUser(fb) : null;
      this.subs.forEach(cb => cb(this._user));
    });
  }

  get currentUser() { return this._user; }

  /** Returns an unsubscribe function. Immediately fires with current state. */
  subscribe(cb: (u: User | null) => void): () => void {
    this.subs.add(cb);
    cb(this._user);
    return () => this.subs.delete(cb);
  }

  signInWithGoogle   = () => signInWithPopup(this.auth, new GoogleAuthProvider());
  signInWithEmail    = (email: string, pw: string) =>
    signInWithEmailAndPassword(this.auth, email, pw);
  registerWithEmail  = (email: string, pw: string) =>
    createUserWithEmailAndPassword(this.auth, email, pw);
  signOut            = () => signOut(this.auth);
}

export const authService = new AuthService();
```

**Hooking into React:**

```typescript
// src/App.tsx (excerpt)
import { useState, useEffect } from 'react';
import { authService } from './services/auth';
import type { User } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => authService.subscribe(setUser), []);

  // Pass user down to components that need it
}
```

---

### Phase 4 — Cloud Firestore (Data Layer)

#### 4.1 Firestore service

```typescript
// src/services/firestore.ts
import {
  getFirestore, doc, setDoc, getDoc,
  collection, addDoc, query, where, getDocs,
  serverTimestamp, deleteDoc,
} from 'firebase/firestore';
import { getFirebaseApp } from './firebase';

const db = getFirestore(getFirebaseApp());

export const firestoreService = {
  // ── Users ──────────────────────────────────────────────────────────────────
  async recordUserLogin(uid: string, email: string) {
    await setDoc(doc(db, 'users', uid), {
      email, lastLogin: serverTimestamp(),
    }, { merge: true });
  },

  // ── Bookmarks ───────────────────────────────────────────────────────────────
  async setBookmark(uid: string, itemId: string) {
    await setDoc(doc(db, 'bookmarks', uid, 'items', itemId), {
      createdAt: serverTimestamp(),
    });
  },

  async removeBookmark(uid: string, itemId: string) {
    await deleteDoc(doc(db, 'bookmarks', uid, 'items', itemId));
  },

  async getBookmarks(uid: string): Promise<string[]> {
    const snap = await getDocs(collection(db, 'bookmarks', uid, 'items'));
    return snap.docs.map(d => d.id);
  },

  // ── Generic doc helpers ─────────────────────────────────────────────────────
  async saveDoc<T extends object>(path: string, id: string, data: T) {
    await setDoc(doc(db, path, id), { ...data, updatedAt: serverTimestamp() });
  },

  async getDoc<T>(path: string, id: string): Promise<T | null> {
    const snap = await getDoc(doc(db, path, id));
    return snap.exists() ? (snap.data() as T) : null;
  },
};
```

#### 4.2 Dual-layer persistence (local-first)

Cache data locally for instant reads; sync to Firestore non-blocking so the UI never waits on the network.

```typescript
// src/services/data.ts
import { firestoreService } from './firestore';

interface LocalStore {
  [uid: string]: {
    bookmarks: string[];
    // add other per-user state here
  };
}

const STORAGE_KEY = 'app_local_store';

class DataService {
  private store: LocalStore = this.load();

  private load(): LocalStore {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); }
    catch { return {}; }
  }
  private persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
  }

  /** Fire-and-forget cloud sync – never blocks the caller */
  private sync(fn: () => Promise<void>) {
    fn().catch(e => console.warn('[data] cloud sync failed:', e));
  }

  private scope(uid: string) {
    if (!this.store[uid]) this.store[uid] = { bookmarks: [] };
    return this.store[uid];
  }

  getBookmarks(uid: string): string[] {
    return this.scope(uid).bookmarks;
  }

  toggleBookmark(uid: string, itemId: string): boolean {
    const s = this.scope(uid);
    const idx = s.bookmarks.indexOf(itemId);
    if (idx === -1) {
      s.bookmarks.push(itemId);
      this.sync(() => firestoreService.setBookmark(uid, itemId));
    } else {
      s.bookmarks.splice(idx, 1);
      this.sync(() => firestoreService.removeBookmark(uid, itemId));
    }
    this.persist();
    return idx === -1; // true = added
  }

  /** Call on login to hydrate local store from cloud */
  async hydrateFromCloud(uid: string) {
    const cloudIds = await firestoreService.getBookmarks(uid);
    this.scope(uid).bookmarks = cloudIds;
    this.persist();
  }
}

export const dataService = new DataService();
```

---

### Phase 5 — Firebase AI Logic (Gemini)

#### 5.1 Model fallback chain

Always define a fallback list so a quota error on one model auto-retries on the next.

```typescript
// src/services/ai.ts
import { getGenerativeModel, Schema, GenerativeModel } from 'firebase/ai';
import { getAIService } from './firebase';

const MODEL_CHAIN = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
] as const;

function isRetriable(msg: string) {
  return /quota|rate.?limit|503|overload/i.test(msg);
}

async function withFallback<T>(
  invoke: (model: GenerativeModel) => Promise<T>
): Promise<T> {
  let last: unknown;
  for (const alias of MODEL_CHAIN) {
    try {
      const model = getGenerativeModel(getAIService(), { model: alias });
      return await invoke(model);
    } catch (err) {
      last = err;
      if (!isRetriable((err as Error).message)) throw err;
      await new Promise(r => setTimeout(r, 1200));
    }
  }
  throw last;
}
```

#### 5.2 Plain text generation

```typescript
export async function generateText(prompt: string): Promise<string> {
  return withFallback(async (model) => {
    const result = await model.generateContent(prompt);
    return result.response.text();
  });
}
```

#### 5.3 Structured output with schema

```typescript
// Define a schema once; reuse across calls
const SUMMARY_SCHEMA = Schema.object({
  properties: {
    title:   Schema.string(),
    bullets: Schema.array({ items: Schema.string() }),
    rating:  Schema.number(),
  },
});

export async function generateStructured<T>(
  prompt: string,
  schema: ReturnType<typeof Schema.object>
): Promise<T> {
  return withFallback(async (model) => {
    const structured = getGenerativeModel(getAIService(), {
      model:            model.model,
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
    });
    const result = await structured.generateContent(prompt);
    return JSON.parse(result.response.text()) as T;
  });
}
```

#### 5.4 Streaming responses

```typescript
export async function* streamText(prompt: string): AsyncGenerator<string> {
  const model = getGenerativeModel(getAIService(), { model: MODEL_CHAIN[0] });
  const result = await model.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    yield chunk.text();
  }
}
```

#### 5.5 Timeout + loading-state pattern

```typescript
const TIMEOUT_MS = 15_000;

export async function aiCallWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('AI request timed out')), TIMEOUT_MS)
  );
  return Promise.race([fn(), timeout]);
}

// In a component:
const [loading, setLoading] = useState(false);
const [result, setResult]   = useState<string>('');

async function handleGenerate() {
  setLoading(true);
  try {
    const text = await aiCallWithTimeout(() => generateText(userPrompt));
    setResult(text);
  } catch (err) {
    addToast('error', (err as Error).message);
  } finally {
    setLoading(false);
  }
}
```

---

### Phase 6 — Component Architecture

#### 6.1 Typed functional components

```typescript
// src/components/ItemCard.tsx
import type { Item } from '../types';

interface ItemCardProps {
  item:             Item;
  isBookmarked:     boolean;
  onToggleBookmark: (id: string) => void;
  onSelect:         (item: Item) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item, isBookmarked, onToggleBookmark, onSelect,
}) => (
  <div className="card" onClick={() => onSelect(item)}>
    <h3>{item.name}</h3>
    <button
      onClick={e => { e.stopPropagation(); onToggleBookmark(item.id); }}
      aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
    >
      {isBookmarked ? '★' : '☆'}
    </button>
  </div>
);
```

#### 6.2 Toast notification helper

```typescript
// src/App.tsx
interface Toast { id: string; type: 'success' | 'error' | 'info'; message: string; }

const [toasts, setToasts] = useState<Toast[]>([]);

const addToast = (type: Toast['type'], message: string) => {
  const id = `toast-${Date.now()}`;
  setToasts(prev => [...prev, { id, type, message }]);
  setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
};
```

---

### Phase 7 — Type Definitions

Centralise all interfaces in `src/types/index.ts`. Adapt the generic shapes below to the domain.

```typescript
// src/types/index.ts

export interface User {
  uid:         string;
  email:       string;
  displayName: string;
  photoURL:    string | null;
  provider:    string;
}

// Generic content item — extend for your domain
export interface Item {
  id:          string;
  name:        string;
  description: string;
  imageUrl:    string;
  categoryId:  string;
  tags?:       string[];
  createdAt?:  string;
}

export interface Category {
  id:    string;
  label: string;
  icon?: string;
}

// Generic AI-generated result
export interface AIResult<T = unknown> {
  data:      T;
  modelUsed: string;
  createdAt: string;
}
```

---

### Phase 8 — CSS Design System

Define all design tokens as CSS variables in `src/index.css`. Every component uses these variables — never hard-code colours or sizes.

```css
/* src/index.css */
:root {
  /* ── Typography ───────────────────────────────── */
  --font-heading: 'Outfit', system-ui, sans-serif;
  --font-body:    'Plus Jakarta Sans', system-ui, sans-serif;
  --fs-xs:  0.75rem;
  --fs-sm:  0.875rem;
  --fs-md:  1rem;
  --fs-lg:  1.25rem;
  --fs-xl:  1.5rem;
  --fs-2xl: 2rem;

  /* ── Colours ──────────────────────────────────── */
  --bg-dark:        #060a14;
  --bg-card:        #0d1424;
  --text-primary:   #f0f4ff;
  --text-secondary: #8899bb;
  --accent-cyan:    #00f2fe;
  --accent-blue:    #4facfe;
  --accent-purple:  #8b5cf6;
  --error:          #ef4444;
  --success:        #22c55e;

  /* ── Gradients ────────────────────────────────── */
  --gradient-primary: linear-gradient(135deg, #00f2fe 0%, #4facfe 45%, #8b5cf6 100%);

  /* ── Spacing ──────────────────────────────────── */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 40px;

  /* ── Radius ───────────────────────────────────── */
  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 22px;
  --radius-xl: 32px;

  /* ── Shadows ──────────────────────────────────── */
  --shadow-card: 0 4px 24px rgba(0,0,0,0.4);
  --shadow-glow: 0 0 30px rgba(0,242,254,0.28);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family:      var(--font-body);
  background-color: var(--bg-dark);
  color:            var(--text-primary);
  line-height:      1.6;
}

h1, h2, h3 { font-family: var(--font-heading); }

.card {
  background:    var(--bg-card);
  border-radius: var(--radius-md);
  box-shadow:    var(--shadow-card);
  padding:       var(--space-md);
  transition:    transform 0.2s ease, box-shadow 0.2s ease;
}
.card:hover {
  transform:  translateY(-2px);
  box-shadow: var(--shadow-glow);
}

.btn-primary {
  background:    var(--gradient-primary);
  border:        none;
  border-radius: var(--radius-sm);
  color:         #fff;
  cursor:        pointer;
  font-family:   var(--font-heading);
  font-weight:   600;
  padding:       10px 20px;
  transition:    opacity 0.2s;
}
.btn-primary:hover   { opacity: 0.88; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
```

---

### Phase 9 — Firestore Security Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helpers ──────────────────────────────────────────────
    function isSignedIn() { return request.auth != null; }
    function isOwner(uid) { return isSignedIn() && request.auth.uid == uid; }
    function isAdmin() {
      return isSignedIn() &&
        request.auth.token.email in ['admin@example.com'];
    }

    // ── Bookmarks: owner only ─────────────────────────────────
    match /bookmarks/{userId}/{document=**} {
      allow read, write: if isOwner(userId);
    }

    // ── User records: owner read, admin read-all ──────────────
    match /users/{userId} {
      allow read:  if isOwner(userId) || isAdmin();
      allow write: if isOwner(userId);
    }

    // ── Public read, authenticated write ─────────────────────
    match /items/{itemId} {
      allow read:  if true;
      allow write: if isAdmin();
    }
  }
}
```

---

### Phase 10 — Firebase Config & Deployment

```json
// firebase.json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "auth":      { "port": 9099 },
    "firestore": { "port": 8080 },
    "hosting":   { "port": 5000 },
    "ui":        { "enabled": true }
  }
}
```

```bash
# Development
npm run dev

# Type-check before building
npx tsc --noEmit

# Production build
npm run build

# Firebase commands
firebase login
firebase use <project-id>
firebase emulators:start                               # local dev
npx firebase-tools deploy --only firestore:rules,hosting
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| AI requests 401/403 | App Check not configured | Set `VITE_APPCHECK_DEBUG_TOKEN` locally or configure reCAPTCHA for prod |
| Firestore `permission-denied` | Security rule mismatch | Check `firestore.rules` and auth state |
| Build fails with TS errors | Type errors in components | Run `npx tsc --noEmit` to see all errors |
| Images broken | Bad `imageUrl` | Point to valid public URL (Wikimedia, Unsplash, etc.) |
| AI always times out | Default quota exceeded | Enable model fallback chain; add timeout UX |
| Auth state lost on refresh | `onAuthStateChanged` not set up | Ensure `authService` is instantiated before first render |

---

## Best Practices Checklist

- [ ] **Lazy init** — Firebase services created on first use, not at module top
- [ ] **Model fallback** — At least 2–3 Gemini model aliases in fallback chain
- [ ] **Local-first** — Read from `localStorage`, sync to Firestore non-blocking
- [ ] **Error boundaries** — All AI calls wrapped in try/catch with user-facing toasts
- [ ] **Type safety** — Every data structure has a TypeScript interface
- [ ] **Design tokens** — All colours, spacing, radius via CSS variables
- [ ] **Secrets** — Only `.env.example` committed; `.env.local` gitignored
- [ ] **Security rules** — Ownership checks on every Firestore path
- [ ] **App Check** — Required before any AI Logic call in production
- [ ] **Timeout** — AI calls race against a deadline promise