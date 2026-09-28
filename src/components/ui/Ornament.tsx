import { cn } from './cn';

/** Gold rule with a centered diamond, used between card sections. */
export function Ornament({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 160 14"
      className={cn('h-3.5 w-40 text-[#b8923f]', className)}
      fill="none"
      stroke="currentColor"
    >
      <path d="M0 7h66M94 7h66" strokeWidth="1" />
      <path d="M80 1l6 6-6 6-6-6z" strokeWidth="1.2" />
      <circle cx="80" cy="7" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
