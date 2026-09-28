select plan(1);

select is_empty(
  $$ select tablename::text from pg_tables where schemaname = 'public' and not rowsecurity $$,
  'SEC-01: every table in the public schema has row level security enabled'
);

select * from finish();
