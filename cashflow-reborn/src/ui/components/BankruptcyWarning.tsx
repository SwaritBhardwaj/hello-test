import { motion } from 'framer-motion';
import { BANKRUPTCY_GRACE_MONTHS } from '../store';
import { useT } from '../lang';
import { formatINR } from '@/utils/money';

// ============================================================
// Bankruptcy warning
// ============================================================
export function BankruptcyWarning({ monthsNegative, monthsToBankruptcy, cashOnHand }: { monthsNegative: number; monthsToBankruptcy: number; cashOnHand: number }) {
  const { t } = useT();
  const dangerPct = (monthsNegative / BANKRUPTCY_GRACE_MONTHS) * 100;
  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-game p-3 sm:p-4 shadow-card ring-2 ring-expense animate-danger-pulse text-card"
      style={{ background: 'linear-gradient(135deg, oklch(0.40 0.15 26), oklch(0.30 0.12 24))' }}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="min-w-0">
          <div className="font-display text-base">{t('bank.overdrawn')}</div>
          <div className="text-2xs opacity-90 tnum">{t('bank.inRed', { x: formatINR(cashOnHand, { compact: true }), m: monthsNegative, total: BANKRUPTCY_GRACE_MONTHS })}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-2xl tnum">{monthsToBankruptcy}</div>
          <div className="text-2xs uppercase tracking-wider opacity-90">{t('bank.monthsLeft')}</div>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-card/20 overflow-hidden">
        <div className="h-full bg-card/80" style={{ width: `${dangerPct}%` }} />
      </div>
      <div className="text-2xs mt-1.5 opacity-90">{t('bank.advice')}</div>
    </motion.section>
  );
}
