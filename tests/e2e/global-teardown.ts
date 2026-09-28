// Runs after every E2E run, even a failed one: hands the admin role back from
// the test-account pool to the configured admin account (see tests/support/users.ts).
import pg from 'pg';

export default async function restoreRealAdmin(): Promise<void> {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) return;
  const local = /localhost|127\.0\.0\.1/.test(dbUrl);
  const client = new pg.Client({ connectionString: dbUrl, ssl: local ? false : { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(`
      update public.profiles p set permission = 'player'
      from auth.users u
      where u.id = p.id and p.permission = 'admin' and u.email like 'e2e-pool-%'`);
    await client.query('select private.sync_admin()');
  } finally {
    await client.end();
  }
}
