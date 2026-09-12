import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Verifies that the LIVE Firestore security rules on the authoritative
 * project + named database are byte-identical to the repo's firestore.rules.
 *
 * Uses the read-only Firestore Rules Management API
 * (firebaserules.googleapis.com). Run locally with a project token, or in the
 * production deploy job immediately after `firebase deploy` so a drift between
 * the deployed rules and the reviewed source is caught by CI.
 *
 * Usage: node scripts/verify-firestore-rules.mjs <accessToken>
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const PROJECT = 'gen-lang-client-0345619653';
const DATABASE = 'gemini-journal';
// The release id for a named database is `cloud.firestore/<databaseId>`.
const RELEASE = `cloud.firestore/${DATABASE}`;

function fail(msg) {
  console.error(`\u2717 firestore rules verification FAILED: ${msg}`);
  process.exit(1);
}

const token = process.argv[2];
if (!token) {
  fail('usage: node scripts/verify-firestore-rules.mjs <accessToken>');
}

const rulesPath = join(root, 'firestore.rules');
if (!existsSync(rulesPath)) fail('firestore.rules is missing');

const normalize = (s) => s.replace(/\s+$/g, '');
const local = normalize(readFileSync(rulesPath, 'utf8'));

async function fetchJson(url, label, token) {
  // The Rules API occasionally returns transient 502s; retry a few times so a
  // healthy CI deploy is not reported as a rules drift.
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-goog-user-project': PROJECT,
        },
      });
      if (res.ok) return await res.json();
      lastErr = `GET ${label} returned ${res.status}`;
    } catch (err) {
      lastErr = `GET ${label} failed: ${err.message}`;
    }
    await new Promise((r) => setTimeout(r, 2500 * attempt));
  }
  fail(`${lastErr}: ${label}`);
}

// 1. Resolve the release → current ruleset for the named database.
const releaseUrl =
  `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases/${RELEASE}`;
const release = await fetchJson(releaseUrl, 'release', token);

const rulesetName = release?.rulesetName;
if (!rulesetName) fail('release has no rulesetName');
if (!release.name?.includes(`releases/${RELEASE}`)) {
  fail(`release returned unexpected path: ${release.name}`);
}

// 2. Download the live ruleset source.
const ruleset = await fetchJson(`https://firebaserules.googleapis.com/v1/${rulesetName}`, 'ruleset', token);
const source = ruleset?.source?.files?.[0]?.content ?? '';

if (normalize(source) !== local) {
  fail(`deployed ruleset ${rulesetName} differs from firestore.rules`);
}

console.log(
  `\u2713 live Firestore rules match repo firestore.rules\n  project=${PROJECT} database=${DATABASE} release=${release.name}\n  ruleset=${rulesetName} (${source.length} chars)`,
);