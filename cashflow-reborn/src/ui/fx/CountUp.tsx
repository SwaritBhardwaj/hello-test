import { useEffect, useRef, useState } from 'react';
import { formatINR } from '@/utils/money';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animate a number from its previous value to the new one. */
export function useCountUp(value: number, durationMs = 650): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
  }, [value, durationMs]);

  return display;
}

/** Money that rolls up to its new value. Tabular figures so it never reflows. */
export function MoneyCount({
  value,
  compact,
  className = '',
}: {
  value: number;
  compact?: boolean;
  className?: string;
}) {
  const n = useCountUp(value);
  return <span className={`tnum ${className}`}>{formatINR(Math.round(n), { compact })}</span>;
}

/** A percentage that rolls up. */
export function PercentCount({ value, className = '' }: { value: number; className?: string }) {
  const n = useCountUp(value);
  return <span className={`tnum ${className}`}>{Math.round(n)}%</span>;
}
