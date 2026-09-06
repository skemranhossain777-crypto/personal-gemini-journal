import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs the Firestore security-rules test suite against the local emulators.
//
// The Firestore/Auth emulators require Java 21+, which is not on this machine's
// system PATH. We prefer a bundled JRE (override with TEST_JRE_DIR) or fall back
// to whatever `java` is on PATH.

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const javaCandidates = [
  process.env.TEST_JRE_DIR,
  'C:\\Users\\LE\\AppData\\Local\\Temp\\opencode\\jre21\\jdk-21.0.12.1+1-jre',
].filter(Boolean);

const bundledJava = javaCandidates.find((dir) => existsSync(join(dir, 'bin', 'java.exe')));
if (bundledJava) {
  process.env.PATH = join(bundledJava, 'bin') + delimiter + (process.env.PATH ?? '');
}

const firebaseBin = resolve(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const suite = resolve(root, 'scripts', 'run-rules-suite.mjs');

const args = [
  firebaseBin,
  'emulators:exec',
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
process.exit(res.status ?? 1);