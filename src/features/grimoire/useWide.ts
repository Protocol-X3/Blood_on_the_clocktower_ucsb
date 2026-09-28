import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 1024px)';

/** GRIM-01: true on screens 1024 px wide or more. */
export function useWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
}
