import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const vitestBin = resolve(root, 'node_modules', 'vitest', 'vitest.mjs');

const res = spawnSync(
  process.execPath,
  [vitestBin, 'run', '--config', 'vitest.rules.config.ts'],
  { cwd: root, stdio: 'inherit', env: process.env },
);
process.exit(res.status ?? 1);