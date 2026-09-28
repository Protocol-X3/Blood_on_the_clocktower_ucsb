// SEC-02: `--dist` scans the production build. SEC-03: `--repo` scans committed files.
// Literal values from .env.local (when present) are also searched for.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseEnvFile, ROOT, walk } from './lib/files.ts';
import { scanForSecrets } from './lib/secrets.ts';

const mode = process.argv[2];
const envPath = join(ROOT, '.env.local');
const env = existsSync(envPath) ? parseEnvFile(readFileSync(envPath, 'utf8')) : {};
const literals = ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_DB_URL', 'ANTHROPIC_API_KEY', ...(mode === '--repo' ? ['ADMIN_EMAIL'] : [])]
  .filter((k) => env[k])
  .map((k) => ({ name: k, value: env[k]! }));

let paths: string[];
if (mode === '--dist') {
  if (!existsSync(join(ROOT, 'dist'))) {
    console.error('✗ dist/ not found — run `npm run build` first');
    process.exit(1);
  }
  paths = walk(join(ROOT, 'dist'));
} else if (mode === '--repo') {
  paths = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((f) => f !== '.env.example' && !/\.(png|jpe?g|webp|ico|woff2?)$/.test(f))
    .map((f) => join(ROOT, f));
} else {
  console.error('usage: node tools/check-secrets.ts --dist | --repo');
  process.exit(2);
}

const files = paths.filter(existsSync).map((p) => ({ path: relative(ROOT, p), text: readFileSync(p, 'utf8') }));
const findings = scanForSecrets(files, literals);
for (const f of findings) console.error(`✗ ${f.path}: contains ${f.kind}`);
if (findings.length) process.exitCode = 1;
else console.log(`✓ no secrets in ${files.length} ${mode === '--dist' ? 'built' : 'committed'} files`);
