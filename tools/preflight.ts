// QA-07: checks the automatable phase entry requirements (roadmap.md, Phase
// transitions). Prints PASS/FAIL per item and never prints a value.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnvFile, ROOT } from './lib/files.ts';
import { checkAuthSettings, checkEnv, formatChecks, type Check } from './lib/preflight.ts';

const envPath = join(ROOT, '.env.local');
const env = { ...(existsSync(envPath) ? parseEnvFile(readFileSync(envPath, 'utf8')) : {}), ...process.env } as Record<string, string>;
const checks: Check[] = checkEnv(env);

try {
  const r = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '' } });
  checks.push({ id: 'E0.4', label: 'Supabase project reachable', pass: r.ok, hint: r.ok ? undefined : `HTTP ${r.status}` });
  if (r.ok) checks.push(...checkAuthSettings(await r.json()));
} catch (e) {
  checks.push({ id: 'E0.4', label: 'Supabase project reachable', pass: false, hint: (e as Error).message });
}

try {
  const out = execFileSync('gh', ['api', 'repos/Protocol-X3/Blood_on_the_clocktower_ucsb/deployments', '--jq', '[.[] | select(.creator.login == "vercel[bot]")] | length'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const n = Number(out.trim());
  checks.push({ id: 'E0.5', label: 'Vercel connected to the repo', pass: n > 0, hint: n > 0 ? undefined : 'no Vercel deployments found' });
} catch {
  checks.push({ id: 'E0.5', label: 'Vercel connected to the repo', pass: false, hint: 'gh api failed (is gh signed in?)' });
}

console.log(formatChecks(checks));
if (checks.some((c) => !c.pass)) process.exitCode = 1;
