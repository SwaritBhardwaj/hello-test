import type { GameState } from '@/types';
import type { CoachDecisionEntry } from '@/modules/coach/actionLog';
import { distinctAssetGroups } from './achievements';

// ============================================================
// Run challenges — a rotating set of 3 mid-run goals with live
// progress. Pure functions only: progress is recomputed from
// (state, log); completion latching lives in the progression store.
// ============================================================

export interface Challenge {
  id: string;
  label: string;
  description: string;
  /** progress() >= target means the challenge is complete */
  target: number;
  /** Current progress, clamped to [0, target]. */
  progress: (state: GameState, log: CoachDecisionEntry[]) => number;
}

const clamp = (n: number, target: number) => Math.max(0, Math.min(target, n));

/** Longest streak of consecutive cashflow-positive month-ends in history. */
function maxPositiveCashflowStreak(state: GameState): number {
  let best = 0;
  let run = 0;
  for (const h of state.history) {
    if (h.income - h.expenses > 0) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

/** Months since the player last took on a loan (game start if never). */
function monthsSinceLastBorrow(state: GameState, log: CoachDecisionEntry[]): number {
  let last = 0;
  for (const loan of state.liabilities) last = Math.max(last, loan.startedAt);
  for (const e of log) {
    if (e.borrowed || e.category.startsWith('borrow')) last = Math.max(last, e.tick);
  }
  return Math.max(0, state.meta.tick - last);
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'iron_wallet',
    label: 'Iron Wallet',
    description: 'Resist 3 temptations',
    target: 3,
    progress: (_state, log) => clamp(log.filter((e) => e.category === 'resist').length, 3),
  },
  {
    id: 'diversifier',
    label: 'Diversifier',
    description: 'Own 3 different asset classes',
    target: 3,
    progress: (state) => clamp(distinctAssetGroups(state), 3),
  },
  {
    id: 'steady_hands',
    label: 'Steady Hands',
    description: '3 consecutive cashflow-positive month-ends',
    target: 3,
    progress: (state) => clamp(maxPositiveCashflowStreak(state), 3),
  },
  {
    id: 'debt_lite',
    label: 'Debt-Lite',
    description: 'Keep EMIs under 30% of income for 6 months',
    target: 6,
    progress: (state, log) => {
      const income = state.statement.totalIncome;
      if (income <= 0) return 0;
      const emiTotal = state.liabilities.reduce((sum, l) => sum + l.emi, 0);
      if (emiTotal > income * 0.3) return 0;
      // The EMI load can only have been at (or below) its current level since
      // the last borrow — count the months since then.
      return clamp(monthsSinceLastBorrow(state, log), 6);
    },
  },
  {
    id: 'first_5l',
    label: 'First ₹5L',
    description: 'Reach ₹5 lakh net worth',
    target: 500_000,
    progress: (state) => clamp(state.statement.netWorth, 500_000),
  },
  {
    id: 'side_income',
    label: 'Side Hustle',
    description: 'Start a side income stream',
    target: 1,
    progress: (state) =>
      state.incomeStreams.some((i) => i.kind === 'freelance' || i.kind === 'business') ? 1 : 0,
  },
  {
    id: 'recession_proof',
    label: 'Recession-Proof',
    description: 'Survive a market contraction with positive net worth',
    target: 1,
    progress: (state) =>
      state.history.some((h) => h.marketPhase === 'contraction' || h.marketPhase === 'trough') &&
      state.statement.netWorth > 0
        ? 1
        : 0,
  },
  {
    id: 'loan_crusher',
    label: 'Loan Crusher',
    description: 'Pay down ₹1 lakh of loan principal',
    target: 100_000,
    progress: (state) =>
      clamp(
        state.liabilities.reduce((sum, l) => sum + (l.originalPrincipal - l.principalOutstanding), 0),
        100_000,
      ),
  },
  {
    id: 'passive_10k',
    label: 'Money Machine',
    description: 'Build ₹10K/month of passive income',
    target: 10_000,
    progress: (state) => clamp(state.statement.passiveIncome, 10_000),
  },
  {
    id: 'cash_cushion',
    label: 'Cash Cushion',
    description: 'Hold 3 months of expenses in cash',
    target: 3,
    progress: (state) =>
      state.statement.totalExpenses > 0
        ? clamp(state.cashOnHand / state.statement.totalExpenses, 3)
        : 0,
  },
];

export function challengeById(id: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

// ------------------------------------------------------------
// Deterministic rotation — 3 active challenges, rotating every
// 12 months, seeded by the run seed so a given run always sees
// the same schedule.
// ------------------------------------------------------------

/** mulberry32 — tiny deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededOrder(seed: number): Challenge[] {
  const rng = mulberry32(seed);
  const pool = [...CHALLENGES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export const ACTIVE_CHALLENGE_COUNT = 3;
export const CHALLENGE_ROTATION_MONTHS = 12;

/**
 * The 3 challenges active at a given month. Deterministic in (seed, monthTick):
 * the pool is shuffled once by seed, then a 3-wide window slides forward every
 * 12 months so every challenge eventually comes up.
 */
export function activeChallenges(seed: number, monthTick: number): Challenge[] {
  const order = seededOrder(seed);
  const epoch = Math.floor(Math.max(0, monthTick) / CHALLENGE_ROTATION_MONTHS);
  const start = (epoch * ACTIVE_CHALLENGE_COUNT) % order.length;
  return Array.from(
    { length: ACTIVE_CHALLENGE_COUNT },
    (_, i) => order[(start + i) % order.length],
  );
}
