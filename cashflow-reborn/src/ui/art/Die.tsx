import { motion } from 'framer-motion';

/** Pip layout per face (3x3 grid positions filled). */
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

/** A custom rolling die — brass-edged ivory cube with pips. */
export function Die({
  value,
  rolling,
  size = 56,
}: {
  value: number | null;
  rolling?: boolean;
  size?: number;
}) {
  const face = value ?? 1;
  const cell = size / 3;
  const pad = cell / 2;
  return (
    <motion.div
      aria-label={value ? `Die showing ${value}` : 'Die'}
      role="img"
      animate={
        rolling
          ? { rotate: [0, -90, 120, -200, 360], scale: [1, 1.12, 0.96, 1.08, 1] }
          : { rotate: 0, scale: 1 }
      }
      transition={rolling ? { duration: 0.6, ease: [0.16, 1, 0.3, 1] } : { type: 'spring', stiffness: 320, damping: 22 }}
      style={{ width: size, height: size }}
      className="relative rounded-[22%] shadow-piece"
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="block">
        <defs>
          <linearGradient id="die-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.99 0.01 86)" />
            <stop offset="100%" stopColor="oklch(0.93 0.02 86)" />
          </linearGradient>
        </defs>
        <rect x="0.5" y="0.5" width={size - 1} height={size - 1} rx={size * 0.22}
          fill="url(#die-body)" stroke="oklch(0.70 0.13 80)" strokeWidth="2" />
        {(rolling ? PIPS[6] : PIPS[face]).map(([r, c], i) => (
          <circle key={i} cx={c * cell + pad} cy={r * cell + pad} r={cell * 0.17}
            fill="oklch(0.30 0.04 60)" />
        ))}
      </svg>
    </motion.div>
  );
}
