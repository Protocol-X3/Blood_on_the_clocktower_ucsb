import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
// BASE_URL points the tests at a deployed site (smoke runs); otherwise a local
// production preview is started.
const remote = process.env.BASE_URL;
// Locally, use the installed Chrome: the Playwright browser download times out
// on the owner's network. CI installs Playwright's own Chromium.
const channel = process.env.CI ? undefined : 'chrome';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.PW_JSON
    ? [['list'], ['json', { outputFile: process.env.PW_JSON }]]
    : process.env.CI
      ? [['github'], ['html', { open: 'never' }]]
      : [['list']],
  use: { baseURL: remote ?? `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  // Players are phone-first; the DM is laptop/iPad-first (design.md, Device targets).
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], channel } },
    { name: 'tablet', use: { ...devices['iPad Pro 11 landscape'], browserName: 'chromium', channel } },
  ],
  webServer: remote
    ? undefined
    : {
        command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
        port: PORT,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
