import type { GameState, ExpenseLine, ExpenseCategory } from '@/types';
import type { PRNG } from '@/engine/prng/prng';
import { INFLATION_BASE_ANNUAL, LIFESTYLE_CREEP_INCOME_THRESHOLD, LIFESTYLE_CREEP_MULTIPLIER } from '@/data/constants';

/** Default expense template by city tier and family status. Tune in /data/expenses.ts later. */
export function defaultExpenses(city: 'T1' | 'T2' | 'T3', family: 'single' | 'married' | 'married_with_kids'): ExpenseLine[] {
  const cityMult = city === 'T1' ? 1.0 : city === 'T2' ? 0.7 : 0.5;
  const familyMult = family === 'single' ? 1.0 : family === 'married' ? 1.4 : 1.8;
  const k = cityMult * familyMult;
  return [
    { category: 'housing',           label: 'Rent / EMI',          monthlyAmount: Math.round(25_000 * k), inflationIndex: 'housing',           isVariable: false },
    { category: 'food',              label: 'Groceries & dining',  monthlyAmount: Math.round(12_000 * k), inflationIndex: 'food',              isVariable: true, varianceBps: 1500 },
    { category: 'transport',         label: 'Fuel + cabs + EMI',   monthlyAmount: Math.round(8_000 * k),  inflationIndex: 'transport',         isVariable: true, varianceBps: 2000 },
    { category: 'utilities',         label: 'Electricity, water, internet', monthlyAmount: Math.round(4_500 * k), inflationIndex: 'utilities', isVariable: true, varianceBps: 1000 },
    { category: 'healthcare',        label: 'OOP healthcare',      monthlyAmount: Math.round(2_500 * k),  inflationIndex: 'healthcare',        isVariable: true, varianceBps: 4000 },
    { category: 'subscriptions',     label: 'Streaming + cloud + apps', monthlyAmount: Math.round(2_000 * k), inflationIndex: 'subscriptions', isVariable: false },
    { category: 'lifestyle',         label: 'Entertainment + shopping', monthlyAmount: Math.round(8_000 * k), inflationIndex: 'lifestyle',     isVariable: true, varianceBps: 5000 },
    { category: 'misc',              label: 'Misc / buffer',       monthlyAmount: Math.round(3_000 * k),  inflationIndex: 'misc',              isVariable: true, varianceBps: 3000 },
  ];
}

/**
 * Apply monthly inflation to each expense line.
 * Inflation comes from the per-category CPI in market state.
 */
export function applyInflationTick(state: GameState): void {
  const annual = INFLATION_BASE_ANNUAL;
  for (const line of state.expenses) {
    const annualRate = annual[line.inflationIndex] ?? 0.05;
    const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
    line.monthlyAmount = Math.round(line.monthlyAmount * (1 + monthlyRate));
    // also bump category-level CPI in market
    state.market.cpiByCategory[line.inflationIndex] *= 1 + monthlyRate;
  }
}

/**
 * Sample this month's actual expense from each line based on its variance.
 * Returns the realized total to subtract from cash this tick.
 */
export function realizedExpensesThisTick(state: GameState, rng: PRNG): number {
  let total = 0;
  for (const line of state.expenses) {
    if (line.isVariable && line.varianceBps) {
      const sigma = line.varianceBps / 10_000;
      const factor = Math.max(0.3, 1 + rng.gaussian(0, sigma));
      total += line.monthlyAmount * factor;
    } else {
      total += line.monthlyAmount;
    }
  }
  return Math.round(total);
}

/**
 * Detect income jump and apply lifestyle creep.
 * Compares latest monthly income to trailing 12-month average.
 */
export function applyLifestyleCreep(state: GameState, currentMonthlyIncome: number): boolean {
  const history = state.history.slice(-12);
  if (history.length < 6) return false;
  const avgPast = history.reduce((s, p) => s + p.income, 0) / history.length;
  if (avgPast === 0) return false;
  const jump = (currentMonthlyIncome - avgPast) / avgPast;
  if (jump < LIFESTYLE_CREEP_INCOME_THRESHOLD) return false;

  const leak = (currentMonthlyIncome - avgPast) * LIFESTYLE_CREEP_MULTIPLIER;
  const lifestyleLine = state.expenses.find((e) => e.category === 'lifestyle');
  if (lifestyleLine) {
    lifestyleLine.monthlyAmount += Math.round(leak);
    return true;
  }
  return false;
}

/** Sum monthly expenses by category for the dashboard. */
export function expensesByCategory(state: GameState): Record<ExpenseCategory, number> {
  const out = {} as Record<ExpenseCategory, number>;
  for (const line of state.expenses) {
    out[line.category] = (out[line.category] ?? 0) + line.monthlyAmount;
  }
  return out;
}
