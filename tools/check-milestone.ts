// QA-09 / roadmap "Exit criteria": `node tools/check-milestone.ts M1 [--certify]`
// Runs every gate that can be checked from here and proves each exit criterion
// of the milestone with a passing tagged test. Exits non-zero if anything fails.
//   --certify  also requires the saved report and the git tag (G11).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkBranchProtection } from './lib/branchProtection.ts';
import { parseEnvFile, ROOT } from './lib/files.ts';
import { parseCriteria } from './lib/ids.ts';
import { supabaseCli } from './lib/supabaseCli.ts';
import { certificationProblems, evaluateCriteria, fromPlaywrightJson, fromVitestJson, type TestResult } from './lib/milestone.ts';

const milestone = process.argv[2];
if (!milestone || !/^M\d$/.test(milestone)) {
  console.error('usage: node tools/check-milestone.ts M<n> [--certify]');
  process.exit(2);
}
const certify = process.argv.includes('--certify');
const n = milestone.slice(1);
const DEPLOYED = 'https://botc-ucsb.vercel.app';
const RESULTS = join(ROOT, 'reports', 'results');
mkdirSync(RESULTS, { recursive: true });

const envPath = join(ROOT, '.env.local');
const env = { ...(existsSync(envPath) ? parseEnvFile(readFileSync(envPath, 'utf8')) : {}), ...process.env } as Record<string, string>;

const gates: { id: string; label: string; ok: boolean; detail?: string }[] = [];
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(id: string, label: string, cmd: string, args: string[], extraEnv: Record<string, string> = {}) {
  console.log(`\n▶ ${id} ${label}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...extraEnv }, shell: process.platform === 'win32' });
  gates.push({ id, label, ok: r.status === 0 });
  return r.status === 0;
}

function readJson(file: string): unknown {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

// G1 / G3 / G4 — the local gate, with machine-readable results.
run('G1', 'typecheck', npm, ['run', 'typecheck']);
run('G1', 'lint + no skipped tests (QA-04)', npm, ['run', 'lint']);
run('G3', 'every rule has a test (QA-05)', npm, ['run', 'check:rules']);
run('QA-08', 'test ledger', npm, ['run', 'ledger:check']);
run('G1/G4', 'unit + integration tests with coverage', npx, [
  'vitest', 'run', '--coverage', '--reporter=default', '--reporter=json', `--outputFile.json=${join(RESULTS, 'vitest.json')}`,
]);
run('G1', 'database tests (pgTAP)', 'node', ['tools/run-pgtap.ts', '--json', join(RESULTS, 'pgtap.json')]);
run('G1', 'E2E tests (phone + tablet)', npx, ['playwright', 'test'], { PW_JSON: join(RESULTS, 'e2e.json') });
run('SEC-02', 'no secrets in the build', 'node', ['tools/check-secrets.ts', '--dist']);
run('SEC-03', 'no secrets in the repo', 'node', ['tools/check-secrets.ts', '--repo']);
run('G5', 'mutation score ≥ 85%', npm, ['run', 'mutate']);
console.log('\n▶ G6 database matches migrations');
const migrations = supabaseCli(['migration', 'list', '--db-url', env.SUPABASE_DB_URL ?? '']);
console.log(migrations.stdout);
// Every row of the table lists a local and a remote version; a missing remote means unapplied.
const unapplied = migrations.stdout.split('\n').filter((l) => /^\s*\d{14}\s*\|\s*\|/.test(l));
gates.push({ id: 'G6', label: 'database matches migrations', ok: migrations.status === 0 && unapplied.length === 0, detail: unapplied.length ? `${unapplied.length} unapplied` : undefined });
run('G7', `smoke tests against ${DEPLOYED}`, npx, ['playwright', 'test', '--grep', '@smoke'], {
  BASE_URL: DEPLOYED,
  PW_JSON: join(RESULTS, 'smoke.json'),
});

// G2 — CI green on this commit; G7 — Vercel deployed this commit.
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
function gh(args: string[]): string {
  try {
    return execFileSync('gh', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}
const runs = JSON.parse(gh(['run', 'list', '--commit', sha, '--workflow', 'CI', '--json', 'conclusion,status']) || '[]') as { conclusion: string; status: string }[];
gates.push({ id: 'G2', label: `CI green on ${sha.slice(0, 7)}`, ok: runs.length > 0 && runs.every((r) => r.status === 'completed' && r.conclusion === 'success') });
const deploys = JSON.parse(gh(['api', `repos/Protocol-X3/Blood_on_the_clocktower_ucsb/deployments?sha=${sha}&environment=Production`]) || '[]') as { id: number }[];
let deployed = false;
if (deploys[0]) {
  const statuses = JSON.parse(gh(['api', `repos/Protocol-X3/Blood_on_the_clocktower_ucsb/deployments/${deploys[0].id}/statuses`]) || '[]') as { state: string }[];
  deployed = statuses.some((s) => s.state === 'success');
}
gates.push({ id: 'G7', label: `Vercel production deployment of ${sha.slice(0, 7)} succeeded`, ok: deployed });

// QA-10 — branch protection.
const protection = gh(['api', 'repos/Protocol-X3/Blood_on_the_clocktower_ucsb/branches/main/protection']);
const protectionProblems = checkBranchProtection(protection ? JSON.parse(protection) : null);
gates.push({ id: 'QA-10', label: 'main requires CI (admins included)', ok: protectionProblems.length === 0, detail: protectionProblems.join('; ') });

// G8 — screenshots of this milestone's screens.
const shotsDir = join(ROOT, 'docs', 'reports', milestone);
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((f) => f.endsWith('.png')) : [];
gates.push({ id: 'G8', label: `screenshots in docs/reports/${milestone}/`, ok: shots.length > 0, detail: `${shots.length} files` });

// G10 — every exit criterion proven by a passing tagged test.
const results: TestResult[] = [
  ...fromVitestJson(readJson(join(RESULTS, 'vitest.json'))),
  ...fromPlaywrightJson(readJson(join(RESULTS, 'e2e.json'))),
  ...fromPlaywrightJson(readJson(join(RESULTS, 'smoke.json'))),
  ...((readJson(join(RESULTS, 'pgtap.json')) as TestResult[]) ?? []),
];
const roadmap = readFileSync(join(ROOT, 'docs', 'plan', 'roadmap.md'), 'utf8');
const criteria = parseCriteria(roadmap, milestone);
const statuses = evaluateCriteria(criteria, Array.isArray(results) ? results : []);
gates.push({ id: 'G10', label: `all ${criteria.length} ${milestone} criteria proven by passing tests`, ok: criteria.length > 0 && statuses.every((s) => s.ok) });

// G11 — certification artifacts.
if (certify) {
  const problems = certificationProblems(milestone, {
    report: existsSync(join(ROOT, 'docs', 'reports', `${milestone}.md`)),
    tag: gh(['api', `repos/Protocol-X3/Blood_on_the_clocktower_ucsb/git/ref/tags/m${n}-done`]).length > 0,
  });
  gates.push({ id: 'G11', label: `report docs/reports/${milestone}.md and tag m${n}-done`, ok: problems.length === 0, detail: problems.join('; ') });
}

console.log(`\n══════ ${milestone} exit check ══════`);
for (const s of statuses) console.log(`${s.ok ? '✓' : '✗'} ${s.id}  (${s.passed} passing, ${s.failed} failing tests)`);
for (const g of gates) console.log(`${g.ok ? '✓' : '✗'} ${g.id}  ${g.label}${g.detail ? ` — ${g.detail}` : ''}`);
const allOk = gates.every((g) => g.ok) && statuses.every((s) => s.ok);
console.log(allOk ? `\n✓ ${milestone} is DONE` : `\n✗ ${milestone} is NOT done`);
if (!allOk) process.exitCode = 1;
