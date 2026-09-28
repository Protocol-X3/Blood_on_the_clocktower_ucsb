import { cn } from './cn';

/**
 * DEATH-03: a red X laid across a dead player's token. A dark underlay keeps it
 * legible on both the parchment tokens and the dark seats.
 */
export function DeadMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      data-testid="dead-mark"
      viewBox="0 0 40 40"
      className={cn('pointer-events-none absolute inset-0 size-full', className)}
      fill="none"
      strokeLinecap="round"
    >
      <path d="M8 8 32 32M32 8 8 32" stroke="rgb(0 0 0 / 0.35)" strokeWidth="4.2" />
      <path d="M8 8 32 32M32 8 8 32" stroke="var(--color-blood)" strokeWidth="2.6" />
    </svg>
  );
}
