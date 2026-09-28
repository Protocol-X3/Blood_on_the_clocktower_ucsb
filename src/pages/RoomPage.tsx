import { Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { StarField } from '@/components/ui/StarField';
import { ThemeScope } from '@/components/ui/ThemeScope';
import { useAuth } from '@/features/auth/useAuth';
import { UserMenu } from '@/features/auth/UserMenu';
import { useRoom, type Member } from '@/features/room/useRoom';
import { errorMessage } from '@/services/errors';
import { supabase, type Game, type Room } from '@/services/supabase';
import { LiveGame } from '@/features/live/LiveGame';
import { BotDriver, LobbyBots } from '@/features/sandbox/sandbox';
import { phaseLabel } from '@/lib/game/phase';
import { DmSetup } from '@/features/setup/DmSetup';
import { PlayerSetup } from '@/features/setup/PlayerSetup';
import { StartSetup } from '@/features/setup/StartSetup';
import { MessagePage } from './ComingSoon';

export function RoomPage() {
  const { code = '' } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { state, reload } = useRoom(code.toUpperCase(), profile!.id);

  // END-02: when the running game ends, its players and DM go to its summary.
  const running = useRef<string | null>(null);
  const game = state.status === 'ready' ? state.game : undefined;
  // Only the game's players and DM can read its summary (HIST-02); onlookers stay in the lobby.
  const participant =
    state.status === 'ready' && (state.room.dm_id === profile!.id || state.members.some((m) => m.user_id === profile!.id && m.seat !== null));
  useEffect(() => {
    if (game === undefined) return;
    if (game?.status === 'in_progress' && participant) running.current = game.id;
    else if (!game && running.current) {
      running.current = null;
      navigate(`/room/${code.toUpperCase()}/summary`);
    }
  }, [game, participant, code, navigate]);

  if (state.status === 'loading') return <LoadingScreen label="正在进入房间…" />;
  if (state.status === 'not_found') return <MessagePage title="房间不存在" message={`没有找到房间 ${code.toUpperCase()}，它可能已经关闭。`} />;
  if (state.status === 'removed') return <MessagePage title="你已离开房间" message="你不在这个房间中了。" />;
  if (state.status === 'error') return <MessagePage title="出错了" message={state.message} />;
  if (state.game?.status === 'setup' || state.game?.status === 'in_progress') {
    return <GameStage room={state.room} members={state.members} game={state.game} reload={reload} />;
  }
  return <Lobby room={state.room} members={state.members} gameActive={state.game !== null} reload={reload} />;
}

/** Setup (SETUP-06) and the started game (SETUP-10): the DM gets the grimoire theme, players the night. */
function GameStage({ room, members, game, reload }: { room: Room; members: Member[]; game: Game; reload: () => Promise<void> }) {
  const { profile } = useAuth();
  const me = profile!;
  const isDm = room.dm_id === me.id;
  const mySeat = members.find((m) => m.user_id === me.id)?.seat ?? null;
  const seatNames = new Map(members.filter((m) => m.seat).map((m) => [m.seat!, m.profile?.nickname ?? '']));
  const [notice, setNotice] = useState<string | null>(null);

  async function act(run: () => PromiseLike<{ error: unknown }>, after?: () => void) {
    setNotice(null);
    const { error } = await run();
    if (error) setNotice(errorMessage(error));
    else {
      after?.();
      await reload();
    }
  }

  const setup = game.status === 'setup';
  // GRIM-04: the DM's screen is always the grimoire; PHASE-03: players follow day and night.
  const theme = isDm ? 'grimoire' : !setup && game.phase_kind === 'day' ? 'day' : 'night';
  const bots = new Map(members.filter((m) => m.seat && m.profile?.is_bot).map((m) => [m.seat!, m.user_id]));
  return (
    <ThemeScope theme={theme} className="relative min-h-dvh overflow-hidden" data-testid="game-theme">
      {theme === 'night' ? <StarField count={36} seed={5} /> : null}
      <div className={cn('relative mx-auto flex min-h-dvh flex-col pb-10', isDm ? 'max-w-6xl' : 'max-w-md')}>
        <PageHeader>
          <UserMenu />
        </PageHeader>
        <header className="px-5 pt-1 text-center">
          <p className="text-xs tracking-[0.4em] text-ink-faint" data-testid="room-code">{room.code}</p>
          <h1 className="mt-1 font-serif text-3xl font-black tracking-[0.2em] text-gold">
            {setup ? '对局配置' : phaseLabel({ kind: game.phase_kind === 'day' ? 'day' : 'night', number: game.phase_number ?? 1 })}
          </h1>
        </header>
        <main className="mt-6 flex flex-col gap-5 px-4">
          {isDm && BotDriver && bots.size ? (
            <Suspense fallback={null}>
              <BotDriver game={game} bots={bots} />
            </Suspense>
          ) : null}
          {setup ? (
            isDm ? (
              <DmSetup game={game} members={members} act={act} />
            ) : (
              <PlayerSetup game={game} mySeat={mySeat} seatNames={seatNames} />
            )
          ) : (
            <LiveGame game={game} isDm={isDm} me={me.id} mySeat={mySeat} names={seatNames} act={act} />
          )}
          {notice ? (
            <p role="alert" className="rounded-xl border border-blood/50 bg-blood/10 px-4 py-3 text-sm text-blood-text">
              {notice}
            </p>
          ) : null}
        </main>
      </div>
    </ThemeScope>
  );
}

function Lobby({ room, members, gameActive, reload }: { room: Room; members: Member[]; gameActive: boolean; reload: () => Promise<void> }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const me = profile!;
  const isDm = room.dm_id === me.id;
  const canDm = me.permission !== 'player' && !me.is_guest;
  const isAdmin = me.permission === 'admin';
  const mine = members.find((m) => m.user_id === me.id);
  const bySeat = new Map(members.filter((m) => m.seat !== null).map((m) => [m.seat!, m]));
  const onlookers = members.filter((m) => m.seat === null && m.user_id !== room.dm_id);
  const dm = members.find((m) => m.user_id === room.dm_id);
  const closed = room.status !== 'open';

  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [managing, setManaging] = useState<Member | null>(null);
  const [copied, setCopied] = useState(false);

  async function act(run: () => PromiseLike<{ error: unknown }>, after?: () => void) {
    setBusy(true);
    setNotice(null);
    const { error } = await run();
    setBusy(false);
    if (error) setNotice(errorMessage(error));
    else {
      after?.();
      await reload();
    }
  }

  const rpc = supabase.rpc.bind(supabase);
  const seated = members.filter((m) => m.seat !== null).length;

  return (
    <ThemeScope theme="night" className="relative min-h-dvh overflow-hidden">
      <StarField count={36} seed={3} />
      <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col pb-10">
        <PageHeader>
          <UserMenu />
        </PageHeader>

        <section className="px-5 pt-2 text-center">
          <p className="text-xs tracking-[0.4em] text-ink-faint">房间码</p>
          <div className="mt-1 flex items-center justify-center gap-3">
            <h1 className="font-serif text-5xl font-black tracking-[0.3em] text-gold" data-testid="room-code">
              {room.code}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              aria-label="复制房间码"
              onClick={async () => {
                await navigator.clipboard?.writeText(room.code).catch(() => undefined);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
              </svg>
            </Button>
          </div>
          <p className="mt-2 text-sm text-ink-muted" aria-live="polite">
            {copied ? '已复制房间码' : closed ? '房间已关闭' : gameActive ? '对局进行中' : `大厅 · ${seated}/${room.seat_count} 人入座`}
          </p>
        </section>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 px-4 md:grid-cols-[minmax(0,1fr)_18rem] md:px-6">
          <div className="flex flex-col gap-5">
            {/* The DM seat (ROOM-09 / ROOM-10) */}
            <Panel className="flex items-center gap-4" data-testid="dm-seat">
              <QuillMark />
              <div className="min-w-0 flex-1">
                <p className="text-xs tracking-[0.3em] text-ink-faint">说书人</p>
                <p className="truncate font-serif text-lg font-bold">{dm?.profile?.nickname ?? '空缺'}</p>
              </div>
              {isDm && !gameActive ? (
                <Button variant="ghost" disabled={busy} onClick={() => act(() => rpc('leave_dm_seat', { p_room: room.id }))}>
                  离开说书人座位
                </Button>
              ) : null}
              {!room.dm_id && canDm ? (
                <Button disabled={busy} onClick={() => act(() => rpc('take_dm_seat', { p_room: room.id }))}>
                  担任说书人
                </Button>
              ) : null}
            </Panel>

            {/* Player seats (ROOM-05 / ROOM-06) */}
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="座位">
              {Array.from({ length: room.seat_count }, (_, i) => i + 1).map((seat) => {
                const occupant = bySeat.get(seat);
                const isMine = occupant?.user_id === me.id;
                return (
                  <li
                    key={seat}
                    data-testid={`seat-${seat}`}
                    className={cn(
                      'flex min-h-28 flex-col rounded-2xl border p-3 transition-colors',
                      isMine ? 'border-gold bg-gold/10' : occupant ? 'border-line bg-surface' : 'border-dashed border-line bg-surface-2/60',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-serif text-sm font-bold text-gold-strong">{seat}号</span>
                      {occupant?.profile?.is_guest ? <Chip>游客</Chip> : null}
                    </div>
                    <p className={cn('mt-1 flex-1 truncate font-medium', occupant ? 'text-ink' : 'text-ink-faint')}>
                      {occupant?.profile?.nickname ?? '空座'}
                    </p>
                    {!gameActive && !closed ? (
                      isMine ? (
                        <Button variant="ghost" className="-mx-1 mt-1" disabled={busy} onClick={() => act(() => rpc('leave_seat', { p_room: room.id }))}>
                          离座
                        </Button>
                      ) : !occupant && !isDm ? (
                        <Button variant="outline" className="mt-1" disabled={busy} onClick={() => act(() => rpc('take_seat', { p_room: room.id, p_seat: seat }))}>
                          坐下
                        </Button>
                      ) : occupant && isDm ? (
                        <Button variant="ghost" className="-mx-1 mt-1" onClick={() => setManaging(occupant)}>
                          管理
                        </Button>
                      ) : null
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>

          <aside className="flex flex-col gap-5">
            {/* People in the room without a seat */}
            <Panel>
              <h2 className="font-serif text-base font-bold tracking-wider text-gold-strong">旁观 · {onlookers.length}</h2>
              <ul className="mt-3 flex flex-col gap-1" aria-label="旁观者">
                {onlookers.length === 0 ? <li className="text-sm text-ink-faint">暂无</li> : null}
                {onlookers.map((m) => (
                  <li key={m.user_id} className="flex min-h-11 items-center justify-between gap-2">
                    <span className="truncate text-sm">
                      {m.profile?.nickname}
                      {m.user_id === me.id ? '（你）' : ''}
                    </span>
                    {(isDm && !gameActive) || (isAdmin && m.profile?.permission !== 'player' && !m.profile?.is_guest) ? (
                      <Button variant="ghost" onClick={() => setManaging(m)}>
                        管理
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Panel>

            {isDm && !gameActive && !closed ? (
              <Panel className="flex flex-col gap-4" aria-label="说书人工具">
                <h2 className="font-serif text-base font-bold tracking-wider text-gold-strong">说书人工具</h2>
                <StartSetup room={room} act={act} seated={seated} />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-muted">座位数</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" aria-label="减少座位" disabled={busy || room.seat_count <= 5}
                      onClick={() => act(() => rpc('set_seat_count', { p_room: room.id, p_count: room.seat_count - 1 }))}>
                      −
                    </Button>
                    <span className="w-8 text-center font-serif text-xl font-bold" data-testid="seat-count">{room.seat_count}</span>
                    <Button variant="outline" size="icon" aria-label="增加座位" disabled={busy || room.seat_count >= 15}
                      onClick={() => act(() => rpc('set_seat_count', { p_room: room.id, p_count: room.seat_count + 1 }))}>
                      +
                    </Button>
                  </div>
                </div>
              </Panel>
            ) : null}

            {isDm && !gameActive && !closed && LobbyBots ? (
              <Suspense fallback={null}>
                <LobbyBots room={room} />
              </Suspense>
            ) : null}

            {notice ? (
              <p role="alert" className="rounded-xl border border-blood/50 bg-blood/10 px-4 py-3 text-sm text-blood-text">
                {notice}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              {(room.created_by === me.id || isAdmin) && !closed ? (
                <Button variant="danger" disabled={busy} onClick={() => act(() => rpc('close_room', { p_room: room.id }), () => navigate('/'))}>
                  关闭房间
                </Button>
              ) : null}
              {mine && !closed ? (
                <Button variant="ghost" disabled={busy} onClick={() => act(() => rpc('leave_room', { p_room: room.id }), () => navigate('/'))}>
                  离开房间
                </Button>
              ) : null}
            </div>
          </aside>
        </div>
      </div>

      {managing ? (
        <ManageMember
          member={managing}
          room={room}
          freeSeats={Array.from({ length: room.seat_count }, (_, i) => i + 1).filter((s) => !bySeat.has(s))}
          asDm={isDm && !gameActive}
          asAdmin={isAdmin}
          onClose={() => setManaging(null)}
          act={act}
        />
      ) : null}
    </ThemeScope>
  );
}

/** ROOM-08 (DM) and ROOM-11 (admin) actions for one member. */
function ManageMember({
  member,
  room,
  freeSeats,
  asDm,
  asAdmin,
  onClose,
  act,
}: {
  member: Member;
  room: Room;
  freeSeats: number[];
  asDm: boolean;
  asAdmin: boolean;
  onClose: () => void;
  act: (run: () => PromiseLike<{ error: unknown }>, after?: () => void) => Promise<void>;
}) {
  const [target, setTarget] = useState<number | ''>(freeSeats[0] ?? '');
  const name = member.profile?.nickname ?? '';
  const canBeDm = member.profile?.permission !== 'player' && !member.profile?.is_guest && room.dm_id !== member.user_id;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={name} description={member.seat ? `${member.seat}号座位` : '旁观中'}>
      <div className="flex flex-col gap-3">
        {asDm ? (
          <>
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1.5 text-sm text-ink-muted">
                移到座位
                <select
                  className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-ink"
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                >
                  {freeSeats.map((s) => (
                    <option key={s} value={s}>
                      {s}号
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="outline" disabled={target === ''}
                onClick={() => act(() => supabase.rpc('dm_move_player', { p_room: room.id, p_user: member.user_id, p_seat: Number(target) }), onClose)}>
                移动
              </Button>
            </div>
            {member.seat ? (
              <Button variant="outline" onClick={() => act(() => supabase.rpc('dm_unseat', { p_room: room.id, p_user: member.user_id }), onClose)}>
                移出座位
              </Button>
            ) : null}
            <Button variant="danger" onClick={() => act(() => supabase.rpc('dm_kick', { p_room: room.id, p_user: member.user_id }), onClose)}>
              移出房间
            </Button>
          </>
        ) : null}
        {asAdmin && canBeDm ? (
          <Button onClick={() => act(() => supabase.rpc('admin_assign_dm', { p_room: room.id, p_user: member.user_id }), onClose)}>
            设为说书人
          </Button>
        ) : null}
        <Button variant="ghost" onClick={onClose}>
          取消
        </Button>
      </div>
    </Dialog>
  );
}

function QuillMark() {
  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-full border border-gold/60 bg-gold/10 text-gold-strong">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 4c-6 1-10 5-12 11l-2 5" />
        <path d="M20 4c-1 6-5 10-11 12" />
        <path d="M9 15l-3-3" />
      </svg>
    </span>
  );
}
