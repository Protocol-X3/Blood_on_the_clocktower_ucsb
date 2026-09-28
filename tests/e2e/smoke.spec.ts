import { expect, test } from '@playwright/test';

// Run against the deployed site with BASE_URL=https://botc-ucsb.vercel.app --grep @smoke,
// and locally against the production preview as part of the normal E2E run.

test('@smoke DEP-01 · M0.1: the home page loads', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: '血染钟楼' })).toBeVisible();
});

test('@smoke DEP-02: a deep link loads the app instead of a server 404', async ({ page }) => {
  const response = await page.goto('/room/K7QX');
  expect(response?.status()).toBe(200);
  await expect(page.locator('#root h1')).toBeVisible();
  await expect(page.getByRole('heading', { name: '页面不存在' })).toHaveCount(0);
});
