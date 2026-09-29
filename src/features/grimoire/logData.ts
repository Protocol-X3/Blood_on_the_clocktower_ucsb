// The log table's data (LOG-01 … LOG-06): cells looked up by row and column, and the calls that change them.
import type { GameData, LogCell, LogNote } from '@/features/game/useGameData';
import { columnKey, rowKey, shownMark, type LogColumn, type LogMark, type StoredMark } from '@/lib/game/logSheet';
import type { Team } from '@/lib/game/teams';
import { supabase } from '@/services/supabase';

export type Act = (run: () => PromiseLike<{ error: unknown }>, after?: () => void) => Promise<void>;

/** A row of the log table: a seat, or one of the DM's note rows (LOG-05). */
export type LogRow = { seat: number } | { note: string };

/** The log table's stored cells, looked up by row and column. */
export class LogIndex {
  private readonly cells = new Map<string, LogCell>();
  private readonly rowMarks = new Map<number, LogMark>();

  constructor(cells: LogCell[], rowMarks: { seat: number; mark: string }[]) {
    for (const c of cells) this.cells.set(`${c.seat === null ? rowKey({ note: c.note_id! }) : rowKey({ seat: c.seat })}|${columnKey(c.column_kind, c.phase_number)}`, c);
    for (const r of rowMarks) this.rowMarks.set(r.seat, r.mark as LogMark);
  }

  private cell(row: LogRow, col: string) {
    return this.cells.get(`${rowKey(row)}|${col}`);
  }

  body(row: LogRow, col: string): string {
    return this.cell(row, col)?.body ?? '';
  }

  /** What the cell itself stores (for 撤销). */
  stored(row: LogRow, col: string): StoredMark {
    return (this.cell(row, col)?.mark ?? null) as StoredMark;
  }

  /** The colour the cell shows: its own, else its row's (LOG-06). */
  mark(row: LogRow, col: string): LogMark | null {
    return shownMark(this.stored(row, col), 'seat' in row ? (this.rowMarks.get(row.seat) ?? null) : null);
  }

  hasText(row: LogRow): boolean {
    return [...this.cells.entries()].some(([k, c]) => k.startsWith(`${rowKey(row)}|`) && !!c.body);
  }
}

export function logIndex(data: { logCells: LogCell[]; logRowMarks: { seat: number; mark: string }[] }) {
  return new LogIndex(data.logCells, data.logRowMarks);
}

/** The arguments that name a cell, for set_log_cell and mark_log_cells. */
export function cellArgs(row: LogRow, col: LogColumn) {
  return {
    seat: 'seat' in row ? row.seat : null,
    note: 'note' in row ? row.note : null,
    column: col.kind,
    phase: col.phase,
  };
}

export function saveCell(gameId: string, row: LogRow, col: LogColumn, body: string) {
  const a = cellArgs(row, col);
  // The generated types can't express the nullable arguments (a seat or a note, a phase or none).
  return supabase.rpc('set_log_cell', {
    p_game: gameId,
    p_seat: a.seat as number,
    p_note: a.note as string,
    p_column: a.column,
    p_phase: a.phase as number,
    p_body: body,
  });
}

/** A seat's name and starting role, as the log shows it. */
export interface LogSeat {
  seat: number;
  name: string;
  role: { name: string; team: Team; glyph: string } | undefined;
}

export const TEAM_TEXT: Record<Team, string> = {
  townsfolk: 'text-townsfolk-text',
  outsider: 'text-outsider-text',
  minion: 'text-minion-text',
  demon: 'text-demon-text',
};

/** The seats and note rows of the log, in table order. */
export function logRows(data: GameData, names: Map<number, string>): { seats: LogSeat[]; notes: LogNote[] } {
  const byId = new Map(data.roles.map((r) => [r.role_id, r]));
  return {
    seats: data.seats.map((s) => {
      const start = data.seatRoles.find((r) => r.seat === s.seat)?.starting_role_id;
      const role = start ? byId.get(start) : undefined;
      return { seat: s.seat, name: names.get(s.seat) ?? '', role: role ? { name: role.name, team: role.team, glyph: role.glyph } : undefined };
    }),
    notes: data.logNotes,
  };
}
