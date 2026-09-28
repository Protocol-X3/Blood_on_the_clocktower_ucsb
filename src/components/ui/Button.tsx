import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from './cn';

const buttonVariants = cva(
  'inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-xl transition-[transform,background-color,filter] duration-150 active:scale-[0.98] disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary:
          'bg-gold font-serif font-bold tracking-wider text-gold-ink shadow-[0_8px_18px_-8px_var(--gold-glow)] hover:brightness-105 disabled:border disabled:border-line disabled:bg-surface-2 disabled:text-ink-faint disabled:shadow-none',
        outline:
          'border-[1.5px] border-gold bg-transparent font-serif font-bold tracking-wider text-gold-strong hover:bg-gold/10 disabled:border-line disabled:text-ink-faint',
        ghost: 'bg-transparent font-medium text-ink-muted hover:bg-ink/5 disabled:text-ink-faint',
        danger: 'border border-blood/60 bg-blood/10 font-medium text-blood-text hover:bg-blood/20 disabled:opacity-60',
      },
      size: {
        md: 'min-h-11 px-4 text-[15px]',
        lg: 'min-h-13 w-full px-6 text-lg',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : (type ?? 'button')}
      {...props}
    />
  );
}
