import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** A slim top bar: a back/home link on the left, arbitrary actions on the right. */
export function PageHeader({ back = '/', backLabel = '首页', children }: { back?: string | null; backLabel?: string; children?: ReactNode }) {
  return (
    <header className="relative flex min-h-14 items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)]">
      {back ? (
        <Link
          to={back}
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-ink-muted hover:text-gold-strong"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {backLabel}
        </Link>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}
