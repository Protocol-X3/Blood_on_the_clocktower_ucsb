// Rule IDs (e.g. VOTE-07) and exit-criterion IDs (e.g. M1.3), and where they're
// defined and referenced. Pure functions: the CLIs in tools/ do the file I/O.

export const RULE_ID = /\b([A-Z]{2,}-\d{2,3})\b/g;
export const CRITERION_ID = /\b(M\d\.\d{1,2})\b/g;

export interface RuleCatalog {
  active: Map<string, string>; // id → file
  retired: Set<string>;
  duplicates: string[];
}

const DEFINED = /^\s*-\s+\*\*([A-Z]{2,}-\d{2,3})\*\*/;
const RETIRED = /^\s*-\s+~~\*\*([A-Z]{2,}-\d{2,3})\*\*/;

/** Reads rule definitions out of rule-catalog markdown files. Code blocks are format examples, not rules. */
export function parseRules(files: { path: string; text: string }[]): RuleCatalog {
  const active = new Map<string, string>();
  const retired = new Set<string>();
  const duplicates: string[] = [];
  for (const { path, text } of files) {
    let inCode = false;
    for (const line of text.split(/\r?\n/)) {
      if (line.trimStart().startsWith('```')) inCode = !inCode;
      if (inCode) continue;
      const r = RETIRED.exec(line);
      if (r) retired.add(r[1]!);
      const d = DEFINED.exec(line);
      if (d) {
        if (active.has(d[1]!)) duplicates.push(d[1]!);
        active.set(d[1]!, path);
      }
    }
  }
  return { active, retired, duplicates };
}

/** Every distinct ID matching `pattern` in `text`. */
export function findIds(text: string, pattern: RegExp): Set<string> {
  return new Set([...text.matchAll(new RegExp(pattern.source, 'g'))].map((m) => m[1]!));
}

/** Exit-criterion IDs of one milestone, from the roadmap's criteria tables (rows like `| M1.3 | …`). */
export function parseCriteria(roadmap: string, milestone: string): string[] {
  const row = new RegExp(`^\\|\\s*(${milestone.replace('.', '\\.')}\\.\\d{1,2})\\s*\\|`, 'gm');
  return [...new Set([...roadmap.matchAll(row)].map((m) => m[1]!))];
}

export interface CoverageReport {
  missing: string[]; // active rules with no test
  unknown: string[]; // referenced IDs that aren't defined (typos)
  covered: number;
}

/** The milestone currently being built, from the roadmap line "Current milestone: M<n>". */
export function currentMilestone(roadmap: string): number | null {
  const m = /Current milestone:\s*M(\d)/.exec(roadmap);
  return m ? Number(m[1]) : null;
}

/** Rule files of phases up to and including `current` (files are named m<n>-*.md). All files when current is null. */
export function inScope(file: string, current: number | null): boolean {
  const m = /(?:^|\/)m(\d)-[^/]*\.md$/.exec(file);
  return current === null || !m || Number(m[1]) <= current;
}

export function ruleCoverage(
  catalog: RuleCatalog,
  testFiles: { path: string; text: string }[],
  required: (file: string) => boolean = () => true,
): CoverageReport {
  const covered = new Set<string>();
  const unknown = new Set<string>();
  for (const { path, text } of testFiles) {
    for (const id of findIds(text, RULE_ID)) {
      if (catalog.active.has(id)) covered.add(id);
      else if (!catalog.retired.has(id)) unknown.add(`${id} in ${path}`);
    }
  }
  const missing = [...catalog.active].filter(([id, file]) => required(file) && !covered.has(id)).map(([id]) => id);
  return { missing, unknown: [...unknown], covered: covered.size };
}
