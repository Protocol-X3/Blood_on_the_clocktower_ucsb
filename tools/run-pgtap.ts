// Runs every supabase/tests/*.test.sql file against SUPABASE_DB_URL and reports
// TAP results. Each file runs in its own transaction, together with the shared
// helpers in supabase/tests/helpers/, and is rolled back afterwards: it leaves
// no trace. Works against the cloud project locally and Docker Supabase in CI.
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
const only = process.argv.find((a) => a.endsWith('.test.sql'));

const testsDir = join(ROOT, 'supabase', 'tests');
const helpers = walk(join(testsDir, 'helpers'))
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');
const files = walk(testsDir)
  .filter((f) => f.endsWith('.test.sql') && (!only || f.endsWith(only)))
  .sort();

const results: (TestResult & { file: string })[] = [];
let failed = false;
const local = /localhost|127\.0\.0\.1/.test(dbUrl);
const client = new pg.Client({ connectionString: dbUrl, ssl: local ? false : { rejectUnauthorized: false } });
await client.connect();

try {
  for (const file of files) {
    const lines: string[] = [];
    const sql = ['begin;', 'create extension if not exists pgtap with schema extensions;', 'set local search_path = public, extensions;', helpers, readFileSync(file, 'utf8')].join('\n');
    try {
      const res = await client.query(sql);
      for (const r of Array.isArray(res) ? res : [res]) {
        for (const row of r.rows ?? []) for (const v of Object.values(row)) if (typeof v === 'string') lines.push(...v.split('\n'));
      }
    } catch (e) {
      lines.push(`not ok 0 - ${basename(file)} errored: ${(e as Error).message}`);
    } finally {
      await client.query('rollback').catch(() => undefined);
    }
    const tap = fromTap(lines);
    const planned = lines.map((l) => /^1\.\.(\d+)/.exec(l.trim())).find(Boolean);
    if (planned && Number(planned[1]) !== tap.length) {
      tap.push({ title: `${basename(file)}: planned ${planned[1]} tests but ran ${tap.length}`, status: 'failed' });
    }
    if (tap.length === 0) tap.push({ title: `${basename(file)}: produced no results`, status: 'failed' });
    for (const t of tap) {
      results.push({ ...t, file: basename(file) });
      if (t.status !== 'passed') {
        failed = true;
        console.log(`✗ ${basename(file)} › ${t.title}`);
        // pgTAP's diagnostics (got/expected) follow the failing line as "# …" lines.
        const at = lines.findIndex((l) => l.includes(`- ${t.title}`) && l.trim().startsWith('not ok'));
        for (const diag of at >= 0 ? lines.slice(at + 1) : []) {
          if (!diag.trim().startsWith('#')) break;
          console.log(`    ${diag.trim()}`);
        }
      }
    }
    const passed = tap.filter((t) => t.status === 'passed').length;
    console.log(`${passed === tap.length ? '✓' : '✗'} ${basename(file)}: ${passed}/${tap.length}`);
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
