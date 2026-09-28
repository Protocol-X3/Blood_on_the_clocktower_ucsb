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

  readonly seatCount: number;

  constructor(seatCount: number) {
    this.seatCount = seatCount;
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
