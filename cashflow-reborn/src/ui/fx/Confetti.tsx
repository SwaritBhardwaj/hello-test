import { useMemo } from 'react';
import { motion } from 'framer-motion';

const COLORS = [
  'oklch(0.78 0.12 84)', // brass
  'oklch(0.88 0.09 88)', // light brass
  'oklch(0.60 0.13 158)', // income green
  'oklch(0.97 0.012 86)', // cream
];

/** A celebratory brass-and-green confetti burst. Skips itself under reduced-motion. */
export function Confetti({ count = 70 }: { count?: number }) {
  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 2,
        delay: Math.random() * 0.25,
        rot: Math.random() * 540 - 270,
        color: COLORS[i % COLORS.length],
        left: Math.random() * 100,
        size: 6 + Math.random() * 7,
        dur: 1.6 + Math.random() * 1.2,
      })),
    [count],
  );

  if (reduced) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: '-10vh', x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', x: `${p.x * 30}vw`, opacity: [1, 1, 0], rotate: p.rot }}
          transition={{ duration: p.dur, delay: p.delay, ease: 'easeIn' }}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}
