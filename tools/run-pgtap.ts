// Runs every supabase/tests/*.test.sql file against SUPABASE_DB_URL and reports
// TAP results. Each test file wraps itself in begin … rollback, so it leaves no
// trace. Works against the cloud project locally and Docker Supabase in CI.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import pg from 'pg';
import { parseEnvFile, ROOT, walk } from './lib/files.ts';
import { fromTap, type TestResult } from './lib/milestone.ts';

const envPath = join(ROOT, '.env.local');
const dbUrl = process.env.SUPABASE_DB_URL ?? (existsSync(envPath) ? parseEnvFile(readFileSync(envPath, 'utf8')).SUPABASE_DB_URL : undefined);
if (!dbUrl) {
  console.error('✗ SUPABASE_DB_URL is not set');
  process.exit(1);
}
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : undefined;

const files = walk(join(ROOT, 'supabase', 'tests')).filter((f) => f.endsWith('.test.sql')).sort();
const results: (TestResult & { file: string })[] = [];
let failed = false;

const client = new pg.Client({ connectionString: dbUrl, ssl: dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  for (const file of files) {
    const lines: string[] = [];
    try {
      const res = await client.query(readFileSync(file, 'utf8'));
      for (const r of Array.isArray(res) ? res : [res]) {
        for (const row of r.rows ?? []) for (const v of Object.values(row)) if (typeof v === 'string') lines.push(...v.split('\n'));
      }
    } catch (e) {
      await client.query('rollback').catch(() => undefined);
      lines.push(`not ok 0 - ${basename(file)} errored: ${(e as Error).message}`);
    }
    const tap = fromTap(lines);
    const planned = lines.map((l) => /^1\.\.(\d+)/.exec(l.trim())).find(Boolean);
    if (planned && Number(planned[1]) !== tap.length) {
      tap.push({ title: `${basename(file)}: planned ${planned[1]} tests but ran ${tap.length}`, status: 'failed' });
    }
    for (const t of tap) {
      results.push({ ...t, file: basename(file) });
      console.log(`${t.status === 'passed' ? '✓' : '✗'} ${basename(file)} › ${t.title}`);
      if (t.status !== 'passed') failed = true;
    }
    if (tap.length === 0) {
      failed = true;
      console.error(`✗ ${basename(file)} produced no TAP results`);
    }
  }
} finally {
  await client.end();
}

if (jsonOut) {
  mkdirSync(dirname(jsonOut), { recursive: true });
  writeFileSync(jsonOut, JSON.stringify(results, null, 2));
}
console.log(`\n${results.filter((r) => r.status === 'passed').length}/${results.length} pgTAP assertions passed`);
if (failed) process.exitCode = 1;
