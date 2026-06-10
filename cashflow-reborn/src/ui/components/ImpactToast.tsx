import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, type DecisionImpact } from '../store';
import { formatINR } from '@/utils/money';

const AUTO_HIDE_MS = 2500;

// ============================================================
// Decision impact toast — a floating pill near bottom-center
// (above the mobile roll bar) summarizing the last decision's
// effect: cash delta · passive income delta · freedom delta.
// Renders nothing until a decision lands; auto-hides in 2.5s.
// ============================================================
export function ImpactToast() {
  const impact = useGameStore((s) => s.lastImpact);
  const [visible, setVisible] = useState<DecisionImpact | null>(null);

  useEffect(() => {
    if (!impact) return;
    setVisible(impact);
    const timer = setTimeout(() => {
      setVisible((cur) => (cur?.uid === impact.uid ? null : cur));
    }, AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [impact]);

  const parts = visible ? buildParts(visible) : [];

  return (
    <div className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
      <AnimatePresence>
        {visible && parts.length > 0 && (
          <motion.div
            key={visible.uid}
            initial={{ opacity: 0, y: 18, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="paper rounded-full shadow-card ring-2 ring-brass/50 px-4 py-2 flex items-center gap-2 whitespace-nowrap"
            role="status"
            aria-live="polite"
          >
            {parts.map((p, i) => (
              <span key={i} className="flex items-center gap-2 text-sm font-display tnum">
                {i > 0 && <span className="text-ink-faint" aria-hidden>·</span>}
                <span className={p.positive ? 'text-income-ink' : 'text-expense-ink'}>{p.text}</span>
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function buildParts(impact: DecisionImpact): { text: string; positive: boolean }[] {
  const parts: { text: string; positive: boolean }[] = [];
  if (impact.cashDelta !== 0) {
    parts.push({
      text: `${impact.cashDelta > 0 ? '+' : '−'}${formatINR(Math.abs(impact.cashDelta))}`,
      positive: impact.cashDelta > 0,
    });
  }
  if (impact.passiveDelta !== 0) {
    parts.push({
      text: `Passive ${impact.passiveDelta > 0 ? '+' : '−'}${formatINR(Math.abs(impact.passiveDelta))}/mo`,
      positive: impact.passiveDelta > 0,
    });
  }
  const coveragePct = impact.coverageDelta * 100;
  if (Math.abs(coveragePct) >= 0.05) {
    parts.push({
      text: `Freedom ${coveragePct > 0 ? '+' : '−'}${Math.abs(coveragePct).toFixed(1)}%`,
      positive: coveragePct > 0,
    });
  }
  return parts;
}
