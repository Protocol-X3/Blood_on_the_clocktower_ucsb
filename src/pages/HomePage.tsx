import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ClockMark } from '@/components/ui/ClockMark';
import { Dialog } from '@/components/ui/Dialog';
import { Ornament } from '@/components/ui/Ornament';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StarField } from '@/components/ui/StarField';
import { ThemeScope } from '@/components/ui/ThemeScope';
import { useAuth } from '@/features/auth/useAuth';
import { UserMenu } from '@/features/auth/UserMenu';
import { errorMessage } from '@/services/errors';
import { supabase, type Room } from '@/services/supabase';

const ROOM_CODE = /^[A-Z0-9]{4}$/;

export function HomePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [seats, setSeats] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const canDm = profile && profile.permission !== 'player' && !profile.is_guest;

  useEffect(() => {
    // Row level security returns only rooms this user belongs to.
    supabase
      .from('rooms')
      .select('*')
      .eq('status', 'open')
      .order('last_activity_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setMyRooms(data ?? []));
  }, []);

  function join(e: FormEvent) {
    e.preventDefault();
    if (ROOM_CODE.test(code)) navigate(`/room/${code}`);
  }

  async function create() {
    setError(null);
    const { data, error: createError } = await supabase.rpc('create_room', { p_seat_count: seats });
    if (createError) setError(errorMessage(createError));
    else navigate(`/room/${data}`);
  }

  return (
    <ThemeScope theme="night" className="relative min-h-dvh overflow-hidden">
      <StarField />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10">
        <PageHeader back={null}>
          <UserMenu />
        </PageHeader>
        <header className="mt-6 flex flex-col items-center text-center">
          <ClockMark />
          <h1 className="mt-5 font-serif text-4xl font-black tracking-[0.2em] text-gold">血染钟楼</h1>
          <p className="mt-2 text-sm tracking-[0.3em] text-ink-muted">UCSB · 对局助手</p>
          <Ornament className="mt-5" />
        </header>

        <Panel className="mt-8 flex flex-col gap-4" padding="lg">
          <form onSubmit={join} className="flex flex-col gap-3">
            <label htmlFor="room-code" className="text-sm text-ink-muted">
              输入房间码加入对局
            </label>
            <input
              id="room-code"
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="K7QX"
              className="min-h-14 rounded-xl border border-line bg-surface-2 text-center font-serif text-3xl font-bold tracking-[0.5em] text-ink placeholder:text-ink-faint/60 focus:border-gold focus:outline-none"
            />
            <Button type="submit" size="lg" disabled={!ROOM_CODE.test(code)}>
              加入房间
            </Button>
          </form>
          {canDm ? (
            <>
              <div className="flex items-center gap-3 text-xs text-ink-faint">
                <span className="h-px flex-1 bg-line" />
                说书人
                <span className="h-px flex-1 bg-line" />
              </div>
              <Button variant="outline" size="lg" onClick={() => setCreating(true)}>
                创建房间
              </Button>
            </>
          ) : null}
        </Panel>

        {myRooms.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-sm tracking-[0.2em] text-ink-muted">我的房间</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {myRooms.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/room/${r.code}`}
                    className="flex min-h-12 items-center justify-between rounded-xl border border-line bg-surface px-4 hover:border-gold"
                  >
                    <span className="font-serif text-lg font-bold tracking-[0.3em] text-gold-strong">{r.code}</span>
                    <span className="text-sm text-ink-muted">{r.seat_count} 座 · 进入</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <Dialog open={creating} onOpenChange={setCreating} title="创建房间" description="选择座位数，与桌上的人数一致。之后也可以调整。">
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" size="icon" aria-label="减少座位" disabled={seats <= 5} onClick={() => setSeats((s) => s - 1)}>
              −
            </Button>
            <span className="w-16 text-center font-serif text-4xl font-black text-gold-strong" aria-live="polite">
              {seats}
            </span>
            <Button variant="outline" size="icon" aria-label="增加座位" disabled={seats >= 15} onClick={() => setSeats((s) => s + 1)}>
              +
            </Button>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-blood-text">
              {error}
            </p>
          ) : null}
          <Button size="lg" onClick={create}>
            创建
          </Button>
        </div>
      </Dialog>
    </ThemeScope>
  );
}
