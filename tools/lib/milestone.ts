// QA-09: every exit criterion of a milestone must be named by at least one
// passing test, and by no failing test.
import { CRITERION_ID } from './ids.ts';

export interface TestResult {
  title: string;
  status: 'passed' | 'failed' | 'skipped';
}

export interface CriterionStatus {
  id: string;
  passed: number;
  failed: number;
  ok: boolean;
}

export function evaluateCriteria(criteria: string[], results: TestResult[]): CriterionStatus[] {
  return criteria.map((id) => {
    const hits = results.filter((r) => [...r.title.matchAll(new RegExp(CRITERION_ID.source, 'g'))].some((m) => m[1] === id));
    const passed = hits.filter((r) => r.status === 'passed').length;
    const failed = hits.filter((r) => r.status !== 'passed').length;
    return { id, passed, failed, ok: passed > 0 && failed === 0 };
  });
}

/** Test results from Vitest's JSON reporter. */
export function fromVitestJson(json: unknown): TestResult[] {
  const files = (json as { testResults?: { assertionResults?: { fullName?: string; title?: string; status?: string }[] }[] })
    .testResults ?? [];
  return files.flatMap((f) =>
    (f.assertionResults ?? []).map((a) => ({
      title: a.fullName ?? a.title ?? '',
      status: a.status === 'passed' ? ('passed' as const) : a.status === 'failed' ? ('failed' as const) : ('skipped' as const),
    })),
  );
}

interface PwSuite {
  title?: string;
  specs?: { title: string; tests?: { projectName?: string; status?: string }[] }[];
  suites?: PwSuite[];
}

/** Test results from Playwright's JSON reporter (one result per spec and project). */
export function fromPlaywrightJson(json: unknown): TestResult[] {
  const out: TestResult[] = [];
  const visit = (suite: PwSuite, path: string[]) => {
    const here = suite.title ? [...path, suite.title] : path;
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const status = t.status === 'expected' || t.status === 'flaky' ? 'passed' : t.status === 'skipped' ? 'skipped' : 'failed';
        out.push({ title: [...here, spec.title, `[${t.projectName ?? ''}]`].join(' › '), status });
      }
    }
    for (const s of suite.suites ?? []) visit(s, here);
  };
  for (const s of (json as { suites?: PwSuite[] }).suites ?? []) visit(s, []);
  return out;
}

/** Test results from our pgTAP runner: TAP lines such as "ok 1 - SEC-01: …". */
export function fromTap(lines: string[]): TestResult[] {
  return lines
    .map((l) => /^(not ok|ok)\s+\d+\s*-?\s*(.*)$/.exec(l.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ title: m[2]!, status: m[1] === 'ok' ? ('passed' as const) : ('failed' as const) }));
}

/** QA-11: a finished milestone needs its saved report and its git tag. */
export function certificationProblems(milestone: string, found: { report: boolean; tag: boolean }): string[] {
  const n = milestone.slice(1);
  return [
    ...(found.report ? [] : [`missing report docs/reports/${milestone}.md`]),
    ...(found.tag ? [] : [`missing git tag m${n}-done`]),
  ];
}
