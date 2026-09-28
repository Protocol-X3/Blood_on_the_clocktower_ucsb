import { test as base, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';
import { poolUser, storedSession, type TestUser, type UserOptions } from '../../support/users.ts';

/**
 * `users.make(opts)` hands each test fresh-state accounts from this worker's
 * own slots of the test-user pool (see tests/support/users.ts).
 */
export const test = base.extend<{ users: { make: (opts?: UserOptions) => Promise<TestUser> } }>({
  // eslint-disable-next-line no-empty-pattern
  users: async ({}, use, testInfo) => {
    let slot = 0;
    await use({ make: (opts) => poolUser(`w${testInfo.parallelIndex}-${slot++}`, opts) });
  },
});
export { expect } from '@playwright/test';

/** Starts the page signed in as `user` (the session is placed where supabase-js looks for it). */
export async function signIn(page: Page, user: TestUser): Promise<void> {
  const { key, value } = await storedSession(user);
  await page.addInitScript(
    ([k, v]) => {
      if (!window.localStorage.getItem(k)) window.localStorage.setItem(k, v);
    },
    [key, value] as const,
  );
}

/** A second, independent browser signed in as another user (e.g. the DM watching a player). */
export async function otherBrowser(browser: Browser, user: TestUser, options: BrowserContextOptions = {}): Promise<Page> {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await signIn(page, user);
  return page;
}
