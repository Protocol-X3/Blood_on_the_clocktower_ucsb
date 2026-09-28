import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

// Test helpers (tests/support/users.ts) need the Supabase keys: from .env.local
// locally, from the environment in CI. Existing environment variables win.
Object.assign(process.env, { ...loadEnv('production', process.cwd(), ''), ...process.env });

const PORT = 4173;
// BASE_URL points the tests at a deployed site (smoke runs); otherwise a local
// production preview is started.
const remote = process.env.BASE_URL;
// Locally, use the installed Chrome: the Playwright browser download times out
// on the owner's network. CI installs Playwright's own Chromium.
const channel = process.env.CI ? undefined : 'chrome';

export default defineConfig({
  testDir: 'tests/e2e',
  globalTeardown: './tests/e2e/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  // Locally the tests share one free-tier cloud project: more parallel browsers overload its realtime service.
  workers: process.env.CI ? 2 : 3,
  reporter: process.env.PW_JSON
    ? [['list'], ['json', { outputFile: process.env.PW_JSON }]]
    : process.env.CI
      ? [['github'], ['html', { open: 'never' }]]
      : [['list']],
  // @prod tests check the production build, so they only run against the deployed site.
  grepInvert: remote ? undefined : /@prod/,
  use: { baseURL: remote ?? `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  // Players are phone-first; the DM is laptop/iPad-first (design.md, Device targets).
  projects: [
    // Admin and DM screens are laptop/tablet screens (the DM specs drive their players' phones themselves),
    // and only one admin can exist at a time: tablet only.
    { name: 'phone', use: { ...devices['Pixel 7'], channel }, testIgnore: /(admin|setup|live|sandbox|grimoire)\.spec\.ts/ },
    // Guest sign-in uses Supabase's anonymous sign-in, which is rate-limited per IP; run it on one profile.
    { name: 'tablet', use: { ...devices['iPad Pro 11 landscape'], browserName: 'chromium', channel }, testIgnore: /guest\.spec\.ts/ },
  ],
  webServer: remote
    ? undefined
    : {
        // A sandbox build (BOT-01/02): the bot tools are in, and it never overwrites dist/.
        command: `npm run build -- --mode sandbox --outDir dist-sandbox && npx vite preview --outDir dist-sandbox --port ${PORT} --strictPort`,
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
