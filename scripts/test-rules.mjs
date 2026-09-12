import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs the Firestore security-rules test suite against the local emulators.
//
// The Firestore/Auth emulators require Java 21+, which is not on this machine's
// system PATH. We prefer a bundled JRE (override with TEST_JRE_DIR) or fall back
// to whatever `java` is on PATH.

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
// Use the OS temp dir (never a workspace-relative path) so the throwaway
// emulator config works on Linux CI as well as on Windows dev machines.
const tmpBase = process.env.TMPDIR ?? process.env.TMP ?? process.env.TEMP ?? tmpdir();
const tmp = resolve(tmpBase, `firebase-rules-test-${process.pid}.json`);

const javaCandidates = [
  process.env.TEST_JRE_DIR,
  'C:\\Users\\LE\\AppData\\Local\\Temp\\opencode\\jre21\\jdk-21.0.12.1+1-jre',
].filter(Boolean);

const bundledJava = javaCandidates.find((dir) => existsSync(join(dir, 'bin', 'java.exe')));
if (bundledJava) {
  process.env.PATH = join(bundledJava, 'bin') + delimiter + (process.env.PATH ?? '');
}

// The emulator suite connects to the `(default)` database. `firebase.json`
// deploys to the named production database `gemini-journal`, so we hand the
// emulators a throwaway config pointing at `(default)` to keep the rules tests
// hermetic (namespace `demo-firestore-rules` is never touched in production).
writeFileSync(
  tmp,
  JSON.stringify({
    firestore: [{ database: '(default)', rules: join(root, 'firestore.rules') }],
    emulators: {
      firestore: { host: '127.0.0.1', port: 8080 },
      auth: { host: '127.0.0.1', port: 9099 },
      ui: { enabled: false },
      singleProjectMode: true,
    },
  }),
);

const firebaseBin = resolve(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const suite = resolve(root, 'scripts', 'run-rules-suite.mjs');

const args = [
  firebaseBin,
  'emulators:exec',
  '--config',
  tmp,
  '--only',
  'firestore,auth',
  '--project',
  'demo-firestore-rules',
  `node ${suite}`,
];

const res = spawnSync(process.execPath, args, {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
try {
  unlinkSync(tmp);
} catch {
  // best-effort cleanup
}
process.exit(res.status ?? 1);