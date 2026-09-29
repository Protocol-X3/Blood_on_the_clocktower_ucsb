import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Panel } from '@/components/ui/Panel';
import type { GameData, LogEntry } from '@/features/game/useGameData';
import { supabase } from '@/services/supabase';
import { entryPhase } from './seats';

type Act = (run: () => PromiseLike<{ error: unknown }>, after?: () => void) => Promise<void>;

const MAX = 500;
const field = 'min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-ink';

/** LOG-01: a new entry for a seat (or the whole game); the database tags it with the phase. */
export function LogComposer({ gameId, seat, act }: { gameId: string; seat: number | null; act: Act }) {
  const [body, setBody] = useState('');
  const length = [...body.trim()].length;
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const sent = body;
        // Clear only what was sent: the DM may already be typing the next entry.
        void act(() => supabase.rpc('add_log', { p_game: gameId, p_seat: seat as number, p_body: sent }), () => setBody((b) => (b === sent ? '' : b)));
      }}
    >
      <textarea
        aria-label="日志内容"
        placeholder={seat ? `记录 ${seat}号 的信息…` : '记录本局信息…'}
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-16 w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2 text-[15px] text-ink placeholder:text-ink-faint focus:border-gold focus:outline-none"
      />
      <div className="flex items-center justify-between">
        <span className={cn('text-xs', length > MAX ? 'text-blood-text' : 'text-ink-faint')}>
          {length}/{MAX}
        </span>
        <Button type="submit" variant="outline" disabled={length < 1 || length > MAX}>
          添加日志
        </Button>
      </div>
    </form>
  );
}

/** Entries, oldest first, each editable and deletable (LOG-01). */
export function LogEntries({ entries, names, act }: { entries: LogEntry[]; names: Map<number, string>; act: Act }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  if (entries.length === 0) return <p className="text-sm text-ink-faint">暂无日志</p>;
  return (
    <ol className="flex flex-col gap-2" aria-label="日志条目">
      {entries.map((e) => (
        <li key={e.id} data-testid="log-entry" className="flex gap-3 rounded-xl bg-surface-2 px-3 py-2">
          <span
            className={cn(
              'h-fit w-12 shrink-0 rounded-md py-0.5 text-center text-[11px]',
              e.phase_kind === 'night' ? 'bg-townsfolk/20 text-townsfolk-text' : 'bg-gold/20 text-gold-strong',
            )}
          >
            {entryPhase(e)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-xs text-ink-faint">{e.seat ? `${e.seat}号 ${names.get(e.seat) ?? ''}` : '整局'}</span>
            {editing === e.id ? (
              <div className="flex flex-col gap-2">
                <textarea aria-label="修改日志" value={draft} onChange={(ev) => setDraft(ev.target.value)} rows={2} className={cn(field, 'py-2')} />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => act(() => supabase.rpc('edit_log', { p_entry: e.id, p_body: draft }), () => setEditing(null))}>
                    保存
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(null)}>
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{e.body}</p>
            )}
          </div>
          {editing === e.id ? null : (
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                className="min-h-11 rounded-lg px-2 text-xs text-ink-faint hover:text-ink"
                onClick={() => {
                  setEditing(e.id);
                  setDraft(e.body);
                }}
              >
                编辑
              </button>
              <button
                type="button"
                className="min-h-11 rounded-lg px-2 text-xs text-ink-faint hover:text-blood-text"
                onClick={() => act(() => supabase.rpc('delete_log', { p_entry: e.id }))}
              >
                删除
              </button>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

/** 说书人日志 (LOG-01 / LOG-03): the whole log, filtered by seat and by phase. */
export function LogPanel({ gameId, data, names, act }: { gameId: string; data: GameData; names: Map<number, string>; act: Act }) {
  const [seat, setSeat] = useState('all');
  const [phase, setPhase] = useState('all');
  const phases = [...new Map(data.log.map((e) => [`${e.phase_kind}${e.phase_number}`, e] as const)).entries()];
  const entries = data.log.filter(
    (e) =>
      (seat === 'all' || (seat === 'game' ? e.seat === null : e.seat === Number(seat))) &&
      (phase === 'all' || `${e.phase_kind}${e.phase_number}` === phase),
  );
  return (
    <Panel className="flex flex-col gap-4" aria-label="说书人日志">
      <LogComposer gameId={gameId} seat={null} act={act} />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink-faint">
          座位
          <select aria-label="按座位筛选" className={field} value={seat} onChange={(e) => setSeat(e.target.value)}>
            <option value="all">全部座位</option>
            <option value="game">整局</option>
            {data.seats.map((s) => (
              <option key={s.seat} value={String(s.seat)}>
                {s.seat}号 {names.get(s.seat)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-faint">
          阶段
          <select aria-label="按阶段筛选" className={field} value={phase} onChange={(e) => setPhase(e.target.value)}>
            <option value="all">全部阶段</option>
            {phases.map(([key, e]) => (
              <option key={key} value={key}>
                {entryPhase(e)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <LogEntries entries={entries} names={names} act={act} />
    </Panel>
  );
}
