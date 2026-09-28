import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ClockMark } from '@/components/ui/ClockMark';
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

export function LoginPage() {
  const { loading, session, profile, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const next = nextPath(location.search);
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <LoadingScreen />;
  if (session && profile?.nickname) return <Navigate to={next} replace />;

  // AUTH-01: Google sign-in returns to the page the user wanted.
  async function google() {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${next}` },
    });
    if (oauthError) setError(errorMessage(oauthError));
  }

  // AUTH-02: guests only give a nickname.
  async function guest(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!session) {
        const { error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) throw anonError;
      }
      const { error: nickError } = await supabase.rpc('set_nickname', { p_nickname: nickname });
      if (nickError) throw nickError;
      await refreshProfile();
      navigate(next, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemeScope theme="night" className="relative min-h-dvh overflow-hidden">
      <StarField />
      <main className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-14">
        <header className="flex flex-col items-center text-center">
          <ClockMark className="size-16" />
          <h1 className="mt-4 font-serif text-4xl font-black tracking-[0.2em] text-gold">血染钟楼</h1>
          <p className="mt-2 text-sm tracking-[0.3em] text-ink-muted">登录后加入对局</p>
          <Ornament className="mt-5" />
        </header>

        <Panel className="mt-8 flex flex-col gap-5" padding="lg">
          {session ? null : (
            <>
              <Button size="lg" onClick={google}>
                <GoogleMark />
                使用 Google 登录
              </Button>
              <div className="flex items-center gap-3 text-xs text-ink-faint">
                <span className="h-px flex-1 bg-line" />
                或
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}
          <form onSubmit={guest} className="flex flex-col gap-3">
            <TextField
              label={session ? '设置你的昵称' : '游客昵称'}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={12}
              autoComplete="nickname"
              placeholder="1–12 个字符"
              error={error}
            />
            <Button type="submit" variant="outline" size="lg" disabled={busy || nickname.trim().length === 0}>
              {session ? '保存昵称' : '以游客身份进入'}
            </Button>
          </form>
          <p className="text-xs leading-relaxed text-ink-faint">游客无需注册，但对局不计入战绩。之后可以绑定 Google 账号保留记录。</p>
        </Panel>
      </main>
    </ThemeScope>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5 rounded-full bg-white p-0.5">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.4-4.7 7l7.6 5.9c4.4-4.1 6.8-10.1 6.8-17.4z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.7-3-.7-4.7s.3-3.2.7-4.7l-7.9-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
