import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from './cn';

const panelVariants = cva('rounded-2xl', {
  variants: {
    variant: {
      surface: 'border border-line bg-surface',
      /** Parchment card with a gilded double border, e.g. the role card. */
      gilded: 'gilded paper-grain border border-[#c9a55a] bg-parchment text-parchment-ink',
    },
    padding: { none: '', md: 'p-4', lg: 'p-6' },
  },
  defaultVariants: { variant: 'surface', padding: 'md' },
});

export type PanelProps = ComponentProps<'section'> & VariantProps<typeof panelVariants>;

export function Panel({ className, variant, padding, ...props }: PanelProps) {
  return <section className={cn(panelVariants({ variant, padding }), className)} {...props} />;
}
