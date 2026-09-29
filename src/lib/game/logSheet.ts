// The DM log table (docs/rules/m4-grimoire.md, LOG-01 … LOG-06): which columns it shows,
// how a cell's colour is worked out, and which cells a paint stroke covers.
import { phaseLabel, type Phase, type PhaseKind } from './phase';

export type LogMark = 'red' | 'yellow' | 'violet' | 'green' | 'dead';
/** What a cell stores: a colour, 'none' (清除 over a row colour), or nothing (use the row's colour). */
export type StoredMark = LogMark | 'none' | null;
/** What a paint stroke sends: a colour, 清除, or 'unset' (back to the row's colour, for 撤销). */
export type Paint = LogMark | 'clear' | 'unset';

export type ColumnKind = 'seat' | 'name' | 'role' | 'setup' | PhaseKind;

export interface LogColumn {
  /** 'seat', 'name', 'role', 'setup', or a phase: 'n1', 'd1', 'n2' … */
  key: string;
  kind: ColumnKind;
  phase: number | null;
  label: string;
  /** The game's current phase. */
  current: boolean;
  /** A phase still to come (the DM may note things ahead). */
  later: boolean;
}

/** LOG-06: the paint colours, in the palette's order. */
export const LOG_MARKS: { mark: LogMark; label: string }[] = [
  { mark: 'red', label: '邪恶 / 错误' },
  { mark: 'yellow', label: '外来者' },
  { mark: 'violet', label: '醉酒 / 中毒' },
  { mark: 'green', label: '正确' },
  { mark: 'dead', label: '死亡' },
];

/** LOG-01: min(5, ⌊players / 2⌋) nights and days, more once the game goes past them. */
export function logRounds(seatCount: number, phase: Phase): number {
  return Math.max(Math.min(5, Math.floor(seatCount / 2)), phase.number);
}

const order = (kind: PhaseKind, number: number) => number * 2 - (kind === 'night' ? 1 : 0);

/** LOG-01: 第1夜, 第1天, 第2夜 … for as many rounds as the table shows. */
export function phaseColumns(seatCount: number, phase: Phase): LogColumn[] {
  const now = order(phase.kind, phase.number);
  const columns: LogColumn[] = [];
  for (let n = 1; n <= logRounds(seatCount, phase); n += 1) {
    for (const kind of ['night', 'day'] as const) {
      const at = order(kind, n);
      columns.push({ key: `${kind[0]}${n}`, kind, phase: n, label: phaseLabel({ kind, number: n }), current: at === now, later: at > now });
    }
  }
  return columns;
}

/** 角色设置 then the phases: the columns that hold text. */
export function textColumns(seatCount: number, phase: Phase): LogColumn[] {
  return [{ key: 'setup', kind: 'setup', phase: null, label: '角色设置', current: false, later: false }, ...phaseColumns(seatCount, phase)];
}

/** Every column left to right: 座位, 玩家, 初始角色, then the text columns. */
export function allColumns(seatCount: number, phase: Phase): LogColumn[] {
  const fixed = (key: 'seat' | 'name' | 'role', label: string): LogColumn => ({ key, kind: key, phase: null, label, current: false, later: false });
  return [fixed('seat', '座位'), fixed('name', '玩家'), fixed('role', '初始角色'), ...textColumns(seatCount, phase)];
}

/** The column key of a stored cell. */
export function columnKey(kind: string, phase: number | null): string {
  return kind === 'night' || kind === 'day' ? `${kind[0]}${phase}` : kind;
}

/** LOG-06: a cell's own colour wins over its row's; 'none' shows no colour at all. */
export function shownMark(own: StoredMark, row: LogMark | null): LogMark | null {
  if (own === 'none') return null;
  return own ?? row;
}

/** A row of the table: a seat ('s3') or a note row ('n:<id>'). */
export function rowKey(row: { seat: number } | { note: string }): string {
  return 'seat' in row ? `s${row.seat}` : `n:${row.note}`;
}

/** The cells a stroke covers: the rectangle from one cell to another (LOG-06). */
export function rectangle<R, C>(rows: R[], columns: C[], from: { row: number; col: number }, to: { row: number; col: number }): { row: R; col: C }[] {
  const cells: { row: R; col: C }[] = [];
  for (let r = Math.min(from.row, to.row); r <= Math.max(from.row, to.row); r += 1) {
    for (let c = Math.min(from.col, to.col); c <= Math.max(from.col, to.col); c += 1) cells.push({ row: rows[r]!, col: columns[c]! });
  }
  return cells;
}

/** 撤销: the paint that puts a cell back to what it stored before a stroke. */
export function undoPaint(before: StoredMark): Paint {
  if (before === null) return 'unset';
  if (before === 'none') return 'clear';
  return before;
}
