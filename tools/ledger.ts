// QA-08: `node tools/ledger.ts update` rewrites the ledger from the tests;
// `node tools/ledger.ts check` fails if it's out of date, or if any count is
// lower than on origin/main.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readTestFiles, ROOT } from './lib/files.ts';
import { compareLedger, countIds, type Ledger } from './lib/ledger.ts';

const FILE = join(ROOT, 'docs', 'rules', 'test-ledger.json');
const REL = 'docs/rules/test-ledger.json';
const current = countIds(readTestFiles());

if (process.argv[2] === 'update') {
  writeFileSync(FILE, JSON.stringify(current, null, 2) + '\n');
  console.log(`✓ ledger updated (${Object.keys(current).length} IDs)`);
} else {
  const committed: Ledger = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
  let baseline: Ledger | null;
  try {
    baseline = JSON.parse(execFileSync('git', ['show', `origin/main:${REL}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch {
    baseline = null; // no ledger on main yet
  }
  const { outdated, decreased } = compareLedger(current, committed, baseline);
  for (const o of outdated) console.error(`✗ ledger out of date — ${o}`);
  for (const d of decreased) console.error(`✗ fewer tests than on main — ${d}`);
  if (outdated.length) console.error('\nRun `npm run ledger:update` and commit the ledger with the tests.');
  if (outdated.length || decreased.length) process.exitCode = 1;
  else console.log(`✓ test ledger up to date (${Object.keys(current).length} IDs, none decreased)`);
}
