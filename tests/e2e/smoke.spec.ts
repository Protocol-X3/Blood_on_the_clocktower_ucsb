import { expect, test } from '@playwright/test';

// Run against the deployed site with BASE_URL=https://botc-ucsb.vercel.app --grep @smoke,
// and locally against the production preview as part of the normal E2E run.

test('@smoke DEP-01 · M0.1: the site loads (signed-out visitors land on the sign-in page)', async ({ page }) => {
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

test('@smoke M1.8 · AUTH-01: "使用 Google 登录" goes to Google with this app’s client', async ({ page }) => {
  await page.goto('/login');
  const toGoogle = page.waitForRequest((r) => r.url().startsWith('https://accounts.google.com/'));
  await page.getByRole('button', { name: '使用 Google 登录' }).click();
  const request = await toGoogle;
  const params = new URL(request.url()).searchParams;
  expect(params.get('client_id')).toMatch(/\.apps\.googleusercontent\.com$/);
  expect(params.get('redirect_uri')).toMatch(/\/auth\/v1\/callback$/);
});
