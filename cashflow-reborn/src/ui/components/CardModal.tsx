import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useGameStore } from '../store';
import { useT } from '../lang';
import { formatINR } from '@/utils/money';
import { buildLoan } from '@/modules/loans/loans';
import type { Card } from '@/modules/cards/cards';
import { Coin } from '../art/Pieces';
import { CoachMascot } from '../art/Coach';
import { play } from '../sound/sound';
import { ModalShell } from './primitives';

// ============================================================
// Card modal
// ============================================================
export function CardModal({ card }: { card: Card }) {
  const resolve = useGameStore((s) => s.resolveCardOption);
  const resolveWithLoan = useGameStore((s) => s.resolveCardOptionWithLoan);
  const applyAction = useGameStore((s) => s.applyAction);
  const coachMode = useGameStore((s) => s.coachMode);
  const state = useGameStore((s) => s.state)!;
  const { t: ui, L } = useT();
  const t = Math.min(5, Math.max(1, card.temptation));
  const visibleOptions = t >= 5 ? card.options.filter((o) => o.id !== 'skip') : card.options;
  const [financeOpen, setFinanceOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);

  return (
    <ModalShell labelledBy="card-title">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className="paper w-full sm:max-w-md rounded-t-game sm:rounded-game shadow-card ring-4 ring-brass/50 overflow-hidden max-h-[92dvh] flex flex-col"
      >
        <div className="bg-wood-700 text-card px-5 py-3 flex items-center gap-3">
          <span className="text-3xl" aria-hidden>{card.emoji}</span>
          <div className="flex-1 min-w-0">
            <div id="card-title" className="font-display text-lg leading-tight">{L(card.title)}</div>
            {card.subtitle && <div className="text-2xs opacity-90 capitalize">{L(card.subtitle)}</div>}
          </div>
        </div>

        {/* Temptation bar — always on a solid tinted background */}
        <div className={`px-5 py-2.5 border-b border-card-edge ${t >= 4 ? 'bg-expense-soft' : t >= 3 ? 'bg-caution-soft' : 'bg-card-edge'}`}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink font-display">
              {ui(`temptation.${t}` as 'temptation.5')}
            </div>
            {/* Fixed-size meter: earned levels are solid coins, the rest hollow + desaturated slots */}
            <div className="flex gap-1 items-center" aria-label={ui('temptation.aria', { t })}>
              {[1, 2, 3, 4, 5].map((i) => <Coin key={i} size={16} empty={i > t} />)}
            </div>
          </div>
          <div className="text-sm italic text-ink mt-1 leading-snug">"{L(card.temptationReason)}"</div>
        </div>

        {/* Scrollable body — context only; decisions live in the sticky footer below */}
        <div className="p-4 sm:p-5 space-y-2.5 overflow-y-auto flex-1 min-h-0">
          <p className="text-[15px] sm:text-base text-ink leading-relaxed">{L(card.description)}</p>
          {card.rows && (
            <div className="rounded-lg bg-card-edge p-3 text-sm space-y-1.5 ring-1 ring-[oklch(0.34_0.04_50)/0.15]">
              {card.rows.map((r, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-ink-soft font-medium">{L(r.label)}</span>
                  <span className="font-bold text-ink tnum">{r.value}</span>
                </div>
              ))}
            </div>
          )}
          {coachMode && card.coachNote && (
            /* Coach note collapses to one line — tap to expand */
            <button
              onClick={() => setCoachOpen((o) => !o)}
              aria-expanded={coachOpen}
              className="w-full text-left rounded-lg bg-income-soft px-3 py-2 text-sm leading-snug ring-1 ring-income/40"
            >
              <div className="flex items-start gap-1.5">
                <CoachMascot mood="happy" size={18} />
                <p className={`flex-1 min-w-0 text-income-ink ${coachOpen ? 'leading-relaxed' : 'line-clamp-1'}`}>{L(card.coachNote)}</p>
                <ChevronDown size={16} className={`shrink-0 mt-0.5 text-income-ink/70 transition-transform ${coachOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>
          )}
          <div className="text-sm text-ink-soft flex items-center gap-1.5">
            {ui('card.youHold')} <Coin size={14} /> <span className="font-bold text-ink tnum">{formatINR(state.cashOnHand)}</span>
          </div>
          {t >= 5 && (
            <div className="rounded-lg bg-expense-soft ring-2 ring-expense px-3 py-2 text-sm text-expense-ink font-bold flex items-center gap-2">
              {ui('card.cantWalk')} {visibleOptions.length === 1 ? ui('card.itsHappening') : ui('card.pickHowPay')}
            </div>
          )}
          {/* Quick finances panel — see cash/loans, borrow, sell right from the card */}
          <div className="rounded-lg ring-1 ring-[oklch(0.34_0.04_50)] overflow-hidden">
            <button
              onClick={() => setFinanceOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-1.5 bg-card-edge hover:bg-[oklch(0.90_0.02_86)] transition text-left"
            >
              <div className="flex items-center gap-2">
                <Coin size={14} />
                <span className="font-display text-xs text-ink font-semibold">{ui('card.yourFinances')}</span>
                <span className="text-2xs text-ink-soft tnum">
                  {ui('card.cash')} <b className={state.cashOnHand < 0 ? 'text-expense-ink' : 'text-income-ink'}>{formatINR(state.cashOnHand, { compact: true })}</b>
                </span>
              </div>
              <ChevronDown size={14} className={`text-ink-faint transition-transform ${financeOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {financeOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <CardFinancePanel state={state} applyAction={applyAction} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Sticky footer — decisions are always visible, never below the fold */}
        <div className="shrink-0 border-t-2 border-card-edge paper px-4 sm:px-5 pt-3 pb-3 space-y-2 shadow-[0_-6px_12px_-8px_oklch(0_0_0/0.25)]">
          {visibleOptions.map((o) => {
              const cantAfford = o.affordCheck?.(state);
              const isResist = o.id === 'skip';
              const showBorrow = !!cantAfford && o.cashCost && state.cashOnHand < o.cashCost;
              const shortfall = o.cashCost ? Math.max(0, o.cashCost - state.cashOnHand) : 0;
              const borrowAmount = Math.ceil(shortfall / 10_000) * 10_000;
              const warn = o.coachWarning ? L(o.coachWarning) : undefined;
              const warnTone = warn?.startsWith('WORST') ? 'bg-expense-soft text-expense-ink ring-1 ring-expense/50'
                : warn?.startsWith('Best') ? 'bg-income-soft text-income-ink ring-1 ring-income/50' : 'bg-caution-soft text-caution-ink ring-1 ring-caution/50';
              return (
                <div key={o.id} className="space-y-1.5">
                  <button
                    onClick={() => { if (!cantAfford) { play(isResist ? 'click' : 'coin'); resolve(o.id); } }}
                    disabled={!!cantAfford}
                    className={[
                      'btn-3d w-full text-left px-4 py-2.5',
                      cantAfford
                        ? 'bg-card-edge border-2 border-card-edge text-ink-soft cursor-not-allowed opacity-60'
                        : isResist
                          ? 'bg-card-edge border-2 border-[oklch(0.34_0.04_50)] enabled:hover:bg-card text-ink font-semibold'
                          : 'bg-brass-500 enabled:hover:bg-brass-600 text-wood-900',
                    ].join(' ')}
                  >
                    <div className="font-display text-base">{L(o.label)}</div>
                    {o.detail && <div className="text-xs mt-0.5 opacity-80">{L(o.detail)}</div>}
                    {cantAfford && <div className="text-xs text-expense-ink mt-0.5 font-semibold">{cantAfford}</div>}
                  </button>
                  {coachMode && warn && <div className={`text-xs leading-snug px-3 py-2 rounded ${warnTone}`}>{warn}</div>}
                  {showBorrow && (
                    <button onClick={() => { play('coin'); resolveWithLoan(o.id, 'personal'); }} className="btn-3d w-full text-left px-4 py-2.5 bg-expense-soft border-2 border-expense enabled:hover:bg-expense/20">
                      <div className="text-sm font-display font-bold text-expense-ink flex items-center gap-1.5">
                        <Coin size={15} /> {ui('card.borrowBuy', { x: borrowAmount.toLocaleString('en-IN') })} {t >= 5 && <span className="ml-1 text-xs bg-expense text-card rounded px-1.5 py-0.5 font-bold">{ui('card.forced')}</span>}
                      </div>
                      <div className="text-xs text-expense-ink font-medium mt-0.5">{ui('card.personalLoanTerms')}</div>
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </motion.div>
    </ModalShell>
  );
}

// ============================================================
// Inline finance panel inside the card modal
// ============================================================
export function CardFinancePanel({ state, applyAction }: { state: ReturnType<typeof useGameStore.getState>['state']; applyAction: (a: import('@/types').DecisionAction) => void }) {
  const { t } = useT();
  const [borrowTab, setBorrowTab] = useState(false);
  const [borrowLakhs, setBorrowLakhs] = useState(2);
  const [borrowMonths, setBorrowMonths] = useState(36);
  const loan = buildLoan({ kind: 'personal', label: 'Quick personal loan', principal: borrowLakhs * 100_000, tenureMonths: borrowMonths });

  // Top assets by value (up to 3)
  const topAssets = [...(state?.assets ?? [])]
    .sort((a, b) => b.currentPrice * b.units - a.currentPrice * a.units)
    .slice(0, 3);
  // Top loans by outstanding (up to 3)
  const topLoans = [...(state?.liabilities ?? [])]
    .sort((a, b) => b.principalOutstanding - a.principalOutstanding)
    .slice(0, 3);

  if (!state) return null;

  return (
    <div className="border-t border-card-edge bg-[oklch(0.97_0.01_86)] p-3 space-y-3 text-sm">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-card p-2 ring-1 ring-card-edge">
          <div className="text-2xs uppercase tracking-wide text-ink-soft font-semibold">{t('hud.cash')}</div>
          <div className={`font-display font-bold tnum ${state.cashOnHand < 0 ? 'text-expense-ink' : 'text-income-ink'}`}>{formatINR(state.cashOnHand, { compact: true })}</div>
        </div>
        <div className="rounded-lg bg-card p-2 ring-1 ring-card-edge">
          <div className="text-2xs uppercase tracking-wide text-ink-soft font-semibold">{t('hud.netWorth')}</div>
          <div className="font-display font-bold tnum text-ink">{formatINR(state.statement.netWorth, { compact: true })}</div>
        </div>
        <div className="rounded-lg bg-card p-2 ring-1 ring-card-edge">
          <div className="text-2xs uppercase tracking-wide text-ink-soft font-semibold">{t('hud.cashflow')}</div>
          <div className={`font-display font-bold tnum ${state.statement.totalIncome - state.statement.totalExpenses >= 0 ? 'text-income-ink' : 'text-expense-ink'}`}>
            {formatINR(state.statement.totalIncome - state.statement.totalExpenses, { compact: true })}/mo
          </div>
        </div>
      </div>

      {/* Toggle: Assets / Borrow */}
      <div className="flex gap-1">
        <button onClick={() => setBorrowTab(false)} className={`flex-1 rounded-lg py-1.5 font-display text-xs font-semibold transition ${!borrowTab ? 'bg-ink text-card' : 'bg-card-edge text-ink hover:bg-card'}`}>{t('fin.assetsLoans')}</button>
        <button onClick={() => setBorrowTab(true)} className={`flex-1 rounded-lg py-1.5 font-display text-xs font-semibold transition ${borrowTab ? 'bg-ink text-card' : 'bg-card-edge text-ink hover:bg-card'}`}>{t('fin.quickBorrow')}</button>
      </div>

      {!borrowTab && (
        <div className="space-y-2">
          {/* Assets — sell right here */}
          {topAssets.length > 0 && (
            <div>
              <div className="text-2xs uppercase tracking-wide text-ink-soft font-bold mb-1">{t('fin.assets')}</div>
              {topAssets.map((a) => {
                const val = a.currentPrice * a.units;
                const gain = val - a.unitCost * a.units;
                return (
                  <div key={a.id} className="flex items-center justify-between gap-2 py-1 border-b border-card-edge last:border-0">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink truncate">{a.label}</div>
                      <div className={`text-xs tnum ${gain >= 0 ? 'text-income-ink' : 'text-expense-ink'}`}>{formatINR(val, { compact: true })} ({gain >= 0 ? '+' : ''}{formatINR(gain, { compact: true })})</div>
                    </div>
                    <button
                      onClick={() => applyAction({ kind: 'sell_asset', assetId: a.id, units: a.units })}
                      className="btn-3d shrink-0 bg-expense-soft text-expense-ink text-xs px-2 py-1"
                    >{t('fin.sellAll')}</button>
                  </div>
                );
              })}
            </div>
          )}
          {/* Loans — prepay right here */}
          {topLoans.length > 0 && (
            <div>
              <div className="text-2xs uppercase tracking-wide text-ink-soft font-bold mb-1">{t('fin.loans')}</div>
              {topLoans.map((l) => {
                const canPay = Math.min(state.cashOnHand, l.principalOutstanding);
                return (
                  <div key={l.id} className="flex items-center justify-between gap-2 py-1 border-b border-card-edge last:border-0">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink truncate">{l.label}</div>
                      <div className="text-xs text-ink-soft tnum">{formatINR(l.principalOutstanding, { compact: true })} · EMI {formatINR(l.emi)}/mo</div>
                    </div>
                    {canPay > 0 && (
                      <button
                        onClick={() => applyAction({ kind: 'prepay_loan', loanId: l.id, amount: canPay })}
                        className="btn-3d shrink-0 bg-income-soft text-income-ink text-xs px-2 py-1"
                      >{t('fin.prepay')}</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {topAssets.length === 0 && topLoans.length === 0 && (
            <p className="text-ink-soft text-xs italic text-center py-2">{t('fin.none')}</p>
          )}
        </div>
      )}

      {borrowTab && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-ink-soft">
            <span>{t('fin.amount')}: <b className="text-ink tnum">₹{borrowLakhs}L</b></span>
            <span>{t('fin.tenure')}: <b className="text-ink tnum">{borrowMonths}mo</b></span>
          </div>
          <input type="range" min={1} max={20} value={borrowLakhs} onChange={(e) => setBorrowLakhs(+e.target.value)} className="w-full accent-brass-600" />
          <input type="range" min={12} max={60} step={6} value={borrowMonths} onChange={(e) => setBorrowMonths(+e.target.value)} className="w-full accent-brass-600" />
          <div className="rounded-lg bg-card p-2 ring-1 ring-card-edge grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs tnum">
            <span className="text-ink-soft">{t('fin.rate')}</span><span className="text-ink font-semibold">13.5% p.a.</span>
            <span className="text-ink-soft">{t('fin.emiMo')}</span><span className="text-income-ink font-bold">{formatINR(loan.emi)}</span>
            <span className="text-ink-soft">{t('fin.totalInterest')}</span><span className="text-expense-ink font-semibold">{formatINR(loan.emi * borrowMonths - borrowLakhs * 100_000)}</span>
            <span className="text-ink-soft">{t('fin.youReceive')}</span><span className="text-income-ink font-bold">{formatINR(borrowLakhs * 100_000)}</span>
          </div>
          <button
            onClick={() => { play('coin'); applyAction({ kind: 'take_loan', loan }); }}
            className="btn-3d w-full bg-brass-500 enabled:hover:bg-brass-600 text-wood-900 py-2 font-display"
          >
            {t('fin.borrowNow', { x: borrowLakhs })}
          </button>
          <p className="text-xs text-ink-soft text-center">{t('fin.borrowNote')}</p>
        </div>
      )}
    </div>
  );
}
