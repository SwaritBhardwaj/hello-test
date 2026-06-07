import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, DAYS_IN_MONTH, BANKRUPTCY_GRACE_MONTHS, trailingNegativeCashMonths } from './store';
import { formatINR } from '@/utils/money';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { LOAN_RATES } from '@/data/constants';
import { buildLoan } from '@/modules/loans/loans';
import { PROFESSIONS, startingSalary } from '@/modules/player/career';
import { pickLesson } from '@/modules/coach/wisdom';
import type { Card, TileType } from '@/modules/cards/cards';
import { TILE_META } from '@/modules/cards/cards';
import type { ProfessionId, Loan, Asset, LoanKind } from '@/types';
import { Die } from './art/Die';
import { Coin, Pawn } from './art/Pieces';
import { CoachMascot } from './art/Coach';
import { useCoachStyle } from './coachStyle';
import { MoneyCount, PercentCount } from './fx/CountUp';
import { Confetti } from './fx/Confetti';
import { play } from './sound/sound';
import { useMute } from './sound/useSound';
import { useProgression } from './progression';
import { rankFor } from '@/modules/progression/titles';
import { achievementById, type Achievement } from '@/modules/progression/achievements';
import type { RunScore } from '@/modules/progression/score';
import { loadGhost, bestEscape } from '@/modules/progression/storage';

function rollRandomCharacter(): {
  age: number;
  profession: ProfessionId;
  city: 'T1' | 'T2' | 'T3';
  family: 'single' | 'married' | 'married_with_kids';
} {
  const r = Math.random;
  const professionIds = Object.keys(PROFESSIONS) as ProfessionId[];
  const profession = professionIds[Math.floor(r() * professionIds.length)];
  const ageBands: Record<ProfessionId, [number, number]> = {
    sde: [23, 38], product_manager: [26, 42], doctor: [28, 50], teacher: [24, 50],
    ca: [25, 45], designer: [23, 40], sales: [24, 48], govt_clerk: [23, 55], founder: [27, 45],
  };
  const [aMin, aMax] = ageBands[profession];
  const age = aMin + Math.floor(r() * (aMax - aMin + 1));
  const cityRoll = r();
  const city: 'T1' | 'T2' | 'T3' = cityRoll < 0.5 ? 'T1' : cityRoll < 0.8 ? 'T2' : 'T3';
  let family: 'single' | 'married' | 'married_with_kids';
  if (age < 27) family = r() < 0.85 ? 'single' : 'married';
  else if (age < 32) family = r() < 0.45 ? 'single' : r() < 0.7 ? 'married' : 'married_with_kids';
  else family = r() < 0.2 ? 'single' : r() < 0.5 ? 'married' : 'married_with_kids';
  return { age, profession, city, family };
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
    play('dice');
    const c = rollRandomCharacter();
    setAge(c.age);
    setProfession(c.profession);
    setCity(c.city);
    setFamily(c.family);
    setMode('random');
  }

  function start() {
    play('click');
    initGame({ seed: Math.floor(Math.random() * 1e9), playerName: name, age, profession, city, family });
  }

  return (
    <div className="min-h-[100dvh] felt-table flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className="paper w-full max-w-md rounded-game shadow-card ring-4 ring-brass/40 overflow-hidden"
      >
        <div className="bg-wood-700 px-6 py-5 flex items-center gap-3 border-b-4 border-brass/50">
          <Die value={5} size={44} />
          <div>
            <h1 className="font-display text-2xl text-card leading-none">Cashflow Reborn</h1>
            <p className="text-xs text-brass-100/80 mt-1">A board game about life &amp; money</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {mode === 'menu' && (
            <div className="space-y-3">
              <PrimaryButton onClick={rollRandom} className="w-full">
                <span className="flex items-center justify-center gap-2"><Die value={3} size={22} /> Roll random circumstances</span>
                <span className="block text-2xs font-normal opacity-80 mt-1">You pick the name; the dice pick age, job, city &amp; family</span>
              </PrimaryButton>
              <button
                onClick={() => { play('click'); setMode('custom'); }}
                className="btn-3d w-full bg-card text-ink px-4 py-3 text-base"
              >
                Customise my character
                <span className="block text-2xs font-normal text-ink-soft mt-0.5">Pick every detail yourself</span>
              </button>
            </div>
          )}

          {mode === 'random' && (
            <>
              <Field label="Your name">
                <TextInput value={name} onChange={setName} placeholder="e.g. Swarit" autoFocus />
              </Field>
              <div className="rounded-xl bg-income-soft border border-income/30 p-3 text-sm space-y-1">
                <div className="font-display text-income-ink">The hand life dealt</div>
                <div className="text-ink-soft">
                  {age} years old, a <b className="text-ink">{PROFESSIONS[profession].label}</b> in <b className="text-ink">{city}</b>
                  {family === 'single' ? ', single' : family === 'married' ? ', married' : ', married with kids'}.
                </div>
                <div className="text-ink-soft text-xs flex items-center gap-1">
                  Monthly salary <Coin size={14} /> <b className="text-ink tnum">{formatINR(monthlySalary)}</b> ({yoe} yrs exp)
                </div>
                <button className="text-xs text-income-ink underline mt-1" onClick={rollRandom}>Reroll circumstances</button>
              </div>
            </>
          )}

          {mode === 'custom' && (
            <div className="space-y-3">
              <Field label="Name"><TextInput value={name} onChange={setName} /></Field>
              <Field label="Age">
                <input type="number" className="w-full rounded-lg border border-card-edge p-2 tnum" value={age} onChange={(e) => setAge(+e.target.value)} />
              </Field>
              <Field label="Profession">
                <Select value={profession} onChange={(v) => setProfession(v as ProfessionId)}>
                  {(Object.keys(PROFESSIONS) as ProfessionId[]).map((p) => <option key={p} value={p}>{PROFESSIONS[p].label}</option>)}
                </Select>
              </Field>
              <Field label="City tier">
                <Select value={city} onChange={(v) => setCity(v as 'T1' | 'T2' | 'T3')}>
                  <option value="T1">T1 (Mumbai / Delhi / BLR)</option>
                  <option value="T2">T2 (Pune / Jaipur / Indore)</option>
                  <option value="T3">T3 (smaller cities)</option>
                </Select>
              </Field>
              <Field label="Family">
                <Select value={family} onChange={(v) => setFamily(v as typeof family)}>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="married_with_kids">Married + kids</option>
                </Select>
              </Field>
              <div className="text-xs text-ink-soft flex items-center gap-1">
                Starting salary <Coin size={13} /> <b className="text-ink tnum">{formatINR(monthlySalary)}/mo</b>
              </div>
            </div>
          )}

          {mode !== 'menu' && (
            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => setMode('menu')} className="text-xs text-ink-faint hover:text-ink px-2 py-2">← back</button>
              <PrimaryButton onClick={start} disabled={!name.trim()} className="flex-1">▶ Start game</PrimaryButton>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================
// Main board
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
  const cellTypes = useGameStore((s) => s.cellTypes);
  const currentCard = useGameStore((s) => s.currentCard);
  const gameStatus = useGameStore((s) => s.gameStatus);
  const outcomeDismissed = useGameStore((s) => s.outcomeDismissed);
  const decisionLog = useGameStore((s) => s.decisionLog);
  const syncProgress = useProgression((s) => s.sync);
  const finishRun = useProgression((s) => s.finishRun);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rolling, setRolling] = useState(false);

  const chartData = state.history.map((h) => ({ tick: h.tick, netWorth: h.netWorth, cash: h.cashOnHand }));
  const month = state.meta.tick;
  const years = Math.floor(month / 12);
  const monthsIntoYear = month % 12;
  const passiveCoverage = state.statement.totalExpenses ? state.statement.passiveIncome / state.statement.totalExpenses : 0;
  const negMonths = trailingNegativeCashMonths(state);
  const monthsToBankruptcy = Math.max(0, BANKRUPTCY_GRACE_MONTHS - negMonths);
  const showOutcomeModal = gameStatus !== 'playing' && !outcomeDismissed;

  // Sound cues
  useEffect(() => { if (currentCard) play('card'); }, [currentCard]);
  useEffect(() => { if (gameStatus === 'won') play('win'); if (gameStatus === 'lost') play('lose'); }, [gameStatus]);

  // Progression: unlock achievements as state evolves; record the run on finish.
  useEffect(() => { syncProgress(state, decisionLog); }, [state, decisionLog, syncProgress]);
  useEffect(() => {
    if (gameStatus !== 'playing') finishRun(state, decisionLog, gameStatus === 'won');
  }, [gameStatus, state, decisionLog, finishRun]);

  function handleRoll() {
    if (currentCard || rolling) return;
    play('dice');
    setRolling(true);
    setTimeout(() => { rollDice(); setRolling(false); }, 580);
  }

  return (
    <div className="min-h-[100dvh] felt-table pb-24 sm:pb-6">
      {gameStatus === 'won' && !outcomeDismissed && <Confetti />}
      <AchievementToasts />
      <div className="mx-auto max-w-5xl px-3 sm:px-5 py-3 sm:py-4 space-y-3">
        {/* HUD bar — identity + money pills + controls, edge-docked & high-contrast */}
        <header className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Pawn size={26} />
            <div className="min-w-0">
              <div className="font-display text-base sm:text-lg text-card leading-none truncate">{state.player.name}</div>
              <div className="mt-0.5"><LevelBadge /></div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 order-3 sm:order-2 w-full sm:w-auto justify-between sm:justify-end mt-1 sm:mt-0">
            <MoneyPill label="Net worth" value={state.statement.netWorth} tone={state.statement.netWorth >= 0 ? 'income' : 'expense'} />
            <MoneyPill label="Cash" value={state.cashOnHand} coin tone={state.cashOnHand < 0 ? 'expense' : 'brass'} />
            <MoneyPill label="Cashflow" value={state.statement.totalIncome - state.statement.totalExpenses} signed tone={state.statement.totalIncome - state.statement.totalExpenses >= 0 ? 'income' : 'expense'} />
          </div>
          <div className="flex items-center gap-1.5 order-2 sm:order-3">
            <CoachStyleToggle />
            <MuteToggle />
            <CoachToggle />
            <button onClick={() => { play('click'); setSheetOpen(true); }} className="btn-3d bg-brass-500 enabled:hover:bg-brass-600 text-wood-900 px-3 py-1.5 text-sm whitespace-nowrap">
              <span className="hidden sm:inline">Balance sheet</span><span className="sm:hidden">Sheet</span>
            </button>
            <div className="relative">
              <button onClick={() => setMenuOpen((o) => !o)} className="rounded-xl bg-felt-700 hover:bg-felt-600 text-card px-3 py-2 text-sm shadow-piece transition active:scale-95" aria-label="More actions">⋯</button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 mt-2 w-44 paper rounded-xl shadow-card ring-1 ring-card-edge z-30 overflow-hidden">
                    <MenuItem onClick={() => { ff(12); setMenuOpen(false); }}>⏩ Skip 1 year</MenuItem>
                    <MenuItem onClick={() => { ff(60); setMenuOpen(false); }}>⏩ Skip 5 years</MenuItem>
                    <MenuItem danger onClick={() => { reset(); setMenuOpen(false); }}>⟲ New game</MenuItem>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {negMonths > 0 && gameStatus === 'playing' && (
          <BankruptcyWarning monthsNegative={negMonths} monthsToBankruptcy={monthsToBankruptcy} cashOnHand={state.cashOnHand} />
        )}

        {/* The board — the hero of the screen */}
        <BoardPanel
          dayPosition={dayPosition} cardCells={cardCells} cellTypes={cellTypes} lastRoll={lastRoll} rolling={rolling}
          canRoll={!currentCard && !rolling} onRoll={handleRoll}
          coverage={passiveCoverage} won={gameStatus === 'won'} phase={state.market.phase}
          year={years} month={monthsIntoYear + 1}
          passive={state.statement.passiveIncome} expenses={state.statement.totalExpenses}
        />

        <CoachInsight />

        <HistoryPanel data={chartData} notes={notes} />
      </div>

      {/* Sticky mobile roll bar */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-30 bg-felt-900/95 backdrop-blur border-t-2 border-brass/40 px-4 pt-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <button
          onClick={handleRoll} disabled={!!currentCard || rolling}
          className="btn-3d w-full bg-brass-500 enabled:hover:bg-brass-600 text-wood-900 text-lg py-3 flex items-center justify-center gap-2"
        >
          <Die value={lastRoll ?? 6} rolling={rolling} size={30} /> {rolling ? 'Rolling…' : 'ROLL THE DICE'}
        </button>
      </div>

      <AnimatePresence>{currentCard && <CardModal key="card" card={currentCard} />}</AnimatePresence>
      <AnimatePresence>{sheetOpen && <BalanceSheet key="sheet" onClose={() => setSheetOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{showOutcomeModal && <OutcomeModal key="outcome" status={gameStatus} />}</AnimatePresence>
    </div>
  );
}

// ============================================================
// Board panel — oval racetrack (sm+) + compact path (mobile)
// ============================================================
// Bright Cashflow-style tiles: saturated fill, bold dark outline, dark labels.
const TILE_STYLE: Record<TileType, { chip: string; text: string }> = {
  deal: { chip: 'bg-[oklch(0.76_0.17_150)]', text: 'text-[oklch(0.22_0.05_150)]' },
  temptation: { chip: 'bg-[oklch(0.66_0.20_28)]', text: 'text-[oklch(0.99_0.02_28)]' },
  market: { chip: 'bg-[oklch(0.68_0.14_245)]', text: 'text-[oklch(0.99_0.01_245)]' },
  chance: { chip: 'bg-[oklch(0.74_0.13_195)]', text: 'text-[oklch(0.22_0.05_195)]' },
  payday: { chip: 'bg-[oklch(0.85_0.16_92)]', text: 'text-[oklch(0.30_0.06_70)]' },
};
const TILE_OUTLINE = 'ring-2 ring-[oklch(0.30_0.04_50)]';

interface BoardProps {
  dayPosition: number; cardCells: number[]; cellTypes: Record<number, TileType>;
  lastRoll: number | null; rolling: boolean; canRoll: boolean; onRoll: () => void;
  coverage: number; won: boolean; phase: string; year: number; month: number;
  passive: number; expenses: number;
}

function BoardPanel(props: BoardProps) {
  const { dayPosition, cardCells, cellTypes, year, month, phase } = props;
  const cardSet = useMemo(() => new Set(cardCells), [cardCells]);
  const nextCardDay = useMemo(() => cardCells.filter((c) => c > dayPosition).sort((a, b) => a - b)[0], [cardCells, dayPosition]);
  const nextType = nextCardDay != null ? cellTypes[nextCardDay] : undefined;

  return (
    <section className="board-cream rounded-game p-3 sm:p-5 relative">
      <div className="flex items-center justify-between px-1 mb-2">
        <div className="font-display text-ink text-base sm:text-lg">Month {year * 12 + month}<span className="text-ink-soft text-sm font-sans"> · day {dayPosition}/{DAYS_IN_MONTH}</span></div>
        <div className="text-xs uppercase tracking-widest text-ink font-display font-semibold capitalize">{phase} market</div>
      </div>

      {/* Oval racetrack — desktop / tablet */}
      <OvalBoard {...props} cardSet={cardSet} nextType={nextType} />

      {/* Compact path — mobile */}
      <PathBoard {...props} cardSet={cardSet} nextType={nextType} />
    </section>
  );
}

function OvalBoard({ dayPosition, cellTypes, lastRoll, rolling, canRoll, onRoll, coverage, won, passive, expenses, cardSet, nextType }: BoardProps & { cardSet: Set<number>; nextType?: TileType }) {
  return (
    <div className="hidden sm:block relative w-full" style={{ aspectRatio: '1.5 / 1' }}>
      {/* printed track ellipse — dark line on cream */}
      <svg viewBox="0 0 100 67" className="absolute inset-0 w-full h-full" preserveAspectRatio="none" aria-hidden>
        <ellipse cx="50" cy="33.5" rx="45" ry="29" fill="none" stroke="oklch(0.34 0.04 50)" strokeWidth="3" />
        <ellipse cx="50" cy="33.5" rx="45" ry="29" fill="none" stroke="oklch(0.88 0.06 88)" strokeWidth="1.4" strokeDasharray="0.4 2.2" />
      </svg>
      {Array.from({ length: DAYS_IN_MONTH + 1 }, (_, day) => {
        const angle = -90 + (day / (DAYS_IN_MONTH + 1)) * 360;
        const rad = (angle * Math.PI) / 180;
        const x = 50 + 45 * Math.cos(rad);
        const y = 50 + 45 * Math.sin(rad);
        const isHere = day === dayPosition;
        const isCard = cardSet.has(day);
        const isEnd = day === DAYS_IN_MONTH;
        const isStart = day === 0;
        const type = cellTypes[day];
        return (
          <div key={day} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
            {isHere && (
              <motion.div layoutId="pawn-oval" transition={{ type: 'spring', stiffness: 460, damping: 28 }} className="absolute left-1/2 -translate-x-1/2 -top-7 z-20">
                <div className="animate-token-bob"><Pawn size={30} /></div>
              </motion.div>
            )}
            {isEnd ? <CornerTile label="FREE" glyph="★" gold />
              : isStart ? <CornerTile label="START" glyph="▶" />
              : isCard && type ? <BoardTile type={type} />
              : <div className="h-2.5 w-2.5 rounded-full bg-[oklch(0.34_0.04_50)]" />}
          </div>
        );
      })}
      {/* Center medallion — the goal lives here */}
      <div className="absolute inset-0 grid place-items-center">
        <Medallion coverage={coverage} won={won} passive={passive} expenses={expenses}
          lastRoll={lastRoll} rolling={rolling} canRoll={canRoll} onRoll={onRoll} nextType={nextType} />
      </div>
    </div>
  );
}

function PathBoard({ dayPosition, cellTypes, lastRoll, rolling, canRoll, onRoll, coverage, won, passive, expenses, cardSet, nextType }: BoardProps & { cardSet: Set<number>; nextType?: TileType }) {
  return (
    <div className="sm:hidden space-y-3">
      <Medallion coverage={coverage} won={won} passive={passive} expenses={expenses}
        lastRoll={lastRoll} rolling={rolling} canRoll={canRoll} onRoll={onRoll} nextType={nextType} compact />
      <div className="rounded-tile bg-[oklch(0.90_0.03_86)] ring-2 ring-[oklch(0.34_0.04_50)] p-2.5 flex flex-wrap gap-1.5 justify-center">
        {Array.from({ length: DAYS_IN_MONTH + 1 }, (_, day) => {
          const isHere = day === dayPosition;
          const isCard = cardSet.has(day);
          const isEnd = day === DAYS_IN_MONTH;
          const type = cellTypes[day];
          return (
            <div key={day} className="relative h-7 w-7 grid place-items-center">
              {isHere && (
                <motion.div layoutId="pawn-strip" transition={{ type: 'spring', stiffness: 460, damping: 28 }} className="absolute -top-3.5 z-10">
                  <div className="animate-token-bob"><Pawn size={22} /></div>
                </motion.div>
              )}
              {isEnd ? <div className="h-6 w-6 grid place-items-center rounded-md bg-brass-500 ring-2 ring-[oklch(0.30_0.04_50)] text-wood-900 text-2xs font-bold">★</div>
                : isCard && type ? <div className={`h-6 w-6 grid place-items-center rounded-md ${TILE_STYLE[type].chip} ${TILE_STYLE[type].text} ${TILE_OUTLINE}`}><TileGlyph type={type} small /></div>
                : <div className="h-2 w-2 rounded-full bg-[oklch(0.34_0.04_50)]" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BoardTile({ type }: { type: TileType }) {
  return (
    <div className={`grid place-items-center h-11 w-11 rounded-lg shadow-piece ${TILE_STYLE[type].chip} ${TILE_STYLE[type].text} ${TILE_OUTLINE}`}>
      <TileGlyph type={type} />
      <span className="font-display font-bold leading-none" style={{ fontSize: 9 }}>{TILE_META[type].short}</span>
    </div>
  );
}

function CornerTile({ label, glyph, gold }: { label: string; glyph: string; gold?: boolean }) {
  return (
    <div className={`grid place-items-center h-12 w-12 rounded-lg shadow-piece ${TILE_OUTLINE} ${gold ? 'bg-brass-500 text-wood-900' : 'bg-card text-wood-900'}`}>
      <span className="leading-none text-lg">{glyph}</span>
      <span className="font-display font-bold leading-none" style={{ fontSize: 8 }}>{label}</span>
    </div>
  );
}

function TileGlyph({ type, small }: { type: TileType; small?: boolean }) {
  const s = small ? 12 : 16;
  if (type === 'deal' || type === 'payday') return <Coin size={s} />;
  const letter = type === 'temptation' ? '♥' : type === 'market' ? '✦' : '?';
  return <span className="font-display font-bold leading-none" style={{ fontSize: small ? 12 : 16 }}>{letter}</span>;
}

/** The center medallion — a clickable dice wrapped by the freedom-goal ring. */
function Medallion({ coverage, won, passive, expenses, lastRoll, rolling, canRoll, onRoll, nextType, compact }: {
  coverage: number; won: boolean; passive: number; expenses: number;
  lastRoll: number | null; rolling: boolean; canRoll: boolean; onRoll: () => void; nextType?: TileType; compact?: boolean;
}) {
  const pct = Math.min(100, coverage * 100);
  return (
    <div className="relative grid place-items-center" style={{ width: compact ? 230 : 260 }}>
      <FreedomRing pct={pct} won={won} size={compact ? 224 : 256}>
        <div className="flex flex-col items-center gap-1">
          <div className="text-xs uppercase tracking-widest font-display font-bold text-brass-300">{won ? '★ Free!' : 'Freedom'}</div>
          <div className={`font-display leading-none font-bold ${won ? 'text-brass-300' : 'text-card'}`} style={{ fontSize: 40 }}><PercentCount value={pct} /></div>
          {/* The dice IS the roll button — big, obvious, clickable */}
          <button onClick={onRoll} disabled={!canRoll} aria-label="Roll the dice"
            className="group mt-0.5 grid place-items-center disabled:opacity-60 enabled:hover:scale-105 enabled:active:scale-95 transition-transform">
            <Die value={lastRoll ?? 1} rolling={rolling} size={compact ? 50 : 58} />
            <span className="mt-1.5 inline-block btn-3d bg-brass-500 text-wood-900 text-sm px-5 py-1.5 group-enabled:group-hover:bg-brass-600">{rolling ? 'Rolling…' : 'TAP TO ROLL'}</span>
          </button>
          {nextType && <div className="text-xs text-brass-300 font-semibold mt-1">next: <span className="font-display text-card">{TILE_META[nextType].label}</span></div>}
        </div>
      </FreedomRing>
      <div className="mt-1.5 text-xs tnum flex items-center gap-1.5 font-semibold">
        <span className="text-income-ink">passive {formatINR(passive, { compact: true })}</span>
        <span className="text-ink-soft">/</span>
        <span className="text-expense-ink">exp {formatINR(expenses, { compact: true })}</span>
      </div>
    </div>
  );
}

/** Circular progress ring around the medallion — the win condition, made central. */
function FreedomRing({ pct, won, size, children }: { pct: number; won: boolean; size: number; children: React.ReactNode }) {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const color = won ? 'oklch(0.82 0.13 88)' : pct >= 75 ? 'oklch(0.74 0.17 150)' : pct >= 40 ? 'oklch(0.82 0.16 92)' : 'oklch(0.70 0.16 50)';
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="oklch(0.30 0.04 158)" strokeWidth="10" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} initial={false} animate={{ strokeDashoffset: c - (Math.min(100, pct) / 100) * c }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }} />
        {[0, 25, 50, 75].map((m) => {
          const a = (m / 100) * 2 * Math.PI;
          return <circle key={m} cx={size / 2 + r * Math.cos(a)} cy={size / 2 + r * Math.sin(a)} r="2.5" fill="oklch(0.95 0.04 88)" />;
        })}
      </svg>
      <div className="rounded-full grid place-items-center" style={{ width: size - 30, height: size - 30, background: 'radial-gradient(circle at 50% 35%, oklch(0.30 0.055 158), oklch(0.22 0.045 158))', boxShadow: 'inset 0 2px 10px oklch(0 0 0 / 0.5), 0 0 0 3px oklch(0.34 0.04 50)' }}>{children}</div>
    </div>
  );
}

// ============================================================
// HUD money pill + history panel
// ============================================================
function MoneyPill({ label, value, coin, signed, tone }: { label: string; value: number; coin?: boolean; signed?: boolean; tone: 'income' | 'expense' | 'brass' }) {
  const text = tone === 'income' ? 'text-income-ink' : tone === 'expense' ? 'text-expense-ink' : 'text-wood-900';
  return (
    <div className="paper rounded-xl shadow-piece px-2.5 py-1.5 flex items-center gap-1.5 min-w-0">
      {coin && <Coin size={18} />}
      <div className="min-w-0">
        <div className="text-2xs uppercase tracking-wider text-ink-soft leading-none font-semibold">{label}</div>
        <div className={`font-display text-sm sm:text-base leading-tight ${text}`}>
          {signed && value >= 0 ? '+' : ''}<MoneyCount value={value} compact />
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({ data, notes }: { data: { tick: number; netWorth: number; cash: number }[]; notes: string[] }) {
  const [tab, setTab] = useState<'chart' | 'log'>('chart');
  return (
    <section className="paper rounded-game shadow-card ring-1 ring-card-edge overflow-hidden">
      <div className="flex border-b border-card-edge">
        {(['chart', 'log'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 font-display text-sm transition ${tab === t ? 'text-income-ink border-b-2 border-income bg-income-soft/40' : 'text-ink-soft font-semibold hover:bg-card-edge/40'}`}>
            {t === 'chart' ? 'Net worth' : 'Game log'}
          </button>
        ))}
      </div>
      <div className="p-3 sm:p-4">
        {tab === 'chart' ? <ChartBody data={data} /> : <LogBody notes={notes} />}
      </div>
    </section>
  );
}

// ============================================================
// Bankruptcy warning
// ============================================================
function BankruptcyWarning({ monthsNegative, monthsToBankruptcy, cashOnHand }: { monthsNegative: number; monthsToBankruptcy: number; cashOnHand: number }) {
  const dangerPct = (monthsNegative / BANKRUPTCY_GRACE_MONTHS) * 100;
  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-game p-3 sm:p-4 shadow-card ring-2 ring-expense animate-danger-pulse text-card"
      style={{ background: 'linear-gradient(135deg, oklch(0.40 0.15 26), oklch(0.30 0.12 24))' }}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="min-w-0">
          <div className="font-display text-base">⚠ Cash overdrawn</div>
          <div className="text-2xs opacity-90 tnum">{formatINR(cashOnHand, { compact: true })} in the red · month {monthsNegative} of {BANKRUPTCY_GRACE_MONTHS}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-2xl tnum">{monthsToBankruptcy}</div>
          <div className="text-2xs uppercase tracking-wider opacity-90">months left</div>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-card/20 overflow-hidden">
        <div className="h-full bg-card/80" style={{ width: `${dangerPct}%` }} />
      </div>
      <div className="text-2xs mt-1.5 opacity-90">Sell assets, clear high-rate debt, or cut expenses. Fast.</div>
    </motion.section>
  );
}

// ============================================================
// Coach insight
// ============================================================
function CoachInsight() {
  const coachMode = useGameStore((s) => s.coachMode);
  const state = useGameStore((s) => s.state);
  const log = useGameStore((s) => s.decisionLog);
  const [open, setOpen] = useState(false);

  // Pure function of (state, log): the pick is stable within a render, so this
  // can never loop. (It used to feed a "recently shown" list back into itself,
  // which white-screened the app once >6 lessons applied. See wisdom.ts.)
  const picked = useMemo(() => {
    if (!coachMode || !state) return null;
    return pickLesson(state, log);
  }, [coachMode, state, log]);

  if (!coachMode || !picked) return null;
  const { lesson } = picked;
  const mood = lesson.tag === 'debt' || lesson.tag === 'risk' ? 'worried' : 'happy';

  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="paper rounded-game shadow-card ring-1 ring-card-edge overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left">
        <div className="shrink-0"><CoachMascot mood={mood} size={30} /></div>
        <div className="min-w-0 flex-1">
          <div className="text-2xs uppercase tracking-widest font-display text-brass-600">Coach</div>
          <div className="text-sm text-ink leading-snug line-clamp-2">{lesson.lesson}</div>
        </div>
        <span className={`shrink-0 text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-3 pb-3 pt-1 border-t border-card-edge">
              <div className="text-sm italic text-ink leading-snug">"{lesson.quote}"</div>
              <div className="mt-1.5 text-xs text-ink-soft font-medium">— {lesson.attribution}{lesson.book ? ` · ${lesson.book}` : ''}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

// ============================================================
// Header toggles
// ============================================================
function CoachToggle() {
  const coachMode = useGameStore((s) => s.coachMode);
  const toggle = useGameStore((s) => s.toggleCoachMode);
  return (
    <button
      onClick={() => { play('click'); toggle(); }}
      title="Teaching mode — explanations on every card"
      className={`rounded-xl px-2.5 py-2 text-sm shadow-piece transition active:scale-95 flex items-center gap-1.5 font-display font-semibold ${coachMode ? 'bg-income text-card ring-2 ring-income' : 'bg-felt-700 text-card ring-1 ring-card/20'}`}
    >
      <CoachMascot mood="happy" size={18} /><span className="hidden sm:inline font-display">{coachMode ? 'Coach on' : 'Coach off'}</span>
    </button>
  );
}

function CoachStyleToggle() {
  const [style, toggle] = useCoachStyle();
  return (
    <button onClick={() => { play('click'); toggle(); }} title={`Coach look: ${style} (tap to switch)`} className="rounded-xl bg-felt-700 hover:bg-felt-600 px-2 py-1.5 shadow-piece transition active:scale-95 grid place-items-center" aria-label="Switch coach look">
      <CoachMascot mood="happy" size={22} />
    </button>
  );
}

function MuteToggle() {
  const [muted, toggle] = useMute();
  return (
    <button onClick={toggle} title={muted ? 'Unmute' : 'Mute'} className="rounded-xl bg-felt-700 hover:bg-felt-600 text-card px-2.5 py-2 text-sm shadow-piece transition active:scale-95" aria-label={muted ? 'Unmute' : 'Mute'}>
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={() => { play('click'); onClick(); }} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-card-edge transition ${danger ? 'text-expense-ink' : 'text-ink'}`}>{children}</button>
  );
}

// ============================================================
// Progression UI — level badge, achievement toasts
// ============================================================
function LevelBadge() {
  const state = useGameStore((s) => s.state)!;
  const { rank, next, progress } = rankFor(state);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-felt-900/60 ring-1 ring-brass/40 pl-1 pr-2 py-0.5" title={next ? `${Math.round(progress * 100)}% to ${next.label}` : 'Top rank'}>
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brass-500 text-wood-900 text-[9px] font-bold">{rank.index + 1}</span>
      <span className="text-card font-display text-xs font-semibold whitespace-nowrap">{rank.label}</span>
    </span>
  );
}

function AchievementIcon({ icon, size = 22 }: { icon: Achievement['icon']; size?: number }) {
  if (icon === 'coin') return <Coin size={size} />;
  if (icon === 'pawn') return <Pawn size={size} />;
  if (icon === 'die') return <Die value={5} size={size} />;
  // star / shield — simple brass glyphs
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-hidden className="shrink-0">
      {icon === 'star'
        ? <path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" fill="oklch(0.82 0.11 84)" stroke="oklch(0.62 0.12 78)" strokeWidth="1" strokeLinejoin="round" />
        : <path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z" fill="oklch(0.82 0.11 84)" stroke="oklch(0.62 0.12 78)" strokeWidth="1" strokeLinejoin="round" />}
    </svg>
  );
}

function AchievementToasts() {
  const toasts = useProgression((s) => s.toasts);
  const dismiss = useProgression((s) => s.dismissToast);
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[70] w-[min(92vw,22rem)] space-y-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const ach = achievementById(t.achievementId);
          if (!ach) return null;
          return (
            <motion.div
              key={t.uid}
              initial={{ opacity: 0, y: -24, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              onAnimationComplete={() => setTimeout(() => dismiss(t.uid), 3400)}
              className="pointer-events-auto paper rounded-game shadow-card ring-2 ring-brass/60 px-3 py-2 flex items-center gap-3"
            >
              <div className="shrink-0 animate-coin-pop"><AchievementIcon icon={ach.icon} size={28} /></div>
              <div className="min-w-0">
                <div className="text-2xs uppercase tracking-widest text-brass-600 font-display">Achievement unlocked</div>
                <div className="font-display text-ink leading-tight">{ach.label}</div>
                <div className="text-2xs text-ink-soft truncate">{ach.description}</div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Chart + log bodies (inside HistoryPanel tabs)
// ============================================================
function ChartBody({ data }: { data: { tick: number; netWorth: number; cash: number }[] }) {
  const ghost = useMemo(() => loadGhost(), []);
  const merged = useMemo(() => {
    if (!ghost) return data;
    const byTick = new Map(ghost.points.map((p) => [p.tick, p.netWorth]));
    return data.map((d) => ({ ...d, ghost: byTick.get(d.tick) }));
  }, [data, ghost]);
  if (data.length <= 1) {
    return (
      <div className="h-[180px] flex flex-col items-center justify-center text-center text-ink-faint">
        <Pawn size={32} />
        <p className="text-xs mt-2">Roll the dice to start your story.<br />Your wealth curve grows here.</p>
      </div>
    );
  }
  return (
    <>
      {ghost && <div className="text-2xs text-ink-faint flex items-center gap-1 mb-1"><span className="inline-block w-3 border-t border-dashed border-ink-faint" /> dashed = your best run</div>}
      <div style={{ width: '100%', height: 200 }}>
        <ResponsiveContainer>
          <LineChart data={merged}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.02 86)" />
            <XAxis dataKey="tick" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => formatINR(v, { compact: true })} tick={{ fontSize: 11 }} width={48} />
            <Tooltip formatter={(v: number) => formatINR(v)} />
            {ghost && <Line type="monotone" dataKey="ghost" stroke="oklch(0.62 0.015 62)" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />}
            <Line type="monotone" dataKey="netWorth" stroke="oklch(0.55 0.12 158)" dot={false} strokeWidth={2.5} />
            <Line type="monotone" dataKey="cash" stroke="oklch(0.74 0.13 80)" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function LogBody({ notes }: { notes: string[] }) {
  return (
    <ul className="text-sm text-ink-soft space-y-1 max-h-52 overflow-auto pr-1">
      {notes.length === 0 && <li className="text-ink-faint italic">Roll the dice to begin.</li>}
      {[...notes].reverse().map((n, i) => <li key={i} className="leading-snug">{n}</li>)}
    </ul>
  );
}

// ============================================================
// Card modal
// ============================================================
function CardModal({ card }: { card: Card }) {
  const resolve = useGameStore((s) => s.resolveCardOption);
  const resolveWithLoan = useGameStore((s) => s.resolveCardOptionWithLoan);
  const applyAction = useGameStore((s) => s.applyAction);
  const coachMode = useGameStore((s) => s.coachMode);
  const state = useGameStore((s) => s.state)!;
  const t = Math.min(5, Math.max(1, card.temptation));
  const visibleOptions = t >= 5 ? card.options.filter((o) => o.id !== 'skip') : card.options;
  const [financeOpen, setFinanceOpen] = useState(false);

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
            <div id="card-title" className="font-display text-lg leading-tight">{card.title}</div>
            {card.subtitle && <div className="text-2xs opacity-90 capitalize">{card.subtitle}</div>}
          </div>
        </div>

        {/* Temptation bar — always on a solid tinted background */}
        <div className={`px-5 py-2.5 border-b border-card-edge ${t >= 4 ? 'bg-expense-soft' : t >= 3 ? 'bg-caution-soft' : 'bg-card-edge'}`}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink font-display">
              {t >= 5 ? 'Unavoidable' : t >= 4 ? 'Very tempting' : t >= 3 ? 'Tempting' : t >= 2 ? 'Mild pull' : 'Take it or leave it'}
            </div>
            {/* Fixed-size meter: earned levels are solid coins, the rest hollow + desaturated slots */}
            <div className="flex gap-1 items-center" aria-label={`Temptation ${t} of 5`}>
              {[1, 2, 3, 4, 5].map((i) => <Coin key={i} size={16} empty={i > t} />)}
            </div>
          </div>
          <div className="text-sm italic text-ink mt-1 leading-snug">"{card.temptationReason}"</div>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          <p className="text-base text-ink leading-relaxed">{card.description}</p>
          {card.rows && (
            <div className="rounded-lg bg-card-edge p-3 text-sm space-y-1.5 ring-1 ring-[oklch(0.34_0.04_50)/0.15]">
              {card.rows.map((r, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-ink-soft font-medium">{r.label}</span>
                  <span className="font-bold text-ink tnum">{r.value}</span>
                </div>
              ))}
            </div>
          )}
          {coachMode && card.coachNote && (
            <div className="rounded-lg bg-income-soft p-3 text-sm leading-relaxed ring-1 ring-income/40">
              <div className="flex items-center gap-1.5 mb-1.5">
                <CoachMascot mood="happy" size={18} />
                <span className="font-display font-semibold text-income-ink text-xs uppercase tracking-wider">Coach</span>
              </div>
              <p className="text-income-ink">{card.coachNote}</p>
            </div>
          )}
          <div className="text-sm text-ink-soft flex items-center gap-1.5">
            You hold <Coin size={14} /> <span className="font-bold text-ink tnum">{formatINR(state.cashOnHand)}</span>
          </div>
          {t >= 5 && (
            <div className="rounded-lg bg-expense-soft ring-2 ring-expense px-3 py-2.5 text-sm text-expense-ink font-bold flex items-center gap-2">
              You can't walk away. {visibleOptions.length === 1 ? "It's happening." : 'Pick how you pay.'}
            </div>
          )}
          {/* Quick finances panel — see cash/loans, borrow, sell right from the card */}
          <div className="rounded-lg ring-1 ring-[oklch(0.34_0.04_50)] overflow-hidden">
            <button
              onClick={() => setFinanceOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-card-edge hover:bg-[oklch(0.90_0.02_86)] transition text-left"
            >
              <div className="flex items-center gap-2">
                <Coin size={16} />
                <span className="font-display text-sm text-ink font-semibold">Your finances</span>
                <span className="text-xs text-ink-soft tnum">
                  cash <b className={state.cashOnHand < 0 ? 'text-expense-ink' : 'text-income-ink'}>{formatINR(state.cashOnHand, { compact: true })}</b>
                </span>
              </div>
              <span className={`text-ink-faint text-sm transition-transform ${financeOpen ? 'rotate-180' : ''}`}>▾</span>
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

          <div className="space-y-2.5 pt-1">
            {visibleOptions.map((o) => {
              const cantAfford = o.affordCheck?.(state);
              const isResist = o.id === 'skip';
              const showBorrow = !!cantAfford && o.cashCost && state.cashOnHand < o.cashCost;
              const shortfall = o.cashCost ? Math.max(0, o.cashCost - state.cashOnHand) : 0;
              const borrowAmount = Math.ceil(shortfall / 10_000) * 10_000;
              const warnTone = o.coachWarning?.startsWith('WORST') ? 'bg-expense-soft text-expense-ink ring-1 ring-expense/50'
                : o.coachWarning?.startsWith('Best') ? 'bg-income-soft text-income-ink ring-1 ring-income/50' : 'bg-caution-soft text-caution-ink ring-1 ring-caution/50';
              return (
                <div key={o.id} className="space-y-1.5">
                  <button
                    onClick={() => { if (!cantAfford) { play(isResist ? 'click' : 'coin'); resolve(o.id); } }}
                    disabled={!!cantAfford}
                    className={[
                      'btn-3d w-full text-left px-4 py-3',
                      cantAfford
                        ? 'bg-card-edge border-2 border-card-edge text-ink-soft cursor-not-allowed opacity-60'
                        : isResist
                          ? 'bg-card-edge border-2 border-[oklch(0.34_0.04_50)] enabled:hover:bg-card text-ink font-semibold'
                          : 'bg-brass-500 enabled:hover:bg-brass-600 text-wood-900',
                    ].join(' ')}
                  >
                    <div className="font-display text-base">{o.label}</div>
                    {o.detail && <div className="text-sm mt-0.5 opacity-80">{o.detail}</div>}
                    {cantAfford && <div className="text-sm text-expense-ink mt-0.5 font-semibold">{cantAfford}</div>}
                  </button>
                  {coachMode && o.coachWarning && <div className={`text-xs leading-snug px-3 py-2 rounded ${warnTone}`}>{o.coachWarning}</div>}
                  {showBorrow && (
                    <button onClick={() => { play('coin'); resolveWithLoan(o.id, 'personal'); }} className="btn-3d w-full text-left px-4 py-2.5 bg-expense-soft border-2 border-expense enabled:hover:bg-expense/20">
                      <div className="text-sm font-display font-bold text-expense-ink flex items-center gap-1.5">
                        <Coin size={15} /> Borrow ₹{borrowAmount.toLocaleString('en-IN')} &amp; buy {t >= 5 && <span className="ml-1 text-xs bg-expense text-card rounded px-1.5 py-0.5 font-bold">forced</span>}
                      </div>
                      <div className="text-xs text-expense-ink font-medium mt-0.5">Personal loan @ 13.5% p.a., 3yr</div>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </ModalShell>
  );
}

// ============================================================
// Inline finance panel inside the card modal
// ============================================================
function CardFinancePanel({ state, applyAction }: { state: ReturnType<typeof useGameStore.getState>['state']; applyAction: (a: import('@/types').DecisionAction) => void }) {
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
          <div className="text-2xs uppercase tracking-wide text-ink-soft font-semibold">Cash</div>
          <div className={`font-display font-bold tnum ${state.cashOnHand < 0 ? 'text-expense-ink' : 'text-income-ink'}`}>{formatINR(state.cashOnHand, { compact: true })}</div>
        </div>
        <div className="rounded-lg bg-card p-2 ring-1 ring-card-edge">
          <div className="text-2xs uppercase tracking-wide text-ink-soft font-semibold">Net worth</div>
          <div className="font-display font-bold tnum text-ink">{formatINR(state.statement.netWorth, { compact: true })}</div>
        </div>
        <div className="rounded-lg bg-card p-2 ring-1 ring-card-edge">
          <div className="text-2xs uppercase tracking-wide text-ink-soft font-semibold">Cashflow</div>
          <div className={`font-display font-bold tnum ${state.statement.totalIncome - state.statement.totalExpenses >= 0 ? 'text-income-ink' : 'text-expense-ink'}`}>
            {formatINR(state.statement.totalIncome - state.statement.totalExpenses, { compact: true })}/mo
          </div>
        </div>
      </div>

      {/* Toggle: Assets / Borrow */}
      <div className="flex gap-1">
        <button onClick={() => setBorrowTab(false)} className={`flex-1 rounded-lg py-1.5 font-display text-xs font-semibold transition ${!borrowTab ? 'bg-ink text-card' : 'bg-card-edge text-ink hover:bg-card'}`}>Assets &amp; Loans</button>
        <button onClick={() => setBorrowTab(true)} className={`flex-1 rounded-lg py-1.5 font-display text-xs font-semibold transition ${borrowTab ? 'bg-ink text-card' : 'bg-card-edge text-ink hover:bg-card'}`}>Quick Borrow</button>
      </div>

      {!borrowTab && (
        <div className="space-y-2">
          {/* Assets — sell right here */}
          {topAssets.length > 0 && (
            <div>
              <div className="text-2xs uppercase tracking-wide text-ink-soft font-bold mb-1">Assets</div>
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
                    >Sell all</button>
                  </div>
                );
              })}
            </div>
          )}
          {/* Loans — prepay right here */}
          {topLoans.length > 0 && (
            <div>
              <div className="text-2xs uppercase tracking-wide text-ink-soft font-bold mb-1">Loans</div>
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
                      >Prepay</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {topAssets.length === 0 && topLoans.length === 0 && (
            <p className="text-ink-soft text-xs italic text-center py-2">No assets or loans yet.</p>
          )}
        </div>
      )}

      {borrowTab && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-ink-soft">
            <span>Amount: <b className="text-ink tnum">₹{borrowLakhs}L</b></span>
            <span>Tenure: <b className="text-ink tnum">{borrowMonths}mo</b></span>
          </div>
          <input type="range" min={1} max={20} value={borrowLakhs} onChange={(e) => setBorrowLakhs(+e.target.value)} className="w-full accent-brass-600" />
          <input type="range" min={12} max={60} step={6} value={borrowMonths} onChange={(e) => setBorrowMonths(+e.target.value)} className="w-full accent-brass-600" />
          <div className="rounded-lg bg-card p-2 ring-1 ring-card-edge grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs tnum">
            <span className="text-ink-soft">Rate</span><span className="text-ink font-semibold">13.5% p.a.</span>
            <span className="text-ink-soft">EMI/mo</span><span className="text-income-ink font-bold">{formatINR(loan.emi)}</span>
            <span className="text-ink-soft">Total interest</span><span className="text-expense-ink font-semibold">{formatINR(loan.emi * borrowMonths - borrowLakhs * 100_000)}</span>
            <span className="text-ink-soft">You receive</span><span className="text-income-ink font-bold">{formatINR(borrowLakhs * 100_000)}</span>
          </div>
          <button
            onClick={() => { play('coin'); applyAction({ kind: 'take_loan', loan }); }}
            className="btn-3d w-full bg-brass-500 enabled:hover:bg-brass-600 text-wood-900 py-2 font-display"
          >
            Borrow ₹{borrowLakhs}L — cash lands now
          </button>
          <p className="text-xs text-ink-soft text-center">Cash credits immediately. EMI auto-debits each month.</p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Outcome modal
// ============================================================
function OutcomeModal({ status }: { status: 'won' | 'lost' }) {
  const dismiss = useGameStore((s) => s.dismissOutcome);
  const reset = useGameStore((s) => s.reset);
  const resetProgress = useProgression((s) => s.resetForNewRun);
  const score = useProgression((s) => s.lastScore);
  const unlocked = useProgression((s) => s.unlocked);
  const state = useGameStore((s) => s.state)!;
  const years = Math.floor(state.meta.tick / 12);
  const months = state.meta.tick % 12;
  const won = status === 'won';
  const best = useMemo(() => bestEscape(), [score]);
  const isNewBest = won && best != null && best.months >= state.meta.tick;

  function newRun() { play('click'); resetProgress(); reset(); }

  return (
    <ModalShell labelledBy="outcome-title" center>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        className="paper w-full max-w-md rounded-game shadow-card ring-4 ring-brass/30 overflow-hidden max-h-[92dvh] flex flex-col"
      >
        <div className="text-card px-6 py-5 text-center shrink-0" style={{ background: won ? 'linear-gradient(135deg, oklch(0.74 0.13 80), oklch(0.62 0.12 78))' : 'linear-gradient(135deg, oklch(0.45 0.16 26), oklch(0.32 0.12 24))' }}>
          <div className="text-5xl mb-1">{won ? '★' : '✖'}</div>
          <div id="outcome-title" className="font-display text-2xl">{won ? 'Rat race escaped!' : 'Bankrupt'}</div>
          <div className="text-sm opacity-95 mt-1">
            {won ? `${state.player.name} reached freedom in ${years}y ${months}m` : `${state.player.name} ran dry for ${BANKRUPTCY_GRACE_MONTHS} straight months`}
          </div>
        </div>
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {score && <Scorecard score={score} unlockedCount={unlocked.length} />}
          <div className="rounded-lg bg-card-edge/50 p-3 space-y-1 text-sm tnum">
            <ResultRow label="Net worth" value={formatINR(state.statement.netWorth)} tone={state.statement.netWorth >= 0 ? 'income' : 'expense'} />
            {won && <ResultRow label="Passive income" value={`${formatINR(state.statement.passiveIncome)}/mo`} tone="income" />}
            <ResultRow label="Survived" value={`${years}y ${months}m`} />
            {best && <ResultRow label={isNewBest ? '★ New best escape' : 'Your best escape'} value={`${Math.floor(best.months / 12)}y ${best.months % 12}m`} tone={isNewBest ? 'income' : undefined} />}
          </div>
          <div className="space-y-2">
            <PrimaryButton onClick={newRun} className="w-full">Start a new run</PrimaryButton>
            <button onClick={dismiss} className="btn-3d w-full bg-card text-ink px-4 py-2.5 text-sm">{won ? 'Keep playing' : 'View the wreckage'}</button>
          </div>
        </div>
      </motion.div>
    </ModalShell>
  );
}

function Scorecard({ score, unlockedCount }: { score: RunScore; unlockedCount: number }) {
  const gradeColor = score.grade.startsWith('A') ? 'text-income-ink bg-income-soft' : score.grade === 'B' ? 'text-brass-600 bg-brass-100' : score.grade === 'C' ? 'text-caution-ink bg-caution-soft' : 'text-expense-ink bg-expense-soft';
  return (
    <div className="rounded-lg ring-1 ring-card-edge overflow-hidden">
      <div className="flex items-center gap-3 p-3 bg-card-edge/30">
        <div className={`w-14 h-14 rounded-xl grid place-items-center font-display text-2xl ${gradeColor}`}>{score.grade}</div>
        <div className="min-w-0">
          <div className="font-display text-ink">Decision grade</div>
          <div className="text-2xs text-ink-soft tnum">{score.goodMoves} smart · {score.badMoves} costly moves · {unlockedCount} achievements</div>
          <div className="mt-1 h-1.5 rounded-full bg-card-edge overflow-hidden w-40 max-w-full">
            <div className="h-full bg-income" style={{ width: `${score.decisionScore}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, value, tone }: { label: string; value: string; tone?: 'income' | 'expense' }) {
  const c = tone === 'income' ? 'text-income-ink' : tone === 'expense' ? 'text-expense-ink' : 'text-ink';
  return <div className="flex justify-between"><span className="text-ink-soft">{label}</span><span className={`font-semibold ${c}`}>{value}</span></div>;
}

// ============================================================
// Balance sheet (bottom sheet on mobile, side drawer on desktop)
// ============================================================
function BalanceSheet({ onClose }: { onClose: () => void }) {
  const state = useGameStore((s) => s.state)!;
  const applyAction = useGameStore((s) => s.applyAction);
  const [tab, setTab] = useState<'statement' | 'assets' | 'liabilities' | 'borrow'>('statement');
  const tabs: { id: typeof tab; label: string }[] = [
    { id: 'statement', label: 'Statement' },
    { id: 'assets', label: `Assets (${state.assets.length})` },
    { id: 'liabilities', label: `Loans (${state.liabilities.length})` },
    { id: 'borrow', label: 'Borrow' },
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
            <div className="text-xs uppercase font-semibold tracking-wider text-card/80">Personal financial statement</div>
            <div id="sheet-title" className="font-display text-lg">{state.player.name}</div>
          </div>
          <button onClick={onClose} className="text-2xl hover:bg-felt-700 w-9 h-9 rounded-lg" aria-label="Close">×</button>
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

function StatementTab() {
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
        <div><div className="text-xs uppercase tracking-wider font-semibold text-card/75">Net worth</div><div className="font-display text-lg">{formatINR(netWorth, { compact: true })}</div></div>
        <div><div className="text-xs uppercase tracking-wider font-semibold text-card/75">Cashflow/mo</div><div className={`font-display text-lg ${cashflow >= 0 ? 'text-income' : 'text-expense'}`}>{cashflow >= 0 ? '+' : ''}{formatINR(cashflow, { compact: true })}</div></div>
        <div><div className="text-xs uppercase tracking-wider font-semibold text-card/75">Passive/exp</div><div className={`font-display text-lg ${passiveCoverage >= 1 ? 'text-income' : 'text-brass-300'}`}>{(passiveCoverage * 100).toFixed(0)}%</div></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Quadrant title="INCOME" subtitle="Monthly" color="income" total={totalIncome}>
          <LedgerRow label="Salary" value={monthlySalary} />
          {monthlyFreelance > 0 && <LedgerRow label="Freelance / side hustle" value={monthlyFreelance} />}
          <LedgerSubhead>Passive</LedgerSubhead>
          {yieldByKind.rent > 0 && <LedgerRow label="Rental income" value={yieldByKind.rent} indent />}
          {yieldByKind.dividend > 0 && <LedgerRow label="Dividends" value={yieldByKind.dividend} indent />}
          {yieldByKind.interest > 0 && <LedgerRow label="Interest / yield" value={yieldByKind.interest} indent />}
          {totalPassive === 0 && <LedgerRow label="(none yet)" value={0} indent muted />}
        </Quadrant>
        <Quadrant title="EXPENSES" subtitle="Monthly" color="expense" total={totalExpenses}>
          {state.expenses.filter((e) => e.monthlyAmount > 0).map((e, i) => <LedgerRow key={i} label={prettyExpense(e.category, e.label)} value={e.monthlyAmount} />)}
          {totalEMI > 0 && (<><LedgerSubhead>Loan EMIs</LedgerSubhead>{state.liabilities.map((l) => <LedgerRow key={l.id} label={l.label} value={l.emi} indent />)}</>)}
          {totalPremium > 0 && (<><LedgerSubhead>Insurance</LedgerSubhead>{state.insurance.map((p) => <LedgerRow key={p.id} label={p.label} value={p.monthlyPremium} indent />)}</>)}
        </Quadrant>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Quadrant title="ASSETS" subtitle="Current value" color="brass" total={totalAssets}>
          <LedgerRow label="Cash on hand" value={state.cashOnHand} />
          {Object.entries(assetGroups).map(([group, items]) => {
            const groupTotal = items.reduce((s, x) => s + x.value, 0);
            return (
              <div key={group}>
                <LedgerSubhead>{group} <span className="text-ink-faint font-normal">({formatINR(groupTotal, { compact: true })})</span></LedgerSubhead>
                {items.map((x, i) => <LedgerRow key={i} label={x.label} value={x.value} indent />)}
              </div>
            );
          })}
          {Object.keys(assetGroups).length === 0 && <LedgerRow label="(no investments yet — draw deal cards)" value={0} muted />}
        </Quadrant>
        <Quadrant title="LIABILITIES" subtitle="Outstanding" color="expense" total={totalLiab}>
          {state.liabilities.length === 0 && <LedgerRow label="Debt-free ★" value={0} muted />}
          {state.liabilities.map((l) => (
            <div key={l.id}>
              <LedgerRow label={l.label} value={l.principalOutstanding} />
              <div className="text-2xs text-ink-faint -mt-0.5 ml-1 tnum">{(l.rateAnnual * 100).toFixed(1)}% · {l.remainingMonths}mo · EMI {formatINR(l.emi)}</div>
            </div>
          ))}
        </Quadrant>
      </div>
      <div className="bg-card-edge/40 rounded-lg p-3 text-center text-sm font-mono tnum">
        <div className="text-ink-faint text-2xs">Assets − Liabilities = Net worth</div>
        <div className="font-bold text-ink mt-1">
          {formatINR(totalAssets, { compact: true })} − {formatINR(totalLiab, { compact: true })} = <span className={netWorth >= 0 ? 'text-income-ink' : 'text-expense-ink'}>{formatINR(netWorth, { compact: true })}</span>
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

function Quadrant({ title, subtitle, color, total, children }: { title: string; subtitle: string; color: 'income' | 'expense' | 'brass'; total: number; children: React.ReactNode }) {
  const head = color === 'income' ? 'bg-income text-card' : color === 'expense' ? 'bg-expense text-card' : 'bg-brass-600 text-wood-900';
  const totalText = color === 'income' ? 'text-income-ink' : color === 'expense' ? 'text-expense-ink' : 'text-wood-700';
  return (
    <div className="bg-card border border-card-edge rounded-lg overflow-hidden shadow-card">
      <div className={`${head} px-3 py-1.5 flex items-baseline justify-between`}><span className="font-display text-sm tracking-wide">{title}</span><span className="text-2xs uppercase tracking-wider opacity-80">{subtitle}</span></div>
      <div className="p-3 space-y-0.5 text-sm">{children}</div>
      <div className={`px-3 py-2 border-t-2 border-card-edge flex justify-between font-bold text-sm bg-card-edge/40 ${totalText}`}><span>TOTAL</span><span className="font-mono tnum">{formatINR(total)}</span></div>
    </div>
  );
}

function LedgerRow({ label, value, indent, muted }: { label: string; value: number; indent?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${indent ? 'ml-3' : ''} ${muted ? 'text-ink-soft italic' : 'text-ink'}`}>
      <span className="truncate pr-2">{label}</span><span className="font-mono whitespace-nowrap tnum">{value === 0 ? '—' : formatINR(value)}</span>
    </div>
  );
}

function LedgerSubhead({ children }: { children: React.ReactNode }) {
  return <div className="text-xs uppercase tracking-wider text-ink-soft font-bold mt-2 mb-0.5">{children}</div>;
}

function AssetsTab({ onSell }: { onSell: (a: Asset, units: number) => void }) {
  const state = useGameStore((s) => s.state)!;
  if (state.assets.length === 0) {
    return (
      <div className="text-center py-10 text-ink-faint">
        <Coin size={36} /><p className="mt-2 text-sm">No assets yet.<br />Draw a deal card and invest.</p>
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
              <button onClick={() => { play('coin'); onSell(a, a.units); }} className="text-2xs bg-expense-soft hover:bg-expense/20 text-expense-ink px-3 py-1 rounded font-display">Sell all</button>
              {a.units > 1 && <button onClick={() => { play('coin'); onSell(a, Math.floor(a.units / 2)); }} className="text-2xs bg-caution-soft hover:bg-caution/20 text-caution-ink px-3 py-1 rounded font-display">Sell half</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LiabilitiesTab({ onPrepay }: { onPrepay: (l: Loan, amount: number) => void }) {
  const state = useGameStore((s) => s.state)!;
  if (state.liabilities.length === 0) return <div className="text-center py-10 text-ink-faint"><div className="text-3xl">★</div><p className="mt-2 text-sm">Debt-free.</p></div>;
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
              {full > 0 && <button onClick={() => { play('coin'); onPrepay(l, full); }} disabled={state.cashOnHand < full} className="text-2xs bg-income-soft hover:bg-income/20 text-income-ink px-3 py-1 rounded font-display disabled:opacity-50">Pay off (₹{full.toLocaleString('en-IN')})</button>}
              {half > 0 && half < l.principalOutstanding && <button onClick={() => { play('coin'); onPrepay(l, half); }} disabled={state.cashOnHand < half} className="text-2xs bg-caution-soft hover:bg-caution/20 text-caution-ink px-3 py-1 rounded font-display disabled:opacity-50">Prepay half (₹{half.toLocaleString('en-IN')})</button>}
              {l.prepaymentPenalty > 0 && <div className="text-2xs text-ink-faint ml-auto self-center">Penalty: {(l.prepaymentPenalty * 100).toFixed(1)}%</div>}
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
  const loan = buildLoan({ kind, label: `${kind} loan`, principal, tenureMonths });
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">Take a loan directly. Cash credits immediately; EMIs auto-debit each month.</p>
      <div className="bg-card-edge/30 rounded-lg p-4 space-y-3">
        <Field label="Loan type">
          <Select value={kind} onChange={(v) => setKind(v as LoanKind)}>
            <option value="personal">Personal loan ({(LOAN_RATES.personal.rate * 100).toFixed(1)}%)</option>
            <option value="car">Car loan ({(LOAN_RATES.car.rate * 100).toFixed(1)}%)</option>
            <option value="education">Education loan ({(LOAN_RATES.education.rate * 100).toFixed(1)}%)</option>
            <option value="business">Business loan ({(LOAN_RATES.business.rate * 100).toFixed(1)}%)</option>
            <option value="credit_card">Credit card revolve ({(LOAN_RATES.credit_card.rate * 100).toFixed(1)}%)</option>
          </Select>
        </Field>
        <Field label={`Principal (₹${principalLakhs} lakh)`}>
          <input type="range" min={1} max={50} value={principalLakhs} onChange={(e) => setPrincipalLakhs(+e.target.value)} className="w-full accent-brass-600" />
        </Field>
        <Field label={`Tenure (${tenureMonths} months ≈ ${(tenureMonths / 12).toFixed(1)} years)`}>
          <input type="range" min={6} max={LOAN_RATES[kind].maxTenureMonths} value={Math.min(tenureMonths, LOAN_RATES[kind].maxTenureMonths)} onChange={(e) => setTenureMonths(+e.target.value)} className="w-full accent-brass-600" />
        </Field>
        <div className="bg-card rounded p-3 text-sm space-y-1 tnum">
          <Row label="Rate" value={`${(rate * 100).toFixed(2)}% p.a.`} />
          <Row label="EMI" value={formatINR(loan.emi) + '/mo'} />
          <Row label="Total interest" value={formatINR(loan.emi * tenureMonths - principal)} />
          <Row label="Principal received" value={formatINR(principal)} bold />
        </div>
        <PrimaryButton onClick={() => { play('coin'); applyAction({ kind: 'take_loan', loan }); }} className="w-full">Take this loan</PrimaryButton>
      </div>
    </div>
  );
}

// ============================================================
// Shared primitives
// ============================================================
function ModalShell({ children, onClose, center, align, labelledBy }: { children: React.ReactNode; onClose?: () => void; center?: boolean; align?: 'end'; labelledBy?: string }) {
  const justify = align === 'end' ? 'justify-end' : center ? 'justify-center' : 'justify-center';
  const items = center ? 'items-center' : 'items-end sm:items-center';
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className={`fixed inset-0 z-50 flex ${items} ${justify} p-0 sm:p-4`}
      style={{ background: 'oklch(0.14 0.04 158 / 0.93)' }}
      onClick={onClose}
      role="dialog" aria-modal="true" aria-labelledby={labelledBy}
    >
      {align === 'end' ? children : <div className="w-full flex justify-center" onClick={onClose}><div onClick={(e) => e.stopPropagation()} className="w-full flex justify-center">{children}</div></div>}
    </motion.div>
  );
}

function PrimaryButton({ children, onClick, disabled, className = '' }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`btn-3d bg-brass-500 enabled:hover:bg-brass-600 text-wood-900 px-4 py-3 ${className}`}>{children}</button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm font-display text-ink-soft">{label}</span><div className="mt-1">{children}</div></label>;
}

function TextInput({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return <input className="w-full rounded-lg border border-card-edge p-2.5 focus:outline-none focus:ring-2 focus:ring-brass/50" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} />;
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return <select className="w-full rounded-lg border border-card-edge p-2.5 bg-card focus:outline-none focus:ring-2 focus:ring-brass/50" value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className={`flex justify-between text-sm ${bold ? 'font-bold border-t border-card-edge pt-1 mt-1' : ''}`}><span className="text-ink-soft">{label}</span><span className="font-mono tnum">{value}</span></div>;
}
