import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, type DecisionImpact } from '../store';
import { useT } from '../lang';
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

// ============================================================
// Per-roll money toasts — every dice roll pays off visibly.
// Crossed calendar events pop in as a staggered stack of chips
// ("Day 7 · Fuel · −₹1,240"); a roll that crossed nothing at all
// shows a single neutral "quiet stretch" pill instead, so no tap
// ever feels dead. Stays under modals (z-40): when a card or the
// payday moment opens, THAT is the roll's payoff.
// ============================================================
const MAX_CHIPS = 3;

export function RollMoneyToasts() {
  const fx = useGameStore((s) => s.lastRollFx);
  const { t } = useT();
  const [visible, setVisible] = useState<typeof fx>(null);

  useEffect(() => {
    if (!fx || (fx.events.length === 0 && !fx.quiet)) return;
    setVisible(fx);
    const shown = Math.min(fx.events.length, MAX_CHIPS);
    const timer = setTimeout(() => {
      setVisible((cur) => (cur?.uid === fx.uid ? null : cur));
    }, 2400 + shown * 420);
    return () => clearTimeout(timer);
  }, [fx]);

  const shown = visible?.events.slice(0, MAX_CHIPS) ?? [];
  const extra = (visible?.events.length ?? 0) - shown.length;

  return (
    <div className="fixed bottom-36 sm:bottom-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center gap-1.5">
      <AnimatePresence>
        {visible?.quiet && (
          <motion.div
            key={`quiet-${visible.uid}`}
            initial={{ opacity: 0, y: 14, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="paper rounded-full shadow-card ring-1 ring-card-edge px-4 py-1.5 text-sm text-ink-soft font-medium whitespace-nowrap"
            role="status" aria-live="polite"
          >
            {t('roll.quiet')}
          </motion.div>
        )}
        {visible && shown.map((e, i) => (
          <motion.div
            key={`${visible.uid}-${e.id}`}
            initial={{ opacity: 0, y: 14, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ delay: i * 0.18, type: 'spring', stiffness: 320, damping: 26 }}
            className="paper rounded-full shadow-card ring-2 ring-brass/40 px-3.5 py-1.5 flex items-center gap-2 whitespace-nowrap text-sm"
            role="status" aria-live="polite"
          >
            <span className="text-2xs uppercase tracking-wide text-ink-faint font-display tnum">{t('roll.day', { d: e.day })}</span>
            <span className="text-ink font-medium max-w-[42vw] sm:max-w-[240px] truncate">{e.label}</span>
            <span className={`font-display font-bold tnum ${e.kind === 'credit' ? 'text-income-ink' : 'text-expense-ink'}`}>
              {e.kind === 'credit' ? '+' : '−'}{formatINR(e.amount)}
            </span>
          </motion.div>
        ))}
        {visible && extra > 0 && (
          <motion.div
            key={`extra-${visible.uid}`}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ delay: shown.length * 0.18 }}
            className="text-2xs text-ink-faint font-medium bg-card/80 rounded-full px-2.5 py-0.5"
          >
            {t('roll.more', { n: extra })}
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
