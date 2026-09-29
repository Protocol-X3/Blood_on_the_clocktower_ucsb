// QA-12: tests that create accounts, rooms or games run only against a local (Docker)
// Supabase, which is what CI uses. After launch the cloud project holds real players'
// data, so a local E2E or integration run must not fill it with test users. A deliberate
// run against it needs ALLOW_LIVE_TEST_DATA=1, and a cleanup afterwards (roadmap.md).

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/;

/** Why a test may not create data against this Supabase URL, or null when it may. */
export function liveDataRefusal(url: string, allow: string | undefined): string | null {
  if (LOCAL.test(url) || allow === '1') return null;
  return (
    `Refusing to create test accounts or games on ${url ? 'the live Supabase project' : 'an unset Supabase URL'}. ` +
    'Integration and E2E tests run in CI against a Docker database. ' +
    'To run them against the cloud project on purpose, set ALLOW_LIVE_TEST_DATA=1 and clean up afterwards.'
  );
}

export function assertTestDatabase(): void {
  const refusal = liveDataRefusal(process.env.VITE_SUPABASE_URL ?? '', process.env.ALLOW_LIVE_TEST_DATA);
  if (refusal) throw new Error(refusal);
}
