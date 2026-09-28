import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ClockMark } from '@/components/ui/ClockMark';
import { Ornament } from '@/components/ui/Ornament';
import { Panel } from '@/components/ui/Panel';
import { StarField } from '@/components/ui/StarField';
import { ThemeScope } from '@/components/ui/ThemeScope';

const ROOM_CODE = /^[A-Z0-9]{4}$/;

export function HomePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const valid = ROOM_CODE.test(code);

  function join(e: FormEvent) {
    e.preventDefault();
    if (valid) navigate(`/room/${code}`);
  }

  return (
    <ThemeScope theme="night" className="relative min-h-dvh overflow-hidden">
      <StarField />
      <main className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-16">
        <header className="flex flex-col items-center text-center">
          <ClockMark />
          <h1 className="mt-5 font-serif text-4xl font-black tracking-[0.2em] text-gold">血染钟楼</h1>
          <p className="mt-2 text-sm tracking-[0.3em] text-ink-muted">UCSB · 对局助手</p>
          <Ornament className="mt-5" />
        </header>

        <Panel className="mt-10 flex flex-col gap-4" padding="lg">
          <form onSubmit={join} className="flex flex-col gap-3">
            <label htmlFor="room-code" className="text-sm text-ink-muted">
              输入房间码加入对局
            </label>
            <input
              id="room-code"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="K7QX"
              className="min-h-14 rounded-xl border border-line bg-surface-2 text-center font-serif text-3xl font-bold tracking-[0.5em] text-ink placeholder:text-ink-faint/60 focus:border-gold focus:outline-none"
            />
            <Button type="submit" size="lg" disabled={!valid}>
              加入房间
            </Button>
          </form>
          <div className="flex items-center gap-3 text-xs text-ink-faint">
            <span className="h-px flex-1 bg-line" />
            说书人
            <span className="h-px flex-1 bg-line" />
          </div>
          <Button variant="outline" size="lg" disabled>
            创建房间
          </Button>
        </Panel>

        <nav className="mt-auto flex justify-center gap-2 pt-10 text-sm">
          <FooterLink to="/login">登录</FooterLink>
          <FooterLink to="/scripts">剧本库</FooterLink>
          <FooterLink to="/dev/design">设计样式</FooterLink>
        </nav>
      </main>
    </ThemeScope>
  );
}

function FooterLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-11 items-center px-2 text-ink-muted underline-offset-4 hover:text-gold hover:underline"
    >
      {children}
    </Link>
  );
}
