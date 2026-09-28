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

/** 第2夜, 第3天… */
export function phaseLabel(phase: Phase): string {
  return `第${phase.number}${phase.kind === 'day' ? '天' : '夜'}`;
}
