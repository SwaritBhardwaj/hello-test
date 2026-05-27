/**
 * The wisdom layer.
 *
 * A curated library of lessons from respected finance personalities,
 * each gated by predicates over the player's *actual* journey (state +
 * history). Triggers look at the past, never the future — the engine
 * runs the player's playbook and surfaces the lesson that matches
 * what they're doing right now.
 *
 * Adding a lesson:
 *   - attribute to a real person; keep the quote accurate
 *   - write the lesson in your own words (1-2 sentences)
 *   - pick a tag, predicate, and priority
 *   - keep priority bands tight so urgent debt warnings always trump
 *     general wisdom
 */
import type { GameState } from '@/types';

export interface CoachLesson {
  id: string;
  attribution: string;
  quote: string;
  lesson: string;
  tag: 'spending' | 'saving' | 'debt' | 'investing' | 'behavioral' | 'risk' | 'general';
  /** 1 (background) → 5 (urgent) */
  priority: number;
  /** True if this lesson is relevant to the player's current trajectory. */
  applies: (state: GameState, ctx: CoachContext) => boolean;
}

/** Derived signals from state + history. Pure read of the past. */
export interface CoachContext {
  monthlyExpenses: number;
  monthlyIncome: number;
  cashOnHand: number;
  cashMonths: number;                // cash / monthlyExpenses
  netWorth: number;
  passiveIncome: number;
  passiveCoverage: number;           // passive / expenses
  emiToIncome: number;               // totalEMI / totalIncome
  ccDebt: number;                    // outstanding on credit_card loans
  hasEmergencyFund: boolean;         // cash >= 6mo expenses, no CC debt
  equityShare: number;               // equity assets / total assets (0..1)
  realEstateShare: number;
  cryptoShare: number;
  monthsPlayed: number;
  netWorthSlope12mo: number;         // ₹/mo growth over last 12 months
  consecutiveNegCashMonths: number;
  lifestyleExpenseGrowthPct: number; // lifestyle expense growth vs first 6mo avg
  marketPhase: GameState['market']['phase'];
}

export function buildCoachContext(state: GameState): CoachContext {
  const monthlyExpenses = state.statement.totalExpenses || 1;
  const monthlyIncome = state.statement.totalIncome || 1;
  const totalEMI = state.liabilities.reduce((s, l) => s + l.emi, 0);
  const ccDebt = state.liabilities
    .filter((l) => l.kind === 'credit_card')
    .reduce((s, l) => s + l.principalOutstanding, 0);
  const cashMonths = state.cashOnHand / monthlyExpenses;
  const hasEmergencyFund = cashMonths >= 6 && ccDebt === 0;

  // Asset class shares
  const totalAssetVal = state.assets.reduce((s, a) => s + a.currentPrice * a.units, 0) || 1;
  const equityVal = state.assets
    .filter((a) => ['stocks', 'index_fund', 'active_mf', 'business_equity'].includes(a.kind))
    .reduce((s, a) => s + a.currentPrice * a.units, 0);
  const reVal = state.assets
    .filter((a) => a.kind === 'real_estate_residential' || a.kind === 'real_estate_commercial' || a.kind === 'reit')
    .reduce((s, a) => s + a.currentPrice * a.units, 0);
  const cryptoVal = state.assets
    .filter((a) => a.kind === 'crypto')
    .reduce((s, a) => s + a.currentPrice * a.units, 0);

  // 12-month net worth slope
  const hist = state.history;
  const monthsPlayed = hist.length;
  let netWorthSlope12mo = 0;
  if (hist.length >= 12) {
    const recent = hist[hist.length - 1].netWorth;
    const back12 = hist[hist.length - 12].netWorth;
    netWorthSlope12mo = (recent - back12) / 12;
  }

  // Consecutive negative cash months
  let consecutiveNegCashMonths = 0;
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i].cashOnHand < 0) consecutiveNegCashMonths++;
    else break;
  }

  // Lifestyle expense growth (relative to first 6 months average)
  // We approximate by comparing current lifestyle expense to a "baseline" implied
  // by the first lifestyle expense the engine seeded.
  const currentLifestyle = state.expenses
    .filter((e) => e.category === 'lifestyle')
    .reduce((s, e) => s + e.monthlyAmount, 0);
  // Engine seeds with a small lifestyle floor; estimate the baseline conservatively
  const baselineLifestyle = Math.max(8000, monthlyIncome * 0.04);
  const lifestyleExpenseGrowthPct =
    baselineLifestyle > 0 ? (currentLifestyle - baselineLifestyle) / baselineLifestyle : 0;

  return {
    monthlyExpenses,
    monthlyIncome,
    cashOnHand: state.cashOnHand,
    cashMonths,
    netWorth: state.statement.netWorth,
    passiveIncome: state.statement.passiveIncome,
    passiveCoverage: state.statement.passiveIncome / monthlyExpenses,
    emiToIncome: totalEMI / monthlyIncome,
    ccDebt,
    hasEmergencyFund,
    equityShare: equityVal / totalAssetVal,
    realEstateShare: reVal / totalAssetVal,
    cryptoShare: cryptoVal / totalAssetVal,
    monthsPlayed,
    netWorthSlope12mo,
    consecutiveNegCashMonths,
    lifestyleExpenseGrowthPct,
    marketPhase: state.market.phase,
  };
}

// ============================================================
// The library
// ============================================================
export const WISDOM: CoachLesson[] = [
  // --- DEBT (urgent) ---
  {
    id: 'munger-debt',
    attribution: 'Charlie Munger',
    quote: '"There are only three ways a smart person can go broke: liquor, ladies and leverage."',
    lesson: 'Leverage (debt) turns small mistakes into terminal ones. Cut credit-card debt before it cuts you.',
    tag: 'debt',
    priority: 5,
    applies: (_s, c) => c.ccDebt > 0,
  },
  {
    id: 'ramsey-cc',
    attribution: 'Dave Ramsey',
    quote: '"The borrower is slave to the lender."',
    lesson:
      'Credit card APR (36%) is mathematically uncatchable by any safe investment. Pay it off first, even before investing.',
    tag: 'debt',
    priority: 5,
    applies: (_s, c) => c.ccDebt > 0,
  },
  {
    id: 'rd-cashflow',
    attribution: 'Robert Kiyosaki',
    quote: '"Rich people acquire assets. The poor and middle class acquire liabilities they think are assets."',
    lesson:
      `EMIs >${Math.round(40)}% of income means the bank owns more of your future income than you do. ` +
      `Target DTI < 40%, ideally < 30%.`,
    tag: 'debt',
    priority: 4,
    applies: (_s, c) => c.emiToIncome > 0.4,
  },

  // --- EMERGENCY FUND ---
  {
    id: 'housel-emergency',
    attribution: 'Morgan Housel',
    quote:
      '"Saving doesn\'t require a goal. Saving is a hedge against life\'s inevitable surprises."',
    lesson:
      `You have ${'<'}1 month of expenses in cash. Build to 6 months in a liquid fund before adding more investments. ` +
      `Without it, the next emergency becomes credit-card debt at 36%.`,
    tag: 'saving',
    priority: 5,
    applies: (_s, c) => c.cashMonths < 1 && c.consecutiveNegCashMonths < 2,
  },
  {
    id: 'taleb-fragility',
    attribution: 'Nassim Taleb',
    quote: '"The three most harmful addictions are heroin, carbohydrates, and a monthly salary."',
    lesson:
      'A 6-month emergency fund is what turns "I have to take this job" into "I can walk away." Optionality compounds.',
    tag: 'saving',
    priority: 3,
    applies: (_s, c) => c.cashMonths < 3 && c.monthsPlayed > 12,
  },

  // --- SPENDING / LIFESTYLE CREEP ---
  {
    id: 'buffett-needs',
    attribution: 'Warren Buffett',
    quote: '"If you buy things you don\'t need, soon you will have to sell things you need."',
    lesson:
      'Lifestyle inflation is the silent wealth killer. Every recurring expense increase locks you into needing higher income forever.',
    tag: 'spending',
    priority: 4,
    applies: (_s, c) => c.lifestyleExpenseGrowthPct > 0.5,
  },
  {
    id: 'graham-margin',
    attribution: 'Benjamin Graham',
    quote: '"The essence of investment management is the management of risks, not the management of returns."',
    lesson:
      'Your savings rate is what you control. Returns are not. A 30% savings rate at 8% returns beats 10% savings at 12%.',
    tag: 'spending',
    priority: 3,
    applies: (_s, c) => c.monthlyIncome - c.monthlyExpenses < c.monthlyIncome * 0.1,
  },

  // --- INVESTING / DIVERSIFICATION ---
  {
    id: 'bogle-index',
    attribution: 'John Bogle',
    quote: '"Don\'t look for the needle in the haystack. Just buy the haystack."',
    lesson:
      'Single-stock concentration vs index funds: ~70% of stocks trail the index over 20yr. Diversify the boring way.',
    tag: 'investing',
    priority: 3,
    applies: (_s, c) =>
      c.equityShare > 0 &&
      c.monthsPlayed > 24 &&
      c.passiveCoverage < 1, // still in build phase
  },
  {
    id: 'pabrai-concentration',
    attribution: 'Mohnish Pabrai',
    quote: '"Heads I win, tails I don\'t lose much."',
    lesson:
      'Asymmetric bets only work if a single loss can\'t end the game. Crypto/single-stock at >20% of net worth violates that.',
    tag: 'risk',
    priority: 4,
    applies: (_s, c) => c.cryptoShare > 0.15,
  },
  {
    id: 'lynch-know',
    attribution: 'Peter Lynch',
    quote: '"Know what you own, and know why you own it."',
    lesson:
      'You hold assets but the passive income is still ~0. Audit each: is it producing yield (rent/dividends/interest) or just promising appreciation? Both can be valid; both can\'t be hope.',
    tag: 'investing',
    priority: 2,
    applies: (s, c) => s.assets.length >= 3 && c.passiveCoverage < 0.05 && c.monthsPlayed > 24,
  },

  // --- BEHAVIORAL ---
  {
    id: 'buffett-fearful',
    attribution: 'Warren Buffett',
    quote: '"Be fearful when others are greedy, and greedy when others are fearful."',
    lesson:
      'Markets are in expansion/peak. Most fortunes are made by buying during contractions — which requires having cash WHEN it happens. Don\'t deploy 100% during euphoria.',
    tag: 'behavioral',
    priority: 3,
    applies: (_s, c) =>
      (c.marketPhase === 'expansion' || c.marketPhase === 'peak') &&
      c.cashMonths < 3 &&
      c.equityShare > 0.7,
  },
  {
    id: 'munger-patience',
    attribution: 'Charlie Munger',
    quote: '"The big money is not in the buying and the selling, but in the waiting."',
    lesson:
      'Compounding is exponential but linear-feeling for the first 10 years. Stay the course; the curve bends sharply in the second decade.',
    tag: 'behavioral',
    priority: 2,
    applies: (_s, c) => c.monthsPlayed < 60 && c.netWorthSlope12mo > 0,
  },
  {
    id: 'naval-leverage',
    attribution: 'Naval Ravikant',
    quote: '"Seek wealth, not money or status."',
    lesson:
      'Your salary buys things. Your assets buy time. You\'re ' +
      'closer to financial freedom than the number suggests if your passive income is growing month over month.',
    tag: 'general',
    priority: 2,
    applies: (_s, c) => c.passiveCoverage > 0.3 && c.passiveCoverage < 1,
  },
  {
    id: 'housel-survive',
    attribution: 'Morgan Housel',
    quote: '"More than I want big returns, I want to be financially unbreakable."',
    lesson:
      'Optimizing for survival > optimizing for returns. Most "great" investors had average returns but enormous longevity. Don\'t blow up — you can\'t compound from zero.',
    tag: 'risk',
    priority: 3,
    applies: (_s, c) => c.netWorth < 0 || c.consecutiveNegCashMonths >= 2,
  },
  {
    id: 'marks-cycles',
    attribution: 'Howard Marks',
    quote: '"You can\'t predict. You can prepare."',
    lesson:
      'Market\'s currently in ' + 'contraction/trough — these are when fortunes get made for the patient. Are you adding to investments or selling in fear?',
    tag: 'behavioral',
    priority: 4,
    applies: (_s, c) =>
      (c.marketPhase === 'contraction' || c.marketPhase === 'trough') && c.cashMonths > 6,
  },

  // --- INDIA-SPECIFIC ---
  {
    id: 'mukherjea-quality',
    attribution: 'Saurabh Mukherjea',
    quote: '"In India, ~15 companies have compounded at >25% for 25 years. Find them, hold them, sleep."',
    lesson:
      'Indian markets reward concentrated bets on quality compounders held forever. Trading destroys value via STCG (15%) and brokerage.',
    tag: 'investing',
    priority: 2,
    applies: (_s, c) => c.equityShare > 0 && c.monthsPlayed > 12,
  },
  {
    id: 'radhika-sip',
    attribution: 'Radhika Gupta',
    quote: '"SIP is not just a product. It\'s a behavior — the habit of investing through every market mood."',
    lesson:
      'Lump-sum entries at peaks underperform regular SIPs across full cycles. Automate the boring, then ignore it.',
    tag: 'investing',
    priority: 2,
    applies: (_s, c) => c.monthsPlayed > 6 && c.equityShare < 0.2 && c.passiveCoverage < 1,
  },

  // --- LATE-GAME GENERAL ---
  {
    id: 'housel-enough',
    attribution: 'Morgan Housel',
    quote: '"The hardest financial skill is getting the goalpost to stop moving."',
    lesson:
      'Your passive income covers most of your expenses. The question is no longer "more money" — it\'s "enough?". Define your enough or you\'ll never get there.',
    tag: 'general',
    priority: 3,
    applies: (_s, c) => c.passiveCoverage >= 0.7,
  },
];

/**
 * Pick the most relevant lesson for the player's current state.
 * Higher priority wins ties. Returns null if nothing applies.
 *
 * @param recentlyShown  IDs to deprioritize (already-seen this session)
 */
export function pickLesson(
  state: GameState,
  recentlyShown: string[] = [],
): { lesson: CoachLesson; context: CoachContext } | null {
  const ctx = buildCoachContext(state);
  const applicable = WISDOM.filter((l) => {
    try {
      return l.applies(state, ctx);
    } catch {
      return false;
    }
  });
  if (applicable.length === 0) return null;

  const recent = new Set(recentlyShown);
  // Sort: first by priority (desc), then by whether NOT in recent (fresh ones first)
  applicable.sort((a, b) => {
    const ra = recent.has(a.id) ? 1 : 0;
    const rb = recent.has(b.id) ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return b.priority - a.priority;
  });
  return { lesson: applicable[0], context: ctx };
}
