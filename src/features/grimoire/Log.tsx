import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { Panel } from '@/components/ui/Panel';
import type { GameData } from '@/features/game/useGameData';
import { textColumns } from '@/lib/game/logSheet';
import type { Phase } from '@/lib/game/phase';
import { logIndex, logRows, saveCell, TEAM_TEXT, type Act, type LogRow } from './logData';

/**
 * One cell's text (LOG-01). It saves when the DM leaves it or presses Ctrl/⌘ + Enter. While
 * the DM types, and until the saved text comes back, a live update never overwrites it.
 */
export function CellText({
  value,
  onSave,
  label,
  placeholder,
  className,
}: {
  value: string;
  onSave: (text: string, done: () => void) => void;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const shown = draft ?? value;

  // Grow with the text; measure again whenever the width changes (layout, rotation).
  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return;
    const grow = () => {
      t.style.height = 'auto';
      t.style.height = `${t.scrollHeight + 2}px`;
    };
    grow();
    let width = t.clientWidth;
    const observer = new ResizeObserver(() => {
      if (t.clientWidth === width) return;
      width = t.clientWidth;
      grow();
    });
    observer.observe(t);
    return () => observer.disconnect();
  }, [shown]);

  // Once the saved text is back from the database, the draft steps aside.
  useEffect(() => {
    if (draft !== null && document.activeElement !== ref.current && draft.trim() === value) setDraft(null);
  }, [draft, value]);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), 1400);
    return () => clearTimeout(timer);
  }, [saved]);

  function save() {
    if (draft === null) return;
    const text = draft.trim();
    if (text === value) {
      setDraft(null);
      return;
    }
    onSave(text, () => setSaved(text ? '✓ 已保存' : '已清空'));
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        aria-label={label}
        placeholder={placeholder}
        rows={1}
        maxLength={500}
        value={shown}
        onFocus={() => setDraft((d) => d ?? value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            save();
          }
        }}
        className={cn(
          'block min-h-9 w-full resize-none overflow-hidden rounded-[10px] border border-transparent bg-transparent px-2 py-1.5 text-sm leading-[1.45] text-ink placeholder:text-ink-faint/55 hover:border-line focus:border-gold focus:bg-bg/60 focus:outline-none',
          className,
        )}
      />
      <span aria-live="polite" className={cn('pointer-events-none absolute right-1.5 bottom-1 text-[11px] text-gold-strong transition-opacity', saved ? 'opacity-100' : 'opacity-0')}>
        {saved}
      </span>
    </div>
  );
}

/** 说书人日志 (LOG-03): one phase at a time, the current one first, with a box for every row. */
export function LogPanel({ gameId, data, names, phase, act }: { gameId: string; data: GameData; names: Map<number, string>; phase: Phase; act: Act }) {
  const columns = textColumns(data.seats.length, phase);
  const [key, setKey] = useState(() => columns.find((c) => c.current)!.key);
  const col = columns.find((c) => c.key === key) ?? columns[0]!;
  const index = logIndex(data);
  const { seats, notes } = logRows(data, names);
  const box = (row: LogRow, label: string, placeholder: string) => (
    <div className="log-cell log-box rounded-[10px]" data-mark={index.mark(row, col.key) ?? undefined}>
      <CellText
        value={index.body(row, col.key)}
        label={`${label} ${col.label}`}
        placeholder={placeholder}
        onSave={(text, done) => void act(() => saveCell(gameId, row, col, text), done)}
      />
    </div>
  );
  return (
    <Panel className="log-sheet flex flex-col gap-3" aria-label="说书人日志">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="选择阶段">
        {columns.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={c.key === col.key}
            onClick={() => setKey(c.key)}
            className={cn(
              'min-h-9 rounded-full border px-3 text-[13px] tabular-nums',
              c.key === col.key ? 'border-gold bg-gold font-bold text-gold-ink' : 'border-line text-ink-muted',
              c.later && c.key !== col.key && 'border-dashed text-ink-faint',
            )}
          >
            {c.label}
            {c.current ? <span className="ml-1 text-[11px] opacity-80">· 当前</span> : null}
          </button>
        ))}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-lg font-bold tracking-widest text-gold-strong">{col.label}</h2>
        <span className="text-xs text-ink-faint">
          {col.kind === 'setup' ? '整局有效的设置' : col.current ? '当前阶段' : col.later ? '尚未到来，可以提前记' : '较早的阶段，仍可修改'}
        </span>
      </div>
      <ol className="flex flex-col gap-2" aria-label="日志行">
        {seats.map((s) => (
          <li key={s.seat} className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-2.5 rounded-[14px] bg-surface-2 px-2.5 py-2" data-testid="log-row">
            <span className="pt-1.5 text-center font-serif text-lg font-black text-gold-strong tabular-nums">{s.seat}</span>
            <div>
              <div className="mb-1 flex items-baseline gap-1.5 text-xs text-ink-faint">
                <b className="text-[13px] font-medium text-ink">{s.name}</b>
                {s.role ? <span className={TEAM_TEXT[s.role.team]}>{s.role.name}</span> : null}
              </div>
              {box({ seat: s.seat }, `${s.seat}号`, `记录 ${s.seat}号 的${col.label}…`)}
            </div>
          </li>
        ))}
        <li aria-hidden="true" className="my-1 h-[3px] rounded-sm bg-[var(--log-divider)]" data-testid="log-divider" />
        {notes.map((n) => (
          <li key={n.id} className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-2.5 rounded-[14px] bg-surface-2 px-2.5 py-2" data-testid="log-row">
            <span className="pt-2.5 text-center text-xs font-medium text-ink-faint">备注</span>
            <div>
              <div className="mb-1 text-xs">
                <b className="text-[13px] font-medium text-ink">{n.label || '未命名备注'}</b>
              </div>
              {box({ note: n.id }, n.label || '备注', '记录…')}
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/** GRIM-03: the seat panel's log section, that seat's row as a list. */
export function SeatLog({ gameId, data, seat, phase, act }: { gameId: string; data: GameData; seat: number; phase: Phase; act: Act }) {
  const index = logIndex(data);
  const row = { seat };
  return (
    <ol className="log-sheet flex flex-col gap-2" aria-label="本座位日志行">
      {textColumns(data.seats.length, phase).map((col) => (
        <li key={col.key} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2">
          <span className={cn('pt-2 text-xs', col.current ? 'font-bold text-gold-strong' : 'text-ink-faint')}>{col.label}</span>
          <div className="log-cell log-box rounded-[10px] bg-surface-2" data-mark={index.mark(row, col.key) ?? undefined}>
            <CellText
              value={index.body(row, col.key)}
              label={`${seat}号 ${col.label}`}
              onSave={(text, done) => void act(() => saveCell(gameId, row, col, text), done)}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
