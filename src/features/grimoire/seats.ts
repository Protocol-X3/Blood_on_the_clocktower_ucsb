// What the grimoire shows for each seat (GRIM-02).
import type { GameData, GameRole, GrimoireToken, LogEntry } from '@/features/game/useGameData';
import { deathText, type DeathCause } from '@/features/live/model';
import { roleGlyph } from '@/lib/game/composition';
import { phaseLabel, type PhaseKind } from '@/lib/game/phase';
import { ALIGNMENT_LABEL, defaultAlignment, type Alignment } from '@/lib/game/teams';

export interface GrimoireSeat {
  seat: number;
  name: string;
  actual: GameRole | undefined;
  /** Only when it differs from the actual role. */
  shown: GameRole | undefined;
  alignment: Alignment | undefined;
  /** Only when the alignment differs from the actual role's team default, e.g. "邪恶". */
  alignmentNote: string | null;
  alive: boolean;
  status: string;
  ghostVoteUsed: boolean;
  tokens: GrimoireToken[];
  glyph: string;
}

export function grimoireSeats(data: GameData, names: Map<number, string>): GrimoireSeat[] {
  const roleById = new Map(data.roles.map((r) => [r.role_id, r]));
  return data.seats.map((s) => {
    const sr = data.seatRoles.find((x) => x.seat === s.seat);
    const actual = sr ? roleById.get(sr.actual_role_id) : undefined;
    const shown = sr && sr.shown_role_id !== sr.actual_role_id ? roleById.get(sr.shown_role_id) : undefined;
    const off = !!(actual && sr && sr.alignment !== defaultAlignment(actual.team));
    return {
      seat: s.seat,
      name: names.get(s.seat) ?? '',
      actual,
      shown,
      alignment: sr?.alignment,
      alignmentNote: off && sr ? ALIGNMENT_LABEL[sr.alignment] : null,
      alive: s.alive,
      status: deathText(s.death_cause as DeathCause, s.death_note),
      ghostVoteUsed: s.ghost_vote_used,
      tokens: data.tokens.filter((t) => t.seat === s.seat),
      glyph: actual ? roleGlyph({ name: actual.name, glyph: actual.glyph }) : String(s.seat),
    };
  });
}

/** Every reminder text the script's roles offer, for TOKEN-01. */
export function scriptReminders(data: GameData): { role: string; text: string }[] {
  return data.roles.flatMap((r) => r.reminders.map((text) => ({ role: r.name, text })));
}

export function entryPhase(e: LogEntry): string {
  return phaseLabel({ kind: e.phase_kind as PhaseKind, number: e.phase_number });
}
