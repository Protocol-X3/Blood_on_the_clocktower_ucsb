import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from './cn';

const chipVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-surface-2 text-ink-muted',
        gold: 'border-gold/50 bg-gold/15 text-gold-strong',
        blood: 'border-blood/50 bg-blood/12 text-blood-text',
        townsfolk: 'border-townsfolk/40 bg-townsfolk/12 text-townsfolk-text',
        outsider: 'border-outsider/40 bg-outsider/12 text-outsider-text',
        minion: 'border-minion/40 bg-minion/12 text-minion-text',
        demon: 'border-demon/40 bg-demon/12 text-demon-text',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type ChipProps = ComponentProps<'span'> & VariantProps<typeof chipVariants>;

export function Chip({ className, tone, ...props }: ChipProps) {
  return <span className={cn(chipVariants({ tone }), className)} {...props} />;
}
