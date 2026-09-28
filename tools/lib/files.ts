import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));

export function walk(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    if (name === 'node_modules' || name.startsWith('.')) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const TEST_FILE = /\.(test|spec)\.(ts|tsx)$|\.test\.sql$/;

/** All test files (unit, integration, E2E, pgTAP) with their text, paths relative to the repo root. */
export function readTestFiles(): { path: string; text: string }[] {
  return [join(ROOT, 'tests'), join(ROOT, 'supabase', 'tests')]
    .flatMap(walk)
    .filter((f) => TEST_FILE.test(f))
    .map((f) => ({ path: relative(ROOT, f).replaceAll('\\', '/'), text: readFileSync(f, 'utf8') }));
}

export function readRuleFiles(): { path: string; text: string }[] {
  return walk(join(ROOT, 'docs', 'rules'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ path: relative(ROOT, f).replaceAll('\\', '/'), text: readFileSync(f, 'utf8') }));
}

/** Parses KEY=value lines (as in .env.local). Values are never logged by callers. */
export function parseEnvFile(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
  }
  return env;
}
