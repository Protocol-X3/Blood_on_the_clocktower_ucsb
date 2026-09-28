// SEC-02 / SEC-03: find secrets in built output or committed files.

const PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'Supabase secret key', re: /sb_secret_[A-Za-z0-9_-]{16,}/ },
  { name: 'Anthropic API key', re: /sk-ant-[A-Za-z0-9_-]{16,}/ },
  { name: 'Google OAuth client secret', re: /GOCSPX-[A-Za-z0-9_-]{16,}/ },
];

const DB_URL = /postgres(?:ql)?:\/\/[^:\s/'"`]+:([^@\s'"`]{6,})@/g;
// Documentation placeholders, not real passwords.
const PLACEHOLDER = /^(?:password|\[?YOUR-PASSWORD\]?|<[^>]+>|\$\{[^}]+\}|\*+|x+)$/i;

function hasRealDbPassword(text: string): boolean {
  return [...text.matchAll(DB_URL)].some((m) => !PLACEHOLDER.test(m[1]!));
}

/** True when a JWT's payload claims the service_role. */
function isServiceRoleJwt(token: string): boolean {
  const payload = token.split('.')[1];
  if (!payload) return false;
  try {
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { role?: string };
    return json.role === 'service_role';
  } catch {
    return false;
  }
}

export interface SecretFinding {
  path: string;
  kind: string;
}

/**
 * Scans files for secret patterns, service-role JWTs, and any of the given
 * literal values (e.g. from .env.local). Findings never include the secret itself.
 */
export function scanForSecrets(
  files: { path: string; text: string }[],
  literals: { name: string; value: string }[] = [],
): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const values = literals.filter((l) => l.value.length >= 8);
  for (const { path, text } of files) {
    for (const { name, re } of PATTERNS) if (re.test(text)) findings.push({ path, kind: name });
    if (hasRealDbPassword(text)) findings.push({ path, kind: 'Postgres URL with password' });
    for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g)) {
      if (isServiceRoleJwt(m[0])) findings.push({ path, kind: 'service_role JWT' });
    }
    for (const { name, value } of values) if (text.includes(value)) findings.push({ path, kind: `value of ${name}` });
  }
  return findings;
}
