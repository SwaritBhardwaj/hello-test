import type { GameState } from '@/types';

export interface Rank {
  index: number;
  label: string;
  /** passive coverage threshold to reach this rank */
  minCoverage: number;
  minNetWorth: number;
}

/** The financial-title ladder — driven by passive coverage and net worth. */
export const RANKS: Rank[] = [
  { index: 0, label: 'Paycheck to Paycheck', minCoverage: 0, minNetWorth: -Infinity },
  { index: 1, label: 'Saver', minCoverage: 0, minNetWorth: 200_000 },
  { index: 2, label: 'Investor', minCoverage: 0.1, minNetWorth: 1_000_000 },
  { index: 3, label: 'Landlord', minCoverage: 0.3, minNetWorth: 3_000_000 },
  { index: 4, label: 'Almost Free', minCoverage: 0.6, minNetWorth: 6_000_000 },
  { index: 5, label: 'Financially Free', minCoverage: 1, minNetWorth: 0 },
];

export interface RankStatus {
  rank: Rank;
  next: Rank | null;
  /** 0..1 progress toward the next rank */
  progress: number;
}

export function rankFor(state: GameState): RankStatus {
  const coverage = state.statement.totalExpenses
    ? state.statement.passiveIncome / state.statement.totalExpenses
    : 0;
  const nw = state.statement.netWorth;

  // Financially Free wins on coverage alone.
  let current = RANKS[0];
  for (const r of RANKS) {
    if (r.index === 5) {
      if (coverage >= 1) current = r;
      continue;
    }
    if (coverage >= r.minCoverage && nw >= r.minNetWorth) current = r;
  }
  const next = current.index < 5 ? RANKS[current.index + 1] : null;

  let progress = 1;
  if (next) {
    if (next.index === 5) {
      progress = Math.max(0, Math.min(1, coverage / 1));
    } else {
      const nwPart = Math.max(0, Math.min(1, nw / Math.max(1, next.minNetWorth)));
      const covPart = next.minCoverage > 0 ? Math.max(0, Math.min(1, coverage / next.minCoverage)) : 1;
      progress = Math.min(nwPart, covPart);
    }
  }
  return { rank: current, next, progress };
}
