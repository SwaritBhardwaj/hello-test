import { useMemo, useState } from 'react';
import { useGameStore, DAYS_IN_MONTH, BANKRUPTCY_GRACE_MONTHS, trailingNegativeCashMonths } from './store';
import { formatINR } from '@/utils/money';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { LOAN_RATES } from '@/data/constants';
import { buildLoan } from '@/modules/loans/loans';
import { PROFESSIONS, startingSalary } from '@/modules/player/career';
import type { Card } from '@/modules/cards/cards';
import type { ProfessionId, Loan, Asset, LoanKind } from '@/types';

const RANDOM_NAMES = [
  'Aarav', 'Aditi', 'Arjun', 'Ananya', 'Dhruv', 'Diya', 'Ishaan', 'Isha',
  'Kabir', 'Kavya', 'Krishna', 'Maya', 'Neil', 'Nisha', 'Rohan', 'Riya',
  'Vihaan', 'Vanya', 'Yash', 'Zara', 'Aryan', 'Meera', 'Aditya', 'Sara',
];

function rollRandomCharacter(): {
  name: string;
  age: number;
  profession: ProfessionId;
  city: 'T1' | 'T2' | 'T3';
  family: 'single' | 'married' | 'married_with_kids';
} {
  const r = Math.random;
  const name = RANDOM_NAMES[Math.floor(r() * RANDOM_NAMES.length)];
  const professionIds = Object.keys(PROFESSIONS) as ProfessionId[];
  const profession = professionIds[Math.floor(r() * professionIds.length)];
  // Age band by profession — doctors/founders skew older, govt/teacher span wider
  const ageBands: Record<ProfessionId, [number, number]> = {
    sde: [23, 38], product_manager: [26, 42], doctor: [28, 50], teacher: [24, 50],
    ca: [25, 45], designer: [23, 40], sales: [24, 48], govt_clerk: [23, 55], founder: [27, 45],
  };
  const [aMin, aMax] = ageBands[profession];
  const age = aMin + Math.floor(r() * (aMax - aMin + 1));
  // City weighted T1 > T2 > T3
  const cityRoll = r();
  const city: 'T1' | 'T2' | 'T3' = cityRoll < 0.5 ? 'T1' : cityRoll < 0.8 ? 'T2' : 'T3';
  // Family by age
  let family: 'single' | 'married' | 'married_with_kids';
  if (age < 27) family = r() < 0.85 ? 'single' : 'married';
  else if (age < 32) family = r() < 0.45 ? 'single' : r() < 0.7 ? 'married' : 'married_with_kids';
  else family = r() < 0.2 ? 'single' : r() < 0.5 ? 'married' : 'married_with_kids';
  return { name, age, profession, city, family };
}

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
  const [mode, setMode] = useState<'menu' | 'custom' | 'random'>('menu');
  const [name, setName] = useState('Swarit');
  const [age, setAge] = useState(28);
  const [profession, setProfession] = useState<ProfessionId>('product_manager');
  const [city, setCity] = useState<'T1' | 'T2' | 'T3'>('T1');
  const [family, setFamily] = useState<'single' | 'married' | 'married_with_kids'>('single');

  const yoe = Math.max(0, age - 22);
  const monthlySalary = startingSalary(profession, city, yoe);

  function rollRandom() {
    const c = rollRandomCharacter();
    setName(c.name);
    setAge(c.age);
    setProfession(c.profession);
    setCity(c.city);
    setFamily(c.family);
    setMode('random');
  }

  function start() {
    initGame({
      seed: Math.floor(Math.random() * 1e9),
      playerName: name,
      age,
      profession,
      city,
      family,
    });
  }

  if (mode === 'menu') {
    return (
      <div className="min-h-screen flex items-center justify-center felt p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md space-y-5 ring-4 ring-amber-700/40">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🎲</span>
            <div>
              <h1 className="text-3xl font-bold">Cashflow Reborn</h1>
              <p className="text-sm text-slate-500 -mt-0.5">A boardgame about life and money</p>
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <button
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-4 rounded-xl w-full font-semibold tracking-wide shadow-lg ring-2 ring-emerald-300/40 transition active:scale-[0.98]"
              onClick={rollRandom}
            >
              🎲 Roll a random character
              <div className="text-xs font-normal opacity-80 mt-0.5">Realistic age, job, city — like real life dealt you a hand</div>
            </button>
            <button
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 rounded-xl w-full font-semibold transition active:scale-[0.98]"
              onClick={() => setMode('custom')}
            >
              ✏️ Customise my character
              <div className="text-xs font-normal opacity-70 mt-0.5">Pick every detail yourself</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center felt p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md space-y-4 ring-4 ring-amber-700/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎲</span>
            <div>
              <h1 className="text-xl font-bold">{mode === 'random' ? 'Your character' : 'Customise'}</h1>
              <p className="text-xs text-slate-500 -mt-0.5">Cashflow Reborn</p>
            </div>
          </div>
          <button
            className="text-xs text-slate-500 hover:text-slate-700"
            onClick={() => setMode('menu')}
          >
            ← back
          </button>
        </div>

        {mode === 'random' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm space-y-1">
            <div className="font-semibold text-emerald-900">Random hand:</div>
            <div className="text-emerald-800">
              <b>{name}</b>, {age} years old, working as a <b>{PROFESSIONS[profession].label}</b> in <b>{city}</b>
              {family === 'single' ? ', single' : family === 'married' ? ', married' : ', married with kids'}.
            </div>
            <div className="text-emerald-700 text-xs">
              Monthly salary: <b>{formatINR(monthlySalary)}</b> ({yoe} yrs experience)
            </div>
            <button className="text-xs text-emerald-700 hover:text-emerald-900 underline mt-1" onClick={rollRandom}>
              🎲 Reroll
            </button>
          </div>
        )}

        {mode === 'custom' && (
          <>
            <Field label="Name">
              <input className="border rounded p-2 w-full" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Age">
              <input type="number" className="border rounded p-2 w-full" value={age} onChange={(e) => setAge(+e.target.value)} />
            </Field>
            <Field label="Profession">
              <select className="border rounded p-2 w-full" value={profession} onChange={(e) => setProfession(e.target.value as ProfessionId)}>
                {(Object.keys(PROFESSIONS) as ProfessionId[]).map((p) => (
                  <option key={p} value={p}>{PROFESSIONS[p].label}</option>
                ))}
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
            <div className="text-xs text-slate-500 -mt-1">
              Starting salary: <b>{formatINR(monthlySalary)}/mo</b>
            </div>
          </>
        )}

        <button
          className="bg-amber-600 text-white px-4 py-3 rounded-xl w-full hover:bg-amber-700 font-semibold tracking-wide shadow"
          onClick={start}
        >
          ▶ Start Game
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
  const gameStatus = useGameStore((s) => s.gameStatus);
  const outcomeDismissed = useGameStore((s) => s.outcomeDismissed);
  const [sheetOpen, setSheetOpen] = useState(false);

  const chartData = state.history.map((h) => ({ tick: h.tick, netWorth: h.netWorth, cash: h.cashOnHand }));
  const month = state.meta.tick;
  const years = Math.floor(month / 12);
  const monthsIntoYear = month % 12;
  const passiveCoverage = state.statement.totalExpenses
    ? state.statement.passiveIncome / state.statement.totalExpenses
    : 0;
  const negMonths = trailingNegativeCashMonths(state);
  const monthsToBankruptcy = Math.max(0, BANKRUPTCY_GRACE_MONTHS - negMonths);
  const showOutcomeModal = gameStatus !== 'playing' && !outcomeDismissed;

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

      {/* Win progress bar — the goal of the whole game */}
      <FreedomBar
        passive={state.statement.passiveIncome}
        expenses={state.statement.totalExpenses}
        coverage={passiveCoverage}
        won={gameStatus === 'won'}
      />

      {/* Bankruptcy warning (only when in danger) */}
      {negMonths > 0 && gameStatus === 'playing' && (
        <BankruptcyWarning
          monthsNegative={negMonths}
          monthsToBankruptcy={monthsToBankruptcy}
          cashOnHand={state.cashOnHand}
        />
      )}

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
        <Stat
          label="Cash on hand"
          value={formatINR(state.cashOnHand, { compact: true })}
          accent={state.cashOnHand < 0 ? undefined : 'amber'}
          hint={state.cashOnHand < 0 ? '⚠️ overdrawn' : undefined}
        />
        <Stat label="Monthly income" value={formatINR(state.statement.totalIncome, { compact: true })} />
        <Stat label="Monthly expenses" value={formatINR(state.statement.totalExpenses, { compact: true })} />
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
      {showOutcomeModal && <OutcomeModal status={gameStatus} />}
    </div>
  );
}

// ============================================================
// Freedom progress bar (the goal of the whole game)
// ============================================================
function FreedomBar({
  passive,
  expenses,
  coverage,
  won,
}: {
  passive: number;
  expenses: number;
  coverage: number;
  won: boolean;
}) {
  const pct = Math.min(150, coverage * 100); // allow some overshoot visually
  const fillPct = Math.min(100, pct);
  const colorClass = won
    ? 'from-amber-300 via-yellow-400 to-amber-300'
    : coverage >= 0.75
      ? 'from-emerald-400 to-emerald-600'
      : coverage >= 0.40
        ? 'from-amber-300 to-amber-500'
        : 'from-rose-300 to-rose-500';

  return (
    <section className={`rounded-2xl p-4 shadow-lg ring-2 ${won ? 'bg-gradient-to-r from-amber-100 to-yellow-50 ring-amber-400 animate-pulse-slow' : 'bg-white/95 ring-amber-700/30'}`}>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Path to Financial Freedom</div>
          <div className="text-sm text-slate-700">
            Passive income <span className="font-bold text-emerald-700">{formatINR(passive, { compact: true })}</span>
            <span className="text-slate-400 mx-2">vs</span>
            Monthly expenses <span className="font-bold text-rose-700">{formatINR(expenses, { compact: true })}</span>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${won ? 'text-amber-600' : coverage >= 0.5 ? 'text-emerald-700' : 'text-slate-700'}`}>
            {Math.round(pct)}%
          </div>
          {won && <div className="text-xs text-amber-700 font-semibold">🏆 RAT RACE ESCAPED</div>}
          {!won && <div className="text-[10px] text-slate-500">Win at 100%</div>}
        </div>
      </div>
      <div className="relative bg-slate-200 rounded-full h-5 overflow-hidden ring-1 ring-slate-300">
        <div
          className={`h-full bg-gradient-to-r ${colorClass} transition-all duration-700 ease-out`}
          style={{ width: `${fillPct}%` }}
        />
        {/* Markers */}
        {[25, 50, 75].map((m) => (
          <div
            key={m}
            className="absolute top-0 bottom-0 w-px bg-white/60"
            style={{ left: `${m}%` }}
          />
        ))}
        {/* 100% finish line */}
        <div className="absolute top-0 bottom-0 w-1 bg-amber-600 shadow" style={{ left: 'calc(100% - 2px)' }} />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-0.5">
        <span>0</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span className="text-amber-700 font-bold">🏁 100%</span>
      </div>
    </section>
  );
}

// ============================================================
// Bankruptcy warning
// ============================================================
function BankruptcyWarning({
  monthsNegative,
  monthsToBankruptcy,
  cashOnHand,
}: {
  monthsNegative: number;
  monthsToBankruptcy: number;
  cashOnHand: number;
}) {
  const dangerPct = (monthsNegative / BANKRUPTCY_GRACE_MONTHS) * 100;
  return (
    <section className="bg-gradient-to-r from-rose-900 to-red-800 text-white rounded-2xl p-4 shadow-lg ring-2 ring-rose-400 animate-pulse-fast">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="font-bold text-base">CASH OVERDRAWN</div>
            <div className="text-xs opacity-90">
              {formatINR(cashOnHand, { compact: true })} in the red · month {monthsNegative} of {BANKRUPTCY_GRACE_MONTHS}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{monthsToBankruptcy}</div>
          <div className="text-[10px] uppercase tracking-wider opacity-90">months to bankruptcy</div>
        </div>
      </div>
      <div className="bg-rose-950/50 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-rose-400 to-red-500 transition-all duration-500"
          style={{ width: `${dangerPct}%` }}
        />
      </div>
      <div className="text-[11px] mt-1.5 opacity-90 italic">
        Sell assets, pay off high-rate debt, or cut expenses — fast.
      </div>
    </section>
  );
}

// ============================================================
// Outcome modal — win or lose
// ============================================================
function OutcomeModal({ status }: { status: 'won' | 'lost' }) {
  const dismiss = useGameStore((s) => s.dismissOutcome);
  const reset = useGameStore((s) => s.reset);
  const state = useGameStore((s) => s.state)!;
  const years = Math.floor(state.meta.tick / 12);
  const months = state.meta.tick % 12;

  if (status === 'won') {
    return (
      <div className="fixed inset-0 bg-amber-900/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
        <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 rounded-2xl shadow-2xl max-w-md w-full ring-4 ring-amber-500 animate-card-in">
          <div className="bg-gradient-to-r from-amber-600 to-yellow-500 text-white rounded-t-xl px-6 py-5 text-center">
            <div className="text-6xl mb-2">🏆</div>
            <div className="text-2xl font-bold">Rat Race Escaped!</div>
            <div className="text-sm opacity-95 mt-1">
              {state.player.name} achieved financial freedom in {years}y {months}m
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-white/70 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Net worth</span>
                <span className="font-bold text-emerald-700">{formatINR(state.statement.netWorth)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Passive income</span>
                <span className="font-bold text-emerald-700">{formatINR(state.statement.passiveIncome)}/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monthly expenses</span>
                <span className="font-mono">{formatINR(state.statement.totalExpenses)}/mo</span>
              </div>
            </div>
            <p className="text-sm text-slate-600 italic text-center">
              "Your money works for you now. Time is yours."
            </p>
            <div className="space-y-2">
              <button
                onClick={dismiss}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-lg font-semibold"
              >
                Keep playing
              </button>
              <button
                onClick={reset}
                className="w-full bg-white border-2 border-amber-300 hover:bg-amber-50 text-amber-800 px-4 py-2.5 rounded-lg font-semibold"
              >
                🎲 Start a new run
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // lost
  return (
    <div className="fixed inset-0 bg-rose-950/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-rose-50 to-white rounded-2xl shadow-2xl max-w-md w-full ring-4 ring-rose-500 animate-card-in">
        <div className="bg-gradient-to-r from-rose-700 to-red-700 text-white rounded-t-xl px-6 py-5 text-center">
          <div className="text-6xl mb-2">💸</div>
          <div className="text-2xl font-bold">Bankrupt</div>
          <div className="text-sm opacity-95 mt-1">
            {state.player.name} ran out of cash for {BANKRUPTCY_GRACE_MONTHS} straight months
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-white rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Final cash</span>
              <span className="font-bold text-rose-700">{formatINR(state.cashOnHand)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Final net worth</span>
              <span className={`font-bold ${state.statement.netWorth < 0 ? 'text-rose-700' : ''}`}>
                {formatINR(state.statement.netWorth)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Survived</span>
              <span className="font-mono">{years}y {months}m</span>
            </div>
          </div>
          <p className="text-sm text-slate-600 italic text-center">
            "The EMIs kept coming. The salary couldn't."
          </p>
          <div className="space-y-2">
            <button
              onClick={reset}
              className="w-full bg-rose-700 hover:bg-rose-800 text-white px-4 py-3 rounded-lg font-semibold"
            >
              🎲 Start a new run
            </button>
            <button
              onClick={dismiss}
              className="w-full bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg text-sm"
            >
              Continue (view the wreckage)
            </button>
          </div>
        </div>
      </div>
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
  const resolveWithLoan = useGameStore((s) => s.resolveCardOptionWithLoan);
  const state = useGameStore((s) => s.state)!;
  const t = Math.min(5, Math.max(1, card.temptation));
  // Max temptation = no resist option. Player must buy (with cash or borrowed).
  const visibleOptions = t >= 5 ? card.options.filter((o) => o.id !== 'skip') : card.options;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl shadow-2xl max-w-md w-full ring-4 ring-amber-600/60 animate-card-in">
        <div className="bg-amber-700 text-white rounded-t-xl px-5 py-3 flex items-center gap-3">
          <span className="text-3xl">{card.emoji}</span>
          <div className="flex-1">
            <div className="font-bold text-lg leading-tight">{card.title}</div>
            {card.subtitle && <div className="text-xs opacity-90">{card.subtitle}</div>}
          </div>
        </div>

        {/* Temptation meter */}
        <div className={`px-5 py-2 border-b border-amber-200 ${t >= 4 ? 'bg-rose-50' : t >= 3 ? 'bg-amber-50' : 'bg-slate-50'}`}>
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">
              {t >= 5 ? 'YOU NEED THIS' : t >= 4 ? 'Very tempting' : t >= 3 ? 'Tempting' : t >= 2 ? 'Mildly interesting' : 'Take it or leave it'}
            </div>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className={`text-base ${i <= t ? (t >= 4 ? 'text-rose-500' : 'text-amber-500') : 'text-slate-300'}`}>
                  {i <= t ? '♥' : '♡'}
                </span>
              ))}
            </div>
          </div>
          <div className="text-xs italic text-slate-600 mt-0.5 leading-snug">
            "{card.temptationReason}"
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
          {t >= 5 && (
            <div className="bg-rose-100 border-2 border-rose-300 rounded-lg px-3 py-2 text-xs text-rose-800 font-semibold flex items-center gap-2">
              <span className="text-base">🔥</span>
              <span>You can't walk away from this one. {visibleOptions.length === 1 ? "It's happening." : 'Pick how you pay.'}</span>
            </div>
          )}
          <div className="space-y-2 pt-2">
            {visibleOptions.map((o) => {
              const cantAfford = o.affordCheck?.(state);
              const isResist = o.id === 'skip';
              const isBuy = !isResist;
              // Show borrow button when this option needs cash and player is short
              const showBorrow = !!cantAfford && o.cashCost && state.cashOnHand < o.cashCost;
              const shortfall = o.cashCost ? Math.max(0, o.cashCost - state.cashOnHand) : 0;
              const borrowAmount = Math.ceil(shortfall / 10_000) * 10_000;

              const baseBtn = isResist
                ? `bg-slate-50 border-slate-300 hover:bg-slate-100 text-slate-700 ${t >= 4 ? 'opacity-70 text-xs py-2' : ''}`
                : isBuy && t >= 4
                  ? 'bg-gradient-to-r from-amber-100 to-rose-100 border-rose-400 hover:from-amber-200 hover:to-rose-200 text-slate-900 shadow-md'
                  : 'bg-white border-amber-300 hover:bg-amber-50 hover:border-amber-500 text-slate-800';
              const disabledClass = cantAfford ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : '';

              return (
                <div key={o.id} className="space-y-1.5">
                  <button
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition ${cantAfford ? disabledClass : baseBtn}`}
                    onClick={() => !cantAfford && resolve(o.id)}
                    disabled={!!cantAfford}
                  >
                    <div className="font-semibold">{o.label}</div>
                    {o.detail && <div className="text-xs text-slate-500 mt-0.5">{o.detail}</div>}
                    {cantAfford && <div className="text-xs text-red-500 mt-0.5">{cantAfford}</div>}
                  </button>
                  {showBorrow && (
                    <button
                      className="w-full text-left px-4 py-2 rounded-lg border-2 border-dashed border-rose-300 bg-rose-50/50 hover:bg-rose-100 transition"
                      onClick={() => resolveWithLoan(o.id, 'personal')}
                    >
                      <div className="text-sm font-semibold text-rose-700">
                        🏦 Borrow ₹{borrowAmount.toLocaleString('en-IN')} & buy {t >= 5 && <span className="ml-1 text-[10px] bg-rose-700 text-white rounded px-1.5 py-0.5">FORCED</span>}
                      </div>
                      <div className="text-xs text-rose-600 mt-0.5">
                        Personal loan @ 13.5% p.a., 3yr · The card never sleeps
                      </div>
                    </button>
                  )}
                </div>
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
  const monthlyFreelance = state.incomeStreams.filter((i) => i.kind === 'freelance').reduce((s, i) => s + i.monthlyGross, 0);

  // Asset yield bucketed by source
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

  // Asset breakdown
  const assetGroups: Record<string, { label: string; value: number }[]> = {};
  for (const a of state.assets) {
    const groupKey = assetGroup(a.kind);
    if (!assetGroups[groupKey]) assetGroups[groupKey] = [];
    assetGroups[groupKey].push({ label: a.label, value: a.currentPrice * a.units });
  }
  const totalAssets = state.cashOnHand + Object.values(assetGroups).flat().reduce((s, x) => s + x.value, 0);

  const totalLiab = state.liabilities.reduce((s, l) => s + l.principalOutstanding, 0);
  const netWorth = totalAssets - totalLiab;
  const passiveCoverage = totalExpenses > 0 ? totalPassive / totalExpenses : 0;

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="bg-slate-900 text-white rounded-lg p-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-wider opacity-60">Net worth</div>
          <div className="text-lg font-bold">{formatINR(netWorth, { compact: true })}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider opacity-60">Cashflow / mo</div>
          <div className={`text-lg font-bold ${cashflow >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {cashflow >= 0 ? '+' : ''}{formatINR(cashflow, { compact: true })}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider opacity-60">Passive / Expenses</div>
          <div className={`text-lg font-bold ${passiveCoverage >= 1 ? 'text-emerald-300' : 'text-amber-200'}`}>
            {(passiveCoverage * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Income & Expenses (top half) */}
      <div className="grid md:grid-cols-2 gap-3">
        <Quadrant title="INCOME" subtitle="Monthly" color="emerald" total={totalIncome}>
          <LedgerRow label="Salary" value={monthlySalary} />
          {monthlyFreelance > 0 && <LedgerRow label="Freelance / side hustle" value={monthlyFreelance} />}
          <LedgerSubhead>Passive</LedgerSubhead>
          {yieldByKind.rent > 0 && <LedgerRow label="Rental income" value={yieldByKind.rent} indent />}
          {yieldByKind.dividend > 0 && <LedgerRow label="Dividends" value={yieldByKind.dividend} indent />}
          {yieldByKind.interest > 0 && <LedgerRow label="Interest / yield" value={yieldByKind.interest} indent />}
          {totalPassive === 0 && <LedgerRow label="(none yet)" value={0} indent muted />}
        </Quadrant>

        <Quadrant title="EXPENSES" subtitle="Monthly" color="rose" total={totalExpenses}>
          {state.expenses
            .filter((e) => e.monthlyAmount > 0)
            .map((e, i) => (
              <LedgerRow key={i} label={prettyExpense(e.category, e.label)} value={e.monthlyAmount} />
            ))}
          {totalEMI > 0 && (
            <>
              <LedgerSubhead>Loan EMIs</LedgerSubhead>
              {state.liabilities.map((l) => (
                <LedgerRow key={l.id} label={l.label} value={l.emi} indent />
              ))}
            </>
          )}
          {totalPremium > 0 && (
            <>
              <LedgerSubhead>Insurance</LedgerSubhead>
              {state.insurance.map((p) => (
                <LedgerRow key={p.id} label={p.label} value={p.monthlyPremium} indent />
              ))}
            </>
          )}
        </Quadrant>
      </div>

      {/* Assets & Liabilities (bottom half) */}
      <div className="grid md:grid-cols-2 gap-3">
        <Quadrant title="ASSETS" subtitle="Current value" color="sky" total={totalAssets}>
          <LedgerRow label="Cash on hand" value={state.cashOnHand} />
          {Object.entries(assetGroups).map(([group, items]) => {
            const groupTotal = items.reduce((s, x) => s + x.value, 0);
            return (
              <div key={group}>
                <LedgerSubhead>{group} <span className="text-slate-400 font-normal">({formatINR(groupTotal, { compact: true })})</span></LedgerSubhead>
                {items.map((x, i) => (
                  <LedgerRow key={i} label={x.label} value={x.value} indent />
                ))}
              </div>
            );
          })}
          {Object.keys(assetGroups).length === 0 && (
            <LedgerRow label="(no investments yet — draw deal cards!)" value={0} muted />
          )}
        </Quadrant>

        <Quadrant title="LIABILITIES" subtitle="Outstanding principal" color="orange" total={totalLiab}>
          {state.liabilities.length === 0 && <LedgerRow label="🎉 Debt-free" value={0} muted />}
          {state.liabilities.map((l) => (
            <div key={l.id}>
              <LedgerRow label={l.label} value={l.principalOutstanding} />
              <div className="text-[10px] text-slate-500 -mt-0.5 ml-1">
                {(l.rateAnnual * 100).toFixed(1)}% · {l.remainingMonths}mo · EMI {formatINR(l.emi)}
              </div>
            </div>
          ))}
        </Quadrant>
      </div>

      {/* Balance proof */}
      <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 text-center text-sm font-mono">
        <div className="text-slate-500 text-xs">Assets &minus; Liabilities = Net Worth</div>
        <div className="font-bold text-slate-900 mt-1">
          {formatINR(totalAssets, { compact: true })} &minus; {formatINR(totalLiab, { compact: true })} ={' '}
          <span className={netWorth >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
            {formatINR(netWorth, { compact: true })}
          </span>
        </div>
      </div>
    </div>
  );
}

function assetGroup(kind: string): string {
  if (kind.startsWith('real_estate') || kind === 'reit') return 'Real Estate';
  if (kind === 'stocks' || kind === 'index_fund' || kind === 'active_mf' || kind === 'business_equity') return 'Equity';
  if (kind === 'gold') return 'Gold';
  if (kind === 'fd' || kind === 'savings' || kind === 'ppf' || kind === 'nps') return 'Fixed Income';
  if (kind === 'crypto') return 'Crypto';
  return 'Other';
}

function prettyExpense(category: string, label: string): string {
  const cat = category.replace(/_/g, ' ');
  if (label.toLowerCase() === cat.toLowerCase()) return cat;
  return `${cat} — ${label}`;
}

function Quadrant({
  title,
  subtitle,
  color,
  total,
  children,
}: {
  title: string;
  subtitle: string;
  color: 'emerald' | 'rose' | 'sky' | 'orange';
  total: number;
  children: React.ReactNode;
}) {
  const colorMap = {
    emerald: { head: 'bg-emerald-700 text-white', total: 'text-emerald-700 border-emerald-300' },
    rose: { head: 'bg-rose-700 text-white', total: 'text-rose-700 border-rose-300' },
    sky: { head: 'bg-sky-700 text-white', total: 'text-sky-700 border-sky-300' },
    orange: { head: 'bg-orange-700 text-white', total: 'text-orange-700 border-orange-300' },
  };
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
      <div className={`${colorMap[color].head} px-3 py-1.5 flex items-baseline justify-between`}>
        <span className="font-bold text-sm tracking-wider">{title}</span>
        <span className="text-[10px] uppercase tracking-wider opacity-80">{subtitle}</span>
      </div>
      <div className="p-3 space-y-0.5 text-sm">{children}</div>
      <div className={`px-3 py-2 border-t-2 ${colorMap[color].total} flex justify-between font-bold text-sm bg-slate-50`}>
        <span>TOTAL</span>
        <span className="font-mono">{formatINR(total)}</span>
      </div>
    </div>
  );
}

function LedgerRow({ label, value, indent, muted }: { label: string; value: number; indent?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${indent ? 'ml-3' : ''} ${muted ? 'text-slate-400 italic' : 'text-slate-700'}`}>
      <span className="truncate pr-2">{label}</span>
      <span className="font-mono whitespace-nowrap">{value === 0 ? '—' : formatINR(value)}</span>
    </div>
  );
}

function LedgerSubhead({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-1.5 mb-0.5">{children}</div>;
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

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-bold border-t pt-1 mt-1' : ''}`}>
      <span className="text-slate-700">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
