// Saves a script made from a photo (M6) into the database, as the owner's admin account:
//   node tools/save-script.ts <spec.json> [--dry-run]
//
// spec.json:
//   {
//     "name": "钟声来了",
//     "author": "Bruce C.",            // or null
//     "roles": [                       // in script order
//       "clockmaker",                  // a library role id
//       { "custom": { "name": "卡牌大师", "team": "townsfolk", "ability": "…", "glyph": "牌", "reminders": [] } }
//     ]
//   }
//
// Everything runs in one transaction through the same RPCs the app uses (create_custom_role,
// save_script), so their checks apply and the owner owns the result. A custom role lands in
// the 自制角色 collection. --dry-run does all of it, prints the result and rolls back.
// Secret values are never printed.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { parseEnvFile, ROOT } from './lib/files.ts';

type Team = 'townsfolk' | 'outsider' | 'minion' | 'demon';
interface CustomRole {
  name: string;
  team: Team;
  ability: string;
  glyph?: string | null;
  reminders?: string[];
}
interface Spec {
  name: string;
  author?: string | null;
  roles: (string | { custom: CustomRole })[];
}

const [file, flag] = process.argv.slice(2);
if (!file || (flag && flag !== '--dry-run')) {
  console.error('usage: node tools/save-script.ts <spec.json> [--dry-run]');
  process.exit(2);
}
const dryRun = flag === '--dry-run';
const spec = JSON.parse(readFileSync(file, 'utf8')) as Spec;
const envPath = join(ROOT, '.env.local');
const env = { ...(existsSync(envPath) ? parseEnvFile(readFileSync(envPath, 'utf8')) : {}), ...process.env } as Record<string, string>;
if (!env.SUPABASE_DB_URL || !env.ADMIN_EMAIL) {
  console.error('✗ SUPABASE_DB_URL and ADMIN_EMAIL must be set (.env.local)');
  process.exit(1);
}

const local = /localhost|127\.0\.0\.1/.test(env.SUPABASE_DB_URL);
const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: local ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query('begin');
  const owner = (await client.query(`select id from auth.users where email = $1`, [env.ADMIN_EMAIL])).rows[0]?.id;
  if (!owner) throw new Error('the admin account has not signed in yet');
  if ((await client.query(`select 1 from public.scripts where name = $1`, [spec.name])).rowCount) throw new Error(`a script named ${spec.name} already exists`);
  // Act as the owner, like the app does, so RLS and the RPCs' own checks apply.
  await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: owner, role: 'authenticated' })]);
  await client.query('set local role authenticated');

  const ids: string[] = [];
  for (const r of spec.roles) {
    if (typeof r === 'string') {
      ids.push(r);
      continue;
    }
    const c = r.custom;
    // A 自制角色 made for an earlier script is reused by its id, never created twice.
    const clash = (await client.query(`select id, edition from public.roles where name = $1`, [c.name])).rows[0];
    if (clash) throw new Error(`a role named ${c.name} already exists (${clash.id}, ${clash.edition}); use its id or pick another name`);
    const { rows } = await client.query(`select public.create_custom_role($1, $2::public.team, $3, $4, $5::text[]) as id`, [
      c.name,
      c.team,
      c.ability,
      c.glyph ?? null,
      c.reminders ?? [],
    ]);
    ids.push(rows[0].id);
  }
  const script = (await client.query(`select public.save_script(null, $1, $2, $3::text[]) as id`, [spec.name, spec.author ?? null, ids])).rows[0].id;

  // Read it back: every role, in order, with its team and collection.
  const { rows } = await client.query(
    `select sr.position, r.id, r.name, r.team, r.edition, r.is_official
     from public.script_roles sr join public.roles r on r.id = sr.role_id
     where sr.script_id = $1 order by sr.position`,
    [script],
  );
  const counts = rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.team]: (m[r.team] ?? 0) + 1 }), {});
  console.log(`${dryRun ? '[dry run] ' : ''}${spec.name}${spec.author ? ` · ${spec.author}` : ''} · ${rows.length} roles`, counts);
  for (const r of rows) console.log(`  ${String(r.position).padStart(2)} ${r.team.padEnd(9)} ${r.name} (${r.id}, ${r.edition}${r.is_official ? '' : ', new 自制角色'})`);
  if (rows.length !== spec.roles.length) throw new Error(`expected ${spec.roles.length} roles, read back ${rows.length}`);

  await client.query(dryRun ? 'rollback' : 'commit');
  console.log(dryRun ? '✓ dry run: rolled back, nothing saved' : `✓ saved script ${script}`);
} catch (e) {
  await client.query('rollback');
  console.error('✗ rolled back:', (e as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
