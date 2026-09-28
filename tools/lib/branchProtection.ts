// QA-10: `main` must require the CI checks before merging, for admins too.

export const REQUIRED_CHECKS = ['Checks', 'Full stack'];

export function checkBranchProtection(protection: unknown, required = REQUIRED_CHECKS): string[] {
  const p = protection as {
    required_status_checks?: { strict?: boolean; contexts?: string[]; checks?: { context: string }[] };
    enforce_admins?: { enabled?: boolean };
  } | null;
  if (!p?.required_status_checks) return ['main has no required status checks'];
  const contexts = new Set([...(p.required_status_checks.contexts ?? []), ...(p.required_status_checks.checks ?? []).map((c) => c.context)]);
  const problems = required.filter((c) => !contexts.has(c)).map((c) => `required check missing: ${c}`);
  if (p.enforce_admins?.enabled !== true) problems.push('admins can bypass the required checks');
  return problems;
}
