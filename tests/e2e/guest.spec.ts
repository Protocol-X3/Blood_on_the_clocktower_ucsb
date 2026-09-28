import { admin, clientFor, deleteUsers, uniqueNickname } from '../support/users.ts';
import { expect, otherBrowser, test } from './support/session.ts';

// Real guest sign-in (Supabase anonymous auth), which is rate-limited per IP:
// runs on the phone profile only (see playwright.config.ts).
let guestNickname = '';
test.afterAll(async () => {
  const { data } = await admin.from('profiles').select('id').eq('nickname', guestNickname);
  await deleteUsers((data ?? []).map((p) => p.id));
});

test('M1.3 · AUTH-02 · ROOM-04 · ROOM-13: a guest signs in with a nickname, joins by code and sits; the DM sees it within 3 s', async ({ page, browser, users }) => {
  const dm = await users.make({ level: 'dm_eligible' });
  const code = (await (await clientFor(dm)).rpc('create_room', { p_seat_count: 8 })).data!;
  const dmPage = await otherBrowser(browser, dm);
  await dmPage.goto(`/room/${code}`);
  await expect(dmPage.getByTestId('seat-3')).toContainText('空座');

  // The guest opens the room link, signs in with just a nickname, and lands in the room.
  await page.goto(`/room/${code}`);
  guestNickname = uniqueNickname('游客');
  await page.getByLabel('游客昵称').fill(guestNickname);
  await page.getByRole('button', { name: '以游客身份进入' }).click();
  await expect(page.getByTestId('room-code')).toHaveText(code);
  await expect(page.getByRole('button', { name: `账号：${guestNickname}` })).toContainText('游客');

  await page.getByTestId('seat-3').getByRole('button', { name: '坐下' }).click();
  await expect(page.getByTestId('seat-3')).toContainText(guestNickname);

  // The DM's screen updates by itself.
  await expect(dmPage.getByTestId('seat-3')).toContainText(guestNickname, { timeout: 3000 });
  await dmPage.context().close();
});
