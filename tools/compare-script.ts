// Compares a script photo's transcription with the live role library (official roles and
// 自制角色), as step 2 of the script-from-photo skill (M6):
//   node tools/compare-script.ts <photo.json>
//
// photo.json: [["townsfolk", "钟表匠", "在你的首个夜晚，…"], …] — team, name and ability as printed.
// Prints one line per role: = identical (apart from punctuation), ≠ with a character diff to
// judge by meaning, ? not in the library, plus any other versions of the same character.
// Reads the library over HTTPS with the import token (SCRIPT-07), so it works in cloud sessions too.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { parseEnvFile, ROOT } from './lib/files.ts';
import { explainImportError, importEnv } from './lib/scriptImport.ts';
import { matchRoles, type LibraryRole, type PhotoRole } from './lib/scriptPhoto.ts';

const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/compare-script.ts <photo.json>');
  process.exit(2);
}
const photo = JSON.parse(readFileSync(file, 'utf8')) as PhotoRole[];
const envPath = join(ROOT, '.env.local');
const conn = importEnv({ ...(existsSync(envPath) ? parseEnvFile(readFileSync(envPath, 'utf8')) : {}), ...process.env });
if ('missing' in conn) {
  console.error(`✗ not set: ${conn.missing.join(', ')} (.env.local, or the cloud environment's variables)`);
  process.exit(1);
}
const supabase = createClient(conn.url, conn.key, { auth: { persistSession: false } });
const { data, error } = await supabase.rpc('script_import_library', { p_token: conn.token });
if (error) {
  console.error(`✗ ${explainImportError(error.message)}`);
  process.exit(1);
}
const library = data as LibraryRole[];

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
