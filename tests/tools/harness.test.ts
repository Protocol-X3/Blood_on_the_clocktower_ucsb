// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readTestFiles, ROOT } from '../../tools/lib/files.ts';

const read = (f: string) => readFileSync(join(ROOT, f), 'utf8');
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

describe('test harness', () => {
  it('QA-01: verify runs every local check, in order, and stops at the first failure', () => {
    const steps = pkg.scripts.verify!.split('&&').map((s) => s.trim());
    expect(steps).toEqual([
      'npm run typecheck',
      'npm run lint',
      'npm run check:rules',
      'npm run ledger:check',
      'npm run test:unit',
      'npm run test:integration',
      'npm run test:db',
      'npm run test:e2e',
      'npm run secrets:dist',
      'npm run secrets:repo',
    ]);
    expect(pkg.scripts.lint).toContain('check-no-skip');
    expect(pkg.scripts['test:unit']).toContain('--coverage');
  });

  it('QA-02: CI runs on every push, with the full suite against a fresh Docker database', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toMatch(/on:\s*\n\s+push:/);
    expect(ci).toContain('name: Checks');
    expect(ci).toContain('name: Full stack');
    expect(ci).toContain('supabase start');
    for (const step of ['npm run typecheck', 'npm run lint', 'npm run check:rules', 'npm run ledger:check', 'npm run test:unit', 'npm run test:integration', 'npm run test:db', 'npm run test:e2e', 'npm run secrets:dist', 'npm run secrets:repo']) {
      expect(ci).toContain(step);
    }
  });

  it('QA-03: coverage gates are 100% lines / 95% branches on src/lib and 70% elsewhere', () => {
    const config = read('vite.config.ts');
    expect(config).toMatch(/'src\/lib\/\*\*': \{ lines: 100, branches: 95, functions: 100, statements: 100 \}/);
    expect(config).toMatch(/lines: 70,/);
  });

  it('QA-06: mutation testing fails below an 85% score on src/lib', () => {
    const stryker = JSON.parse(read('stryker.config.json')) as { mutate: string[]; thresholds: { break: number } };
    expect(stryker.mutate).toEqual(['src/lib/**/*.ts']);
    expect(stryker.thresholds.break).toBe(85);
  });

  it('M0.3: every test layer is wired up and has real tests', () => {
    const tests = readTestFiles();
    const count = (dir: string) => tests.filter((t) => t.path.startsWith(dir)).length;
    expect(count('tests/unit/')).toBeGreaterThan(0);
    expect(count('tests/tools/')).toBeGreaterThan(0);
    expect(count('tests/integration/')).toBeGreaterThan(0);
    expect(count('tests/e2e/')).toBeGreaterThan(0);
    expect(count('supabase/tests/')).toBeGreaterThan(0);
    expect(tests.some((t) => t.text.includes('fc.assert('))).toBe(true); // property-based
    expect(read('playwright.config.ts')).toMatch(/name: 'phone'[\s\S]*name: 'tablet'/);
    expect(existsSync(join(ROOT, 'stryker.config.json'))).toBe(true);
    expect(readdirSync(join(ROOT, 'supabase', 'tests')).some((f) => f.endsWith('.test.sql'))).toBe(true);
  });
});
