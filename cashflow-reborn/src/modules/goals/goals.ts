import type { GameState, Goal } from '@/types';

/**
 * Check goal completion every tick.
 * Mutates Goal.achievedAt when conditions met.
 */
export function checkGoals(state: GameState): Goal[] {
  const justAchieved: Goal[] = [];
  for (const goal of state.goals) {
    if (goal.achievedAt !== undefined) continue;
    if (isGoalAchieved(goal, state)) {
      goal.achievedAt = state.meta.tick;
      justAchieved.push(goal);
    }
  }
  return justAchieved;
}

function isGoalAchieved(goal: Goal, state: GameState): boolean {
  switch (goal.kind) {
    case 'rat_race_escape': {
      // 12 consecutive months of passive income >= expenses
      const need = 12;
      if (state.history.length < need) return false;
      const recent = state.history.slice(-need);
      return recent.every((h) => {
        // h.income includes salary; for passive-only check we'd separate.
        // STUB: v0.2 will track passiveIncome on HistoryPoint explicitly.
        return h.income >= h.expenses;
      });
    }
    case 'fire': {
      const liquid = state.assets.filter((a) =>
        ['savings', 'fd', 'index_fund', 'stocks', 'gold', 'reit'].includes(a.kind)
      ).reduce((s, a) => s + a.currentPrice * a.units, 0);
      const annualExp = state.statement.totalExpenses * 12;
      return liquid >= annualExp * 25;
    }
    case 'net_worth_by_age':
      return goal.targetRupees !== undefined &&
             state.statement.netWorth >= goal.targetRupees;
    default:
      return false;
  }
}
