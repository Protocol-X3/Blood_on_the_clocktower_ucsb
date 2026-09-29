import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Panel } from '@/components/ui/Panel';
import { RoleToken } from '@/components/ui/RoleToken';
import type { GameData } from '@/features/game/useGameData';
import { DEATH_CAUSE_LABEL, type DeathCause } from '@/features/live/model';
import type { PhaseKind } from '@/lib/game/phase';
import { ALIGNMENT_LABEL, TEAM_LABEL, type Alignment } from '@/lib/game/teams';
import { supabase, type Game } from '@/services/supabase';
import { SeatLog } from './Log';
import { grimoireSeats, scriptReminders } from './seats';

type Act = (run: () => PromiseLike<{ error: unknown }>, after?: () => void) => Promise<void>;

const field = 'min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-ink';
const TOKEN_MAX = 8;

/**
 * GRIM-03: everything the DM can do to one seat: its roles and alignment, death and
 * revival, the ghost vote, reminder tokens and log entries.
 */
export function SeatDetail({
  game,
  data,
  names,
  seat,
  act,
  onPick,
}: {
  game: Game;
  data: GameData;
  names: Map<number, string>;
  seat: number | null;
  act: Act;
  onPick: (n: number) => void;
}) {
  const s = grimoireSeats(data, names).find((x) => x.seat === seat);
  if (!s) {
    return (
      <Panel className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">在魔典中轻触一个座位，或从这里选择：</p>
        <div className="flex flex-wrap gap-2">
          {data.seats.map((x) => (
            <Button key={x.seat} variant="outline" size="icon" onClick={() => onPick(x.seat)} aria-label={`${x.seat}号 ${names.get(x.seat)}`}>
              {x.seat}
            </Button>
          ))}
        </div>
      </Panel>
    );
  }
  // Remount the forms when the DM picks another seat, so nothing carries over.
  return <SeatForms key={s.seat} game={game} data={data} names={names} seatNo={s.seat} act={act} />;
}

function SeatForms({ game, data, names, seatNo, act }: { game: Game; data: GameData; names: Map<number, string>; seatNo: number; act: Act }) {
  const s = grimoireSeats(data, names).find((x) => x.seat === seatNo)!;
  const sr = data.seatRoles.find((x) => x.seat === seatNo);
  const [actualId, setActualId] = useState(sr?.actual_role_id ?? '');
  const [shownId, setShownId] = useState(sr?.shown_role_id ?? '');
  const [cause, setCause] = useState<DeathCause>('night');
  const [note, setNote] = useState('');
  const [reminder, setReminder] = useState('');
  const [custom, setCustom] = useState('');
  const reminders = scriptReminders(data);
  const roles = [...data.roles].sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name, 'zh'));
  const rpc = supabase.rpc.bind(supabase);

  return (
    <Panel className="flex flex-col gap-5" aria-label={`${s.seat}号座位`} data-testid="seat-panel">
      <div className="flex items-center gap-3">
        {s.actual ? <RoleToken glyph={s.glyph} team={s.actual.team} label={s.actual.name} size="md" dead={!s.alive} /> : null}
        <div className="min-w-0">
          <p className="font-serif text-lg font-bold">
            {s.seat}号 {s.name}
          </p>
          <p className="text-xs text-ink-muted">
            {s.status} · {s.ghostVoteUsed ? '幽灵票已用' : '幽灵票未用'}
          </p>
        </div>
      </div>

      {/* Roles and alignment */}
      <section className="flex flex-col gap-2" aria-label="角色与阵营">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-ink-faint">
            真实角色
            <select aria-label="真实角色" className={field} value={actualId} onChange={(e) => setActualId(e.target.value)}>
              {roles.map((r) => (
                <option key={r.role_id} value={r.role_id}>
                  {r.name}（{TEAM_LABEL[r.team]}）
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-faint">
            展示角色
            <select aria-label="展示角色" className={field} value={shownId} onChange={(e) => setShownId(e.target.value)}>
              {roles.map((r) => (
                <option key={r.role_id} value={r.role_id}>
                  {r.name}（{TEAM_LABEL[r.team]}）
                </option>
              ))}
            </select>
          </label>
        </div>
        <Button
          variant="outline"
          disabled={!sr || (actualId === sr.actual_role_id && shownId === sr.shown_role_id)}
          onClick={() => act(() => rpc('set_seat_role', { p_game: game.id, p_seat: s.seat, p_actual: actualId, p_shown: shownId }))}
        >
          更改角色
        </Button>
        <div className="flex items-center gap-2" role="radiogroup" aria-label="阵营">
          <span className="text-sm text-ink-muted">阵营</span>
          {(['good', 'evil'] as Alignment[]).map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={s.alignment === a}
              onClick={() => s.alignment !== a && act(() => rpc('set_alignment', { p_game: game.id, p_seat: s.seat, p_alignment: a }))}
              className={cn(
                'min-h-11 flex-1 rounded-xl border text-sm',
                s.alignment === a ? (a === 'good' ? 'border-townsfolk bg-townsfolk/15 text-townsfolk-text' : 'border-demon bg-demon/15 text-demon-text') : 'border-line text-ink-muted',
              )}
            >
              {ALIGNMENT_LABEL[a]}
            </button>
          ))}
        </div>
      </section>

      {/* Life and death */}
      {s.alive ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm text-ink-muted">死亡原因</legend>
          <div className="flex gap-2">
            {(Object.keys(DEATH_CAUSE_LABEL) as DeathCause[]).map((c) => (
              <label
                key={c}
                className={cn(
                  'flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border text-sm',
                  cause === c ? 'border-blood bg-blood/15 text-blood-text' : 'border-line',
                )}
              >
                <input type="radio" name="cause" value={c} checked={cause === c} onChange={() => setCause(c)} className="sr-only" />
                {DEATH_CAUSE_LABEL[c]}
              </label>
            ))}
          </div>
          {cause === 'other' ? (
            <input aria-label="说明（可选）" placeholder="说明（可选）" value={note} maxLength={40} onChange={(e) => setNote(e.target.value)} className={field} />
          ) : null}
          <Button
            variant="danger"
            onClick={() =>
              act(
                () => rpc('kill_seat', { p_game: game.id, p_seat: s.seat, p_cause: cause, p_note: cause === 'other' ? note : (null as unknown as string) }),
                () => setNote(''),
              )
            }
          >
            标记死亡
          </Button>
        </fieldset>
      ) : (
        <Button variant="outline" onClick={() => act(() => rpc('revive_seat', { p_game: game.id, p_seat: s.seat }))}>
          复活
        </Button>
      )}
      <Button variant="ghost" onClick={() => act(() => rpc('set_ghost_vote', { p_game: game.id, p_seat: s.seat, p_used: !s.ghostVoteUsed }))}>
        {s.ghostVoteUsed ? '恢复幽灵票' : '标记幽灵票已用'}
      </Button>

      {/* TOKEN-01 */}
      <section className="flex flex-col gap-2" aria-label="标记">
        <h3 className="font-serif font-bold tracking-wider text-gold-strong">标记</h3>
        {s.tokens.length ? (
          <ul className="flex flex-wrap gap-2" aria-label="已有标记">
            {s.tokens.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  aria-label={`移除标记 ${t.label}`}
                  onClick={() => act(() => rpc('remove_token', { p_token: t.id }))}
                  className="flex min-h-11 items-center gap-1 rounded-full border border-gold/50 bg-gold/15 px-3 text-sm text-gold-strong"
                >
                  {t.label} <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-faint">暂无标记</p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => act(() => rpc('add_token', { p_game: game.id, p_seat: s.seat, p_kind: 'poisoned' }))}>
            中毒
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => act(() => rpc('add_token', { p_game: game.id, p_seat: s.seat, p_kind: 'drunk' }))}>
            醉酒
          </Button>
        </div>
        <div className="flex gap-2">
          <select aria-label="角色提示标记" className={cn(field, 'min-w-0 flex-1')} value={reminder} onChange={(e) => setReminder(e.target.value)}>
            <option value="">选择角色提示…</option>
            {reminders.map((r) => (
              <option key={`${r.role}:${r.text}`} value={r.text}>
                {r.role} · {r.text}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={!reminder}
            onClick={() => act(() => rpc('add_token', { p_game: game.id, p_seat: s.seat, p_kind: 'reminder', p_text: reminder }), () => setReminder(''))}
          >
            添加
          </Button>
        </div>
        <div className="flex gap-2">
          <input
            aria-label="自定义标记"
            placeholder={`自定义（最多 ${TOKEN_MAX} 字）`}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className={cn(field, 'min-w-0 flex-1')}
          />
          <Button
            variant="outline"
            disabled={[...custom.trim()].length < 1 || [...custom.trim()].length > TOKEN_MAX}
            onClick={() => {
              const sent = custom;
              void act(() => rpc('add_token', { p_game: game.id, p_seat: s.seat, p_kind: 'custom', p_text: sent }), () => setCustom((c) => (c === sent ? '' : c)));
            }}
          >
            添加
          </Button>
        </div>
      </section>

      {/* GRIM-03 · LOG-01: this seat's row of the log table */}
      <section className="flex flex-col gap-2" aria-label="本座位日志">
        <h3 className="font-serif font-bold tracking-wider text-gold-strong">日志</h3>
        <SeatLog gameId={game.id} data={data} seat={s.seat} phase={{ kind: (game.phase_kind ?? 'night') as PhaseKind, number: game.phase_number ?? 1 }} act={act} />
      </section>
    </Panel>
  );
}
