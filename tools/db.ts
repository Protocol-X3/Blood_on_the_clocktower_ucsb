// Database chores against SUPABASE_DB_URL (from the environment or .env.local):
//   node tools/db.ts push        apply pending migrations (supabase db push)
//   node tools/db.ts types       regenerate src/services/database.types.ts
//   node tools/db.ts set-admin   store ADMIN_EMAIL in private.app_config and grant admin (PERM-02)
// Secret values are never printed.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { parseEnvFile, ROOT } from './lib/files.ts';
import { supabaseCli } from './lib/supabaseCli.ts';

const envPath = join(ROOT, '.env.local');
const env = { ...(existsSync(envPath) ? parseEnvFile(readFileSync(envPath, 'utf8')) : {}), ...process.env } as Record<string, string>;
const dbUrl = env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('✗ SUPABASE_DB_URL is not set');
  process.exit(1);
}
const redact = (s: string) => s.replaceAll(dbUrl, '<db-url>');

const command = process.argv[2];
if (command === 'push') {
  const r = supabaseCli(['db', 'push', '--db-url', dbUrl, '--yes']);
  console.log(redact(`${r.stdout}${r.stderr}`));
  process.exitCode = r.status ?? 1;
} else if (command === 'types') {
  const r = supabaseCli(['gen', 'types', 'typescript', '--db-url', dbUrl, '--schema', 'public']);
  if (r.status !== 0) {
    console.error(redact(r.stderr));
    process.exit(1);
  }
  writeFileSync(join(ROOT, 'src', 'services', 'database.types.ts'), r.stdout);
  console.log('✓ wrote src/services/database.types.ts');
} else if (command === 'set-admin') {
  if (!env.ADMIN_EMAIL) {
    console.error('✗ ADMIN_EMAIL is not set');
    process.exit(1);
  }
  const local = /localhost|127\.0\.0\.1/.test(dbUrl);
  const client = new pg.Client({ connectionString: dbUrl, ssl: local ? false : { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(
      `insert into private.app_config (key, value) values ('admin_email', $1)
       on conflict (key) do update set value = excluded.value`,
      [env.ADMIN_EMAIL],
    );
    await client.query('select private.sync_admin()');
    const { rows } = await client.query(`select count(*)::int as n from public.profiles where permission = 'admin'`);
    console.log(`✓ admin email configured; admin accounts: ${rows[0].n} (0 until the owner first signs in with Google)`);
  } finally {
    await client.end();
  }
} else {
  console.error('usage: node tools/db.ts push | types | set-admin');
  process.exitCode = 2;
}
