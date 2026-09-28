// Reads, and optionally sets, the bot-sandbox switch (BOT-01) straight in the database, so
// tests can turn it on and afterwards put back whatever the admin had chosen.
import pg from 'pg';

export async function botSandbox(on?: boolean): Promise<boolean> {
  const dbUrl = process.env.SUPABASE_DB_URL!;
  const local = /localhost|127\.0\.0\.1/.test(dbUrl);
  const client = new pg.Client({ connectionString: dbUrl, ssl: local ? false : { rejectUnauthorized: false } });
  await client.connect();
  try {
    if (on !== undefined) {
      await client.query(
        `insert into private.app_config (key, value) values ('bot_sandbox', $1)
         on conflict (key) do update set value = excluded.value`,
        [on ? 'on' : 'off'],
      );
    }
    const { rows } = await client.query(`select value from private.app_config where key = 'bot_sandbox'`);
    return rows[0]?.value === 'on';
  } finally {
    await client.end();
  }
}
