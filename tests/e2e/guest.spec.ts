import { clientFor } from '../support/users.ts';
import { expect, otherBrowser, signIn, test } from './support/session.ts';

test('M1.3 · AUTH-02 · ROOM-04 · ROOM-13: a player opens a room link, finds only Google sign-in, joins and sits; the DM sees it within 3 s', async ({ page, browser, users }) => {
  const dm = await users.make({ level: 'dm_eligible' });
  const code = (await (await clientFor(dm)).rpc('create_room', { p_seat_count: 8 })).data!;
  const dmPage = await otherBrowser(browser, dm);
  await dmPage.goto(`/room/${code}`);
  await expect(dmPage.getByTestId('seat-3')).toContainText('空座');

  // AUTH-02: signed out, the room link leads to a sign-in page with Google only, no guest option.
  await page.goto(`/room/${code}`);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: '使用 Google 登录' })).toBeVisible();
  await expect(page.getByRole('button', { name: '以游客身份进入' })).toHaveCount(0);
  await expect(page.getByLabel('游客昵称')).toHaveCount(0);

  // Signed in, the player lands in the room and takes a seat.
  const player = await users.make();
  await signIn(page, player);
  await page.goto(`/room/${code}`);
  await expect(page.getByTestId('room-code')).toHaveText(code);
  await page.getByTestId('seat-3').getByRole('button', { name: '坐下' }).click();
  await expect(page.getByTestId('seat-3')).toContainText(player.nickname!);

  // The DM's screen updates by itself.
  await expect(dmPage.getByTestId('seat-3')).toContainText(player.nickname!, { timeout: 3000 });
  await dmPage.context().close();
});
