// Generates a migration that upserts the official role library from
// supabase/data/official-roles.json (LIB-01). Usage:
//   node tools/gen-roles-migration.ts <migration-file-name>
// After the owner edits wording in the JSON, generate a new migration with a new timestamp.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/files.ts';
import { parseOfficialRoles, rolesUpsertSql } from './lib/roles.ts';

const name = process.argv[2];
if (!name || !/^\d{14}_[a-z0-9_]+\.sql$/.test(name)) {
  console.error('usage: node tools/gen-roles-migration.ts <yyyymmddhhmmss_name.sql>');
  process.exit(2);
}
const roles = parseOfficialRoles(JSON.parse(readFileSync(join(ROOT, 'supabase', 'data', 'official-roles.json'), 'utf8')));
writeFileSync(join(ROOT, 'supabase', 'migrations', name), rolesUpsertSql(roles));
console.log(`✓ wrote supabase/migrations/${name} (${roles.length} roles)`);
