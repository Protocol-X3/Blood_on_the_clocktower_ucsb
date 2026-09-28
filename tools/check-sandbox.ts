// BOT-01: scans the production build (dist/) for bot-sandbox code.
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT, walk } from './lib/files.ts';
import { findSandboxCode } from './lib/sandbox.ts';

const dist = join(ROOT, 'dist');
if (!existsSync(dist)) {
  console.error('✗ dist/ not found — run `npm run build` first');
  process.exit(1);
}
const files = walk(dist)
  .filter((p) => /\.(js|html|css|map)$/.test(p))
  .map((p) => ({ path: relative(ROOT, p), text: readFileSync(p, 'utf8') }));
const found = findSandboxCode(files);
for (const f of found) console.error(`✗ ${f.path}: contains sandbox code (${f.marker})`);
if (found.length) process.exitCode = 1;
else console.log(`✓ no bot-sandbox code in ${files.length} built files`);
