import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * CI-time validation of the Firebase deployment surface.
 *
 * Guards the pipeline against config drift BEFORE any deploy: asserts the
 * authoritative GCP project, the named Firestore database ("gemini-journal"),
 * and that only the intended targets exist (no storage config). Runs in
 * Stage 1 (validate-and-test) so push/PR CI catches problems immediately.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const EXPECTED_PROJECT = 'gen-lang-client-0345619653';
const EXPECTED_DATABASE = 'gemini-journal';

function fail(msg) {
  console.error(`\u2717 firebase config validation FAILED: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`\u2713 ${msg}`);
}

// ── Authoritative project ────────────────────────────────────────────────────
const firebasercPath = join(root, '.firebaserc');
if (!existsSync(firebasercPath)) fail('.firebaserc is missing');
const firebaserc = JSON.parse(readFileSync(firebasercPath, 'utf8'));
if (firebaserc?.projects?.default !== EXPECTED_PROJECT) {
  fail(
    `.firebaserc default project is "${firebaserc?.projects?.default}", expected "${EXPECTED_PROJECT}"`,
  );
}
ok(`default project is ${EXPECTED_PROJECT}`);

// ── Firestore database + rules/indexes targets ───────────────────────────────
const firebaseJsonPath = join(root, 'firebase.json');
if (!existsSync(firebaseJsonPath)) fail('firebase.json is missing');
const firebaseJson = JSON.parse(readFileSync(firebaseJsonPath, 'utf8'));

const firestore = firebaseJson.firestore;
if (!Array.isArray(firestore) || firestore.length === 0) {
  fail('firebase.json "firestore" must be a non-empty array (multi-database form)');
}
if (firestore.length > 1) {
  fail(`expected exactly one Firestore database entry, found ${firestore.length}`);
}
const [db] = firestore;
if (db.database !== EXPECTED_DATABASE) {
  fail(`firestore database is "${db.database}", expected "${EXPECTED_DATABASE}"`);
}
ok(`firestore database is ${EXPECTED_DATABASE}`);

for (const [key, file] of [
  ['rules', db.rules],
  ['indexes', db.indexes],
]) {
  if (!file) fail(`firestore.${key} path is missing in firebase.json`);
  const p = join(root, file);
  if (!existsSync(p)) fail(`firestore ${key} file does not exist: ${file}`);
}
ok(`firestore.rules -> ${db.rules}`);

const indexesPath = join(root, db.indexes);
try {
  const parsed = JSON.parse(readFileSync(indexesPath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.indexes)) {
    fail('firestore.indexes.json must be an object with an "indexes" array');
  }
  if (parsed.fieldOverrides !== undefined && !Array.isArray(parsed.fieldOverrides)) {
    fail('firestore.indexes.json "fieldOverrides" must be an array when present');
  }
} catch (err) {
  fail(`firestore.indexes.json is not valid JSON: ${err.message}`);
}
ok(`firestore.indexes.json is valid JSON (${db.indexes})`);

const rulesPath = join(root, db.rules);
const rulesSize = readFileSync(rulesPath, 'utf8').length;
if (rulesSize < 1000) fail(`firestore.rules looks empty (${rulesSize} chars)`);
ok(`firestore.rules present (${rulesSize} chars)`);

// ── Consolidation guards ─────────────────────────────────────────────────────
if (firebaseJson.storage) {
  fail('firebase.json contains a "storage" section — this app has NO Cloud Storage; remove it before enabling any storage deploy');
}
if (firebaseJson.hosting && db.database) {
  ok('storage section absent (config is restricted to Firestore)');
}

console.log('\nfirebase config OK — deploy target: project=%s database=%s', EXPECTED_PROJECT, EXPECTED_DATABASE);