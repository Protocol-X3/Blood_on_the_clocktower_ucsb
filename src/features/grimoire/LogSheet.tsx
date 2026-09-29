import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import type { LogNote } from '@/features/game/useGameData';
import { allColumns, LOG_MARKS, rectangle, rowKey, textColumns, undoPaint, type LogColumn, type LogMark, type Paint, type StoredMark } from '@/lib/game/logSheet';
import type { Phase } from '@/lib/game/phase';
import { supabase } from '@/services/supabase';
import { CellText } from './Log';
import { cellArgs, saveCell, TEAM_TEXT, type Act, type LogIndex, type LogRow, type LogSeat } from './logData';

const RING: Record<string, string> = {
  townsfolk: 'border-townsfolk',
  outsider: 'border-outsider',
  minion: 'border-minion',
  demon: 'border-demon',
};

const SWATCH: Record<LogMark, string> = {
  red: 'bg-[#d63448]',
  yellow: 'bg-[#deb22c]',
  violet: 'bg-[#965ce2]',
  green: 'bg-[#3aac68]',
  dead: 'bg-[image:var(--log-dead-hatch)] bg-[#80869a]',
};

type Brush = LogMark | 'clear';
type Stroke = { row: LogRow; col: LogColumn; before: StoredMark }[];

function markCells(gameId: string, cells: { row: LogRow; col: LogColumn }[], paint: Paint) {
  return supabase.rpc('mark_log_cells', { p_game: gameId, p_cells: cells.map((c) => cellArgs(c.row, c.col)), p_mark: paint });
}

/**
 * 日志总表 (LOG-01 · LOG-04 · LOG-05 · LOG-06): every seat and note row against every
 * column, at the bottom of the DM's page. 座位, 玩家 and 初始角色 stay pinned while the
 * phases scroll. With `edit`, the DM types into cells, adds note rows, and paints colours;
 * without it (the summary), the table is read-only.
 */
export function LogSheet({
  seats,
  notes,
  index,
  phase,
  edit,
}: {
  seats: LogSeat[];
  notes: LogNote[];
  index: LogIndex;
  phase: Phase;
  edit?: { gameId: string; act: Act };
}) {
  const columns = allColumns(seats.length, phase);
  const phases = textColumns(seats.length, phase).slice(1);
  const rows: LogRow[] = [...seats.map((s) => ({ seat: s.seat })), ...notes.map((n) => ({ note: n.id }))];
  const [brush, setBrush] = useState<Brush | null>(null);
  const [undo, setUndo] = useState<Stroke[]>([]);
  const [drag, setDrag] = useState<{ from: { row: number; col: number }; to: { row: number; col: number } } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const posOf = (el: Element | null) => {
    const cell = el?.closest<HTMLElement>('td[data-r]');
    if (!cell || !tableRef.current?.contains(cell)) return null;
    const row = rows.findIndex((r) => rowKey(r) === cell.dataset.r);
    const col = columns.findIndex((c) => c.key === cell.dataset.c);
    return row < 0 || col < 0 ? null : { row, col };
  };
  // A note row's label spans 座位 + 玩家 and answers to 座位, so its 玩家 cell is skipped.
  const strokeCells = (d: NonNullable<typeof drag>) =>
    rectangle(rows, columns, d.from, d.to).filter((c) => !('note' in c.row && c.col.kind === 'name'));
  const inRange = new Set(drag ? strokeCells(drag).map((c) => `${rowKey(c.row)}|${c.col.key}`) : []);

  function onPointerDown(e: PointerEvent<HTMLTableElement>) {
    if (!brush) return;
    const at = posOf(e.target as Element);
    if (!at) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: at, to: at });
  }
  function onPointerMove(e: PointerEvent<HTMLTableElement>) {
    if (!drag) return;
    const at = posOf(document.elementFromPoint(e.clientX, e.clientY));
    if (at && (at.row !== drag.to.row || at.col !== drag.to.col)) setDrag({ ...drag, to: at });
  }
  function onPointerUp() {
    if (!drag || !brush || !edit) return;
    const cells = strokeCells(drag);
    setDrag(null);
    const stroke = cells.map((c) => ({ ...c, before: index.stored(c.row, c.col.key) }));
    void edit.act(() => markCells(edit.gameId, cells, brush), () => setUndo((u) => [...u, stroke]));
  }
  async function undoLast() {
    const stroke = undo.at(-1);
    if (!stroke || !edit) return;
    // Cells may have stored different colours before: put each group back in turn.
    const groups = new Map<Paint, Stroke>();
    for (const c of stroke) groups.set(undoPaint(c.before), [...(groups.get(undoPaint(c.before)) ?? []), c]);
    for (const [paint, cells] of groups) await edit.act(() => markCells(edit.gameId, cells, paint));
    setUndo((u) => u.slice(0, -1));
  }

  const td = (row: LogRow, col: LogColumn, className: string, children?: ReactNode, colSpan?: number) => {
    const key = `${rowKey(row)}|${col.key}`;
    return (
      <td
        key={col.key}
        colSpan={colSpan}
        data-r={rowKey(row)}
        data-c={col.key}
        data-mark={index.mark(row, col.key) ?? undefined}
        className={cn('log-cell border-r border-b border-line/60 align-top', inRange.has(key) && 'log-in-range', className)}
      >
        {children}
      </td>
    );
  };
  const text = (row: LogRow, col: LogColumn, label: string) =>
    edit ? (
      <CellText
        value={index.body(row, col.key)}
        label={label}
        className="px-1.5 py-[5px] text-[13px]"
        onSave={(t, done) => void edit.act(() => saveCell(edit.gameId, row, col, t), done)}
      />
    ) : (
      <p className="min-h-9 px-2 py-1.5 text-[13px] leading-[1.45] break-words whitespace-pre-wrap">{index.body(row, col.key)}</p>
    );
  const phaseTd = (row: LogRow, col: LogColumn, label: string) => td(row, col, cn('min-w-[132px] p-[3px]'), text(row, col, `${label} ${col.label}`));

  return (
    <section className={cn('log-sheet flex flex-col gap-2.5', brush && 'log-painting')} aria-label="日志总表">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="font-serif text-2xl font-black tracking-[0.15em] text-gold-strong">日志总表</h2>
          <p className="mt-0.5 text-[13px] text-ink-faint">每位玩家一行，每个夜晚和白天一列。左右滑动查看更多，座位、玩家和初始角色三列固定。</p>
        </div>
      </div>

      {edit ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-line bg-surface px-3 py-2.5" role="toolbar" aria-label="上色">
          <span className="mr-1 text-xs tracking-[0.15em] text-ink-faint">上色</span>
          {[...LOG_MARKS.map((m) => ({ brush: m.mark as Brush, label: m.label })), { brush: 'clear' as Brush, label: '清除' }].map((m) => (
            <button
              key={m.brush}
              type="button"
              aria-pressed={brush === m.brush}
              onClick={() => setBrush(brush === m.brush ? null : m.brush)}
              className={cn(
                'inline-flex min-h-10 items-center gap-2 rounded-[10px] border bg-surface-2 py-0 pr-3 pl-2 text-[13px]',
                brush === m.brush ? 'border-gold-strong text-gold-strong shadow-[0_0_0_1px_var(--gold-strong)]' : 'border-line text-ink',
              )}
            >
              <i
                aria-hidden="true"
                className={cn(
                  'size-[18px] shrink-0 rounded-[5px] border border-ink/25',
                  m.brush === 'clear' ? 'bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgb(232_221_196/0.35)_3px_4px)]' : SWATCH[m.brush as LogMark],
                )}
              />
              {m.label}
            </button>
          ))}
          <span className="flex-1" />
          <button type="button" disabled={undo.length === 0} onClick={() => void undoLast()} className="min-h-10 rounded-[10px] border border-line px-3.5 text-[13px] text-ink-muted disabled:opacity-40">
            撤销
          </button>
          {brush ? (
            <button type="button" onClick={() => setBrush(null)} className="min-h-10 rounded-[10px] border border-gold bg-gold px-3.5 text-[13px] font-bold text-gold-ink">
              完成
            </button>
          ) : null}
          {brush ? (
            <span className="w-full text-xs text-gold-strong" role="status">
              正在涂「{brush === 'clear' ? '清除' : LOG_MARKS.find((m) => m.mark === brush)!.label}」：点一个格子，或按住拖动涂一整片。再点一次颜色或「完成」回到写字。
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={cn('overflow-x-auto rounded-[18px] border bg-surface', brush ? 'border-gold' : 'border-line')}>
        <table
          ref={tableRef}
          data-testid="log-sheet"
          className="min-w-full border-separate border-spacing-0 text-left text-sm"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
        >
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'sticky top-0 z-[2] border-r border-b border-line bg-surface-2 px-2 py-2.5 text-xs font-medium tracking-[0.1em] whitespace-nowrap',
                    i === 0 && 'log-pin-seat text-center',
                    i === 1 && 'log-pin-name',
                    i === 2 && 'log-pin-role',
                    c.kind === 'setup' && 'min-w-[132px]',
                    c.kind === 'night' && 'min-w-[132px] text-townsfolk-text',
                    c.kind === 'day' && 'min-w-[132px] text-gold-strong',
                    c.kind !== 'night' && c.kind !== 'day' && 'text-ink-faint',
                    c.current && 'shadow-[inset_0_-2px_0_var(--gold)]',
                    c.later && 'font-normal text-ink-faint',
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seats.map((s) => {
              const row = { seat: s.seat };
              return (
                <tr key={s.seat} data-testid={`log-sheet-seat-${s.seat}`}>
                  {td(row, columns[0]!, 'log-pin-seat bg-surface py-[9px] text-center font-serif text-[17px] font-black text-gold-strong tabular-nums', s.seat)}
                  {td(row, columns[1]!, 'log-pin-name bg-surface px-2 py-2.5', <span title={s.name}>{s.name}</span>)}
                  {td(
                    row,
                    columns[2]!,
                    'log-pin-role bg-surface px-2 py-[7px]',
                    s.role ? (
                      <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap" title={s.role.name}>
                        <span
                          aria-hidden="true"
                          className={cn('grid size-[26px] shrink-0 place-items-center rounded-full border-2 bg-parchment font-serif text-xs font-black text-parchment-ink max-sm:hidden', RING[s.role.team])}
                        >
                          {s.role.glyph}
                        </span>
                        <span className={cn('log-role min-w-0 truncate text-[13px]', TEAM_TEXT[s.role.team])}>{s.role.name}</span>
                      </span>
                    ) : null,
                  )}
                  {[columns[3]!, ...phases].map((col) => phaseTd(row, col, `${s.seat}号`))}
                </tr>
              );
            })}
            <tr aria-hidden="true" data-testid="log-sheet-divider">
              <td colSpan={columns.length} className="h-3 bg-[var(--log-divider)] p-0">
                <span className="sticky left-0 inline-block px-2 text-[10px] leading-3 font-bold tracking-[0.3em] text-gold-ink">备注</span>
              </td>
            </tr>
            {notes.map((n) => (
              <NoteRow key={n.id} note={n} columns={columns} index={index} edit={edit} td={td} phaseTd={phaseTd} />
            ))}
          </tbody>
          {edit ? (
            <tfoot>
              <tr>
                <td colSpan={3} className="sticky left-0 bg-surface px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => void edit.act(() => supabase.rpc('add_log_note', { p_game: edit.gameId, p_label: '' }))}
                    className="min-h-10 rounded-[10px] border border-dashed border-gold px-3.5 text-sm whitespace-nowrap text-gold-strong"
                  >
                    + 添加备注行
                  </button>
                </td>
                <td colSpan={columns.length - 3} />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {edit ? (
        <p className="text-xs text-ink-faint">
          离开格子或按 Ctrl/⌘ + Enter 保存；清空格子即删除文字。开局时邪恶玩家整行自动标红、外来者整行标黄，其余颜色由说书人自己涂；单个格子可以改色或清除。只有说书人能看到，对局结束后出现在总结和历史中。
        </p>
      ) : null}
    </section>
  );
}

/** LOG-05: a note row, with its label (renamable) and a delete button that asks first when the row has text. */
function NoteRow({
  note,
  columns,
  index,
  edit,
  td,
  phaseTd,
}: {
  note: LogNote;
  columns: LogColumn[];
  index: LogIndex;
  edit?: { gameId: string; act: Act };
  td: (row: LogRow, col: LogColumn, className: string, children?: ReactNode, colSpan?: number) => ReactNode;
  phaseTd: (row: LogRow, col: LogColumn, label: string) => ReactNode;
}) {
  const row = { note: note.id };
  const [label, setLabel] = useState(note.label);
  const [confirming, setConfirming] = useState(false);
  const name = note.label || '备注';
  const remove = () => edit && void edit.act(() => supabase.rpc('delete_log_note', { p_note: note.id }));
  return (
    <tr className="log-note" data-testid="log-sheet-note">
      {td(
        row,
        columns[0]!,
        'sticky left-0 z-[1] w-[128px] min-w-[128px] bg-surface-2 p-[5px] max-w-[128px] max-sm:w-[100px] max-sm:min-w-[100px] max-sm:max-w-[100px]',
        edit ? (
          <>
            <div className="flex items-center gap-0.5">
              <input
                aria-label="备注行名称"
                value={label}
                maxLength={12}
                placeholder="备注行名称"
                onChange={(e) => setLabel(e.target.value)}
                onBlur={() => label.trim() !== note.label && void edit.act(() => supabase.rpc('rename_log_note', { p_note: note.id, p_label: label }))}
                className="w-full min-w-0 rounded-lg border border-transparent bg-transparent p-1.5 font-serif text-[13px] font-bold text-ink placeholder:font-sans placeholder:font-normal placeholder:text-ink-faint hover:border-line focus:border-gold focus:bg-bg focus:outline-none"
              />
              <button
                type="button"
                aria-label="删除备注行"
                onClick={() => (index.hasText(row) ? setConfirming(true) : remove())}
                className="min-h-8 min-w-8 rounded-lg text-xs text-ink-faint hover:text-blood-text"
              >
                ✕
              </button>
            </div>
            {confirming ? (
              <div className="flex flex-wrap items-center gap-1.5 px-1.5 pt-1 pb-0.5 text-xs text-blood-text">
                删除这一行？
                <button type="button" onClick={remove} className="min-h-[30px] rounded-lg bg-blood px-2.5 font-bold text-[#1a0508]">
                  删除
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="min-h-[30px] rounded-lg border border-line px-2.5 text-ink-muted">
                  取消
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <span className="block p-1.5 font-serif text-[13px] font-bold">{note.label}</span>
        ),
        2,
      )}
      {td(row, columns[2]!, 'log-pin-role bg-surface-2')}
      {columns.slice(3).map((col) => phaseTd(row, col, name))}
    </tr>
  );
}
