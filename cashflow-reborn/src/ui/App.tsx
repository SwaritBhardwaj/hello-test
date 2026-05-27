import { useMemo, useState } from 'react';
import { useGameStore, DAYS_IN_MONTH } from './store';
import { formatINR, formatPct } from '@/utils/money';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { LOAN_RATES } from '@/data/constants';
import { buildLoan } from '@/modules/loans/loans';
import type { Card } from '@/modules/cards/cards';
import type { ProfessionId, Loan, Asset, LoanKind } from '@/types';

export default function App() {
  const state = useGameStore((s) => s.state);
  if (!state) return <SetupScreen />;
  return <BoardScreen />;
}

// ============================================================
// Setup
// ============================================================
function SetupScreen() {
  const initGame = useGameStore((s) => s.initGame);
  const [name, setName] = useState('Swarit');
  const [age, setAge] = useState(28);
  const [profession, setProfession] = useState<ProfessionId>('product_manager');
  const [city, setCity] = useState<'T1' | 'T2' | 'T3'>('T1');
  const [family, setFamily] = useState<'single' | 'married' | 'married_with_kids'>('single');

  return (
    <div className="min-h-screen flex items-center justify-center felt p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md space-y-4 ring-4 ring-amber-700/40">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎲</span>
          <div>
            <h1 className="text-2xl font-bold">Cashflow Reborn</h1>
            <p className="text-xs text-slate-500 -mt-0.5">A boardgame about life and money</p>
          </div>
        </div>
        <p className="text-sm text-slate-600">Set up your run.</p>
        <Field label="Name">
          <input className="border rounded p-2 w-full" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Age">
          <input type="number" className="border rounded p-2 w-full" value={age} onChange={(e) => setAge(+e.target.value)} />
        </Field>
        <Field label="Profession">
          <select className="border rounded p-2 w-full" value={profession} onChange={(e) => setProfession(e.target.value as ProfessionId)}>
            <option value="sde">Software Engineer</option>
            <option value="product_manager">Product Manager</option>
            <option value="doctor">Doctor</option>
            <option value="ca">Chartered Accountant</option>
            <option value="teacher">Teacher</option>
            <option value="designer">Designer</option>
            <option value="sales">Sales</option>
            <option value="govt_clerk">Govt Employee</option>
            <option value="founder">Founder</option>
          </select>
        </Field>
        <Field label="City Tier">
          <select className="border rounded p-2 w-full" value={city} onChange={(e) => setCity(e.target.value as 'T1' | 'T2' | 'T3')}>
            <option value="T1">T1 (Mumbai/Delhi/BLR)</option>
            <option value="T2">T2 (Pune/Jaipur/Indore)</option>
            <option value="T3">T3 (smaller cities)</option>
          </select>
        </Field>
        <Field label="Family">
          <select className="border rounded p-2 w-full" value={family} onChange={(e) => setFamily(e.target.value as typeof family)}>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="married_with_kids">Married + kids</option>
          </select>
        </Field>
        <button
          className="bg-amber-600 text-white px-4 py-3 rounded-xl w-full hover:bg-amber-700 font-semibold tracking-wide shadow"
          onClick={() => initGame({ seed: Math.floor(Math.random() * 1e9), playerName: name, age, profession, city, family })}
        >
          Start Game
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Main Board Screen
// ============================================================
function BoardScreen() {
  const state = useGameStore((s) => s.state)!;
  const rollDice = useGameStore((s) => s.rollDice);
  const ff = useGameStore((s) => s.fastForward);
  const reset = useGameStore((s) => s.reset);
  const notes = useGameStore((s) => s.notifications);
  const dayPosition = useGameStore((s) => s.dayPosition);
  const lastRoll = useGameStore((s) => s.lastRoll);
  const cardCells = useGameStore((s) => s.cardCells);
  const currentCard = useGameStore((s) => s.currentCard);
  const [sheetOpen, setSheetOpen] = useState(false);

  const chartData = state.history.map((h) => ({ tick: h.tick, netWorth: h.netWorth, cash: h.cashOnHand }));
  const month = state.meta.tick;
  const years = Math.floor(month / 12);
  const monthsIntoYear = month % 12;
  const passiveCoverage = state.statement.totalExpenses
    ? state.statement.passiveIncome / state.statement.totalExpenses
    : 0;

  return (
    <div className="min-h-screen felt p-4 md:p-6 space-y-4">
      {/* Top bar */}
      <header className="flex flex-wrap gap-3 justify-between items-center">
        <div className="bg-white/90 rounded-xl px-4 py-2 shadow ring-1 ring-amber-700/20">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Player</div>
          <div className="font-bold text-lg">{state.player.name}, {Math.floor(state.player.ageInMonths / 12)}y</div>
          <div className="text-xs text-slate-600">
            Year {years} · Month {monthsIntoYear + 1} · <span className="font-medium">{state.market.phase}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl shadow font-semibold"
            onClick={() => setSheetOpen(true)}
          >
            📒 Balance Sheet
          </button>
          <button
            className="bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg shadow-sm text-sm"
            onClick={() => ff(12)}
          >
            ⏩ +1 year
          </button>
          <button
            className="bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg shadow-sm text-sm"
            onClick={() => ff(60)}
          >
            ⏩⏩ +5 years
          </button>
          <button
            className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg shadow-sm text-sm"
            onClick={reset}
          >
            ⟲ Reset
          </button>
        </div>
      </header>

      {/* The board (day track) */}
      <section className="bg-emerald-900/30 rounded-2xl p-4 ring-4 ring-amber-700/40 shadow-inner">
        <div className="flex items-center justify-between mb-3">
          <div className="text-white/90 text-sm">
            <span className="font-bold text-base">Month track</span> · Day {dayPosition} / {DAYS_IN_MONTH}
          </div>
          <div className="flex items-center gap-3">
            <DieFace value={lastRoll} />
            <button
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg ring-2 ring-amber-300/60 transition active:scale-95"
              onClick={rollDice}
              disabled={!!currentCard}
            >
              🎲 Roll Dice
            </button>
          </div>
        </div>
        <DayTrack
          dayPosition={dayPosition}
          cardCells={cardCells}
          daysInMonth={DAYS_IN_MONTH}
        />
        <div className="text-white/60 text-xs mt-2 italic">
          Card squares are pink. Rolling moves your token; completing a lap closes the month.
        </div>
      </section>

      {/* Stats row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Net worth" value={formatINR(state.statement.netWorth, { compact: true })} accent="emerald" />
        <Stat label="Cash on hand" value={formatINR(state.cashOnHand, { compact: true })} accent="amber" />
        <Stat label="Monthly passive" value={formatINR(state.statement.passiveIncome, { compact: true })} />
        <Stat
          label="Passive/Expenses"
          value={`${(passiveCoverage * 100).toFixed(0)}%`}
          accent={passiveCoverage >= 1 ? 'emerald' : undefined}
          hint={passiveCoverage >= 1 ? '🏆 RAT RACE ESCAPED' : 'goal: 100%'}
        />
      </section>

      {/* Chart + notifications */}
      <section className="grid md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow md:col-span-2">
          <h2 className="font-semibold mb-2">Net worth over time</h2>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tick" />
                <YAxis tickFormatter={(v) => formatINR(v, { compact: true })} />
                <Tooltip formatter={(v: number) => formatINR(v)} />
                <Line type="monotone" dataKey="netWorth" stroke="#0F766E" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="cash" stroke="#D97706" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow">
          <h2 className="font-semibold mb-2">Game log</h2>
          <ul className="text-sm text-slate-700 space-y-1 max-h-64 overflow-auto">
            {notes.length === 0 && <li className="text-slate-400">Roll the dice to begin.</li>}
            {[...notes].reverse().map((n, i) => (
              <li key={i} className="leading-snug">• {n}</li>
            ))}
          </ul>
        </div>
      </section>

      {currentCard && <CardModal card={currentCard} />}
      {sheetOpen && <BalanceSheetDrawer onClose={() => setSheetOpen(false)} />}
    </div>
  );
}

// ============================================================
// Day Track (the visible "board")
// ============================================================
function DayTrack({
  dayPosition,
  cardCells,
  daysInMonth,
}: {
  dayPosition: number;
  cardCells: number[];
  daysInMonth: number;
}) {
  const cardSet = useMemo(() => new Set(cardCells), [cardCells]);
  return (
    <div className="flex gap-1 overflow-x-auto py-2">
      {Array.from({ length: daysInMonth + 1 }, (_, i) => {
        const day = i;
        const isHere = day === dayPosition;
        const isCard = cardSet.has(day);
        const isStart = day === 0;
        const isEnd = day === daysInMonth;
        return (
          <div
            key={day}
            className={`
              flex-shrink-0 w-9 h-12 rounded-md text-[10px] flex flex-col items-center justify-end pb-0.5
              ${isCard ? 'bg-pink-300 text-pink-900 font-bold' : 'bg-emerald-700 text-emerald-100'}
              ${isStart ? 'ring-2 ring-amber-300' : ''}
              ${isEnd ? 'ring-2 ring-amber-400 bg-amber-500 text-white font-bold' : ''}
              ${isHere ? 'ring-4 ring-yellow-300 scale-110 shadow-lg z-10 relative' : ''}
              transition-all
            `}
            title={`Day ${day}${isCard ? ' (card)' : ''}${isEnd ? ' (month end)' : ''}`}
          >
            {isHere && <span className="text-base">🟡</span>}
            {!isHere && isCard && <span>🃏</span>}
            {!isHere && isEnd && <span>🏁</span>}
            <span className="opacity-80">{day}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Die face
// ============================================================
function DieFace({ value }: { value: number | null }) {
  const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  return (
    <div className="bg-white rounded-lg w-12 h-12 flex items-center justify-center text-3xl shadow ring-2 ring-amber-700/30">
      {value ? faces[value - 1] : '·'}
    </div>
  );
}

// ============================================================
// Card Modal
// ============================================================
function CardModal({ card }: { card: Card }) {
  const resolve = useGameStore((s) => s.resolveCardOption);
  const state = useGameStore((s) => s.state)!;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl shadow-2xl max-w-md w-full ring-4 ring-amber-600/60 animate-card-in">
        <div className="bg-amber-700 text-white rounded-t-xl px-5 py-3 flex items-center gap-3">
          <span className="text-3xl">{card.emoji}</span>
          <div>
            <div className="font-bold text-lg leading-tight">{card.title}</div>
            {card.subtitle && <div className="text-xs opacity-90">{card.subtitle}</div>}
          </div>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-slate-700">{card.description}</p>
          {card.rows && (
            <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
              {card.rows.map((r, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-slate-500">{r.label}</span>
                  <span className="font-semibold text-slate-800">{r.value}</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-xs text-slate-400">
            You have <span className="font-semibold text-slate-700">{formatINR(state.cashOnHand)}</span> in cash.
          </div>
          <div className="space-y-2 pt-2">
            {card.options.map((o) => {
              const cantAfford = o.affordCheck?.(state);
              const disabled = !!cantAfford;
              return (
                <button
                  key={o.id}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition
                    ${disabled
                      ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-white border-amber-300 hover:bg-amber-50 hover:border-amber-500 text-slate-800'}`}
                  onClick={() => !disabled && resolve(o.id)}
                  disabled={disabled}
                >
                  <div className="font-semibold">{o.label}</div>
                  {o.detail && <div className="text-xs text-slate-500 mt-0.5">{o.detail}</div>}
                  {cantAfford && <div className="text-xs text-red-500 mt-0.5">{cantAfford}</div>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Balance Sheet Drawer
// ============================================================
function BalanceSheetDrawer({ onClose }: { onClose: () => void }) {
  const state = useGameStore((s) => s.state)!;
  const applyAction = useGameStore((s) => s.applyAction);
  const [tab, setTab] = useState<'statement' | 'assets' | 'liabilities' | 'borrow'>('statement');

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex" onClick={onClose}>
      <div
        className="ml-auto bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-slate-900 text-white px-5 py-3 flex justify-between items-center">
          <div>
            <div className="text-xs uppercase opacity-70">Personal Financial Statement</div>
            <div className="font-bold text-lg">{state.player.name}</div>
          </div>
          <button onClick={onClose} className="text-2xl hover:bg-slate-700 w-9 h-9 rounded-lg">×</button>
        </div>

        <div className="border-b sticky top-[60px] bg-white z-10 flex">
          {(['statement', 'assets', 'liabilities', 'borrow'] as const).map((t) => (
            <button
              key={t}
              className={`flex-1 px-4 py-3 font-semibold text-sm uppercase tracking-wider transition
                ${tab === t ? 'border-b-2 border-emerald-600 text-emerald-700 bg-emerald-50' : 'text-slate-500 hover:bg-slate-50'}`}
              onClick={() => setTab(t)}
            >
              {t === 'statement' && '📊 Statement'}
              {t === 'assets' && `💎 Assets (${state.assets.length})`}
              {t === 'liabilities' && `📉 Loans (${state.liabilities.length})`}
              {t === 'borrow' && '🏦 Borrow'}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'statement' && <StatementTab />}
          {tab === 'assets' && <AssetsTab onSell={(a, u) => applyAction({ kind: 'sell_asset', assetId: a.id, units: u })} />}
          {tab === 'liabilities' && <LiabilitiesTab onPrepay={(l, amt) => applyAction({ kind: 'prepay_loan', loanId: l.id, amount: amt })} />}
          {tab === 'borrow' && <BorrowTab />}
        </div>
      </div>
    </div>
  );
}

function StatementTab() {
  const state = useGameStore((s) => s.state)!;
  const monthlySalary = state.incomeStreams.filter((i) => i.kind === 'salary').reduce((s, i) => s + i.monthlyGross, 0);
  const monthlyOtherIncome = state.incomeStreams.filter((i) => i.kind !== 'salary').reduce((s, i) => s + i.monthlyGross, 0);
  const yieldMonthly = state.assets.reduce((s, a) => s + (a.currentPrice * a.units * a.yieldRateAnnual) / 12, 0);
  const totalEMI = state.liabilities.reduce((s, l) => s + l.emi, 0);
  const totalPremium = state.insurance.reduce((s, i) => s + i.monthlyPremium, 0);
  const livingExpenses = state.expenses.reduce((s, e) => s + e.monthlyAmount, 0);

  return (
    <div className="space-y-6">
      <Section title="INCOME (monthly)" color="emerald">
        <Row label="Salary" value={formatINR(monthlySalary)} />
        {monthlyOtherIncome > 0 && <Row label="Other / freelance" value={formatINR(monthlyOtherIncome)} />}
        <Row label="Asset yield (dividends/rent/interest)" value={formatINR(Math.round(yieldMonthly))} />
        <Row label="TOTAL INCOME" value={formatINR(monthlySalary + monthlyOtherIncome + Math.round(yieldMonthly))} bold />
      </Section>

      <Section title="EXPENSES (monthly)" color="rose">
        {state.expenses.map((e, i) => (
          <Row key={i} label={`${e.category} — ${e.label}`} value={formatINR(e.monthlyAmount)} />
        ))}
        {totalEMI > 0 && <Row label="Loan EMIs" value={formatINR(totalEMI)} />}
        {totalPremium > 0 && <Row label="Insurance premiums" value={formatINR(totalPremium)} />}
        <Row label="TOTAL EXPENSES" value={formatINR(livingExpenses + totalEMI + totalPremium)} bold />
      </Section>

      <Section title="CASH FLOW" color="amber">
        <Row label="Cash on hand" value={formatINR(state.cashOnHand)} bold />
        <Row label="Net monthly cashflow" value={formatINR(state.statement.totalIncome - state.statement.totalExpenses)} />
        <Row label="Savings rate" value={formatPct(state.statement.savingsRate, 1)} />
      </Section>

      <Section title="NET WORTH" color="slate">
        <Row label="Total assets" value={formatINR(state.statement.totalAssets)} />
        <Row label="Total liabilities" value={formatINR(state.statement.totalLiabilities)} />
        <Row label="NET WORTH" value={formatINR(state.statement.netWorth)} bold />
      </Section>
    </div>
  );
}

function AssetsTab({ onSell }: { onSell: (a: Asset, units: number) => void }) {
  const state = useGameStore((s) => s.state)!;
  if (state.assets.length === 0) {
    return <div className="text-slate-500 italic text-center py-8">No assets yet. Draw a deal card and invest!</div>;
  }
  return (
    <div className="space-y-3">
      {state.assets.map((a) => {
        const value = a.currentPrice * a.units;
        const costBasis = a.unitCost * a.units;
        const gain = value - costBasis;
        const gainPct = costBasis ? (gain / costBasis) * 100 : 0;
        const monthlyYield = (a.currentPrice * a.units * a.yieldRateAnnual) / 12;
        return (
          <div key={a.id} className="border rounded-lg p-3 bg-slate-50">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold">{a.label}</div>
                <div className="text-xs text-slate-500 uppercase">{a.kind.replace(/_/g, ' ')}</div>
              </div>
              <div className="text-right">
                <div className="font-bold">{formatINR(value, { compact: true })}</div>
                <div className={`text-xs ${gain >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {gain >= 0 ? '+' : ''}{formatINR(gain, { compact: true })} ({gainPct.toFixed(1)}%)
                </div>
              </div>
            </div>
            <div className="text-xs text-slate-600 mt-1">
              {a.units} units @ ₹{a.currentPrice.toLocaleString('en-IN')} · Yield ₹{Math.round(monthlyYield).toLocaleString('en-IN')}/mo
            </div>
            <div className="flex gap-2 mt-2">
              <button
                className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded font-semibold"
                onClick={() => onSell(a, a.units)}
              >
                Sell all
              </button>
              {a.units > 1 && (
                <button
                  className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1 rounded font-semibold"
                  onClick={() => onSell(a, Math.floor(a.units / 2))}
                >
                  Sell half
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LiabilitiesTab({ onPrepay }: { onPrepay: (l: Loan, amount: number) => void }) {
  const state = useGameStore((s) => s.state)!;
  if (state.liabilities.length === 0) {
    return <div className="text-slate-500 italic text-center py-8">Debt-free. 🎉</div>;
  }
  return (
    <div className="space-y-3">
      {state.liabilities.map((l) => {
        const half = Math.min(state.cashOnHand, Math.round(l.principalOutstanding / 2));
        const full = Math.min(state.cashOnHand, l.principalOutstanding);
        return (
          <div key={l.id} className="border rounded-lg p-3 bg-slate-50">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-semibold">{l.label}</div>
                <div className="text-xs text-slate-500 uppercase">{l.kind} · {(l.rateAnnual * 100).toFixed(1)}% p.a.</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-red-600">{formatINR(l.principalOutstanding, { compact: true })}</div>
                <div className="text-xs text-slate-500">EMI ₹{l.emi.toLocaleString('en-IN')} · {l.remainingMonths}mo left</div>
              </div>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {full > 0 && (
                <button
                  className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-1 rounded font-semibold"
                  onClick={() => onPrepay(l, full)}
                  disabled={state.cashOnHand < full}
                >
                  Pay off full (₹{full.toLocaleString('en-IN')})
                </button>
              )}
              {half > 0 && half < l.principalOutstanding && (
                <button
                  className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1 rounded font-semibold"
                  onClick={() => onPrepay(l, half)}
                  disabled={state.cashOnHand < half}
                >
                  Prepay half (₹{half.toLocaleString('en-IN')})
                </button>
              )}
              {l.prepaymentPenalty > 0 && (
                <div className="text-xs text-slate-400 ml-auto self-center">
                  Prepay penalty: {(l.prepaymentPenalty * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BorrowTab() {
  const applyAction = useGameStore((s) => s.applyAction);
  const [kind, setKind] = useState<LoanKind>('personal');
  const [principalLakhs, setPrincipalLakhs] = useState(5);
  const [tenureMonths, setTenureMonths] = useState(36);
  const rate = LOAN_RATES[kind].rate;
  const principal = principalLakhs * 100_000;
  const loan = buildLoan({
    kind,
    label: `${kind} loan`,
    principal,
    tenureMonths,
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Take a loan directly. Cash credits to your balance immediately; EMIs auto-debit each month.
      </p>
      <div className="bg-slate-50 rounded-lg p-4 space-y-3">
        <Field label="Loan type">
          <select className="border rounded p-2 w-full" value={kind} onChange={(e) => setKind(e.target.value as LoanKind)}>
            <option value="personal">Personal loan ({(LOAN_RATES.personal.rate * 100).toFixed(1)}%)</option>
            <option value="car">Car loan ({(LOAN_RATES.car.rate * 100).toFixed(1)}%)</option>
            <option value="education">Education loan ({(LOAN_RATES.education.rate * 100).toFixed(1)}%)</option>
            <option value="business">Business loan ({(LOAN_RATES.business.rate * 100).toFixed(1)}%)</option>
            <option value="credit_card">Credit card revolve ({(LOAN_RATES.credit_card.rate * 100).toFixed(1)}%)</option>
          </select>
        </Field>
        <Field label={`Principal (₹${principalLakhs} lakh)`}>
          <input
            type="range"
            min={1}
            max={50}
            value={principalLakhs}
            onChange={(e) => setPrincipalLakhs(+e.target.value)}
            className="w-full"
          />
        </Field>
        <Field label={`Tenure (${tenureMonths} months ≈ ${(tenureMonths / 12).toFixed(1)} years)`}>
          <input
            type="range"
            min={6}
            max={LOAN_RATES[kind].maxTenureMonths}
            value={Math.min(tenureMonths, LOAN_RATES[kind].maxTenureMonths)}
            onChange={(e) => setTenureMonths(+e.target.value)}
            className="w-full"
          />
        </Field>
        <div className="bg-white rounded p-3 text-sm space-y-1">
          <Row label="Rate" value={`${(rate * 100).toFixed(2)}% p.a.`} />
          <Row label="EMI" value={formatINR(loan.emi) + '/mo'} />
          <Row label="Total interest" value={formatINR(loan.emi * tenureMonths - principal)} />
          <Row label="Principal received" value={formatINR(principal)} bold />
        </div>
        <button
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg w-full font-semibold"
          onClick={() => applyAction({ kind: 'take_loan', loan })}
        >
          Take this loan
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Small UI helpers
// ============================================================
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: 'emerald' | 'amber' }) {
  const accentClass = accent === 'emerald' ? 'ring-emerald-400 bg-emerald-50' : accent === 'amber' ? 'ring-amber-400 bg-amber-50' : 'ring-white/50 bg-white';
  return (
    <div className={`p-3 rounded-xl shadow ring-2 ${accentClass}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg md:text-xl font-bold mt-0.5">{value}</div>
      {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: 'emerald' | 'rose' | 'amber' | 'slate'; children: React.ReactNode }) {
  const colorMap = {
    emerald: 'border-emerald-300 bg-emerald-50',
    rose: 'border-rose-300 bg-rose-50',
    amber: 'border-amber-300 bg-amber-50',
    slate: 'border-slate-300 bg-slate-50',
  };
  return (
    <div className={`border-l-4 ${colorMap[color]} rounded-r-lg p-3`}>
      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600 mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-bold border-t pt-1 mt-1' : ''}`}>
      <span className="text-slate-700">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
