// Player statistics (docs/rules/m5-stats-history.md, STATS).
// (Declared here rather than imported, so Node-side tests can load this file directly.)
type Alignment = 'good' | 'evil';

/** One ended game from one user's point of view. */
export interface PlayedGame {
  endedAt: string;
  winner: Alignment;
  /** True when the user ran this game as DM (then there is no seat). */
  asDm: boolean;
  /** STATS-04: the actual role held when the game started. */
  startingRole: string | null;
  /** STATS-02: the alignment at the end of the game. */
  finalAlignment: Alignment | null;
}

export interface TeamRecord {
  games: number;
  wins: number;
  /** A whole percentage, or null with no games ("—"). */
  rate: number | null;
}

export interface Stats {
  gamesPlayed: number;
  wins: number;
  rate: number | null;
  byTeam: Record<Alignment, TeamRecord>;
  /** STATS-04: up to 3 roles, most played first; ties go to the more recently played. */
  topRoles: { role: string; count: number }[];
  gamesAsDm: number;
}

/** STATS-02: wins ÷ games as a whole percentage; null means "—". */
export function winRate(wins: number, games: number): number | null {
  return games > 0 ? Math.round((100 * wins) / games) : null;
}

export function formatRate(rate: number | null): string {
  return rate === null ? '—' : `${rate}%`;
}

function record(games: PlayedGame[]): TeamRecord {
  const wins = games.filter((g) => g.finalAlignment === g.winner).length;
  return { games: games.length, wins, rate: winRate(wins, games.length) };
}

/**
 * STATS-01..05. `isGuest`: STATS-06, guests have no stats (null). Upgraded guests are
 * no longer guests, so all their earlier games count (STATS-07).
 */
export function computeStats(games: readonly PlayedGame[], isGuest: boolean): Stats | null {
  if (isGuest) return null;
  const played = games.filter((g) => !g.asDm);
  const overall = record(played);
  // role → how often it was the starting role, and when it was last played (ms).
  const roles = new Map<string, { count: number; last: number }>();
  for (const g of played) {
    if (!g.startingRole) continue;
    const r = roles.get(g.startingRole) ?? { count: 0, last: -Infinity };
    roles.set(g.startingRole, { count: r.count + 1, last: Math.max(r.last, Date.parse(g.endedAt)) });
  }
  const topRoles = [...roles.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.last - a.last)
    .slice(0, 3)
    .map(([role, r]) => ({ role, count: r.count }));
  return {
    gamesPlayed: overall.games,
    wins: overall.wins,
    rate: overall.rate,
    byTeam: {
      good: record(played.filter((g) => g.finalAlignment === 'good')),
      evil: record(played.filter((g) => g.finalAlignment === 'evil')),
    },
    topRoles,
    gamesAsDm: games.filter((g) => g.asDm).length,
  };
}
