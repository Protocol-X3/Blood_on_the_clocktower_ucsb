// A reference model of a running game (docs/rules/m3-live-game.md), for the
// model-based simulation (M3.3). Each action returns what the database must do:
// succeed, or refuse with a given error code. The model applies the action only
// when it succeeds. It checks in the same order as the database functions, so
// the expected error code is exact.
import { nextPhase, type Phase } from '../../src/lib/game/phase.ts';
import { canRaiseHand, circleOrder, onTheBlock, voteThreshold } from '../../src/lib/game/vote.ts';

export type DeathCause = 'executed' | 'night' | 'other';
export type NominationStatus = 'open' | 'voting' | 'counted' | 'closed' | 'cancelled';

export interface ModelSeat {
  alive: boolean;
  ghostVoteUsed: boolean;
  cause: DeathCause | null;
}

export interface ModelVote {
  raised: boolean;
  locked: boolean;
  ghostSpent: boolean;
}

export interface ModelNomination {
  day: number;
  nominator: number;
  nominee: number;
  status: NominationStatus;
  hand: number;
  paused: boolean;
  threshold: number | null;
  count: number | null;
  /** Index = seat - 1. */
  votes: ModelVote[];
}

export interface ModelPost {
  /** null for the DM. */
  seat: number | null;
}

/** A script role, as the grimoire needs it (M4). */
export interface ModelRole {
  id: string;
  team: 'townsfolk' | 'outsider' | 'minion' | 'demon';
  reminders: string[];
}

/** A cell of the log table (LOG-01 / LOG-06). */
export interface ModelLogCell {
  body: string | null;
  mark: string | null;
}

/** Names a log cell: a seat or a note row (by its model id), and a column. */
export interface ModelCellRef {
  seat: number | null;
  note: number | null;
  column: string;
  phase: number | null;
}

export interface ModelSeatRole {
  actual: string;
  shown: string;
  alignment: 'good' | 'evil';
}

export type Outcome = { ok: true; value?: unknown } | { ok: false; code: string };

const ok = (value?: unknown): Outcome => ({ ok: true, value });
const fail = (code: string): Outcome => ({ ok: false, code });

export class GameModel {
  phase: Phase = { kind: 'night', number: 1 };
  status: 'in_progress' | 'ended' = 'in_progress';
  winner: 'good' | 'evil' | null = null;
  seats: ModelSeat[];
  nominations: ModelNomination[] = [];
  /** day → executed seat (null: 无人处决). */
  dayResults = new Map<number, number | null>();
  posts: ModelPost[] = [];
  speed = 1500;
  // M4 · the grimoire
  seatRoles: ModelSeatRole[];
  tokens: { seat: number; label: string }[] = [];
  /** The log table: `${row}|${column}` → cell, where row is 's<seat>' or 'n<note id>'. */
  logCells = new Map<string, ModelLogCell>();
  logNotes: { id: number; label: string }[] = [];
  /** LOG-06: seat → the row colour set at the start. */
  logRowMarks = new Map<number, 'red' | 'yellow'>();
  private nextNote = 1;

  readonly seatCount: number;
  readonly script: ModelRole[];

  /** `roles`: the roles dealt to seats 1…n (shown as themselves); `script`: every role of the game's script. */
  constructor(seatCount: number, roles: ModelRole[] = [], script: ModelRole[] = roles) {
    this.seatCount = seatCount;
    this.script = script;
    this.seatRoles = roles.slice(0, seatCount).map((r) => ({ actual: r.id, shown: r.id, alignment: r.team === 'townsfolk' || r.team === 'outsider' ? 'good' : 'evil' }));
    roles.slice(0, seatCount).forEach((r, i) => {
      if (r.team === 'minion' || r.team === 'demon') this.logRowMarks.set(i + 1, 'red');
      else if (r.team === 'outsider') this.logRowMarks.set(i + 1, 'yellow');
    });
    this.seats = Array.from({ length: seatCount }, () => ({
      alive: true,
      ghostVoteUsed: false,
      cause: null,
    }));
  }

  private seat(n: number): ModelSeat | undefined {
    return Number.isInteger(n) && n >= 1 && n <= this.seatCount ? this.seats[n - 1] : undefined;
  }

  get openNomination(): ModelNomination | undefined {
    return this.nominations.find((n) => n.status === 'open' || n.status === 'voting' || n.status === 'counted');
  }

  private running(): Outcome | null {
    return this.status === 'in_progress' ? null : fail('NOT_IN_PROGRESS');
  }

  private kill(seat: number, cause: DeathCause) {
    Object.assign(this.seats[seat - 1]!, { alive: false, cause });
  }

  // PHASE-01 / PHASE-04
  advancePhase(): Outcome {
    const refused = this.running() ?? (this.openNomination ? fail('NOMINATION_OPEN') : null);
    if (refused) return refused;
    this.phase = nextPhase(this.phase);
    return ok();
  }

  // DEATH-01
  killSeat(seat: number, cause: DeathCause, note: string | null): Outcome {
    const refused = this.running();
    if (refused) return refused;
    const s = this.seat(seat);
    if (!s) return fail('SEAT_INVALID');
    if (note !== null && note.trim().length > 40) return fail('NOTE_TOO_LONG');
    if (!s.alive) return fail('ALREADY_DEAD');
    this.kill(seat, cause);
    return ok();
  }

  // DEATH-02
  reviveSeat(seat: number): Outcome {
    const refused = this.running();
    if (refused) return refused;
    const s = this.seat(seat);
    if (!s) return fail('SEAT_INVALID');
    if (s.alive) return fail('NOT_DEAD');
    Object.assign(s, { alive: true, cause: null });
    return ok();
  }

  // DEATH-04
  setGhostVote(seat: number, used: boolean): Outcome {
    const refused = this.running();
    if (refused) return refused;
    const s = this.seat(seat);
    if (!s) return fail('SEAT_INVALID');
    s.ghostVoteUsed = used;
    return ok();
  }

  // NOM-01 / PHASE-05
  openNominationFor(nominator: number, nominee: number): Outcome {
    const refused = this.running();
    if (refused) return refused;
    if (this.phase.kind !== 'day') return fail('NOT_DAY');
    if (!this.seat(nominator) || !this.seat(nominee)) return fail('SEAT_INVALID');
    if (this.dayResults.has(this.phase.number)) return fail('DAY_OVER');
    if (this.openNomination) return fail('NOMINATION_OPEN');
    this.nominations.push({
      day: this.phase.number,
      nominator,
      nominee,
      status: 'open',
      hand: 0,
      paused: false,
      threshold: null,
      count: null,
      votes: this.seats.map(() => ({
        raised: false,
        locked: false,
        ghostSpent: false,
      })),
    });
    return ok();
  }

  // NOM-03
  cancelNomination(n: ModelNomination): Outcome {
    const refused = this.running();
    if (refused) return refused;
    if (n.status !== 'open') return fail('VOTE_STARTED');
    n.status = 'cancelled';
    return ok();
  }

  // VOTE-01 / VOTE-02 / VOTE-04 (as the seat's player)
  setHand(n: ModelNomination, seat: number, raised: boolean): Outcome {
    if (n.status !== 'open' && n.status !== 'voting') return fail('NO_OPEN_VOTE');
    const v = n.votes[seat - 1]!;
    if (v.locked) return fail('VOTE_LOCKED');
    if (raised && !canRaiseHand(this.voter(seat))) return fail('GHOST_VOTE_SPENT');
    v.raised = raised;
    return ok();
  }

  private voter(seat: number) {
    const s = this.seats[seat - 1]!;
    return { alive: s.alive, ghostVoteUsed: s.ghostVoteUsed };
  }

  // VOTE-03 / VOTE-10
  startVote(n: ModelNomination): Outcome {
    const refused = this.running();
    if (refused) return refused;
    if (n.status !== 'open') return fail('VOTE_STARTED');
    Object.assign(n, {
      status: 'voting',
      hand: 0,
      paused: false,
      threshold: voteThreshold(this.seats.filter((s) => s.alive).length),
    });
    return ok();
  }

  // VOTE-04 / VOTE-07
  advanceVote(n: ModelNomination, expected: number): Outcome {
    const refused = this.running();
    if (refused) return refused;
    if (n.status !== 'voting') return fail('NOT_VOTING');
    if (expected !== n.hand) return ok(n.hand);
    const seat = circleOrder(this.seatCount, n.nominee)[n.hand]!;
    const s = this.seats[seat - 1]!;
    const v = n.votes[seat - 1]!;
    const raised = v.raised && canRaiseHand(this.voter(seat));
    Object.assign(v, { locked: true, raised, ghostSpent: raised && !s.alive });
    if (raised && !s.alive) s.ghostVoteUsed = true;
    n.hand += 1;
    if (n.hand === this.seatCount) {
      n.status = 'counted';
      n.paused = false;
      n.count = this.count(n);
    }
    return ok(n.hand);
  }

  private count(n: ModelNomination): number {
    return n.votes.filter((v) => v.locked && v.raised).length;
  }

  // VOTE-06
  setPaused(n: ModelNomination, paused: boolean): Outcome {
    const refused = this.running();
    if (refused) return refused;
    if (n.status !== 'voting') return fail('NOT_VOTING');
    n.paused = paused;
    return ok();
  }

  // VOTE-05
  setSpeed(ms: number): Outcome {
    const refused = this.running();
    if (refused) return refused;
    if (!Number.isInteger(ms) || ms < 500 || ms > 3000) return fail('SPEED_INVALID');
    this.speed = ms;
    return ok();
  }

  // VOTE-08
  correctVote(n: ModelNomination, seat: number, raised: boolean): Outcome {
    const refused = this.running();
    if (refused) return refused;
    if (n.status !== 'voting' && n.status !== 'counted') return fail('NOT_VOTING');
    const s = this.seat(seat);
    if (!s) return fail('SEAT_INVALID');
    const v = n.votes[seat - 1]!;
    if (!v.locked) return fail('NOT_LOCKED');
    if (v.raised === raised) return ok();
    if (raised && !s.alive) {
      Object.assign(v, { raised: true, ghostSpent: true });
      s.ghostVoteUsed = true;
    } else if (!raised && v.ghostSpent) {
      Object.assign(v, { raised: false, ghostSpent: false });
      s.ghostVoteUsed = false;
    } else {
      v.raised = raised;
    }
    if (n.status === 'counted') n.count = this.count(n);
    return ok();
  }

  // VOTE-13
  closeVote(n: ModelNomination): Outcome {
    const refused = this.running();
    if (refused) return refused;
    if (n.status !== 'counted') return fail('NOT_COUNTED');
    n.status = 'closed';
    return ok();
  }

  /** VOTE-11: who is on the block today. */
  get block(): number | null {
    return onTheBlock(
      this.nominations
        .filter((n) => n.day === this.phase.number && n.status === 'closed')
        .map((n) => ({
          nominee: n.nominee,
          count: n.count!,
          threshold: n.threshold!,
        })),
    );
  }

  // VOTE-14
  concludeDay(execute: boolean): Outcome {
    const refused = this.running();
    if (refused) return refused;
    if (this.phase.kind !== 'day') return fail('NOT_DAY');
    if (this.openNomination) return fail('NOMINATION_OPEN');
    if (this.dayResults.has(this.phase.number)) return fail('DAY_OVER');
    let target: number | null = null;
    if (execute) {
      target = this.block;
      if (target === null) return fail('NOBODY_ON_BLOCK');
      if (this.seats[target - 1]!.alive) this.kill(target, 'executed');
    }
    this.dayResults.set(this.phase.number, target);
    return ok(target);
  }

  // BOARD-01 (seat null: the DM)
  post(seat: number | null, body: string): Outcome {
    const refused = this.running();
    if (refused) return refused;
    const length = [...body.trim()].length;
    if (length < 1 || length > 140) return fail('POST_LENGTH');
    this.posts.push({ seat });
    return ok();
  }

  // BOARD-03 (by: a seat, or null for the DM)
  deletePost(index: number, by: number | null): Outcome {
    const p = this.posts[index]!;
    if (by !== null && p.seat !== by) return fail('FORBIDDEN');
    const refused = this.running();
    if (refused) return refused;
    this.posts.splice(index, 1);
    return ok();
  }

  // TOKEN-01
  addToken(seat: number, kind: 'poisoned' | 'drunk' | 'reminder' | 'custom', text: string | null): Outcome {
    const refused = this.running();
    if (refused) return refused;
    if (!this.seat(seat)) return fail('SEAT_INVALID');
    const t = (text ?? '').trim();
    let label: string;
    if (kind === 'poisoned') label = '中毒';
    else if (kind === 'drunk') label = '醉酒';
    else if (kind === 'reminder') {
      if (!this.script.some((r) => r.reminders.includes(t))) return fail('TOKEN_NOT_IN_SCRIPT');
      label = t;
    } else {
      const n = [...t].length;
      if (n < 1 || n > 8) return fail('TOKEN_TEXT_LENGTH');
      label = t;
    }
    this.tokens.push({ seat, label });
    return ok();
  }

  removeToken(index: number): Outcome {
    const refused = this.running();
    if (refused) return refused;
    this.tokens.splice(index, 1);
    return ok();
  }

  // LOG-01: the table shows min(5, ⌊players / 2⌋) nights and days, more once the game goes past them.
  get logRounds(): number {
    return Math.max(Math.min(5, Math.floor(this.seatCount / 2)), this.phase.number);
  }

  private static cellKey(c: ModelCellRef): string {
    const row = c.seat !== null ? `s${c.seat}` : `n${c.note}`;
    return `${row}|${c.column}${c.phase ?? ''}`;
  }

  private checkCell(c: ModelCellRef): Outcome | null {
    if ((c.seat === null) === (c.note === null)) return fail('LOG_ROW_INVALID');
    if (c.seat !== null && !this.seat(c.seat)) return fail('SEAT_INVALID');
    if (c.note !== null && !this.logNotes.some((n) => n.id === c.note)) return fail('LOG_NOTE_NOT_FOUND');
    if (!['seat', 'name', 'role', 'setup', 'night', 'day'].includes(c.column)) return fail('LOG_COLUMN_INVALID');
    const phased = c.column === 'night' || c.column === 'day';
    if (phased && (c.phase === null || c.phase < 1 || c.phase > this.logRounds)) return fail('LOG_COLUMN_INVALID');
    if (!phased && c.phase !== null) return fail('LOG_COLUMN_INVALID');
    return null;
  }

  private putCell(key: string, cell: ModelLogCell) {
    if (cell.body === null && cell.mark === null) this.logCells.delete(key);
    else this.logCells.set(key, cell);
  }

  // LOG-01 / LOG-03
  setLogCell(c: ModelCellRef, body: string): Outcome {
    const refused = this.running() ?? this.checkCell(c);
    if (refused) return refused;
    if (!['setup', 'night', 'day'].includes(c.column)) return fail('LOG_COLUMN_INVALID');
    const text = body.trim();
    if ([...text].length > 500) return fail('LOG_LENGTH');
    const key = GameModel.cellKey(c);
    this.putCell(key, { body: text || null, mark: this.logCells.get(key)?.mark ?? null });
    return ok();
  }

  // LOG-06
  markLogCells(cells: ModelCellRef[], mark: string): Outcome {
    const refused = this.running();
    if (refused) return refused;
    if (!['red', 'yellow', 'violet', 'green', 'dead', 'clear', 'unset'].includes(mark)) return fail('LOG_MARK_INVALID');
    if (cells.length < 1 || cells.length > 500) return fail('LOG_CELLS_INVALID');
    for (const c of cells) {
      const bad = this.checkCell(c);
      if (bad) return bad;
    }
    for (const c of cells) {
      const key = GameModel.cellKey(c);
      const own =
        mark === 'unset' ? null : mark === 'clear' ? (c.seat !== null && this.logRowMarks.has(c.seat) ? 'none' : null) : mark;
      this.putCell(key, { body: this.logCells.get(key)?.body ?? null, mark: own });
    }
    return ok();
  }

  // LOG-05
  addLogNote(label: string): Outcome {
    const refused = this.running();
    if (refused) return refused;
    const text = label.trim();
    if ([...text].length > 12) return fail('LOG_LABEL_LENGTH');
    if (this.logNotes.length >= 20) return fail('LOG_NOTE_LIMIT');
    const id = this.nextNote++;
    this.logNotes.push({ id, label: text });
    return ok(id);
  }

  renameLogNote(index: number, label: string): Outcome {
    const refused = this.running();
    if (refused) return refused;
    const text = label.trim();
    if ([...text].length > 12) return fail('LOG_LABEL_LENGTH');
    this.logNotes[index]!.label = text;
    return ok();
  }

  deleteLogNote(index: number): Outcome {
    const refused = this.running();
    if (refused) return refused;
    const [note] = this.logNotes.splice(index, 1);
    for (const key of [...this.logCells.keys()]) if (key.startsWith(`n${note!.id}|`)) this.logCells.delete(key);
    return ok();
  }

  // GRIM-03
  setRole(seat: number, actual: string, shown: string): Outcome {
    const refused = this.running();
    if (refused) return refused;
    if (!this.seat(seat)) return fail('SEAT_INVALID');
    if (!this.script.some((r) => r.id === actual) || !this.script.some((r) => r.id === shown)) return fail('ROLE_NOT_IN_SCRIPT');
    Object.assign(this.seatRoles[seat - 1]!, { actual, shown });
    return ok();
  }

  setAlignment(seat: number, alignment: 'good' | 'evil'): Outcome {
    const refused = this.running();
    if (refused) return refused;
    if (!this.seat(seat)) return fail('SEAT_INVALID');
    this.seatRoles[seat - 1]!.alignment = alignment;
    return ok();
  }

  // END-01
  endGame(winner: 'good' | 'evil'): Outcome {
    const refused = this.running();
    if (refused) return refused;
    for (const n of this.nominations) if (n.status === 'open' || n.status === 'voting' || n.status === 'counted') n.status = 'cancelled';
    this.status = 'ended';
    this.winner = winner;
    return ok();
  }
}
