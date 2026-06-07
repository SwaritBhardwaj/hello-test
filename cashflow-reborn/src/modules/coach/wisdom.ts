/**
 * The wisdom layer.
 *
 * A curated library of lessons from respected finance personalities. Each
 * lesson cites its source, and triggers only on the player's own past
 * (state + history + decision log). The engine never peeks at future
 * card placements — it only knows what the player has done.
 *
 * Adding a lesson:
 *   - attribute to a real person; cite the book/letter/interview
 *   - mark `verified` honestly: 'verbatim', 'paraphrased', or 'attributed'
 *     (attributed = widely circulated, no firm primary source)
 *   - write the lesson in your own words (1-2 sentences)
 *   - pick a tag, predicate, and priority (1=background, 5=urgent debt)
 */
import type { GameState } from '@/types';
import type { CoachDecisionEntry } from './actionLog';

export interface CoachLesson {
  id: string;
  attribution: string;
  quote: string;
  lesson: string;
  /** Primary source — book/letter/interview. */
  source: string;
  /** Recommended reading: book title (and chapter if known). */
  book?: string;
  /** Verification level. */
  verified: 'verbatim' | 'paraphrased' | 'attributed';
  tag: 'spending' | 'saving' | 'debt' | 'investing' | 'behavioral' | 'risk' | 'general' | 'tax' | 'insurance' | 'career';
  /** 1 (background) → 5 (urgent) */
  priority: number;
  applies: (state: GameState, ctx: CoachContext) => boolean;
}

/** Derived signals from state + history + decision log. Pure read of the past. */
export interface CoachContext {
  // --- Snapshot ---
  monthlyExpenses: number;
  monthlyIncome: number;
  cashOnHand: number;
  cashMonths: number;
  netWorth: number;
  passiveIncome: number;
  passiveCoverage: number;
  emiToIncome: number;
  ccDebt: number;
  totalDebt: number;
  hasEmergencyFund: boolean;
  equityShare: number;
  realEstateShare: number;
  cryptoShare: number;
  singleAssetMaxShare: number;     // largest single holding as % of total assets
  monthsPlayed: number;
  netWorthSlope12mo: number;
  consecutiveNegCashMonths: number;
  lifestyleExpenseGrowthPct: number;
  marketPhase: GameState['market']['phase'];
  hasAnyInsurance: boolean;
  // --- Behavioral (from decision log) ---
  doodadOneshotLast12mo: number;
  doodadSubscriptionLast12mo: number;
  panicSellsLast24mo: number;       // sells during contraction/trough
  fomoBuysAtPeakLast24mo: number;   // stock/crypto buys during peak
  ccBailoutsLast24mo: number;       // chose CC on unseen-expense card
  resistsLast12mo: number;
  borrowedForDoodadEver: number;
  totalDecisions: number;
}

export function buildCoachContext(state: GameState, log: CoachDecisionEntry[]): CoachContext {
  const monthlyExpenses = state.statement.totalExpenses || 1;
  const monthlyIncome = state.statement.totalIncome || 1;
  const totalEMI = state.liabilities.reduce((s, l) => s + l.emi, 0);
  const ccDebt = state.liabilities
    .filter((l) => l.kind === 'credit_card')
    .reduce((s, l) => s + l.principalOutstanding, 0);
  const totalDebt = state.liabilities.reduce((s, l) => s + l.principalOutstanding, 0);
  const cashMonths = state.cashOnHand / monthlyExpenses;
  const hasEmergencyFund = cashMonths >= 6 && ccDebt === 0;

  const totalAssetVal = state.assets.reduce((s, a) => s + a.currentPrice * a.units, 0) || 1;
  const sharesByAsset = state.assets.map((a) => (a.currentPrice * a.units) / totalAssetVal);
  const singleAssetMaxShare = sharesByAsset.length > 0 ? Math.max(...sharesByAsset) : 0;
  const equityVal = state.assets
    .filter((a) => ['stocks', 'index_fund', 'active_mf', 'business_equity'].includes(a.kind))
    .reduce((s, a) => s + a.currentPrice * a.units, 0);
  const reVal = state.assets
    .filter((a) => a.kind === 'real_estate_residential' || a.kind === 'real_estate_commercial' || a.kind === 'reit')
    .reduce((s, a) => s + a.currentPrice * a.units, 0);
  const cryptoVal = state.assets
    .filter((a) => a.kind === 'crypto')
    .reduce((s, a) => s + a.currentPrice * a.units, 0);

  const hist = state.history;
  const monthsPlayed = hist.length;
  let netWorthSlope12mo = 0;
  if (hist.length >= 12) {
    netWorthSlope12mo = (hist[hist.length - 1].netWorth - hist[hist.length - 12].netWorth) / 12;
  }
  let consecutiveNegCashMonths = 0;
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i].cashOnHand < 0) consecutiveNegCashMonths++;
    else break;
  }
  const currentLifestyle = state.expenses
    .filter((e) => e.category === 'lifestyle')
    .reduce((s, e) => s + e.monthlyAmount, 0);
  const baselineLifestyle = Math.max(8000, monthlyIncome * 0.04);
  const lifestyleExpenseGrowthPct =
    baselineLifestyle > 0 ? (currentLifestyle - baselineLifestyle) / baselineLifestyle : 0;

  // Behavioral signals — only look at the past.
  const currentTick = state.meta.tick;
  const since = (months: number) => log.filter((e) => currentTick - e.tick <= months);
  const last12 = since(12);
  const last24 = since(24);
  const doodadOneshotLast12mo = last12.filter((e) => e.category === 'doodad_oneshot').length;
  const doodadSubscriptionLast12mo = last12.filter((e) => e.category === 'doodad_subscription').length;
  const panicSellsLast24mo = last24.filter(
    (e) => e.category === 'sell_asset' && (e.marketPhase === 'contraction' || e.marketPhase === 'trough'),
  ).length;
  const fomoBuysAtPeakLast24mo = last24.filter(
    (e) => (e.category === 'invest_stock' || e.category === 'invest_crypto') && e.marketPhase === 'peak',
  ).length;
  const ccBailoutsLast24mo = last24.filter((e) => e.category === 'unseen_expense_cc').length;
  const resistsLast12mo = last12.filter((e) => e.category === 'resist').length;
  const borrowedForDoodadEver = log.filter(
    (e) => (e.category === 'doodad_oneshot' || e.category === 'doodad_subscription') && e.borrowed,
  ).length;

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
    totalDebt,
    hasEmergencyFund,
    equityShare: equityVal / totalAssetVal,
    realEstateShare: reVal / totalAssetVal,
    cryptoShare: cryptoVal / totalAssetVal,
    singleAssetMaxShare,
    monthsPlayed,
    netWorthSlope12mo,
    consecutiveNegCashMonths,
    lifestyleExpenseGrowthPct,
    marketPhase: state.market.phase,
    hasAnyInsurance: state.insurance.length > 0,
    doodadOneshotLast12mo,
    doodadSubscriptionLast12mo,
    panicSellsLast24mo,
    fomoBuysAtPeakLast24mo,
    ccBailoutsLast24mo,
    resistsLast12mo,
    borrowedForDoodadEver,
    totalDecisions: log.length,
  };
}

// ============================================================
// The library — 50 lessons across spending, debt, saving, investing,
// behavioral finance, risk, taxes, insurance, career.
// ============================================================
export const WISDOM: CoachLesson[] = [
  // ============================================================
  // DEBT (priority 4-5)
  // ============================================================
  {
    id: 'munger-leverage',
    attribution: 'Charlie Munger',
    quote: '"There are only three ways a smart person can go broke: liquor, ladies and leverage."',
    lesson:
      'Buffett later quipped Munger only added the first two for the alliteration — the real killer is leverage. ' +
      `Your ${'>'}40% DTI / credit-card balance is the leverage Munger meant. Kill it first.`,
    source: 'Warren Buffett, CNBC Squawk Box, 26 Feb 2018 — attributing Munger',
    verified: 'verbatim',
    tag: 'debt',
    priority: 5,
    applies: (_s, c) => c.ccDebt > 0 || c.emiToIncome > 0.5,
  },
  {
    id: 'ramsey-borrower',
    attribution: 'Dave Ramsey',
    quote: '"The borrower is slave to the lender."',
    lesson:
      'Credit card APR (36% in India) is mathematically uncatchable by any safe investment. Pay it off before ' +
      'investing in equity — the guaranteed 36% saved beats any expected 12% earned.',
    source: 'Proverbs 22:7, cited throughout Ramsey\'s teaching',
    book: 'The Total Money Makeover (2003)',
    verified: 'verbatim',
    tag: 'debt',
    priority: 5,
    applies: (_s, c) => c.ccDebt > 0,
  },
  {
    id: 'kiyosaki-cashflow',
    attribution: 'Robert Kiyosaki',
    quote: '"Rich people acquire assets. The poor and middle class acquire liabilities they think are assets."',
    lesson:
      `EMIs at ${'>'}40% of income mean the bank owns more of your future income than you do. The house, the car — ` +
      'their EMIs are liabilities until paid off. Target DTI < 40%, ideally < 30%.',
    source: 'Rich Dad Poor Dad (1997), ch. 2',
    book: 'Rich Dad Poor Dad — flawed framework in places, but the income-statement intuition is gold',
    verified: 'paraphrased',
    tag: 'debt',
    priority: 4,
    applies: (_s, c) => c.emiToIncome > 0.4,
  },

  // ============================================================
  // EMERGENCY FUND / SAVING
  // ============================================================
  {
    id: 'housel-emergency',
    attribution: 'Morgan Housel',
    quote: '"Saving doesn\'t require a goal. Saving is a hedge against life\'s inevitable surprises."',
    lesson:
      'You have less than a month of expenses in cash. Build to 6 months in a liquid fund (5-7% yield) before ' +
      'adding new investments. Without it, the next emergency becomes credit-card debt at 36%.',
    source: 'The Psychology of Money (2020), ch. 11 — "Reasonable > Rational"',
    book: 'The Psychology of Money',
    verified: 'verbatim',
    tag: 'saving',
    priority: 5,
    applies: (_s, c) => c.cashMonths < 1 && c.consecutiveNegCashMonths < 2,
  },
  {
    id: 'taleb-salary',
    attribution: 'Nassim Nicholas Taleb',
    quote: '"The three most harmful addictions are heroin, carbohydrates, and a monthly salary."',
    lesson:
      'A 6-month emergency fund is what turns "I have to take this job" into "I can walk away." Optionality ' +
      'compounds the same way money does — invisibly, until you need it.',
    source: 'The Bed of Procrustes: Philosophical and Practical Aphorisms (2010)',
    book: 'The Bed of Procrustes',
    verified: 'verbatim',
    tag: 'saving',
    priority: 3,
    applies: (_s, c) => c.cashMonths < 3 && c.monthsPlayed > 12,
  },
  {
    id: 'vicki-life-energy',
    attribution: 'Vicki Robin',
    quote:
      '"Money is something we trade our life energy for. We sell our life energy in order to get money."',
    lesson:
      'Reframe expenses as hours of your life. A ₹50,000 phone at your post-tax hourly rate = X hours of your one ' +
      'finite life. Hard to spend frivolously once you do this math.',
    source: 'Your Money or Your Life (1992, updated 2018)',
    book: 'Your Money or Your Life',
    verified: 'paraphrased',
    tag: 'spending',
    priority: 3,
    applies: (_s, c) => c.lifestyleExpenseGrowthPct > 0.3 || c.doodadOneshotLast12mo >= 2,
  },
  {
    id: 'mmm-shockingly-simple',
    attribution: 'Mr. Money Mustache (Pete Adeney)',
    quote: '"Your time to retirement depends on only one number: your savings rate."',
    lesson:
      '50% savings rate = retire in ~17 years. 70% savings = ~9 years. Spending less is twice as powerful as ' +
      'earning more, because every rupee saved both adds to your nest egg AND lowers the target.',
    source: '"The Shockingly Simple Math Behind Early Retirement" (mrmoneymustache.com, 2012)',
    verified: 'paraphrased',
    tag: 'saving',
    priority: 3,
    applies: (_s, c) =>
      c.monthlyIncome > 0 && (c.monthlyIncome - c.monthlyExpenses) / c.monthlyIncome < 0.2 && c.monthsPlayed > 12,
  },

  // ============================================================
  // SPENDING / LIFESTYLE
  // ============================================================
  {
    id: 'buffett-needs',
    attribution: 'Warren Buffett',
    quote: '"If you buy things you don\'t need, soon you will have to sell things you need."',
    lesson:
      'Lifestyle inflation is the silent wealth killer. Every recurring expense locks you into needing higher ' +
      'income forever. The new car becomes the new normal becomes the floor.',
    source: 'Widely attributed; no verified primary source (likely apocryphal but spirit holds)',
    verified: 'attributed',
    tag: 'spending',
    priority: 4,
    applies: (_s, c) => c.lifestyleExpenseGrowthPct > 0.5 || c.doodadSubscriptionLast12mo >= 2,
  },
  {
    id: 'ramit-conscious',
    attribution: 'Ramit Sethi',
    quote: '"Spend extravagantly on the things you love, and cut costs mercilessly on the things you don\'t."',
    lesson:
      "Don't aim to spend less on everything — aim to know what you actually value. ₹10K on books a month is " +
      'great if reading transforms you; ₹500 on subscriptions you never watch is silly. Be conscious, not cheap.',
    source: 'I Will Teach You to Be Rich (2009), Conscious Spending Plan',
    book: 'I Will Teach You to Be Rich',
    verified: 'verbatim',
    tag: 'spending',
    priority: 2,
    applies: (_s, c) => c.doodadSubscriptionLast12mo >= 3,
  },
  {
    id: 'graham-savings-rate',
    attribution: 'Benjamin Graham',
    quote: '"The essence of investment management is the management of risks, not the management of returns."',
    lesson:
      'Your savings rate is what you control. Returns are not. A 30% savings rate at 8% returns ends up richer ' +
      'than 10% savings at 12% returns over 30 years.',
    source: 'The Intelligent Investor (1949, rev. 1973)',
    book: 'The Intelligent Investor, ch. 20',
    verified: 'verbatim',
    tag: 'spending',
    priority: 3,
    applies: (_s, c) => c.monthlyIncome - c.monthlyExpenses < c.monthlyIncome * 0.1 && c.monthsPlayed > 6,
  },

  // ============================================================
  // BEHAVIORAL FINANCE — research-backed
  // ============================================================
  {
    id: 'kahneman-loss',
    attribution: 'Daniel Kahneman',
    quote: '"Losses loom larger than gains."',
    lesson:
      "You feel a ₹10K loss roughly 2x more painfully than a ₹10K gain feels good (loss aversion). That's why " +
      "panic-selling at the bottom feels rational in the moment, and why most people underperform their own funds.",
    source: 'Thinking, Fast and Slow (2011), Prospect Theory',
    book: 'Thinking, Fast and Slow, ch. 26-28',
    verified: 'paraphrased',
    tag: 'behavioral',
    priority: 4,
    applies: (_s, c) => c.panicSellsLast24mo >= 1,
  },
  {
    id: 'thaler-mental',
    attribution: 'Richard Thaler',
    quote: '"All money is fungible. We just don\'t treat it that way."',
    lesson:
      'Mental accounting: people splurge their tax refund / bonus even when they\'d never withdraw the same amount ' +
      'from their savings to spend. That ₹1L bonus = the same as your ₹1L emergency fund. Treat it as such.',
    source: 'Misbehaving: The Making of Behavioral Economics (2015)',
    book: 'Misbehaving',
    verified: 'paraphrased',
    tag: 'behavioral',
    priority: 2,
    applies: (_s, c) => c.totalDecisions > 12 && c.lifestyleExpenseGrowthPct > 0.3,
  },
  {
    id: 'cialdini-social',
    attribution: 'Robert Cialdini',
    quote: '"Social proof is most powerful when we are uncertain."',
    lesson:
      "FOMO operates on social proof: everyone's buying, so it must be smart. Markets in expansion/peak are " +
      'maximum social proof — and maximum risk. The crowd is right in the middle, wrong at the extremes.',
    source: 'Influence: The Psychology of Persuasion (1984)',
    book: 'Influence',
    verified: 'paraphrased',
    tag: 'behavioral',
    priority: 4,
    applies: (_s, c) => c.fomoBuysAtPeakLast24mo >= 1,
  },

  // ============================================================
  // INVESTING — diversification, costs, quality
  // ============================================================
  {
    id: 'bogle-haystack',
    attribution: 'John Bogle',
    quote: '"Don\'t look for the needle in the haystack. Just buy the haystack."',
    lesson:
      "~70% of actively-picked stocks trail the index over 20+ years. Single stocks ARE fun, but no single stock " +
      'should be >5-10% of your portfolio. Index funds are the haystack.',
    source: 'The Little Book of Common Sense Investing (2007)',
    book: 'The Little Book of Common Sense Investing',
    verified: 'verbatim',
    tag: 'investing',
    priority: 3,
    applies: (_s, c) =>
      c.equityShare > 0 && c.monthsPlayed > 24 && c.passiveCoverage < 1 && c.singleAssetMaxShare > 0.15,
  },
  {
    id: 'bogle-costs',
    attribution: 'John Bogle',
    quote: '"In investing, you get what you don\'t pay for."',
    lesson:
      'Costs compound against you the same way returns compound for you. A 1.5% expense ratio over 30 years ' +
      'eats ~35% of your final corpus. Choose direct-plan index funds (0.1-0.5% TER) over regular plans.',
    source: 'The Little Book of Common Sense Investing (2007)',
    book: 'The Little Book of Common Sense Investing',
    verified: 'verbatim',
    tag: 'investing',
    priority: 2,
    applies: (s) => s.assets.some((a) => a.kind === 'active_mf'),
  },
  {
    id: 'pabrai-asymmetric',
    attribution: 'Mohnish Pabrai',
    quote: '"Heads I win, tails I don\'t lose much."',
    lesson:
      "Asymmetric bets only work if a single loss can't end the game. Crypto / single-stock at >15% of net worth " +
      'violates that — you can\'t be patient if a 70% drawdown wipes you out.',
    source: 'The Dhandho Investor (2007)',
    book: 'The Dhandho Investor',
    verified: 'verbatim',
    tag: 'risk',
    priority: 4,
    applies: (_s, c) => c.cryptoShare > 0.15 || c.singleAssetMaxShare > 0.4,
  },
  {
    id: 'lynch-know',
    attribution: 'Peter Lynch',
    quote: '"Know what you own, and know why you own it."',
    lesson:
      'You hold assets but passive income is still trivial. Audit each: is it producing yield (rent/dividends/' +
      "interest) or just promising appreciation? Both can be valid; neither can be hope.",
    source: 'One Up On Wall Street (1989)',
    book: 'One Up On Wall Street',
    verified: 'verbatim',
    tag: 'investing',
    priority: 2,
    applies: (s, c) => s.assets.length >= 3 && c.passiveCoverage < 0.05 && c.monthsPlayed > 24,
  },
  {
    id: 'fisher-quality',
    attribution: 'Philip Fisher',
    quote: '"The stock market is filled with individuals who know the price of everything, but the value of nothing."',
    lesson:
      'Quality compounds. A great business at a fair price beats a fair business at a great price over decades. ' +
      "Fisher's 15 points (scuttlebutt method) work as well today as in 1958.",
    source: 'Common Stocks and Uncommon Profits (1958)',
    book: 'Common Stocks and Uncommon Profits',
    verified: 'paraphrased',
    tag: 'investing',
    priority: 2,
    applies: (s) => s.assets.some((a) => a.kind === 'stocks'),
  },
  {
    id: 'greenblatt-magic',
    attribution: 'Joel Greenblatt',
    quote: '"The secret to investing is to figure out the value of something and then pay a lot less."',
    lesson:
      'Magic Formula: buy good businesses (high ROC) at cheap prices (high earnings yield), hold mechanically. ' +
      "Beats most active funds because it removes you from the loop — the failure mode is always you.",
    source: 'The Little Book That Beats the Market (2005)',
    book: 'The Little Book That Beats the Market',
    verified: 'verbatim',
    tag: 'investing',
    priority: 1,
    applies: (s) => s.assets.some((a) => a.kind === 'stocks'),
  },
  {
    id: 'swensen-allocation',
    attribution: 'David Swensen',
    quote: '"Asset allocation is the most important investment decision."',
    lesson:
      'Roughly 90% of long-term returns come from asset mix (equity/debt/RE/gold), not stock-picking. Set your ' +
      'target allocation; rebalance yearly; ignore the daily noise.',
    source: 'Pioneering Portfolio Management (2000)',
    book: 'Pioneering Portfolio Management',
    verified: 'paraphrased',
    tag: 'investing',
    priority: 2,
    applies: (_s, c) => c.singleAssetMaxShare > 0.6 && c.monthsPlayed > 12,
  },
  {
    id: 'dalio-allweather',
    attribution: 'Ray Dalio',
    quote: '"The holy grail of investing is to find 10-15 good, uncorrelated return streams."',
    lesson:
      "Uncorrelated assets in a single portfolio reduce risk without sacrificing return. Don't just diversify " +
      'across stocks — diversify across equity, bonds, gold, RE, international. They zig when others zag.',
    source: 'Principles (2017); All Weather portfolio (Bridgewater)',
    book: 'Principles',
    verified: 'paraphrased',
    tag: 'investing',
    priority: 2,
    applies: (_s, c) => c.equityShare > 0.85 && c.monthsPlayed > 24,
  },

  // ============================================================
  // MARKET TIMING / CYCLES
  // ============================================================
  {
    id: 'buffett-fearful',
    attribution: 'Warren Buffett',
    quote: '"Be fearful when others are greedy, and greedy when others are fearful."',
    lesson:
      'Markets are in expansion/peak. Most fortunes are made by buying contractions — which requires cash WHEN it ' +
      'happens. Hold dry powder during euphoria; deploy it during fear.',
    source: 'Berkshire Hathaway 1986 Letter to Shareholders',
    verified: 'verbatim',
    tag: 'behavioral',
    priority: 3,
    applies: (_s, c) =>
      (c.marketPhase === 'expansion' || c.marketPhase === 'peak') && c.cashMonths < 3 && c.equityShare > 0.7,
  },
  {
    id: 'marks-prepare',
    attribution: 'Howard Marks',
    quote: '"You can\'t predict. You can prepare."',
    lesson:
      "Market's in contraction/trough — these are when fortunes get made for the patient. Are you adding to " +
      'investments or selling in fear? Position size during fear, not during euphoria.',
    source: 'Oaktree Memos; The Most Important Thing (2011)',
    book: 'The Most Important Thing',
    verified: 'verbatim',
    tag: 'behavioral',
    priority: 4,
    applies: (_s, c) =>
      (c.marketPhase === 'contraction' || c.marketPhase === 'trough') && c.cashMonths > 6,
  },
  {
    id: 'marks-second-level',
    attribution: 'Howard Marks',
    quote: '"To be a successful investor, you have to think differently from the crowd, and better."',
    lesson:
      'Second-level thinking: the crowd thinks "X is going up, buy!" — you think "X is going up, who\'s holding ' +
      'the bag when it stops?" Mediocre returns come from consensus; outperformance comes from variant perception.',
    source: 'The Most Important Thing (2011)',
    book: 'The Most Important Thing',
    verified: 'paraphrased',
    tag: 'behavioral',
    priority: 2,
    applies: (_s, c) => c.fomoBuysAtPeakLast24mo >= 1,
  },
  {
    id: 'munger-waiting',
    attribution: 'Charlie Munger',
    quote: '"The big money is not in the buying and the selling, but in the waiting."',
    lesson:
      'Compounding is exponential but linear-feeling for the first 10 years. Most people sell out before the ' +
      'curve bends sharply in the second decade. Stay invested; do nothing well.',
    source: 'Daily Journal Annual Meetings, various; oft-cited',
    verified: 'verbatim',
    tag: 'behavioral',
    priority: 2,
    applies: (_s, c) => c.monthsPlayed < 60 && c.netWorthSlope12mo > 0,
  },

  // ============================================================
  // RISK / TALEB
  // ============================================================
  {
    id: 'taleb-skin',
    attribution: 'Nassim Nicholas Taleb',
    quote: '"Don\'t tell me what you think, tell me what you have in your portfolio."',
    lesson:
      "Anyone who pitches you a bet — stock tip, real estate deal, business — should be in it themselves with " +
      'meaningful skin. Otherwise their advice is free options on your money.',
    source: 'Skin in the Game (2018)',
    book: 'Skin in the Game',
    verified: 'verbatim',
    tag: 'risk',
    priority: 3,
    applies: (_s, c) => c.totalDecisions > 12 && (c.cryptoShare > 0.05 || c.fomoBuysAtPeakLast24mo > 0),
  },
  {
    id: 'taleb-barbell',
    attribution: 'Nassim Nicholas Taleb',
    quote: '"If you put 90% of your funds in extremely safe assets and 10% in very risky ones, your worst case is much better than putting 100% in moderately risky assets."',
    lesson:
      "Barbell strategy: most of your money in dead-safe (FD, PPF, liquid funds); a small slice in moonshots " +
      '(angel investing, crypto, single stocks). Avoid the middle — moderate risk is the most fragile.',
    source: 'Antifragile (2012)',
    book: 'Antifragile',
    verified: 'paraphrased',
    tag: 'risk',
    priority: 2,
    applies: (_s, c) => c.equityShare > 0.5 && c.cashMonths < 6 && c.monthsPlayed > 24,
  },
  {
    id: 'housel-survive',
    attribution: 'Morgan Housel',
    quote: '"More than I want big returns, I want to be financially unbreakable."',
    lesson:
      "Optimizing for survival > optimizing for returns. Most great investors had average returns but enormous " +
      "longevity. Don't blow up — you can't compound from zero.",
    source: 'The Psychology of Money (2020), ch. 6 — "Tails, You Win"',
    book: 'The Psychology of Money',
    verified: 'paraphrased',
    tag: 'risk',
    priority: 3,
    applies: (_s, c) => c.netWorth < 0 || c.consecutiveNegCashMonths >= 2,
  },

  // ============================================================
  // INSURANCE — Indian context
  // ============================================================
  {
    id: 'halan-insurance',
    attribution: 'Monika Halan',
    quote: '"Insurance is for protection. Investment is for growth. Don\'t mix them."',
    lesson:
      "Buy pure term life (insurance) + pure equity SIPs (investment) separately. ULIPs / endowment plans give " +
      'you bad insurance AND bad returns. A ₹1Cr term cover for a 30-year-old non-smoker = ~₹10K/year.',
    source: 'Let\'s Talk Money (2018)',
    book: 'Let\'s Talk Money — the best India-specific personal finance book',
    verified: 'paraphrased',
    tag: 'insurance',
    priority: 3,
    applies: (_s, c) => !c.hasAnyInsurance && c.monthsPlayed > 12 && c.netWorth > 500_000,
  },
  {
    id: 'clark-term',
    attribution: 'Clark Howard',
    quote: '"Buy term and invest the difference."',
    lesson:
      "Term life is cheap because it pays out only if you die during the term. The 'difference' (vs whole-life " +
      'premiums) invested in equity over 30 years vastly exceeds any whole-life payout. Math wins.',
    source: 'Clark Howard radio show, decades of consistent guidance',
    verified: 'verbatim',
    tag: 'insurance',
    priority: 2,
    applies: (_s, c) => !c.hasAnyInsurance && c.monthsPlayed > 6,
  },

  // ============================================================
  // RETIREMENT / FIRE math
  // ============================================================
  {
    id: 'bengen-4pct',
    attribution: 'Bill Bengen',
    quote: '"4% is the safe withdrawal rate over a 30-year retirement."',
    lesson:
      "FIRE math: corpus = 25x annual expenses. ₹50K/mo expenses → need ₹1.5Cr to retire safely. India inflation " +
      'is higher than US; conservative is 3.5% withdrawal, i.e. corpus = ~28x.',
    source: 'Bill Bengen, "Determining Withdrawal Rates Using Historical Data" (1994)',
    verified: 'paraphrased',
    tag: 'general',
    priority: 2,
    applies: (_s, c) => c.passiveCoverage > 0.5 && c.passiveCoverage < 1,
  },
  {
    id: 'pfau-glidepath',
    attribution: 'Wade Pfau',
    quote: '"The greatest risk in retirement is the sequence of returns in the first decade."',
    lesson:
      'A 30% crash in retirement Year 1 hurts far more than the same crash in Year 20. Reduce equity share as ' +
      'you approach the goalpost; build a 3-year cash bucket.',
    source: 'Safety-First Retirement Planning (2019)',
    book: 'Safety-First Retirement Planning',
    verified: 'paraphrased',
    tag: 'general',
    priority: 2,
    applies: (_s, c) => c.passiveCoverage > 0.8 && c.equityShare > 0.7,
  },

  // ============================================================
  // INDIAN VOICES
  // ============================================================
  {
    id: 'mukherjea-quality',
    attribution: 'Saurabh Mukherjea',
    quote:
      '"In India, ~15 companies have compounded at >25% for 25 years. Find them, hold them, sleep."',
    lesson:
      'Indian markets reward concentrated bets on quality compounders held forever. Trading destroys value via ' +
      'STCG (15%) and brokerage. Coffee Can Investing: buy great businesses, do nothing for a decade.',
    source: 'Coffee Can Investing (2018); Marcellus Investment Managers blog',
    book: 'Coffee Can Investing',
    verified: 'paraphrased',
    tag: 'investing',
    priority: 2,
    applies: (_s, c) => c.equityShare > 0 && c.monthsPlayed > 12,
  },
  {
    id: 'radhika-sip',
    attribution: 'Radhika Gupta',
    quote: '"SIP is not just a product. It\'s a behavior — the habit of investing through every market mood."',
    lesson:
      'Lump-sum entries at peaks underperform regular SIPs across full cycles. Automate the boring monthly ' +
      'investment, then ignore it. Discipline > timing.',
    source: 'Mint columns, Edelweiss MF commentary; widely quoted',
    book: 'Limitless (2024)',
    verified: 'paraphrased',
    tag: 'investing',
    priority: 2,
    applies: (_s, c) => c.monthsPlayed > 6 && c.equityShare < 0.2 && c.passiveCoverage < 1,
  },
  {
    id: 'kamath-slow',
    attribution: 'Nithin Kamath',
    quote: '"Wealth is built slowly. F&O, intraday, get-rich-quick — that\'s how it gets destroyed."',
    lesson:
      "Zerodha's own data: ~90% of F&O traders lose money. The brokerage profits from your trades; you don't. " +
      'Slow, boring index SIPs beat the smartest day-trader you know.',
    source: 'Nithin Kamath interviews and Zerodha\'s F&O loss disclosures (SEBI)',
    verified: 'paraphrased',
    tag: 'risk',
    priority: 4,
    applies: (_s, c) => c.fomoBuysAtPeakLast24mo >= 2 || c.cryptoShare > 0.2,
  },
  {
    id: 'kedia-volatility',
    attribution: 'Vijay Kedia',
    quote:
      '"To make money in the stock market you need patience, courage, and conviction — and SMILE: Small in size, ' +
      'Medium in experience, Inside huge potential, Large market opportunity, Excellent management."',
    lesson:
      'Kedia\'s SMILE framework filters small-caps. Most small-caps go to zero; the few survivors deliver 100x. ' +
      'Concentrated bets only after the filter, never on tips.',
    source: 'Vijay Kedia public talks; well-documented interviews',
    verified: 'paraphrased',
    tag: 'investing',
    priority: 1,
    applies: (s) => s.assets.some((a) => a.kind === 'stocks') && s.assets.length >= 3,
  },
  {
    id: 'kamra-valuation',
    attribution: 'Pranjal Kamra',
    quote: '"Price is what you pay. Value is what you get."',
    lesson:
      'A great company at a stupid price is a stupid investment. PE > 60 on a mature business is rarely worth ' +
      'it — the future has to deliver everything perfectly.',
    source: 'Originally Buffett (1986 letter), popularised in India via Finology / Kamra videos',
    verified: 'verbatim',
    tag: 'investing',
    priority: 2,
    applies: (_s, c) => c.fomoBuysAtPeakLast24mo >= 1,
  },
  {
    id: 'shenoy-cycles',
    attribution: 'Deepak Shenoy',
    quote: '"The market doesn\'t care about your portfolio."',
    lesson:
      "Don't fall in love with a holding. The market reprices on facts (mostly), not on how long you've held. " +
      "If the thesis breaks, sell — don't wait to break even.",
    source: 'Capitalmind blog and podcast',
    verified: 'paraphrased',
    tag: 'behavioral',
    priority: 1,
    applies: (_s, c) => c.panicSellsLast24mo === 0 && c.monthsPlayed > 36,
  },
  {
    id: 'warikoo-career',
    attribution: 'Ankur Warikoo',
    quote: '"Your salary is the worst form of income — it stops the moment you stop."',
    lesson:
      'Career capital (skills, network, reputation) is your highest-ROI asset in your 20s-30s. Invest in it over ' +
      'side hustles for low pay. The compound rate on rare skills beats every market.',
    source: 'Warikoo public talks; "Do Epic Shit" (2021)',
    book: 'Do Epic Shit',
    verified: 'paraphrased',
    tag: 'career',
    priority: 2,
    applies: (_s, c) => c.monthsPlayed > 6 && c.monthsPlayed < 60,
  },

  // ============================================================
  // BEHAVIORAL PATTERN-TRIGGERED LESSONS (from player's actual decisions)
  // ============================================================
  {
    id: 'pattern-panic-sell',
    attribution: 'Warren Buffett',
    quote: '"The stock market is a device for transferring money from the impatient to the patient."',
    lesson:
      `You sold ${'1+'} time(s) during a market contraction. That's the textbook way to convert paper losses ` +
      'into permanent ones. Crashes are when shares change hands from the weak to the strong; pick a side.',
    source: 'Buffett, various; widely cited in Berkshire letters',
    verified: 'paraphrased',
    tag: 'behavioral',
    priority: 5,
    applies: (_s, c) => c.panicSellsLast24mo >= 1,
  },
  {
    id: 'pattern-fomo-peak',
    attribution: 'Howard Marks',
    quote: '"The riskiest moment is when you\'re right."',
    lesson:
      'You bought volatile assets during a market peak. That\'s the textbook FOMO entry — the chart looks great ' +
      'right until it doesn\'t. Asset prices revert; cash flow doesn\'t lie.',
    source: 'Oaktree memo "Risk Revisited Again" (2015)',
    book: 'The Most Important Thing',
    verified: 'paraphrased',
    tag: 'behavioral',
    priority: 5,
    applies: (_s, c) => c.fomoBuysAtPeakLast24mo >= 1,
  },
  {
    id: 'pattern-doodad-binge',
    attribution: 'Will Rogers',
    quote: '"Too many people spend money they haven\'t earned, to buy things they don\'t want, to impress people they don\'t like."',
    lesson:
      `You bought 3+ doodads in the last 12 months. Each one feels small in isolation; together they reset your ` +
      'baseline forever. Try the 48-hour rule: want it for 48 hours; if you still do, then maybe.',
    source: 'Will Rogers, attributed; popularised by Dave Ramsey',
    verified: 'attributed',
    tag: 'spending',
    priority: 4,
    applies: (_s, c) => c.doodadOneshotLast12mo >= 3,
  },
  {
    id: 'pattern-borrow-for-want',
    attribution: 'Thomas J. Stanley',
    quote: '"Wealthy people position themselves not to need much income. Wannabes work to fund consumption."',
    lesson:
      'You borrowed to buy a doodad. That\'s the cardinal sin of personal finance — paying interest on something ' +
      "that's depreciating. Whatever you bought, it just cost ~25% more than the sticker price.",
    source: 'The Millionaire Next Door (1996)',
    book: 'The Millionaire Next Door',
    verified: 'paraphrased',
    tag: 'debt',
    priority: 5,
    applies: (_s, c) => c.borrowedForDoodadEver >= 1,
  },
  {
    id: 'pattern-cc-bailout',
    attribution: 'Dave Ramsey',
    quote: '"Credit cards are not your friend in an emergency. They are the emergency."',
    lesson:
      `You've fallen back on credit cards for ${'unexpected'} expenses ${'multiple'} times. That's the emergency-` +
      'fund deficit talking. Fix the cause (no liquid savings) not the symptom (each emergency separately).',
    source: 'Ramsey radio show, persistent theme',
    book: 'The Total Money Makeover',
    verified: 'paraphrased',
    tag: 'debt',
    priority: 5,
    applies: (_s, c) => c.ccBailoutsLast24mo >= 2,
  },
  {
    id: 'pattern-subscription-creep',
    attribution: 'Morgan Housel',
    quote: '"Wealth is what you don\'t see."',
    lesson:
      `You've added 2+ monthly subscriptions in the last year. ₹2K/mo subscriptions × 30 years × 12% = ₹70L ` +
      "compounded. Audit recurring expenses quarterly; if you didn't use it last month, kill it.",
    source: 'The Psychology of Money (2020), ch. 10 — "Save Money"',
    book: 'The Psychology of Money',
    verified: 'verbatim',
    tag: 'spending',
    priority: 3,
    applies: (_s, c) => c.doodadSubscriptionLast12mo >= 2,
  },
  {
    id: 'pattern-resist-praise',
    attribution: 'Charlie Munger',
    quote: '"The first rule of compounding: never interrupt it unnecessarily."',
    lesson:
      `You've resisted ${'3+'} tempting purchases in the past year. That's the discipline that makes the math ` +
      'work. The boring sustained behavior, not the heroic occasional sacrifice, is what compounds.',
    source: 'Charlie Munger, various Daily Journal meetings',
    verified: 'paraphrased',
    tag: 'general',
    priority: 1,
    applies: (_s, c) => c.resistsLast12mo >= 3,
  },

  // ============================================================
  // GENERAL / META
  // ============================================================
  {
    id: 'munger-incentives',
    attribution: 'Charlie Munger',
    quote: '"Show me the incentive and I\'ll show you the outcome."',
    lesson:
      'Your insurance agent earns commission on the product they sell; your broker earns on trades. ' +
      "Always ask: who's incentivized for me to do this, and how? Then read fine print.",
    source: 'Poor Charlie\'s Almanack (2005), repeated by Munger throughout his career',
    book: 'Poor Charlie\'s Almanack',
    verified: 'verbatim',
    tag: 'general',
    priority: 2,
    applies: (_s, c) => c.monthsPlayed > 24,
  },
  {
    id: 'naval-leverage',
    attribution: 'Naval Ravikant',
    quote: '"Seek wealth, not money or status."',
    lesson:
      'Your salary buys things. Your assets buy time. You\'re closer to financial freedom than the headline ' +
      'number suggests if your passive income is growing month over month.',
    source: 'The Almanack of Naval Ravikant (2020), "How to Get Rich"',
    book: 'The Almanack of Naval Ravikant',
    verified: 'verbatim',
    tag: 'general',
    priority: 2,
    applies: (_s, c) => c.passiveCoverage > 0.3 && c.passiveCoverage < 1,
  },
  {
    id: 'housel-enough',
    attribution: 'Morgan Housel',
    quote: '"The hardest financial skill is getting the goalpost to stop moving."',
    lesson:
      "Your passive income covers most expenses. The question is no longer 'more money' — it's 'enough?'. " +
      "Define your enough explicitly or you'll never get there. Wealth without enough is just a treadmill.",
    source: 'The Psychology of Money (2020), ch. 3 — "Never Enough"',
    book: 'The Psychology of Money',
    verified: 'verbatim',
    tag: 'general',
    priority: 3,
    applies: (_s, c) => c.passiveCoverage >= 0.7,
  },
  {
    id: 'taleb-via-negativa',
    attribution: 'Nassim Nicholas Taleb',
    quote: '"Don\'t lose; the rest takes care of itself."',
    lesson:
      'Via negativa: improve by removing, not adding. Cut high-interest debt before chasing the next investment ' +
      "idea. Eliminate ruin scenarios first — the upside takes care of itself.",
    source: 'Antifragile (2012)',
    book: 'Antifragile',
    verified: 'paraphrased',
    tag: 'risk',
    priority: 3,
    applies: (_s, c) => c.ccDebt > 0 || c.cryptoShare > 0.3,
  },
];

/**
 * Pick the most relevant lesson for the player's current state + history.
 *
 * Selection is a PURE function of (state, log): highest priority wins, and
 * among the top-priority tier we rotate deterministically by the in-game month
 * so the panel still varies as the player's journey evolves.
 *
 * IMPORTANT: this intentionally does NOT depend on a "recently shown" list.
 * An earlier version deprioritized recently-shown lessons, but the UI fed its
 * own output back in as input — once more than 6 lessons applied at once, the
 * pick never stabilized and <CoachInsight> looped setState every render,
 * crashing the whole app to a white screen. See tests/whitescreen-repro.test.ts.
 */
export function pickLesson(
  state: GameState,
  log: CoachDecisionEntry[],
): { lesson: CoachLesson; context: CoachContext } | null {
  const ctx = buildCoachContext(state, log);
  const applicable = WISDOM.filter((l) => {
    try {
      return l.applies(state, ctx);
    } catch {
      return false;
    }
  });
  if (applicable.length === 0) return null;
  // Highest-priority tier, in stable WISDOM order.
  const maxPriority = Math.max(...applicable.map((l) => l.priority));
  const topTier = applicable.filter((l) => l.priority === maxPriority);
  // Rotate within the tier by month — a stable input, so the result can never
  // oscillate within a single render.
  const idx = ((state.meta.tick % topTier.length) + topTier.length) % topTier.length;
  return { lesson: topTier[idx], context: ctx };
}
