import { clientFor, forgetSession } from '../support/users.ts';
import { expect, signIn, test } from './support/session.ts';

test('AUTH-07 · AUTH-01: a signed-out visitor is sent to sign in, and lands back on the page afterwards', async ({ page, users }) => {
  const dm = await users.make({ level: 'dm_eligible' });
  const code = (await (await clientFor(dm)).rpc('create_room', {})).data!;
  await page.goto(`/room/${code}`);
  await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Froom%2F${code}$`));
  await expect(page.getByRole('button', { name: '使用 Google 登录' })).toBeVisible();

  // Returning from Google means arriving with a session: the app continues to the page asked for.
  await signIn(page, await users.make());
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/room/${code}$`));
  await expect(page.getByTestId('room-code')).toHaveText(code);
});

test('AUTH-04: a new user chooses a nickname before entering a room', async ({ page, users }) => {
  const dm = await users.make({ level: 'dm_eligible' });
  const code = (await (await clientFor(dm)).rpc('create_room', {})).data!;
  const fresh = await users.make({ nickname: null });
  await signIn(page, fresh);
  await page.goto(`/room/${code}`);
  await expect(page).toHaveURL(/\/welcome\?next=/);
  const nickname = `新人${Date.now() % 100000}`;
  await page.getByLabel('你的昵称').fill(nickname);
  await page.getByRole('button', { name: '确定' }).click();
  await expect(page.getByTestId('room-code')).toHaveText(code);
  await expect(page.getByRole('button', { name: `账号：${nickname}` })).toBeVisible();
});

test('AUTH-03: a nickname already in use is refused with a Chinese message', async ({ page, users }) => {
  const taken = await users.make();
  await signIn(page, await users.make({ nickname: null }));
  await page.goto('/welcome');
  await page.getByLabel('你的昵称').fill(taken.nickname!.toUpperCase());
  await page.getByRole('button', { name: '确定' }).click();
  await expect(page.getByRole('alert')).toHaveText('昵称已被使用');
});

test('AUTH-08: the session survives a reload', async ({ page, users }) => {
  const u = await users.make();
  await signIn(page, u);
  await page.goto('/');
  await expect(page.getByRole('button', { name: `账号：${u.nickname}` })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: `账号：${u.nickname}` })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test('AUTH-06: signing out returns to the sign-in page', async ({ page, users }) => {
  const u = await users.make();
  await signIn(page, u);
  await page.goto('/');
  await page.getByRole('button', { name: `账号：${u.nickname}` }).click();
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: '使用 Google 登录' })).toBeVisible();
  forgetSession(u);
});

test('AUTH-06: a guest is warned that the account cannot be recovered before signing out', async ({ page, users }) => {
  const g = await users.make({ guest: true });
  await signIn(page, g);
  await page.goto('/');
  await page.getByRole('button', { name: `账号：${g.nickname}` }).click();
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page.getByRole('alert')).toContainText('游客账号退出后将无法找回');
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('button', { name: '仍然退出' }).click();
  await expect(page).toHaveURL(/\/login/);
  forgetSession(g);
});

test('AUTH-05: a guest is offered to link a Google account', async ({ page, users }) => {
  const g = await users.make({ guest: true });
  await signIn(page, g);
  await page.goto('/');
  await page.getByRole('button', { name: `账号：${g.nickname}` }).click();
  await expect(page.getByRole('button', { name: '绑定 Google 账号' })).toBeVisible();
});

test('AUTH-09: a user renames themselves on their 个人主页, and everyone sees the new name', async ({ page, users }) => {
  const u = await users.make();
  const other = await users.make();
  await signIn(page, u);
  await page.goto('/');
  await page.getByRole('button', { name: `账号：${u.nickname}` }).click();
  await page.getByRole('link', { name: '个人主页' }).click();
  await expect(page.getByRole('heading', { name: u.nickname! })).toBeVisible();

  await page.getByRole('button', { name: '修改昵称' }).click();
  const dialog = page.getByRole('dialog', { name: '修改昵称' });
  await expect(dialog.getByLabel('新昵称')).toHaveValue(u.nickname!);
  await expect(dialog.getByRole('button', { name: '保存' })).toBeDisabled();
  // AUTH-03 still applies: someone else's name is refused, in Chinese.
  await dialog.getByLabel('新昵称').fill(other.nickname!.toUpperCase());
  await dialog.getByRole('button', { name: '保存' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('昵称已被使用');

  const renamed = `改名${Date.now() % 100000}`;
  await dialog.getByLabel('新昵称').fill(`  ${renamed}  `);
  await dialog.getByRole('button', { name: '保存' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: renamed })).toBeVisible();
  await expect(page.getByRole('button', { name: `账号：${renamed}` })).toBeVisible();
  // Everyone else reads the new name.
  const { data } = await (await clientFor(other)).from('profiles').select('nickname').eq('id', u.id).single();
  expect(data!.nickname).toBe(renamed);

  // Only on your own page.
  await page.goto(`/profile/${other.id}`);
  await expect(page.getByRole('heading', { name: other.nickname! })).toBeVisible();
  await expect(page.getByRole('button', { name: '修改昵称' })).toHaveCount(0);
});
