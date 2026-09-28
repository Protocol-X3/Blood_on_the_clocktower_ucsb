import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { ThemeScope } from '@/components/ui/ThemeScope';
import { useAuth } from '@/features/auth/useAuth';
import { UserMenu } from '@/features/auth/UserMenu';
import { errorMessage } from '@/services/errors';
import { supabase, type Profile } from '@/services/supabase';
import { MessagePage } from './ComingSoon';

/** PERM-06: the admin grants and revokes DM-eligible; everyone else sees "no permission". */
export function AdminPage() {
  const { profile } = useAuth();
  if (profile?.permission !== 'admin') {
    return <MessagePage title="没有权限" message="只有管理员可以访问此页面。" theme="grimoire" />;
  }
  return <AdminUsers />;
}

function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const [deleting, setDeleting] = useState<Profile | null>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('is_guest', false)
      .order('nickname')
      .then(({ data }) => setUsers(data ?? []));
  }, [version]);

  async function setLevel(user: Profile, level: 'player' | 'dm_eligible') {
    setBusy(user.id);
    setNotice(null);
    const { error } = await supabase.rpc('set_permission', { p_user: user.id, p_level: level });
    setBusy(null);
    if (error) setNotice(errorMessage(error));
    else setVersion((v) => v + 1);
  }

  // HIST-06: on the user's request; their games stay, shown as 已删除用户.
  async function remove(user: Profile) {
    setBusy(user.id);
    setNotice(null);
    const { error } = await supabase.rpc('admin_delete_user', { p_user: user.id });
    setBusy(null);
    setDeleting(null);
    if (error) setNotice(errorMessage(error));
    else {
      setNotice(`已删除账号：${user.nickname ?? ''}`);
      setVersion((v) => v + 1);
    }
  }

  return (
    <ThemeScope theme="grimoire" className="min-h-dvh">
      <div className="mx-auto max-w-3xl pb-12">
        <PageHeader>
          <UserMenu />
        </PageHeader>
        <h1 className="px-5 pt-2 font-serif text-3xl font-black tracking-[0.2em] text-gold-strong">管理</h1>
        <p className="px-5 pt-2 text-sm text-ink-muted">授予或取消“可担任说书人”资格。游客需要先绑定 Google 账号。</p>
        {notice ? (
          <p role="alert" className="mx-5 mt-4 rounded-xl border border-blood/50 bg-blood/10 px-4 py-3 text-sm text-blood-text">
            {notice}
          </p>
        ) : null}
        <Panel className="mx-4 mt-5" padding="none">
          <ul aria-label="用户">
            {users.map((u) => (
              <li key={u.id} className="flex min-h-16 items-center justify-between gap-3 border-b border-line px-5 last:border-b-0" data-testid={`user-${u.nickname}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="truncate font-medium">{u.nickname ?? '（未设置昵称）'}</span>
                  {u.permission === 'admin' ? <Chip tone="gold">管理员</Chip> : u.permission === 'dm_eligible' ? <Chip tone="townsfolk">可担任说书人</Chip> : <Chip>玩家</Chip>}
                </div>
                {u.permission === 'player' ? (
                  <Button variant="outline" disabled={busy === u.id} onClick={() => setLevel(u, 'dm_eligible')}>
                    授予说书人资格
                  </Button>
                ) : u.permission === 'dm_eligible' ? (
                  <Button variant="ghost" disabled={busy === u.id} onClick={() => setLevel(u, 'player')}>
                    取消资格
                  </Button>
                ) : null}
                {u.permission !== 'admin' ? (
                  <Button variant="ghost" className="text-blood-text" disabled={busy === u.id} onClick={() => setDeleting(u)} aria-label={`删除账号 ${u.nickname ?? ''}`}>
                    删除
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      {deleting ? (
        <Dialog
          open
          onOpenChange={(o) => !o && setDeleting(null)}
          title={`删除账号：${deleting.nickname ?? ''}`}
          description="将删除该用户的登录方式、邮箱和昵称，且无法恢复。TA 参与过的对局会保留，并显示为「已删除用户」。"
        >
          <div className="flex flex-col gap-3">
            <Button variant="danger" disabled={busy === deleting.id} onClick={() => remove(deleting)}>
              确认删除
            </Button>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              取消
            </Button>
          </div>
        </Dialog>
      ) : null}
    </ThemeScope>
  );
}
