import type { ComponentProps } from 'react';
import { cn } from './cn';

export type ThemeName = 'day' | 'night' | 'grimoire';

/** Applies one of the three design themes to everything inside it. */
export function ThemeScope({ theme, className, ...props }: ComponentProps<'div'> & { theme: ThemeName }) {
  return (
    <div
      data-theme={theme}
      className={cn('bg-bg text-ink transition-colors duration-700', className)}
      {...props}
    />
  );
}
