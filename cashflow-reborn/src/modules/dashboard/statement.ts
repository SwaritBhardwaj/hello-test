import type { GameState, FinancialStatement } from '@/types';
import { totalAssetValue } from '@/modules/assets/assets';

/**
 * Compute the financial statement from current state.
 * Called at the end of every tick by the orchestrator.
 */
export function computeStatement(state: GameState): FinancialStatement {
  const totalIncome = state.incomeStreams.reduce((s, i) => s + i.monthlyGross, 0);
  const totalExpenses = state.expenses.reduce((s, e) => s + e.monthlyAmount, 0)
    + state.liabilities.reduce((s, l) => s + l.emi, 0)
    + state.insurance.reduce((s, p) => s + p.monthlyPremium, 0);
  const totalAssets = totalAssetValue(state.assets) + state.cashOnHand;
  const totalLiabilities = state.liabilities.reduce((s, l) => s + l.principalOutstanding, 0);
  const netWorth = totalAssets - totalLiabilities;
  const assetYieldMonthly = state.assets.reduce(
    (s, a) => s + (a.currentPrice * a.units * a.yieldRateAnnual) / 12,
    0,
  );
  const passiveIncome = state.incomeStreams
    .filter((i) => i.kind !== 'salary' && i.kind !== 'freelance')
    .reduce((s, i) => s + i.monthlyGross, 0)
    + assetYieldMonthly;
  const savingsRate = totalIncome === 0 ? 0 : (totalIncome - totalExpenses) / totalIncome;

  return {
    totalIncome,
    totalExpenses,
    totalAssets,
    totalLiabilities,
    netWorth,
    passiveIncome,
    savingsRate,
  };
}
