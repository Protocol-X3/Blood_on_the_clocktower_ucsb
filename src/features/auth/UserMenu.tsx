import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { errorMessage } from '@/services/errors';
import { supabase } from '@/services/supabase';
import { useAuth } from './useAuth';

const LEVEL_LABEL = { admin: '管理员', dm_eligible: '可担任说书人', player: '玩家' } as const;

/** The signed-in user's nickname, opening an account panel (sign out, admin, upgrade). */
export function UserMenu() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmGuestExit, setConfirmGuestExit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!profile) return null;

  async function signOut() {
    await supabase.auth.signOut({ scope: 'local' });
    setOpen(false);
    navigate('/login');
  }

  // AUTH-05: a guest links a Google account and keeps their profile and history.
  async function linkGoogle() {
    setError(null);
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
    if (linkError) setError(errorMessage(linkError));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setConfirmGuestExit(false);
          setError(null);
          setOpen(true);
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm text-ink hover:border-gold"
        aria-label={`账号：${profile.nickname ?? ''}`}
      >
        <span className="max-w-32 truncate font-medium">{profile.nickname}</span>
        {profile.is_guest ? <Chip>游客</Chip> : profile.permission !== 'player' ? <Chip tone="gold">{LEVEL_LABEL[profile.permission]}</Chip> : null}
      </button>

      <Dialog open={open} onOpenChange={setOpen} title={profile.nickname ?? '账号'} description={profile.is_guest ? '游客账号' : LEVEL_LABEL[profile.permission]}>
        {confirmGuestExit ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-blood-text" role="alert">
              游客账号退出后将无法找回，你的昵称和对局记录都会丢失。确定要退出吗？
            </p>
            <Button variant="danger" onClick={signOut}>
              仍然退出
            </Button>
            <Button variant="ghost" onClick={() => setConfirmGuestExit(false)}>
              取消
            </Button>
          </div>
        ) : (
          <nav className="flex flex-col gap-2">
            <Button asChild variant="outline">
              <Link to={`/profile/${profile.id}`} onClick={() => setOpen(false)}>
                个人主页
              </Link>
            </Button>
            {profile.permission === 'admin' ? (
              <Button asChild variant="outline">
                <Link to="/admin" onClick={() => setOpen(false)}>
                  管理
                </Link>
              </Button>
            ) : null}
            {profile.is_guest ? (
              <Button variant="outline" onClick={linkGoogle}>
                绑定 Google 账号
              </Button>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-blood-text">
                {error}
              </p>
            ) : null}
            <Button variant="ghost" onClick={() => (profile.is_guest ? setConfirmGuestExit(true) : signOut())}>
              退出登录
            </Button>
          </nav>
        )}
      </Dialog>
    </>
  );
}
