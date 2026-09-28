import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Ornament } from '@/components/ui/Ornament';
import { Panel } from '@/components/ui/Panel';
import { StarField } from '@/components/ui/StarField';
import { TextField } from '@/components/ui/TextField';
import { ThemeScope } from '@/components/ui/ThemeScope';
import { useAuth } from '@/features/auth/useAuth';
import { nextPath } from '@/features/auth/nextPath';
import { errorMessage } from '@/services/errors';
import { supabase } from '@/services/supabase';

/** AUTH-04: a new user picks a nickname before entering any room. */
export function WelcomePage() {
  const { loading, session, profile, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const next = nextPath(location.search);
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading || (session && !profile)) return <LoadingScreen />;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  if (profile?.nickname) return <Navigate to={next} replace />;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: nickError } = await supabase.rpc('set_nickname', { p_nickname: nickname });
    if (nickError) {
      setError(errorMessage(nickError));
      setBusy(false);
      return;
    }
    await refreshProfile();
    navigate(next, { replace: true });
  }

  return (
    <ThemeScope theme="night" className="relative min-h-dvh overflow-hidden">
      <StarField />
      <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 pb-16">
        <h1 className="text-center font-serif text-3xl font-black tracking-[0.2em] text-gold">欢迎来到小镇</h1>
        <Ornament className="mx-auto mt-4" />
        <Panel className="mt-8" padding="lg">
          <form onSubmit={save} className="flex flex-col gap-4">
            <TextField
              label="你的昵称"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={12}
              autoFocus
              placeholder="其他玩家会看到这个名字"
              error={error}
            />
            <Button type="submit" size="lg" disabled={busy || nickname.trim().length === 0}>
              确定
            </Button>
          </form>
        </Panel>
      </main>
    </ThemeScope>
  );
}
