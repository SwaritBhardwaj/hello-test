import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store';
import { formatINR } from '@/utils/money';
import { MoneyCount } from '../fx/CountUp';
import { play } from '../sound/sound';
import { ModalShell, PrimaryButton } from './primitives';

const AUTO_DISMISS_MS = 6000;

// ============================================================
// Payday moment — celebratory recap shown when a lap (month)
// completes. Self-contained: renders nothing when no payday is
// pending; dismissible (rollDice is never blocked by it).
// ============================================================
export function PaydayModal() {
  const payday = useGameStore((s) => s.pendingPayday);
  const collect = useGameStore((s) => s.collectPayday);

  // Coin chime on open + auto-dismiss after 6s.
  useEffect(() => {
    if (!payday) return;
    play('coin');
    const timer = setTimeout(() => {
      // Only dismiss if this same payday is still showing.
      if (useGameStore.getState().pendingPayday === payday) collect();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [payday, collect]);

  return (
    <AnimatePresence>
      {payday && <PaydayCard key={payday.monthTick} payday={payday} onCollect={collect} />}
    </AnimatePresence>
  );
}

function PaydayCard({
  payday,
  onCollect,
}: {
  payday: NonNullable<ReturnType<typeof useGameStore.getState>['pendingPayday']>;
  onCollect: () => void;
}) {
  const freedomBeforePct = payday.freedomBefore * 100;
  const freedomAfterPct = payday.freedomAfter * 100;
  const freedomUp = freedomAfterPct >= freedomBeforePct;
  const netPositive = payday.netDelta >= 0;

  return (
    <ModalShell onClose={onCollect} labelledBy="payday-title" center>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        className="paper w-full max-w-md rounded-game shadow-card ring-4 ring-brass/30 overflow-hidden max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Wood header */}
        <div className="bg-wood-700 text-card px-6 py-4 text-center shrink-0">
          <div className="text-3xl mb-0.5" aria-hidden>💰</div>
          <div id="payday-title" className="font-display text-xl">
            Payday — Month {payday.monthTick}
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Salary count-up */}
          <div className="text-center">
            <div className="text-2xs uppercase tracking-widest text-ink-soft font-display">Salary credited</div>
            <div className="font-display text-3xl text-income-ink">
              <MoneyCount value={payday.salary} />
            </div>
          </div>

          {/* Recap rows */}
          <div className="rounded-lg bg-card-edge/50 p-3 space-y-1 text-sm tnum">
            <div className="flex justify-between">
              <span className="text-ink-soft">Passive income</span>
              <span className="font-semibold text-income-ink">+{formatINR(payday.passive)}/mo</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">Monthly expenses</span>
              <span className="font-semibold text-expense-ink">−{formatINR(payday.totalExpenses)}</span>
            </div>
          </div>

          {/* Big net delta */}
          <div className={`rounded-lg p-3 text-center ${netPositive ? 'bg-income-soft' : 'bg-expense-soft'}`}>
            <div className="text-2xs uppercase tracking-widest text-ink-soft font-display">Net this month</div>
            <div className={`font-display text-2xl ${netPositive ? 'text-income-ink' : 'text-expense-ink'}`}>
              {netPositive ? '+' : '−'}
              <MoneyCount value={Math.abs(payday.netDelta)} />
            </div>
          </div>

          {/* Freedom delta */}
          <div className="flex items-center justify-center gap-2 text-sm font-display">
            <span className="text-ink-soft">Freedom</span>
            <span className="tnum text-ink">{freedomBeforePct.toFixed(1)}%</span>
            <span className={freedomUp ? 'text-income-ink' : 'text-expense-ink'} aria-hidden>
              {freedomUp ? '↗' : '↘'}
            </span>
            <span className={`tnum font-semibold ${freedomUp ? 'text-income-ink' : 'text-expense-ink'}`}>
              {freedomAfterPct.toFixed(1)}%
            </span>
          </div>

          <PrimaryButton onClick={onCollect} className="w-full">Collect</PrimaryButton>
        </div>
      </motion.div>
    </ModalShell>
  );
}
