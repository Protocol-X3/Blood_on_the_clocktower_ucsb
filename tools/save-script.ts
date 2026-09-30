// Saves a script made from a photo (M6) into the database, as the owner's admin account:
//   node tools/save-script.ts <spec.json> [--dry-run]
//
// spec.json:
//   {
//     "name": "钟声来了",
//     "author": "Bruce C.",            // or null
//     "replace": false,                // true: overwrite the existing script of that name (owner's choice)
//     "roles": [                       // in script order
//       "clockmaker",                  // a library role id
//       { "custom": { "name": "卡牌大师", "team": "townsfolk", "ability": "…", "glyph": "牌", "reminders": [] } }
//     ]
//   }
//
// Runs over HTTPS with the import token (SCRIPT-07), so it works in cloud sessions too. The
// database's import_script does everything in one transaction through the same RPCs the app
// uses (create_custom_role, save_script), so their checks apply and the admin owns the result.
// A custom role lands in the 自制角色 collection. --dry-run does all of it, prints the result
// and rolls back. Secret values are never printed.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { parseEnvFile, ROOT } from './lib/files.ts';
import { explainImportError, importEnv, roleNameClashes, type ScriptSpec } from './lib/scriptImport.ts';

interface SavedRole {
  position: number;
  id: string;
  name: string;
  team: string;
  edition: string;
  is_official: boolean;
  created: boolean;
}
interface Saved {
  script: string;
  replaced: boolean;
  dry_run: boolean;
  roles: SavedRole[];
}

const [file, flag] = process.argv.slice(2);
if (!file || (flag && flag !== '--dry-run')) {
  console.error('usage: node tools/save-script.ts <spec.json> [--dry-run]');
  process.exit(2);
}
const dryRun = flag === '--dry-run';
const spec = JSON.parse(readFileSync(file, 'utf8')) as ScriptSpec;
const envPath = join(ROOT, '.env.local');
const conn = importEnv({ ...(existsSync(envPath) ? parseEnvFile(readFileSync(envPath, 'utf8')) : {}), ...process.env });
if ('missing' in conn) {
  console.error(`✗ not set: ${conn.missing.join(', ')} (.env.local, or the cloud environment's variables)`);
  process.exit(1);
}
const supabase = createClient(conn.url, conn.key, { auth: { persistSession: false } });

function fail(message: string): never {
  console.error(`✗ nothing saved: ${message}`);
  process.exit(1);
}

// Name clashes first, with the clashing role's id, before anything is created.
const library = await supabase.rpc('script_import_library', { p_token: conn.token });
if (library.error) fail(explainImportError(library.error.message, spec));
const clashes = roleNameClashes(spec, library.data as { id: string; name: string; edition: string }[]);
if (clashes.length) fail(clashes.join('\n  '));

const { data, error } = await supabase.rpc('import_script', { p_token: conn.token, p_spec: spec, p_dry_run: dryRun });
if (error) fail(explainImportError(error.message, spec));
const saved = data as Saved;

// The script as the database saved it: every role, in order, with its team and collection.
const counts = saved.roles.reduce<Record<string, number>>((m, r) => ({ ...m, [r.team]: (m[r.team] ?? 0) + 1 }), {});
console.log(`${dryRun ? '[dry run] ' : ''}${spec.name}${spec.author ? ` · ${spec.author}` : ''} · ${saved.roles.length} roles`, counts);
for (const r of saved.roles) {
  console.log(`  ${String(r.position).padStart(2)} ${r.team.padEnd(9)} ${r.name} (${r.id}, ${r.edition}${r.is_official ? '' : r.created ? ', new 自制角色' : ', 自制角色'})`);
}
if (saved.roles.length !== spec.roles.length) fail(`expected ${spec.roles.length} roles, the database has ${saved.roles.length}`);
console.log(dryRun ? '✓ dry run: rolled back, nothing saved' : `✓ ${saved.replaced ? 'replaced' : 'saved'} script ${saved.script}`);
