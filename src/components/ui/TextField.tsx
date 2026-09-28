import { useId, type ComponentProps } from 'react';
import { cn } from './cn';

/** A labelled text input with an optional error message below it. */
export function TextField({
  label,
  error,
  className,
  ...props
}: ComponentProps<'input'> & { label: string; error?: string | null }) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'min-h-12 rounded-xl border border-line bg-surface-2 px-4 text-base text-ink placeholder:text-ink-faint/70 focus:border-gold focus:outline-none aria-invalid:border-blood',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-blood-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
