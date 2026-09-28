import { cva } from 'class-variance-authority';
import type { Team } from '@/lib/game/teams';
import { cn } from './cn';

const tokenVariants = cva(
  'relative inline-flex shrink-0 select-none items-center justify-center rounded-full bg-parchment font-serif font-black text-parchment-ink transition-[filter,opacity] duration-500',
  {
    variants: {
      team: {
        townsfolk: 'border-townsfolk',
        outsider: 'border-outsider',
        minion: 'border-minion',
        demon: 'border-demon',
      },
      size: {
        sm: 'size-10 border-[2.5px] text-[19px]',
        md: 'size-14 border-[3px] text-[26px]',
        lg: 'size-22 border-4 text-[38px] shadow-[0_8px_20px_rgb(0_0_0/0.45)]',
        xl: 'size-27 border-4 text-[54px] shadow-[0_0_0_4px_var(--color-parchment),0_0_0_5px_#b8923f]',
      },
    },
  },
);

export interface RoleTokenProps {
  /** The character shown on the token, e.g. "占" for 占卜师. */
  glyph: string;
  team: Team;
  /** Accessible name, usually the full role name. */
  label: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  dead?: boolean;
  selected?: boolean;
  className?: string;
}

export function RoleToken({ glyph, team, label, size = 'md', dead, selected, className }: RoleTokenProps) {
  return (
    <span
      role="img"
      aria-label={dead ? `${label}（已死亡）` : label}
      data-team={team}
      data-dead={dead ? '' : undefined}
      className={cn(
        tokenVariants({ team, size }),
        dead && 'opacity-45 grayscale',
        selected && 'ring-2 ring-gold ring-offset-4 ring-offset-bg',
        className,
      )}
    >
      <span aria-hidden="true">{glyph}</span>
    </span>
  );
}
