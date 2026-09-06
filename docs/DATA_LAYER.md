# DATA LAYER — JOURNAL∞ (users/{uid}/* collections)

Owner-scoped Firestore data layer added in Phase 3 (additive; the legacy
`interactions` subcollection is preserved and still served by the shipping UI).

- **Source:** `src/data/` (models, validators, CRUD, collection services)
- **Rules:** `firestore.rules`
- **Rules tests:** `tests/rules/security_rules.test.ts` (emulator-backed)
- **Docs status:** see also `docs/PROJECT_STATE.md`, master spec Phase 3.

---

## 1. Layout

Every data-layer document lives under `users/{uid}/<collection>/<id>` and
carries `uid` (the owning `request.auth.uid`) plus `createdAt`/`updatedAt`
(Firestore server timestamps). Writes that do not re-assert `uid == auth.uid`
or that tamper with the immutable `uid` field are rejected.

| Collection | Purpose | Update allowed | Notes |
|---|---|---|---|
| `journalEntries` | free-form reflection entries (mood/energy/tags/location/attachments/aiMetadata) | yes | the Phase 3 entry model |
| `conversations` | multi-turn Gemini companion sessions (9 skills) | yes | `readonlyKeys` for audit fields |
| `insights` | AI reflections (daily/weekly/monthly/yearly/pattern) | yes | `saved` gates long-term use |
| `memories` | personal memory engine (review/edit/save/forget) | yes | `saved` gates AI use |
| `timelineEvents` | visual timeline; `year/month/day` precomputed for index-friendly queries | yes | |
| `goals` | goals with milestones + evidence links | yes | |
| `habits` | habit tracking + bounded daily log | yes | `daysOfWeek` fully validated (0–6) |
| `collections` | user-curated folders grouping entries | yes | |
| `notifications` | in-app notification queue | yes | system-owned fields immutable |
| `aiInteractions` | append-only Gemini call audit (`contextRefs` = what was retrieved/sent) | **no** | `allow update: if false` |
| `settings` | exactly one doc, id `preferences` | yes | fixed doc id |

Legacy (preserved for the shipping UI, Phase 3 cloud persistence):

| Collection | Purpose | Notes |
|---|---|---|
| `users/{uid}/interactions` | chat-style interaction docs | owner-scoped; legacy string timestamps |
| `roles/{uid}` | admin role marker | owner **read-only**; writes denied to all clients |

Anything else under `users/{uid}` that is not an exact collection match above
(unknown collections, deeper subcollections, the `users` root itself) is denied
by default.

## 2. Validation

`src/data/validation.ts` mirrors the security rules client-side so SDK checks
(`DataError`) align with server enforcement. Common constraints:

- `uid` must equal the authenticated caller (`requireOwnerUid`).
- Fixed string ids ≤ 128 chars matching `[A-Za-z0-9_-]`.
- `isValidId` also rejects `.`/`..`/`__proto__`/`constructor`/`prototype` and the
  `[\\/]+` separators (path traversal guard).
- Bounded lists: `messages` ≤ 400 msgs × ≤ 120000 chars content, milestones ≤
  40, `contextRefs` ≤ 20, tags ≤ 100, attachments ≤ 40, etc.
- `serverTimestamp()` is a required writer; tampering is detected as
  `DataError('timestamp-forbidden')`.
- Update validators validate the **merged** post-update document, so a partial
  update cannot smuggle an invalid field.

`ValidationResult.ok` is asserted in unit tests; the type always carries
`errors: string[]`.

## 3. Security rules design

`firestore.rules` is the enforcement point; the SDK validators are a UX
convenience. Highlights:

- All reads/writes require `request.auth != null` and `request.auth.uid ==
  userId` (owner isolation; anonymous/demo sessions get `DataError` before any
  network write via `requireOwnerUid`'s demo-uid guard).
- Every allow rule for writes validates `request.resource.data` fully.
- Immutable fields: `uid`, and per-collection readonly keys, unchanged across
  updates (`immutableUnchanged`).
- `daysOfWeek` in habits is enumerated (exact 0–6 set), not just "any list".
- `aiInteractions` is create/read/delete only; the write path is intentionally
  banned.
- Default-deny for any unmatched path (unknown collections, `roles` writes,
  `users` root listing).

### Emulator-safe subset (important when editing rules)

The Firestore emulator's rules engine does **not** support list iteration:
`list.all()`/`list.all(pred)`/`map.values().all(...)` compile but fail at
runtime with `Function not found error: Name: [all]`. It supports `size()`,
index access, `hasOnly/hasAll/hasAny`, `matches(regex)` (no `contains`), and
string/primitive checks. The rules therefore use:

- `boundedList(x, n)` + explicit index probes to depth 4 into nested lists
  (messages, milestones, logs, contextRefs, entries);
- enumerated settings flag maps: `map.size() == N && keys().hasOnly(...) &&
  (<key> is bool)` per flag.

Tests in `tests/rules/security_rules.test.ts` pin the behavior; if you edit the
helpers, keep the probe-depth convention and re-run `npm run test:rules`.

## 4. Rules test matrix

`tests/rules/security_rules.test.ts` (124 tests) runs against the emulator
(`demo-firestore-rules`). Covered:

- Owner create/read/update/delete per collection fixture (valid docs).
- Owner update-bypass attempts: rewrite `uid`, drop `uid`, tamper immutable
  keys → denied.
- Non-owner read/write and unauthenticated read/write on owner partitions → denied.
- Invalid doc ids: oversized, `__proto__`/`constructor`/reserved, and the
  path-separator (`a/b`) doc-ref rejection (document refs with odd segment
  counts throw in the SDK — asserted with `expect(() => doc(...)).toThrow(...)`).
- Collection traversal: listing `users`, unknown subcollections, deeper nesting
  → denied.
- Cross-account isolation: forged `uid` at the owner/instruder partitions.
- Legacy: owner `interactions` persist/read succeed; intruder/forged-owner
  denied; `roles` read-only (owner read ok; writes + third-party reads denied).

Run: `npm run test:rules` (manages the emulator and a bundled JRE; override the
JRE with `TEST_JRE_DIR`).

### 4.1 Journal engine integration suite

`tests/integration/journalEngine.integration.test.ts` drives the **real**
`createCollectionApi` + `createFirestoreJournalStore` + `DraftEngine` against
the same emulator process, but under its own project id
(`demo-journal-integration`). A distinct project id keeps its `clearFirestore()`
calls and rules upload from racing the security-rules suite (which drives
`demo-firestore-rules`) when vitest runs both files in parallel.

Covered: create→read round-trip with server timestamps, rapid-edit coalescing
(newest text wins), in-place update preserving `createdAt`, crash recovery over a
stale server doc, server adoption when the mirror is clean, re-create after a
deleted doc, and listing order (`createdAt` desc — an edit updates the document
in place without reordering it).

### 4.2 Rules gotcha: null-able fields must be present as `null`

Firestore rules treat a missing field as `undefined`, and `undefined == null`
is **false** in the rules language. The journal validator's
`data.aiMetadata == null || isAiMetadata(...)` therefore **denies every write**
that omits the `aiMetadata` key. The firestore store sends `aiMetadata: null`
(`normalizeInput` in `src/journal/store.ts`); keep that when editing, and apply
the same rule to any future optional-map field.

## 5. Running tests

```
npm test          # unit + RTL tests only — no emulator needed
npm run test:rules    # emulator-backed rules + integration suites
npm run lint          # tsc --noEmit
npm run build         # production build (client + server bundle)
```

`src/**/*.test.ts` (unit + React Testing Library, incl. axe a11y assertions)
runs in the plain `npm test`; the emulator-only suites live in
`tests/rules/` and `tests/integration/` and are excluded from the default
vitest `include` (see `vitest.rules.config.ts`), so a coffee-machine `npm test`
never needs the emulator.

Notes for maintainers:

- Emulator binds Firestore `127.0.0.1:8080` and Auth `127.0.0.1:9099`.
- If `npm run test:rules` fails to bind, a stale Java emulator may be holding
  port 8080: `Get-NetTCPConnection -LocalPort 8080 -State Listen` then kill the
  owning PID.
- `firebase-tools` is a local devDependency; the launcher scripts live in
  `scripts/` (`test-rules.mjs`, `run-rules-suite.mjs`).

## 6. Indexes

The current CRUD layer lists with single-field `orderBy('createdAt')` +
`orderBy(__name__)` — **no composite index is required today**. Anticipated
composite indexes (add + deploy when the query features are built):

- `timelineEvents` On-This-Day: `year`+`month`+`day`+`createdAt` (asc).
- `insights` by kind/period: `kind`+`periodStart` (desc) + `createdAt`.

`firestore.indexes.json` intentionally stays empty until a query needs one.

## 7. Migration / compatibility

- The legacy `interactions` subcollection remains readable/writable by the
  shipping UI (`subscribeUserInteractions` etc.) under the owner-scoped legacy
  validator (string timestamps, `userId == auth.uid`, message shape probes).
- The old blanket `{document=**}` owner wildcard was **removed**; anything not
  in the table in §1 is denied. If a future phase reintroduces a collection, add
  an explicit `match` + validator (and a test) rather than widening the wildcard.
