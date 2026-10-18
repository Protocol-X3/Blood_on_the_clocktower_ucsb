import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { supabase } from '@/services/supabase';
import { useAuth } from './useAuth';

const LEVEL_LABEL = { admin: '管理员', dm_eligible: '可担任说书人', player: '玩家' } as const;

/** The signed-in user's nickname, opening an account panel (profile, scripts, admin, sign out). */
export function UserMenu() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!profile) return null;

  // AUTH-06
  async function signOut() {
    await supabase.auth.signOut({ scope: 'local' });
    setOpen(false);
    navigate('/login');
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm text-ink hover:border-gold"
        aria-label={`账号：${profile.nickname ?? ''}`}
      >
        <span className="max-w-32 truncate font-medium">{profile.nickname}</span>
        {profile.permission !== 'player' ? <Chip tone="gold">{LEVEL_LABEL[profile.permission]}</Chip> : null}
      </button>

      <Dialog open={open} onOpenChange={setOpen} title={profile.nickname ?? '账号'} description={LEVEL_LABEL[profile.permission]}>
        <nav className="flex flex-col gap-2">
          <Button asChild variant="outline">
            <Link to={`/profile/${profile.id}`} onClick={() => setOpen(false)}>
              个人主页
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/scripts" onClick={() => setOpen(false)}>
              剧本库
            </Link>
          </Button>
          {profile.permission === 'admin' ? (
            <Button asChild variant="outline">
              <Link to="/admin" onClick={() => setOpen(false)}>
                管理
              </Link>
            </Button>
          ) : null}
          <Button variant="ghost" onClick={signOut}>
            退出登录
          </Button>
        </nav>
      </Dialog>
    </>
  );
}
