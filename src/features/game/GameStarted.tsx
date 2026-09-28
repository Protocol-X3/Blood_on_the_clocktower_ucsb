import { Chip } from '@/components/ui/Chip';
import { Panel } from '@/components/ui/Panel';
import { RoleToken } from '@/components/ui/RoleToken';
import { RoleCard } from '@/features/roles/RoleCard';
import { ALIGNMENT_LABEL } from '@/lib/game/teams';
import type { Game } from '@/services/supabase';
import { useGameData } from './useGameData';

/**
 * After 开始游戏 (SETUP-10): a player sees their role card (their shown role only,
 * SECRET-01); the DM sees every seat's actual and shown role.
 */
export function GameStarted({ game, isDm, seatNames }: { game: Game; isDm: boolean; seatNames: Map<number, string> }) {
  const { data } = useGameData(game.id);
  if (!data) return null;
  const roleById = new Map(data.roles.map((r) => [r.role_id, r]));

  if (!isDm) {
    const mine = data.shown[0];
    const role = mine ? roleById.get(mine.shown_role_id) : undefined;
    return role ? (
      <div className="motion-safe:animate-flip-in">
        <RoleCard role={role} />
      </div>
    ) : (
      <p className="text-center text-sm text-ink-muted" role="status">
        对局进行中，你正在旁观。
      </p>
    );
  }

  return (
    <Panel aria-label="座位角色" padding="none">
      <ul>
        {data.seatRoles.map((sr) => {
          const actual = roleById.get(sr.actual_role_id)!;
          const shown = sr.shown_role_id !== sr.actual_role_id ? roleById.get(sr.shown_role_id) : undefined;
          return (
            <li key={sr.seat} data-testid={`dm-seat-${sr.seat}`} className="flex min-h-16 items-center gap-3 border-b border-line px-4 last:border-b-0">
              <span className="w-8 font-serif font-bold text-gold-strong">{sr.seat}号</span>
              <RoleToken glyph={actual.glyph} team={actual.team} label={actual.name} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{seatNames.get(sr.seat)}</span>
                <span className="block text-sm text-ink-muted">
                  {actual.name} · {ALIGNMENT_LABEL[sr.alignment]}
                </span>
              </span>
              {shown ? <Chip>展示：{shown.name}</Chip> : null}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
