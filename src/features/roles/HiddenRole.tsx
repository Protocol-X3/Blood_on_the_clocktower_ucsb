import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CARD_BACK, CardEmblem } from '@/components/ui/CardEmblem';
import { cn } from '@/components/ui/cn';
import { RoleCard, type RoleInfo } from './RoleCard';

/**
 * SECRET-05: the player's own role, face down until they tap it, so people nearby
 * can't read it. Tapping the card or 隐藏角色 turns it back over, and so does the
 * app going to the background.
 */
export function HiddenRole({ role, caption }: { role: RoleInfo; caption: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === 'hidden') setOpen(false);
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', hide);
    };
  }, []);

  if (open) {
    return (
      <div className="flex flex-col items-center gap-2">
        {/* Tapping the card itself also hides it; the button below is the accessible control. */}
        <div onClick={() => setOpen(false)} className="w-full cursor-pointer motion-safe:animate-flip-in">
          <RoleCard role={role} />
        </div>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          隐藏角色
        </Button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-expanded="false"
      data-testid="role-hidden"
      className={cn('mx-auto flex min-h-24 w-full max-w-80 items-center gap-4 rounded-2xl px-5 py-4 text-left transition-transform hover:-translate-y-0.5', CARD_BACK)}
    >
      <CardEmblem className="size-14 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs tracking-[0.2em] text-[#c9a55a]/80">{caption}</span>
        <span className="font-serif text-lg font-bold tracking-[0.15em] text-[#f1e3c0]">轻触查看角色</span>
        <span className="text-xs text-[#8f9ab8]">请确认旁人看不到你的屏幕</span>
      </span>
    </button>
  );
}
