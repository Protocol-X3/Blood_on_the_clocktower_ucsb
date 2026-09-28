import { cn } from './cn';

/** The app's clock-face emblem: gold dial with a crimson hand. */
export function ClockMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" className={cn('size-20', className)} fill="none" strokeLinecap="round">
      <circle cx="32" cy="32" r="26" stroke="var(--gold)" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="20" stroke="var(--gold)" strokeWidth="0.8" opacity="0.5" />
      <path
        d="M32 8v4M32 52v4M8 32h4M52 32h4M15 15l2.8 2.8M46.2 46.2L49 49M15 49l2.8-2.8M46.2 17.8L49 15"
        stroke="var(--gold)"
        strokeWidth="1.2"
      />
      <path d="M32 32V19" stroke="var(--gold)" strokeWidth="2.2" />
      <path d="M32 32l9 6" stroke="var(--blood)" strokeWidth="2.2" />
      <circle cx="32" cy="32" r="2.4" fill="var(--gold)" />
    </svg>
  );
}
