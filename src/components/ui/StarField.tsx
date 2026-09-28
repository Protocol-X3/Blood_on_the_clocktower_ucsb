import { useMemo } from 'react';
import { cn } from './cn';

interface Star {
  x: number;
  y: number;
  d: number;
  o: number;
  twinkle: boolean;
}

function makeStars(count: number, seed: number): Star[] {
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, () => ({
    x: rnd() * 100,
    y: rnd() * 100,
    d: rnd() < 0.8 ? 2 : 3,
    o: 0.25 + rnd() * 0.5,
    twinkle: rnd() < 0.3,
  }));
}

/** Faint, deterministic star field behind night screens. Purely decorative. */
export function StarField({ count = 44, seed = 7 }: { count?: number; seed?: number }) {
  const stars = useMemo(() => makeStars(count, seed), [count, seed]);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((star, i) => (
        <span
          key={i}
          data-twinkle={star.twinkle ? '' : undefined}
          className={cn('absolute rounded-full bg-[#f3e6c4]', star.twinkle && 'motion-safe:animate-twinkle')}
          style={{ left: `${star.x}%`, top: `${star.y}%`, width: star.d, height: star.d, opacity: star.o }}
        />
      ))}
    </div>
  );
}
