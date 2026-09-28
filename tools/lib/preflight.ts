// QA-07: phase entry requirements that can be checked automatically.
// Results carry a label and pass/fail only — never a value.

export interface Check {
  id: string;
  label: string;
  pass: boolean;
  hint?: string;
}

const ENV_SHAPES: { key: string; test: (v: string) => boolean; hint: string }[] = [
  { key: 'VITE_SUPABASE_URL', test: (v) => /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(v), hint: 'https://<ref>.supabase.co, no path' },
  { key: 'VITE_SUPABASE_PUBLISHABLE_KEY', test: (v) => /^sb_publishable_/.test(v) || /^eyJ/.test(v), hint: 'sb_publishable_… key' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', test: (v) => /^sb_secret_/.test(v) || /^eyJ/.test(v), hint: 'sb_secret_… key' },
  {
    key: 'SUPABASE_DB_URL',
    test: (v) => /^postgres(ql)?:\/\/[^:]+:[^@]+@[^/]+\/postgres/.test(v) && !/YOUR-PASSWORD|\[|\]/.test(v),
    hint: 'postgresql://user:password@host:port/postgres',
  },
  { key: 'ADMIN_EMAIL', test: (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), hint: 'an email address' },
];

/** E0.3: every required key is present, non-empty and well-formed. */
export function checkEnv(env: Record<string, string | undefined>): Check[] {
  return ENV_SHAPES.map(({ key, test, hint }) => {
    const v = env[key] ?? '';
    const pass = v.length > 0 && test(v);
    return { id: 'E0.3', label: key, pass, hint: pass ? undefined : v ? `wrong format, expected ${hint}` : 'missing' };
  });
}

/** E1.2 / E1.3: sign-in providers, from Supabase's public /auth/v1/settings. */
export function checkAuthSettings(settings: unknown): Check[] {
  const s = (settings ?? {}) as { external?: Record<string, boolean>; disable_signup?: boolean };
  return [
    { id: 'E1.2', label: 'anonymous sign-ins enabled', pass: s.external?.anonymous_users === true },
    { id: 'E1.3', label: 'Google provider enabled', pass: s.external?.google === true },
    { id: 'E1.2', label: 'new sign-ups allowed', pass: s.disable_signup !== true },
  ];
}

export function formatChecks(checks: Check[]): string {
  return checks
    .map((c) => `${c.pass ? 'PASS' : 'FAIL'}  [${c.id}] ${c.label}${c.hint ? ` — ${c.hint}` : ''}`)
    .join('\n');
}
