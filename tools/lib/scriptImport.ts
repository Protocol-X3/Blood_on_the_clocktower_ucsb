// SCRIPT-07: what the script-from-photo tools share. They reach Supabase over HTTPS (the
// only traffic a cloud session's proxy carries) with the public publishable key and a
// single-purpose import token; the database functions script_import_library and
// import_script check the token. Secret values are never printed.

export const IMPORT_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'SCRIPT_IMPORT_TOKEN'] as const;

export interface ImportEnv {
  url: string;
  key: string;
  token: string;
}

/** The connection settings, or the names of the ones that are missing. */
export function importEnv(env: Record<string, string | undefined>): ImportEnv | { missing: string[] } {
  const missing = IMPORT_ENV.filter((k) => !env[k]);
  if (missing.length) return { missing };
  return { url: env.VITE_SUPABASE_URL!, key: env.VITE_SUPABASE_PUBLISHABLE_KEY!, token: env.SCRIPT_IMPORT_TOKEN! };
}

type Team = 'townsfolk' | 'outsider' | 'minion' | 'demon';
export interface CustomRole {
  name: string;
  team: Team;
  ability: string;
  glyph?: string | null;
  reminders?: string[];
}
export interface ScriptSpec {
  name: string;
  author?: string | null;
  replace?: boolean;
  roles: (string | { custom: CustomRole })[];
}

/** Custom roles whose name is already in the library: they must reuse its id instead (never created twice). */
export function roleNameClashes(spec: ScriptSpec, library: { id: string; name: string; edition: string }[]): string[] {
  const byName = new Map(library.map((r) => [r.name, r]));
  return spec.roles.flatMap((r) => {
    if (typeof r === 'string') return [];
    const hit = byName.get(r.custom.name.trim());
    return hit ? [`a role named ${r.custom.name} already exists (${hit.id}, ${hit.edition}); use its id or pick another name`] : [];
  });
}

/** What a refusal from the database means for whoever runs the tool. */
export function explainImportError(code: string, spec?: ScriptSpec): string {
  switch (code) {
    case 'IMPORT_TOKEN_INVALID':
      return 'SCRIPT_IMPORT_TOKEN is missing or out of date. On the owner\'s PC, `node tools/db.ts import-token` makes a new one (in .env.local); copy it to the cloud environment\'s variables.';
    case 'ADMIN_NOT_SIGNED_IN':
      return 'the admin account has not signed in yet, so no one can own the script';
    case 'SCRIPT_NAME_TAKEN':
      return `a script named ${spec?.name} already exists; ask the owner (replace, new name or stop)`;
    case 'SCRIPT_NOT_FOUND':
      return `"replace" is set, but there is no script named ${spec?.name}`;
    case 'ROLE_NAME_TAKEN':
      return 'a custom role has the name of a role already in the library; use its id or pick another name';
    case 'IMPORT_SPEC_INVALID':
      return 'the spec is malformed: it needs a name and roles (ids, or {"custom": {name, team, ability, glyph, reminders}})';
    default:
      return code;
  }
}
