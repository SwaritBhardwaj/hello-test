import type { GameState } from '@/types';
import type { CoachDecisionEntry } from '@/modules/coach/actionLog';

export interface Achievement {
  id: string;
  label: string;
  description: string;
  /** glyph rendered in the toast/badge */
  icon: 'coin' | 'pawn' | 'die' | 'star' | 'shield';
  test: (ctx: AchievementContext) => boolean;
}

export interface AchievementContext {
  state: GameState;
  log: CoachDecisionEntry[];
}

function distinctAssetGroups(state: GameState): number {
  const groups = new Set<string>();
  for (const a of state.assets) {
    if (a.kind.startsWith('real_estate') || a.kind === 'reit') groups.add('re');
    else if (['stocks', 'index_fund', 'active_mf', 'business_equity'].includes(a.kind)) groups.add('eq');
    else if (a.kind === 'gold') groups.add('gold');
    else if (['fd', 'savings', 'ppf', 'nps'].includes(a.kind)) groups.add('fi');
    else if (a.kind === 'crypto') groups.add('crypto');
  }
  return groups.size;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_asset', label: 'First Investment', description: 'Bought your first asset', icon: 'coin',
    test: ({ state }) => state.assets.length >= 1 },
  { id: 'first_lakh', label: 'First Lakh', description: 'Net worth crossed ₹1 lakh', icon: 'coin',
    test: ({ state }) => state.statement.netWorth >= 100_000 },
  { id: 'ten_lakh', label: 'Two Commas Coming', description: 'Net worth crossed ₹10 lakh', icon: 'coin',
    test: ({ state }) => state.statement.netWorth >= 1_000_000 },
  { id: 'crore', label: 'Crorepati', description: 'Net worth crossed ₹1 crore', icon: 'star',
    test: ({ state }) => state.statement.netWorth >= 10_000_000 },
  { id: 'diversified', label: 'Diversified', description: 'Held 4+ different asset classes', icon: 'shield',
    test: ({ state }) => distinctAssetGroups(state) >= 4 },
  { id: 'debt_slayer', label: 'Debt Slayer', description: 'Cleared all your debt after borrowing', icon: 'shield',
    test: ({ state, log }) => state.liabilities.length === 0 && log.some((e) => e.borrowed || e.category.startsWith('borrow')) },
  { id: 'iron_will', label: 'Iron Will', description: 'Resisted 5 temptations', icon: 'shield',
    test: ({ log }) => log.filter((e) => e.category === 'resist').length >= 5 },
  { id: 'side_income', label: 'Side Hustler', description: 'Started a side income stream', icon: 'die',
    test: ({ state }) => state.incomeStreams.some((i) => i.kind === 'freelance') },
  { id: 'recession_survivor', label: 'Held the Line', description: 'Survived a market contraction', icon: 'shield',
    test: ({ state }) => state.history.some((h) => h.marketPhase === 'contraction' || h.marketPhase === 'trough') && state.statement.netWorth > 0 },
  { id: 'first_passive', label: 'Money at Work', description: 'Earned your first passive income', icon: 'coin',
    test: ({ state }) => state.statement.passiveIncome > 0 },
  { id: 'free', label: 'Rat Race Escaped', description: 'Passive income covered your expenses', icon: 'star',
    test: ({ state }) => state.statement.totalExpenses > 0 && state.statement.passiveIncome >= state.statement.totalExpenses },
];

/** Return the ids that are currently satisfied. */
export function evaluateAchievements(ctx: AchievementContext): string[] {
  return ACHIEVEMENTS.filter((a) => a.test(ctx)).map((a) => a.id);
}

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
