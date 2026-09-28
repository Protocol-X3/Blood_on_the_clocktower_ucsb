// Derives what the live screens show from the game's rows.
import { phaseLabel, type PhaseKind } from '@/lib/game/phase';
import { circleOrder, onTheBlock, voteCount } from '@/lib/game/vote';
import type { BoardPost, GameData, Nomination, VoteRow } from '@/features/game/useGameData';
import type { Team } from '@/lib/game/teams';
import type { CircleSeat, SeatVoteState } from './SeatCircle';

export const OPEN_STATUSES = ['open', 'voting', 'counted'] as const;

export function openNomination(data: GameData): Nomination | undefined {
  return data.nominations.find((n) => (OPEN_STATUSES as readonly string[]).includes(n.status));
}

export function votesOf(data: GameData, nomination: Nomination | undefined): Map<number, VoteRow> {
  return new Map(nomination ? data.votes.filter((v) => v.nomination_id === nomination.id).map((v) => [v.seat, v]) : []);
}

/** The seat the clock hand is about to pass, if the circle is running. */
export function currentSeat(nomination: Nomination | undefined, seatCount: number): number | null {
  if (!nomination || nomination.status !== 'voting') return null;
  return circleOrder(seatCount, nomination.nominee_seat)[nomination.hand_index] ?? null;
}

export function liveCount(nomination: Nomination, votes: Map<number, VoteRow>): number {
  return nomination.vote_count ?? voteCount([...votes.values()]);
}

/** VOTE-11 / VOTE-13: who is on the block today, from the day's closed votes. */
export function blockToday(data: GameData, day: number): number | null {
  return onTheBlock(
    data.nominations
      .filter((n) => n.day_number === day && n.status === 'closed' && n.vote_count !== null && n.threshold !== null)
      .map((n) => ({
        nominee: n.nominee_seat,
        count: n.vote_count!,
        threshold: n.threshold!,
      })),
  );
}

export function todays(data: GameData, day: number): Nomination[] {
  return data.nominations.filter((n) => n.day_number === day && n.status !== 'cancelled');
}

export const DEATH_CAUSE_LABEL = {
  executed: '处决',
  night: '夜间死亡',
  other: '其他',
} as const;
export type DeathCause = keyof typeof DEATH_CAUSE_LABEL;

export function deathText(cause: DeathCause | null, note: string | null): string {
  if (!cause) return '存活';
  return cause === 'other' && note ? `其他：${note}` : DEATH_CAUSE_LABEL[cause];
}

/** The seats for the town-square circle, with each seat's vote state. */
export function circleSeats(
  data: GameData,
  names: Map<number, string>,
  opts: {
    mySeat?: number | null;
    selected?: number | null;
    /** The DM's view: each seat's actual role glyph and team. */
    roles?: Map<number, { glyph: string; team: Team }>;
  } = {},
): CircleSeat[] {
  const nom = openNomination(data);
  const votes = votesOf(data, nom);
  const current = currentSeat(nom, data.seats.length);
  return data.seats.map((s) => {
    const v = votes.get(s.seat);
    let vote: SeatVoteState = nom ? 'none' : 'idle';
    if (nom && s.seat === current) vote = 'current';
    else if (v?.locked) vote = v.raised ? 'locked-yes' : 'locked-no';
    else if (nom && s.seat === nom.nominee_seat) vote = 'nominee';
    return {
      seat: s.seat,
      label: names.get(s.seat) ?? '',
      alive: s.alive,
      ghostVoteUsed: s.ghost_vote_used,
      vote,
      raised: !!v && v.raised && !v.locked,
      mine: opts.mySeat === s.seat,
      selected: opts.selected === s.seat,
      token: opts.roles?.get(s.seat)?.glyph,
      team: opts.roles?.get(s.seat)?.team,
    };
  });
}

export function postPhase(p: BoardPost): string {
  return phaseLabel({
    kind: p.phase_kind as PhaseKind,
    number: p.phase_number,
  });
}

export function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
