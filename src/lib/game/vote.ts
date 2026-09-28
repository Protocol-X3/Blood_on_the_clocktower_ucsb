// Nominations and voting (docs/rules/m3-live-game.md, NOM and VOTE).
// The database enforces the same rules; these functions drive the screens and
// are the reference the model-based simulation checks the database against.

/**
 * VOTE-03: the order the clock hand visits the seats: every seat once, clockwise,
 * from the seat after the nominee, ending with the nominee.
 */
export function circleOrder(seatCount: number, nominee: number): number[] {
  // (A nominee within 1…seatCount also rules out an empty table.)
  if (!Number.isInteger(seatCount) || !Number.isInteger(nominee) || nominee < 1 || nominee > seatCount) return [];
  return Array.from({ length: seatCount }, (_, i) => ((nominee + i) % seatCount) + 1);
}

/** VOTE-10: half the living players, rounded up. */
export function voteThreshold(living: number): number {
  return Math.ceil(Math.max(0, living) / 2);
}

export interface SeatVoter {
  alive: boolean;
  ghostVoteUsed: boolean;
}

/** VOTE-01 / VOTE-02: the living, and the dead with an unused ghost vote, may raise a hand. */
export function canRaiseHand(seat: SeatVoter): boolean {
  return seat.alive || !seat.ghostVoteUsed;
}

export interface Vote {
  raised: boolean;
  locked: boolean;
}

/** VOTE-09: the count is the number of locked raised hands. */
export function voteCount(votes: readonly Vote[]): number {
  return votes.filter((v) => v.raised && v.locked).length;
}

export interface Tally {
  nominee: number;
  count: number;
  threshold: number;
}

/**
 * VOTE-11: the nominee with the day's highest count at or above its threshold.
 * A tie for that highest count puts nobody on the block.
 */
export function onTheBlock(tallies: readonly Tally[]): number | null {
  const passing = tallies.filter((t) => t.count >= t.threshold);
  const max = Math.max(...passing.map((t) => t.count));
  // The same nominee twice is not a tie with themselves.
  const top = new Set(passing.filter((t) => t.count === max).map((t) => t.nominee));
  return top.size === 1 ? [...top][0]! : null;
}

export type NominationWarning = 'nominator_already_nominated' | 'nominee_already_nominated' | 'nominator_dead';

export const NOMINATION_WARNING_TEXT: Record<NominationWarning, string> = {
  nominator_already_nominated: '提名者今天已经提名过',
  nominee_already_nominated: '被提名者今天已经被提名过',
  nominator_dead: '提名者已死亡',
};

/** NOM-02: rule breaks the DM is warned about, but not stopped by. */
export function nominationWarnings(
  today: readonly { nominator: number; nominee: number }[],
  nominator: number,
  nominee: number,
  nominatorAlive: boolean,
): NominationWarning[] {
  const warnings: NominationWarning[] = [];
  if (today.some((n) => n.nominator === nominator)) warnings.push('nominator_already_nominated');
  if (today.some((n) => n.nominee === nominee)) warnings.push('nominee_already_nominated');
  if (!nominatorAlive) warnings.push('nominator_dead');
  return warnings;
}

/** VOTE-05: 1.5 s per seat by default, adjustable from 0.5 to 3 s. */
export const VOTE_SPEED = { min: 500, max: 3000, default: 1500, step: 250 } as const;

export function clampVoteSpeed(ms: number): number {
  if (!Number.isFinite(ms)) return VOTE_SPEED.default;
  return Math.min(VOTE_SPEED.max, Math.max(VOTE_SPEED.min, Math.round(ms)));
}
