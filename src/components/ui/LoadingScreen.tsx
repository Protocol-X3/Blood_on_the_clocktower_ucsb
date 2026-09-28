import { ClockMark } from './ClockMark';
import { ThemeScope } from './ThemeScope';

export function LoadingScreen({ label = '载入中…' }: { label?: string }) {
  return (
    <ThemeScope theme="night" className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <ClockMark className="size-14 motion-safe:animate-pulse" />
      <p className="text-sm tracking-[0.3em] text-ink-muted" role="status">
        {label}
      </p>
    </ThemeScope>
  );
}
