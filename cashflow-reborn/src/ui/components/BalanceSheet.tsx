import { useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useGameStore } from '../store';
import { useT } from '../lang';
import { formatINR } from '@/utils/money';
import { LOAN_RATES } from '@/data/constants';
import { buildLoan } from '@/modules/loans/loans';
import type { Loan, Asset, LoanKind } from '@/types';
import { Coin } from '../art/Pieces';
import { play } from '../sound/sound';
import { ModalShell, PrimaryButton, Field, Select, Row } from './primitives';
import { COACH_FLAGS } from '@/data/coachFlags';
import { sellIntervention } from '@/modules/coach/interventions';
import { InterventionNotice } from './CardModal';

// ============================================================
// Balance sheet (bottom sheet on mobile, side drawer on desktop)
// ============================================================
export function BalanceSheet({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const state = useGameStore((s) => s.state)!;
  const applyAction = useGameStore((s) => s.applyAction);
  const [tab, setTab] = useState<'statement' | 'assets' | 'liabilities' | 'borrow'>('statement');
  const tabs: { id: typeof tab; label: string }[] = [
    { id: 'statement', label: t('bs.statement') },
    { id: 'assets', label: t('bs.assetsN', { n: state.assets.length }) },
    { id: 'liabilities', label: t('bs.loansN', { n: state.liabilities.length }) },
    { id: 'borrow', label: t('bs.borrow') },
  ];
  return (
    <ModalShell labelledBy="sheet-title" onClose={onClose} align="end">
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className="ml-auto bg-card w-full sm:max-w-2xl h-[100dvh] overflow-y-auto shadow-card flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-wood-900 text-card px-5 py-3 flex justify-between items-center z-10">
          <div>
            <div className="text-xs uppercase font-semibold tracking-wider text-card/80">{t('bs.title')}</div>
            <div id="sheet-title" className="font-display text-lg">{state.player.name}</div>
          </div>
          <button onClick={onClose} className="grid place-items-center hover:bg-felt-700 w-9 h-9 rounded-lg" aria-label={t('bs.close')}><X size={22} /></button>
        </div>
        <div className="sticky top-[60px] bg-card z-10 flex overflow-x-auto border-b border-card-edge">
          {tabs.map((tb) => (
            <button key={tb.id} onClick={() => { play('click'); setTab(tb.id); }}
              className={`whitespace-nowrap px-4 py-3 font-display text-sm transition ${tab === tb.id ? 'border-b-2 border-income text-income-ink bg-income-soft/50' : 'text-ink-soft font-semibold hover:bg-card-edge/40'}`}>
              {tb.label}
            </button>
          ))}
        </div>
        <div className="p-4 sm:p-5">
          {tab === 'statement' && <StatementTab />}
          {tab === 'assets' && <AssetsTab onSell={(a, u) => applyAction({ kind: 'sell_asset', assetId: a.id, units: u })} />}
          {tab === 'liabilities' && <LiabilitiesTab onPrepay={(l, amt) => applyAction({ kind: 'prepay_loan', loanId: l.id, amount: amt })} />}
          {tab === 'borrow' && <BorrowTab />}
        </div>
      </motion.div>
    </ModalShell>
  );
}

export function StatementTab() {
  const { t } = useT();
  const state = useGameStore((s) => s.state)!;
  const monthlySalary = state.incomeStreams.filter((i) => i.kind === 'salary').reduce((s, i) => s + i.monthlyGross, 0);
  const monthlyFreelance = state.incomeStreams.filter((i) => i.kind === 'freelance').reduce((s, i) => s + i.monthlyGross, 0);
  const yieldByKind = { rent: 0, dividend: 0, interest: 0 };
  for (const a of state.assets) {
    const monthly = (a.currentPrice * a.units * a.yieldRateAnnual) / 12;
    if (a.kind === 'real_estate_residential' || a.kind === 'real_estate_commercial' || a.kind === 'reit') yieldByKind.rent += monthly;
    else if (a.kind === 'savings' || a.kind === 'fd' || a.kind === 'ppf' || a.kind === 'nps' || a.kind === 'gold') yieldByKind.interest += monthly;
    else yieldByKind.dividend += monthly;
  }
  yieldByKind.rent = Math.round(yieldByKind.rent);
  yieldByKind.dividend = Math.round(yieldByKind.dividend);
  yieldByKind.interest = Math.round(yieldByKind.interest);
  const totalPassive = yieldByKind.rent + yieldByKind.dividend + yieldByKind.interest;
  const totalIncome = monthlySalary + monthlyFreelance + totalPassive;
  const totalEMI = state.liabilities.reduce((s, l) => s + l.emi, 0);
  const totalPremium = state.insurance.reduce((s, i) => s + i.monthlyPremium, 0);
  const livingExpenses = state.expenses.reduce((s, e) => s + e.monthlyAmount, 0);
  const totalExpenses = livingExpenses + totalEMI + totalPremium;
  const cashflow = totalIncome - totalExpenses;

  const assetGroups: Record<string, { label: string; value: number }[]> = {};
  for (const a of state.assets) {
    const k = assetGroup(a.kind);
    if (!assetGroups[k]) assetGroups[k] = [];
    assetGroups[k].push({ label: a.label, value: a.currentPrice * a.units });
  }
  const totalAssets = state.cashOnHand + Object.values(assetGroups).flat().reduce((s, x) => s + x.value, 0);
  const totalLiab = state.liabilities.reduce((s, l) => s + l.principalOutstanding, 0);
  const netWorth = totalAssets - totalLiab;
  const passiveCoverage = totalExpenses > 0 ? totalPassive / totalExpenses : 0;

  return (
    <div className="space-y-4">
      <div className="bg-wood-900 text-card rounded-lg p-3 grid grid-cols-3 gap-2 text-center tnum">
        <div><div className="text-xs uppercase tracking-wider font-semibold text-card/75">{t('hud.netWorth')}</div><div className="font-display text-lg">{formatINR(netWorth, { compact: true })}</div></div>
        <div><div className="text-xs uppercase tracking-wider font-semibold text-card/75">{t('bs.cashflowMo')}</div><div className={`font-display text-lg ${cashflow >= 0 ? 'text-income' : 'text-expense'}`}>{cashflow >= 0 ? '+' : ''}{formatINR(cashflow, { compact: true })}</div></div>
        <div><div className="text-xs uppercase tracking-wider font-semibold text-card/75">{t('bs.passiveExp')}</div><div className={`font-display text-lg ${passiveCoverage >= 1 ? 'text-income' : 'text-brass-300'}`}>{(passiveCoverage * 100).toFixed(0)}%</div></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Quadrant title={t('bs.income')} subtitle={t('bs.monthly')} color="income" total={totalIncome}>
          <LedgerRow label={t('bs.salary')} value={monthlySalary} />
          {monthlyFreelance > 0 && <LedgerRow label={t('bs.freelance')} value={monthlyFreelance} />}
          <LedgerSubhead>{t('bs.passive')}</LedgerSubhead>
          {yieldByKind.rent > 0 && <LedgerRow label={t('bs.rentalIncome')} value={yieldByKind.rent} indent />}
          {yieldByKind.dividend > 0 && <LedgerRow label={t('bs.dividends')} value={yieldByKind.dividend} indent />}
          {yieldByKind.interest > 0 && <LedgerRow label={t('bs.interestYield')} value={yieldByKind.interest} indent />}
          {totalPassive === 0 && <LedgerRow label={t('bs.noneYet')} value={0} indent muted />}
        </Quadrant>
        <Quadrant title={t('bs.expenses')} subtitle={t('bs.monthly')} color="expense" total={totalExpenses}>
          {state.expenses.filter((e) => e.monthlyAmount > 0).map((e, i) => <LedgerRow key={i} label={prettyExpense(e.category, e.label)} value={e.monthlyAmount} />)}
          {totalEMI > 0 && (<><LedgerSubhead>{t('bs.loanEmis')}</LedgerSubhead>{state.liabilities.map((l) => <LedgerRow key={l.id} label={l.label} value={l.emi} indent />)}</>)}
          {totalPremium > 0 && (<><LedgerSubhead>{t('bs.insurance')}</LedgerSubhead>{state.insurance.map((p) => <LedgerRow key={p.id} label={p.label} value={p.monthlyPremium} indent />)}</>)}
        </Quadrant>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Quadrant title={t('bs.assetsCaps')} subtitle={t('bs.currentValue')} color="brass" total={totalAssets}>
          <LedgerRow label={t('bs.cashOnHand')} value={state.cashOnHand} />
          {Object.entries(assetGroups).map(([group, items]) => {
            const groupTotal = items.reduce((s, x) => s + x.value, 0);
            return (
              <div key={group}>
                <LedgerSubhead>{t(`group.${group}` as 'group.Other')} <span className="text-ink-faint font-normal">({formatINR(groupTotal, { compact: true })})</span></LedgerSubhead>
                {items.map((x, i) => <LedgerRow key={i} label={x.label} value={x.value} indent />)}
              </div>
            );
          })}
          {Object.keys(assetGroups).length === 0 && <LedgerRow label={t('bs.noInvest')} value={0} muted />}
        </Quadrant>
        <Quadrant title={t('bs.liabilities')} subtitle={t('bs.outstanding')} color="expense" total={totalLiab}>
          {state.liabilities.length === 0 && <LedgerRow label={t('bs.debtFree')} value={0} muted />}
          {state.liabilities.map((l) => (
            <div key={l.id}>
              <LedgerRow label={l.label} value={l.principalOutstanding} />
              <div className="text-2xs text-ink-faint -mt-0.5 ml-1 tnum">{(l.rateAnnual * 100).toFixed(1)}% · {l.remainingMonths}mo · EMI {formatINR(l.emi)}</div>
            </div>
          ))}
        </Quadrant>
      </div>
      <div className="bg-card-edge/40 rounded-lg p-3 text-center text-sm font-mono tnum">
        <div className="text-ink-faint text-2xs">{t('bs.equation')}</div>
        <div className="font-bold text-ink mt-1">
          {formatINR(totalAssets, { compact: true })} − {formatINR(totalLiab, { compact: true })} = <span className={netWorth >= 0 ? 'text-income-ink' : 'text-expense-ink'}>{formatINR(netWorth, { compact: true })}</span>
        </div>
      </div>
    </div>
  );
}

export function assetGroup(kind: string): string {
  if (kind.startsWith('real_estate') || kind === 'reit') return 'Real Estate';
  if (kind === 'stocks' || kind === 'index_fund' || kind === 'active_mf' || kind === 'business_equity') return 'Equity';
  if (kind === 'gold') return 'Gold';
  if (kind === 'fd' || kind === 'savings' || kind === 'ppf' || kind === 'nps') return 'Fixed Income';
  if (kind === 'crypto') return 'Crypto';
  return 'Other';
}

export function prettyExpense(category: string, label: string): string {
  const cat = category.replace(/_/g, ' ');
  if (label.toLowerCase() === cat.toLowerCase()) return cat;
  return `${cat} — ${label}`;
}

export function Quadrant({ title, subtitle, color, total, children }: { title: string; subtitle: string; color: 'income' | 'expense' | 'brass'; total: number; children: React.ReactNode }) {
  const { t } = useT();
  const head = color === 'income' ? 'bg-income text-card' : color === 'expense' ? 'bg-expense text-card' : 'bg-brass-600 text-wood-900';
  const totalText = color === 'income' ? 'text-income-ink' : color === 'expense' ? 'text-expense-ink' : 'text-wood-700';
  return (
    <div className="bg-card border border-card-edge rounded-lg overflow-hidden shadow-card">
      <div className={`${head} px-3 py-1.5 flex items-baseline justify-between`}><span className="font-display text-sm tracking-wide">{title}</span><span className="text-2xs uppercase tracking-wider opacity-80">{subtitle}</span></div>
      <div className="p-3 space-y-0.5 text-sm">{children}</div>
      <div className={`px-3 py-2 border-t-2 border-card-edge flex justify-between font-bold text-sm bg-card-edge/40 ${totalText}`}><span>{t('bs.total')}</span><span className="font-mono tnum">{formatINR(total)}</span></div>
    </div>
  );
}

export function LedgerRow({ label, value, indent, muted }: { label: string; value: number; indent?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${indent ? 'ml-3' : ''} ${muted ? 'text-ink-soft italic' : 'text-ink'}`}>
      <span className="truncate pr-2">{label}</span><span className="font-mono whitespace-nowrap tnum">{value === 0 ? '—' : formatINR(value)}</span>
    </div>
  );
}

export function LedgerSubhead({ children }: { children: React.ReactNode }) {
  return <div className="text-xs uppercase tracking-wider text-ink-soft font-bold mt-2 mb-0.5">{children}</div>;
}

export function AssetsTab({ onSell }: { onSell: (a: Asset, units: number) => void }) {
  const { t } = useT();
  const state = useGameStore((s) => s.state)!;
  const decisionLog = useGameStore((s) => s.decisionLog);
  // Repeat-mistake guard: first tap arms, second tap sells (armed key = assetId:units).
  const [armedSell, setArmedSell] = useState<string | null>(null);
  const sellGuard = COACH_FLAGS.interventions ? sellIntervention(state, decisionLog) : null;
  function guardedSell(a: Asset, units: number) {
    const key = `${a.id}:${units}`;
    if (sellGuard && armedSell !== key) { play('pop'); setArmedSell(key); return; }
    play('coin'); onSell(a, units);
  }
  if (state.assets.length === 0) {
    return (
      <div className="text-center py-10 text-ink-faint">
        <Coin size={36} /><p className="mt-2 text-sm">{t('bs.noAssets')}<br />{t('bs.drawDeal')}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {state.assets.map((a) => {
        const value = a.currentPrice * a.units;
        const gain = value - a.unitCost * a.units;
        const gainPct = a.unitCost * a.units ? (gain / (a.unitCost * a.units)) * 100 : 0;
        const monthlyYield = (a.currentPrice * a.units * a.yieldRateAnnual) / 12;
        return (
          <div key={a.id} className="border border-card-edge rounded-lg p-3 bg-card-edge/30">
            <div className="flex justify-between items-start">
              <div><div className="font-display text-ink">{a.label}</div><div className="text-2xs text-ink-faint uppercase">{a.kind.replace(/_/g, ' ')}</div></div>
              <div className="text-right tnum">
                <div className="font-bold text-ink">{formatINR(value, { compact: true })}</div>
                <div className={`text-2xs ${gain >= 0 ? 'text-income-ink' : 'text-expense-ink'}`}>{gain >= 0 ? '+' : ''}{formatINR(gain, { compact: true })} ({gainPct.toFixed(1)}%)</div>
              </div>
            </div>
            <div className="text-2xs text-ink-soft mt-1 tnum">{a.units} units @ ₹{a.currentPrice.toLocaleString('en-IN')} · Yield ₹{Math.round(monthlyYield).toLocaleString('en-IN')}/mo</div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => guardedSell(a, a.units)} className="text-2xs bg-expense-soft hover:bg-expense/20 text-expense-ink px-3 py-1 rounded font-display">{t('fin.sellAll')}</button>
              {a.units > 1 && <button onClick={() => guardedSell(a, Math.floor(a.units / 2))} className="text-2xs bg-caution-soft hover:bg-caution/20 text-caution-ink px-3 py-1 rounded font-display">{t('fin.sellHalf')}</button>}
            </div>
            {sellGuard && armedSell?.startsWith(`${a.id}:`) && <div className="mt-2"><InterventionNotice guard={sellGuard} /></div>}
          </div>
        );
      })}
    </div>
  );
}

export function LiabilitiesTab({ onPrepay }: { onPrepay: (l: Loan, amount: number) => void }) {
  const { t } = useT();
  const state = useGameStore((s) => s.state)!;
  if (state.liabilities.length === 0) return <div className="text-center py-10 text-ink-faint"><div className="text-3xl">★</div><p className="mt-2 text-sm">{t('bs.debtFreeShort')}</p></div>;
  return (
    <div className="space-y-3">
      {state.liabilities.map((l) => {
        const half = Math.min(state.cashOnHand, Math.round(l.principalOutstanding / 2));
        const full = Math.min(state.cashOnHand, l.principalOutstanding);
        return (
          <div key={l.id} className="border border-card-edge rounded-lg p-3 bg-card-edge/30">
            <div className="flex justify-between items-start">
              <div><div className="font-display text-ink">{l.label}</div><div className="text-2xs text-ink-faint uppercase">{l.kind} · {(l.rateAnnual * 100).toFixed(1)}% p.a.</div></div>
              <div className="text-right tnum"><div className="font-bold text-expense-ink">{formatINR(l.principalOutstanding, { compact: true })}</div><div className="text-2xs text-ink-faint">EMI ₹{l.emi.toLocaleString('en-IN')} · {l.remainingMonths}mo</div></div>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {full > 0 && <button onClick={() => { play('coin'); onPrepay(l, full); }} disabled={state.cashOnHand < full} className="text-2xs bg-income-soft hover:bg-income/20 text-income-ink px-3 py-1 rounded font-display disabled:opacity-50">{t('bs.payOff', { x: full.toLocaleString('en-IN') })}</button>}
              {half > 0 && half < l.principalOutstanding && <button onClick={() => { play('coin'); onPrepay(l, half); }} disabled={state.cashOnHand < half} className="text-2xs bg-caution-soft hover:bg-caution/20 text-caution-ink px-3 py-1 rounded font-display disabled:opacity-50">{t('bs.prepayHalf', { x: half.toLocaleString('en-IN') })}</button>}
              {l.prepaymentPenalty > 0 && <div className="text-2xs text-ink-faint ml-auto self-center">{t('bs.penalty', { x: (l.prepaymentPenalty * 100).toFixed(1) })}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BorrowTab() {
  const { t } = useT();
  const applyAction = useGameStore((s) => s.applyAction);
  const [kind, setKind] = useState<LoanKind>('personal');
  const [principalLakhs, setPrincipalLakhs] = useState(5);
  const [tenureMonths, setTenureMonths] = useState(36);
  const rate = LOAN_RATES[kind].rate;
  const principal = principalLakhs * 100_000;
  const loan = buildLoan({ kind, label: `${kind} loan`, principal, tenureMonths });
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">{t('bs.borrowIntro')}</p>
      <div className="bg-card-edge/30 rounded-lg p-4 space-y-3">
        <Field label={t('bs.loanType')}>
          <Select value={kind} onChange={(v) => setKind(v as LoanKind)}>
            <option value="personal">{t('loan.personal', { r: (LOAN_RATES.personal.rate * 100).toFixed(1) })}</option>
            <option value="car">{t('loan.car', { r: (LOAN_RATES.car.rate * 100).toFixed(1) })}</option>
            <option value="education">{t('loan.education', { r: (LOAN_RATES.education.rate * 100).toFixed(1) })}</option>
            <option value="business">{t('loan.business', { r: (LOAN_RATES.business.rate * 100).toFixed(1) })}</option>
            <option value="credit_card">{t('loan.credit_card', { r: (LOAN_RATES.credit_card.rate * 100).toFixed(1) })}</option>
          </Select>
        </Field>
        <Field label={t('bs.principalLakh', { x: principalLakhs })}>
          <input type="range" min={1} max={50} value={principalLakhs} onChange={(e) => setPrincipalLakhs(+e.target.value)} className="w-full accent-brass-600" />
        </Field>
        <Field label={t('bs.tenureMonths', { m: tenureMonths, y: (tenureMonths / 12).toFixed(1) })}>
          <input type="range" min={6} max={LOAN_RATES[kind].maxTenureMonths} value={Math.min(tenureMonths, LOAN_RATES[kind].maxTenureMonths)} onChange={(e) => setTenureMonths(+e.target.value)} className="w-full accent-brass-600" />
        </Field>
        <div className="bg-card rounded p-3 text-sm space-y-1 tnum">
          <Row label={t('fin.rate')} value={`${(rate * 100).toFixed(2)}% p.a.`} />
          <Row label={t('bs.emiRow')} value={formatINR(loan.emi) + '/mo'} />
          <Row label={t('fin.totalInterest')} value={formatINR(loan.emi * tenureMonths - principal)} />
          <Row label={t('bs.principalReceived')} value={formatINR(principal)} bold />
        </div>
        <PrimaryButton onClick={() => { play('coin'); applyAction({ kind: 'take_loan', loan }); }} className="w-full">{t('bs.takeLoan')}</PrimaryButton>
      </div>
    </div>
  );
}
