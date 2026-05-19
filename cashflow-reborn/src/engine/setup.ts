import type { GameState, AssetClass, ExpenseCategory, ProfessionId } from '@/types';
import { buildInitialPlayer, startingSalary } from '@/modules/player/career';
import { defaultExpenses } from '@/modules/expenses/expenses';

export interface SetupOptions {
  seed: number;
  playerName: string;
  age: number;
  profession: ProfessionId;
  city: 'T1' | 'T2' | 'T3';
  family: 'single' | 'married' | 'married_with_kids';
  startDate?: string;
}

export function buildInitialState(opts: SetupOptions): GameState {
  const player = buildInitialPlayer({
    name: opts.playerName,
    age: opts.age,
    profession: opts.profession,
    city: opts.city,
    family: opts.family,
  });

  const monthlySalary = startingSalary(opts.profession, opts.city, player.yearsOfExperience);
  const expenses = defaultExpenses(opts.city, opts.family);

  const allAssetClasses: AssetClass[] = [
    'savings', 'fd', 'index_fund', 'active_mf', 'stocks',
    'real_estate_residential', 'real_estate_commercial', 'reit',
    'gold', 'crypto', 'business_equity', 'ppf', 'nps',
  ];
  const indices = Object.fromEntries(allAssetClasses.map((c) => [c, 1])) as Record<AssetClass, number>;

  const allCategories: ExpenseCategory[] = [
    'housing','food','transport','utilities','healthcare','education',
    'insurance_premium','lifestyle','subscriptions','dependents','misc',
  ];
  const cpiByCategory = Object.fromEntries(allCategories.map((c) => [c, 1])) as Record<ExpenseCategory, number>;

  return {
    meta: {
      seed: opts.seed,
      tick: 0,
      startDate: opts.startDate ?? new Date().toISOString().slice(0, 10),
      version: '0.1.0',
    },
    player,
    cashOnHand: 50_000,        // small starting cushion; tune later
    incomeStreams: [{
      id: 'salary_primary',
      kind: 'salary',
      monthlyGross: monthlySalary,
      tdsRate: 0.10,           // recomputed each tick by tax module
      taxable: true,
    }],
    expenses,
    assets: [],
    liabilities: [],
    insurance: [],
    market: {
      phase: 'expansion',
      phaseStartedAt: 0,
      inflationAnnual: 0.055,
      repoRate: 0.065,
      gdpGrowthAnnual: 0.07,
      indices,
      cpiByCategory,
    },
    goals: [
      { id: 'goal_escape', kind: 'rat_race_escape', label: 'Escape the Rat Race' },
    ],
    history: [],
    decisionLog: [],
    pendingEvents: [],
    detectedPatterns: [],
    statement: {
      totalIncome: 0,
      totalExpenses: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      netWorth: 0,
      passiveIncome: 0,
      savingsRate: 0,
    },
  };
}
