// QA-04: no test may be skipped or focused.
const SKIP = /\b(?:it|test|describe|suite|bench)\s*\.\s*(skip|only|todo|fixme|skipIf|runIf)\b|\bx(?:it|describe|test)\s*\(|\btest\.fixme\b/;

export interface SkipFinding {
  path: string;
  line: number;
  text: string;
}

export function findSkippedTests(files: { path: string; text: string }[]): SkipFinding[] {
  const findings: SkipFinding[] = [];
  for (const { path, text } of files) {
    text.split(/\r?\n/).forEach((line, i) => {
      if (SKIP.test(line)) findings.push({ path, line: i + 1, text: line.trim() });
    });
  }
  return findings;
}
