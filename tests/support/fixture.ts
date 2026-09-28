// Seeds ended games directly into the database (with the service role), for the stats
// and history tests (HIST-05). Each game gets its own closed room.
import { admin } from './users.ts';

export interface SeatSpec {
  user: string | null;
  /** The role held when the game started (STATS-04). */
  role: string;
  /** The role at the end, when it changed mid-game. */
  finalRole?: string;
  alignment: 'good' | 'evil';
}

export interface GameSpec {
  endedAt: string;
  winner: 'good' | 'evil';
  dm: string;
  scriptId: string;
  seats: SeatSpec[];
  /** Optional history: a closed nomination (seat → seat) with its count, and board posts. */
  nomination?: { nominator: number; nominee: number; count: number; threshold: number; executed: boolean };
  posts?: { seat: number | null; body: string }[];
}

const must = <T>(r: { data: T; error: { message: string } | null }): NonNullable<T> => {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
};

/**
 * Pool accounts are reused from run to run: forget every game a user took part in,
 * so their stats start from zero.
 */
export async function clearHistory(user: string): Promise<void> {
  const seated = must(await admin.from('game_seats').select('game_id').eq('user_id', user));
  const ran = must(await admin.from('games').select('id').eq('dm_id', user));
  const ids = [...new Set([...seated.map((s) => s.game_id), ...ran.map((g) => g.id)])];
  for (let i = 0; i < ids.length; i += 100) must(await admin.from('games').delete().in('id', ids.slice(i, i + 100)));
}

export async function seedGame(spec: GameSpec): Promise<string> {
  const code = 'ZZZZ';
  const room = must(
    await admin
      .from('rooms')
      .insert({ code, created_by: spec.dm, dm_id: spec.dm, seat_count: spec.seats.length, status: 'closed', closed_at: spec.endedAt })
      .select('id')
      .single(),
  );
  const game = must(
    await admin
      .from('games')
      .insert({
        room_id: room.id,
        dm_id: spec.dm,
        status: 'ended',
        script_id: spec.scriptId,
        assignment_mode: 'manual',
        seat_count: spec.seats.length,
        phase_kind: 'day',
        phase_number: 2,
        started_at: spec.endedAt,
        ended_at: spec.endedAt,
        winner: spec.winner,
      })
      .select('id')
      .single(),
  );
  const ids = [...new Set(spec.seats.flatMap((s) => [s.role, s.finalRole ?? s.role]))];
  const roles = must(await admin.from('roles').select('id, name, team, ability, glyph, reminders').in('id', ids));
  must(
    await admin
      .from('game_roles')
      .insert(roles.map((r) => ({ game_id: game.id, role_id: r.id, name: r.name, team: r.team, ability: r.ability, glyph: r.glyph ?? r.name.slice(0, 1), reminders: r.reminders }))),
  );
  must(await admin.from('game_seats').insert(spec.seats.map((s, i) => ({ game_id: game.id, seat: i + 1, user_id: s.user }))));
  must(
    await admin.from('seat_roles').insert(
      spec.seats.map((s, i) => ({
        game_id: game.id,
        seat: i + 1,
        actual_role_id: s.finalRole ?? s.role,
        shown_role_id: s.finalRole ?? s.role,
        alignment: s.alignment,
        starting_role_id: s.role,
      })),
    ),
  );
  if (spec.nomination) {
    const n = spec.nomination;
    must(
      await admin.from('nominations').insert({
        game_id: game.id,
        day_number: 1,
        nominator_seat: n.nominator,
        nominee_seat: n.nominee,
        status: 'closed',
        hand_index: spec.seats.length,
        threshold: n.threshold,
        vote_count: n.count,
        closed_at: spec.endedAt,
      }),
    );
    must(await admin.from('day_results').insert({ game_id: game.id, day_number: 1, executed_seat: n.executed ? n.nominee : null }));
  }
  if (spec.posts?.length) {
    must(
      await admin.from('board_posts').insert(
        spec.posts.map((p) => ({
          game_id: game.id,
          seat: p.seat,
          is_dm: p.seat === null,
          author_id: p.seat === null ? spec.dm : spec.seats[p.seat - 1]!.user,
          body: p.body,
          phase_kind: 'day',
          phase_number: 1,
        })),
      ),
    );
  }
  return game.id;
}

/**
 * The known history of one player, P (HIST-05). Expected:
 *   5 games played (+1 as DM), 3 wins → 60%;
 *   good: 2 games, 1 win → 50%; evil: 3 games, 2 wins → 67%;
 *   top roles by starting role: 小恶魔 2 (latest 09-06), 厨师 2 (latest 09-03), 僧侣 1.
 */
export function knownHistory(p: string, others: string[], dm: string, scriptId: string): GameSpec[] {
  const [a, b, c, d] = others as [string, string, string, string];
  const table = (me: SeatSpec): SeatSpec[] => [
    me,
    { user: a, role: 'washerwoman', alignment: 'good' },
    { user: b, role: 'librarian', alignment: 'good' },
    { user: c, role: 'poisoner', alignment: 'evil' },
    { user: d, role: 'empath', alignment: 'good' },
  ];
  return [
    { endedAt: '2026-09-01T20:00:00Z', winner: 'good', dm, scriptId, seats: table({ user: p, role: 'chef', alignment: 'good' }) },
    {
      endedAt: '2026-09-02T20:00:00Z',
      winner: 'good',
      dm,
      scriptId,
      seats: table({ user: p, role: 'imp', alignment: 'evil' }),
      nomination: { nominator: 2, nominee: 1, count: 3, threshold: 3, executed: true },
      posts: [
        { seat: 2, body: '我觉得 1号 是恶魔' },
        { seat: null, body: '天亮了' },
      ],
    },
    // Started as the Chef, turned evil: judged by the final alignment (STATS-02), counted as the Chef (STATS-04).
    { endedAt: '2026-09-03T20:00:00Z', winner: 'evil', dm, scriptId, seats: table({ user: p, role: 'chef', finalRole: 'imp', alignment: 'evil' }) },
    { endedAt: '2026-09-04T20:00:00Z', winner: 'evil', dm, scriptId, seats: table({ user: p, role: 'monk', alignment: 'good' }) },
    // P runs this one as DM.
    { endedAt: '2026-09-05T20:00:00Z', winner: 'good', dm: p, scriptId, seats: table({ user: dm, role: 'chef', alignment: 'good' }) },
    { endedAt: '2026-09-06T20:00:00Z', winner: 'evil', dm, scriptId, seats: table({ user: p, role: 'imp', alignment: 'evil' }) },
  ];
}
