// Day and night (docs/rules/m3-live-game.md, PHASE).

export type PhaseKind = 'night' | 'day';

export interface Phase {
  kind: PhaseKind;
  number: number;
}

/** PHASE-01: every game starts at 第1夜. */
export const FIRST_PHASE: Phase = { kind: 'night', number: 1 };

/** PHASE-01: night N → day N → night N+1. */
export function nextPhase(phase: Phase): Phase {
  return phase.kind === 'night' ? { kind: 'day', number: phase.number } : { kind: 'night', number: phase.number + 1 };
}

/** PHASE-06: the phase before this one (day N → night N → day N−1), or null at 第1夜. */
export function prevPhase(phase: Phase): Phase | null {
  if (phase.kind === 'day') return { kind: 'night', number: phase.number };
  return phase.number > 1 ? { kind: 'day', number: phase.number - 1 } : null;
}

/** 第2夜, 第3天… */
export function phaseLabel(phase: Phase): string {
  return `第${phase.number}${phase.kind === 'day' ? '天' : '夜'}`;
}
