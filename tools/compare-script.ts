// Compares a script photo's transcription with the live role library (official roles and
// 自制角色), as step 2 of the script-from-photo skill (M6):
//   node tools/compare-script.ts <photo.json>
//
// photo.json: [["townsfolk", "钟表匠", "在你的首个夜晚，…"], …] — team, name and ability as printed.
// Prints one line per role: = identical (apart from punctuation), ≠ with a character diff to
// judge by meaning, ? not in the library, plus any other versions of the same character.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { parseEnvFile, ROOT } from './lib/files.ts';
import { matchRoles, type LibraryRole, type PhotoRole } from './lib/scriptPhoto.ts';

const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/compare-script.ts <photo.json>');
  process.exit(2);
}
const photo = JSON.parse(readFileSync(file, 'utf8')) as PhotoRole[];
const envPath = join(ROOT, '.env.local');
const env = { ...(existsSync(envPath) ? parseEnvFile(readFileSync(envPath, 'utf8')) : {}), ...process.env } as Record<string, string>;
if (!env.SUPABASE_DB_URL) {
  console.error('✗ SUPABASE_DB_URL is not set');
  process.exit(1);
}
const local = /localhost|127\.0\.0\.1/.test(env.SUPABASE_DB_URL);
const client = new pg.Client({ connectionString: env.SUPABASE_DB_URL, ssl: local ? false : { rejectUnauthorized: false } });
await client.connect();
const library = (await client.query(`select id, name, team::text as team, ability, edition from public.roles order by is_official desc, id`)).rows as LibraryRole[];
await client.end();

const counts: Record<string, number> = {};
let identical = 0;
for (const m of matchRoles(photo, library)) {
  const [team, name, ability] = m.photo;
  counts[team] = (counts[team] ?? 0) + 1;
  if (!m.role) {
    console.log(`? ${name}: not in the library (no name match; no ability ≥60% alike). Check the wiki; otherwise a new 自制角色.\n    ${ability}`);
    continue;
  }
  const label = `${name} (${m.role.id}, ${m.role.edition}${m.how === 'ability' ? `, matched by ability as ${m.role.name}` : ''})`;
  const notes = [m.teamDiffers && `TEAM: library ${m.role.team}, photo ${team}`, m.versions.length && `OTHER VERSIONS: ${m.versions.map((v) => `${v.name} (${v.id})`).join(', ')}`].filter(Boolean);
  if (m.identical) identical++;
  console.log(`${m.identical ? '=' : '≠'} ${label}${notes.length ? `\n    ${notes.join(' · ')}` : ''}${m.identical ? '' : `\n    ${m.diff}`}`);
}
console.log(`\n${identical}/${photo.length} identical apart from punctuation · library: ${library.length} roles · photo teams:`, counts);
