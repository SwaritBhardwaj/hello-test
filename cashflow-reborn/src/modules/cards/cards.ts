import type { GameState, AssetClass, RealEstateMeta, LoanKind } from '@/types';
import { PRNG } from '@/engine/prng/prng';
import { buildLoan } from '@/modules/loans/loans';
import { LOAN_RATES } from '@/data/constants';

export type CardKind =
  | 'deal_real_estate'
  | 'deal_stock'
  | 'deal_index_fund'
  | 'deal_gold'
  | 'deal_business'
  | 'doodad'
  | 'side_hustle'
  | 'unseen_expense'
  | 'borrow_offer'
  | 'market_event'
  | 'payday_bonus';

export interface CardOption {
  id: string;
  label: string;
  detail?: string;
  apply: (state: GameState) => string;
  affordCheck?: (state: GameState) => string | null;
  /** Cash needed for this option. If set and cash < cashCost, the UI offers a
   *  "Borrow & buy" alternative that takes a personal loan to cover the gap. */
  cashCost?: number;
  /** Coach-mode warning: shown under the button to teach what choosing this means. */
  coachWarning?: string;
}

export interface Card {
  id: string;
  kind: CardKind;
  emoji: string;
  title: string;
  subtitle?: string;
  description: string;
  rows?: { label: string; value: string }[];
  options: CardOption[];
  /** 1 = barely tempting, 5 = "you NEED this". UX nudge only. */
  temptation: number;
  /** One-line flavor explaining the temptation. */
  temptationReason: string;
  /** Coach-mode lesson: the financial concept behind this card. */
  coachNote?: string;
}

/** Compound a one-time cost over N years to show "the real cost". */
function compounded30y(amount: number): number {
  return Math.round(amount * Math.pow(1.12, 30));
}
function compounded30yMonthly(monthly: number): number {
  // SIP-style: FV of monthly contribution over 30y at 12% annual
  const r = Math.pow(1.12, 1 / 12) - 1;
  const n = 30 * 12;
  return Math.round(monthly * ((Math.pow(1 + r, n) - 1) / r));
}

const lakh = 100_000;

function newId(prefix: string, state: GameState): string {
  return `${prefix}_${state.meta.tick}_${Math.floor(Math.random() * 1e6)}`;
}

function pushAsset(
  state: GameState,
  fields: {
    kind: AssetClass;
    label: string;
    units: number;
    unitCost: number;
    yieldRateAnnual: number;
    meta?: RealEstateMeta;
  },
): string {
  const id = newId('asset', state);
  state.assets.push({
    id,
    kind: fields.kind,
    label: fields.label,
    units: fields.units,
    unitCost: fields.unitCost,
    currentPrice: fields.unitCost,
    acquiredAt: state.meta.tick,
    yieldRateAnnual: fields.yieldRateAnnual,
    meta: fields.meta,
  });
  return id;
}

function pushLoan(
  state: GameState,
  opts: { kind: LoanKind; label: string; principal: number; tenureMonths: number; rate?: number; linkedAssetId?: string },
): number {
  const built = buildLoan(opts);
  const loan = { ...built, id: newId('loan', state), startedAt: state.meta.tick };
  state.liabilities.push(loan);
  return loan.emi;
}

// ============================================================
// Card generators
// ============================================================

function realEstateCard(state: GameState, rng: PRNG): Card {
  const city = state.player.city;
  const phaseMult = state.market.indices.real_estate_residential;
  const types: Array<{
    propertyType: RealEstateMeta['propertyType'];
    baseLakh: [number, number];
    rentPctAnnual: number;
    label: string;
  }> = [
    { propertyType: 'flat_1bhk', baseLakh: [35, 70], rentPctAnnual: 0.028, label: '1BHK flat' },
    { propertyType: 'flat_2bhk', baseLakh: [60, 140], rentPctAnnual: 0.025, label: '2BHK flat' },
    { propertyType: 'flat_3bhk', baseLakh: [90, 250], rentPctAnnual: 0.022, label: '3BHK flat' },
    { propertyType: 'plot', baseLakh: [25, 120], rentPctAnnual: 0.005, label: 'plot of land' },
    { propertyType: 'commercial', baseLakh: [80, 300], rentPctAnnual: 0.07, label: 'commercial unit' },
  ];
  const pick = types[Math.floor(rng.next() * types.length)];
  const cityMult = city === 'T1' ? 1.6 : city === 'T2' ? 1.0 : 0.7;
  const lakhsRaw = pick.baseLakh[0] + rng.next() * (pick.baseLakh[1] - pick.baseLakh[0]);
  const price = Math.round(lakhsRaw * lakh * cityMult * phaseMult);
  const monthlyRent = Math.round((price * pick.rentPctAnnual) / 12);
  const isCommercial = pick.propertyType === 'commercial';
  const assetKind: AssetClass = isCommercial ? 'real_estate_commercial' : 'real_estate_residential';
  const tenureMonths = 20 * 12;
  const downPct = 0.25;
  const downPayment = Math.round(price * downPct);
  const closingCosts = Math.round(price * 0.05); // stamp duty, registration, brokerage
  const loanAmount = price - downPayment;
  const homeEMI = Math.round(
    (loanAmount * (LOAN_RATES.home.rate / 12) * Math.pow(1 + LOAN_RATES.home.rate / 12, tenureMonths)) /
      (Math.pow(1 + LOAN_RATES.home.rate / 12, tenureMonths) - 1),
  );
  const totalCash = downPayment + closingCosts;

  const buildAsset = (): RealEstateMeta => ({
    city,
    propertyType: pick.propertyType,
    isTenanted: pick.rentPctAnnual > 0.01,
    monthlyRent,
    maintenancePerMonth: Math.round(monthlyRent * 0.08),
    propertyTaxPerYear: Math.round(price * 0.005),
    vacancyProbability: 0.04,
  });

  return {
    id: newId('card', state),
    kind: 'deal_real_estate',
    emoji: isCommercial ? '🏢' : '🏠',
    title: `${pick.label.charAt(0).toUpperCase() + pick.label.slice(1)} in ${city}`,
    subtitle: `Market: ${state.market.phase}`,
    description: `A ${pick.label} is on the market. Yield from rent: ~${(pick.rentPctAnnual * 100).toFixed(1)}% p.a.`,
    rows: [
      { label: 'Price', value: `₹${(price / lakh).toFixed(1)}L` },
      { label: 'Monthly rent', value: `₹${monthlyRent.toLocaleString('en-IN')}` },
      { label: '25% down + costs', value: `₹${(totalCash / lakh).toFixed(1)}L` },
      { label: 'EMI (20y @ 8.5%)', value: `₹${homeEMI.toLocaleString('en-IN')}/mo` },
    ],
    options: [
      {
        id: 'cash',
        label: `Buy outright (₹${(price / lakh).toFixed(1)}L + ₹${(closingCosts / lakh).toFixed(1)}L costs)`,
        cashCost: price + closingCosts,
        affordCheck: (s) =>
          s.cashOnHand < price + closingCosts
            ? `Need ₹${((price + closingCosts) / lakh).toFixed(1)}L cash`
            : null,
        apply: (s) => {
          s.cashOnHand -= price + closingCosts;
          pushAsset(s, {
            kind: assetKind,
            label: `${pick.label} (${city})`,
            units: 1,
            unitCost: price,
            yieldRateAnnual: pick.rentPctAnnual,
            meta: buildAsset(),
          });
          return `Bought ${pick.label} outright`;
        },
      },
      {
        id: 'loan',
        label: `Buy with ₹${(totalCash / lakh).toFixed(1)}L down + home loan`,
        cashCost: totalCash,
        detail: `EMI ₹${homeEMI.toLocaleString('en-IN')}/mo · cashflow ${
          monthlyRent - homeEMI >= 0 ? '+' : ''
        }₹${(monthlyRent - homeEMI).toLocaleString('en-IN')}/mo`,
        affordCheck: (s) =>
          s.cashOnHand < totalCash ? `Need ₹${(totalCash / lakh).toFixed(1)}L cash` : null,
        apply: (s) => {
          s.cashOnHand -= totalCash;
          const assetId = pushAsset(s, {
            kind: assetKind,
            label: `${pick.label} (${city})`,
            units: 1,
            unitCost: price,
            yieldRateAnnual: pick.rentPctAnnual,
            meta: buildAsset(),
          });
          const emi = pushLoan(s, {
            kind: 'home',
            label: `Home loan: ${pick.label}`,
            principal: loanAmount,
            tenureMonths,
            linkedAssetId: assetId,
          });
          return `Bought ${pick.label} with loan, EMI ₹${emi.toLocaleString('en-IN')}/mo`;
        },
      },
      { id: 'skip', label: 'Pass', apply: () => 'Passed on deal' },
    ],
    temptation: isCommercial ? 3 : 4,
    temptationReason: 'Property! Your uncle says it always doubles. Your spouse already mentally lives there.',
    coachNote:
      `Cap rate = annual rent ÷ price = ${(pick.rentPctAnnual * 100).toFixed(1)}%. ` +
      `Below ~4% = priced for appreciation, not cashflow. With 25% down and a loan, you're 4x leveraged: ` +
      `a 10% price drop wipes out your equity. Inflation here ≈ 5.5% p.a. — that's the floor you're beating.`,
  };
}

function stockCard(state: GameState, rng: PRNG): Card {
  const tickers = [
    { sym: 'RELIANCE', sector: 'Energy', yieldAnnual: 0.005 },
    { sym: 'HDFCBANK', sector: 'Banking', yieldAnnual: 0.012 },
    { sym: 'INFY', sector: 'IT', yieldAnnual: 0.025 },
    { sym: 'TCS', sector: 'IT', yieldAnnual: 0.018 },
    { sym: 'ITC', sector: 'FMCG', yieldAnnual: 0.035 },
    { sym: 'ASIANPAINT', sector: 'Materials', yieldAnnual: 0.008 },
    { sym: 'BAJFINANCE', sector: 'Finance', yieldAnnual: 0.003 },
    { sym: 'TATAMOTORS', sector: 'Auto', yieldAnnual: 0.0 },
  ];
  const pick = tickers[Math.floor(rng.next() * tickers.length)];
  const basePrice = Math.round((500 + rng.next() * 3500) * state.market.indices.stocks);
  const lotSize = Math.max(5, Math.round(50_000 / basePrice));
  const totalCost = basePrice * lotSize;
  return {
    id: newId('card', state),
    kind: 'deal_stock',
    emoji: '📈',
    title: `${pick.sym} — ${pick.sector}`,
    subtitle: `Market: ${state.market.phase}`,
    description: `Equity in ${pick.sym}. High volatility; can be sold any month from the balance sheet.`,
    rows: [
      { label: 'Price/share', value: `₹${basePrice.toLocaleString('en-IN')}` },
      { label: 'Suggested lot', value: `${lotSize} shares` },
      { label: 'Lot cost', value: `₹${totalCost.toLocaleString('en-IN')}` },
      { label: 'Dividend yield', value: `${(pick.yieldAnnual * 100).toFixed(2)}% p.a.` },
    ],
    options: [
      {
        id: 'buy',
        label: `Buy ${lotSize} shares (₹${totalCost.toLocaleString('en-IN')})`,
        cashCost: totalCost,
        affordCheck: (s) => (s.cashOnHand < totalCost ? 'Insufficient cash' : null),
        apply: (s) => {
          s.cashOnHand -= totalCost;
          pushAsset(s, {
            kind: 'stocks',
            label: pick.sym,
            units: lotSize,
            unitCost: basePrice,
            yieldRateAnnual: pick.yieldAnnual,
          });
          return `Bought ${lotSize} ${pick.sym}`;
        },
      },
      { id: 'skip', label: 'Pass', apply: () => 'Passed on stock' },
    ],
    temptation: 3,
    temptationReason: 'A friend on WhatsApp says this is going to 5x by year-end. The chart looks bullish.',
    coachNote:
      `Single stocks: ~70% of them trail the index over 20+ years. ` +
      `Even good picks have 30-50% drawdowns regularly. Position-size accordingly: ` +
      `no single stock should be >5-10% of your portfolio. STCG tax = 15% if held <1yr, LTCG = 10% above ₹1L gains/yr.`,
  };
}

function indexFundCard(state: GameState, rng: PRNG): Card {
  const funds = [
    { name: 'NIFTY 50 Index Fund', kind: 'index_fund' as AssetClass, yield: 0.013 },
    { name: 'NIFTY Next 50 Index', kind: 'index_fund' as AssetClass, yield: 0.011 },
    { name: 'Parag Parikh Flexi Cap', kind: 'active_mf' as AssetClass, yield: 0.008 },
    { name: 'Nippon Small Cap', kind: 'active_mf' as AssetClass, yield: 0.005 },
    { name: 'Embassy REIT', kind: 'reit' as AssetClass, yield: 0.062 },
  ];
  const pick = funds[Math.floor(rng.next() * funds.length)];
  const nav = Math.round(50 + rng.next() * 350);
  const units = Math.round(25_000 / nav);
  const cost = nav * units;
  return {
    id: newId('card', state),
    kind: 'deal_index_fund',
    emoji: pick.kind === 'reit' ? '🏛️' : '📊',
    title: pick.name,
    subtitle: 'SIP-eligible',
    description: `Diversified equity exposure. Lower variance than individual stocks.`,
    rows: [
      { label: 'NAV', value: `₹${nav}` },
      { label: 'Suggested SIP lot', value: `${units} units = ₹${cost.toLocaleString('en-IN')}` },
      { label: 'Yield', value: `${(pick.yield * 100).toFixed(2)}% p.a.` },
    ],
    options: [
      {
        id: 'buy',
        label: `Buy ${units} units (₹${cost.toLocaleString('en-IN')})`,
        cashCost: cost,
        affordCheck: (s) => (s.cashOnHand < cost ? 'Insufficient cash' : null),
        apply: (s) => {
          s.cashOnHand -= cost;
          pushAsset(s, {
            kind: pick.kind,
            label: pick.name,
            units,
            unitCost: nav,
            yieldRateAnnual: pick.yield,
          });
          return `Bought ${units} units of ${pick.name}`;
        },
      },
      { id: 'skip', label: 'Pass', apply: () => 'Passed' },
    ],
    temptation: 2,
    temptationReason: 'The boring sensible choice. No dopamine, just compounding.',
    coachNote:
      pick.kind === 'reit'
        ? `REIT = Real Estate Investment Trust. Fund that owns rental properties; trades on the exchange like a stock. ` +
          `~90% of rental income gets paid out as dividends. Lower minimum than buying property; instantly liquid.`
        : `Index funds track a basket (NIFTY 50, etc.) at low expense ratios (<0.5%). ` +
          `Over 20+ years they outperform 80%+ of active funds after fees. SIP = monthly auto-buy, smooths price entry. ` +
          `LTCG (held >1yr) = 10% on gains above ₹1L per FY.`,
  };
}

function goldCard(state: GameState, rng: PRNG): Card {
  const pricePerGm = Math.round(7500 * state.market.indices.gold);
  const grams = 10 + Math.floor(rng.next() * 40);
  const cost = pricePerGm * grams;
  return {
    id: newId('card', state),
    kind: 'deal_gold',
    emoji: '🥇',
    title: 'Sovereign Gold Bond',
    subtitle: 'Hedge against inflation',
    description: 'Government-backed gold bond. 2.5% nominal interest + price appreciation.',
    rows: [
      { label: 'Price/gm', value: `₹${pricePerGm.toLocaleString('en-IN')}` },
      { label: 'Lot', value: `${grams}g` },
      { label: 'Lot cost', value: `₹${cost.toLocaleString('en-IN')}` },
    ],
    options: [
      {
        id: 'buy',
        label: `Buy ${grams}g (₹${cost.toLocaleString('en-IN')})`,
        cashCost: cost,
        affordCheck: (s) => (s.cashOnHand < cost ? 'Insufficient cash' : null),
        apply: (s) => {
          s.cashOnHand -= cost;
          pushAsset(s, {
            kind: 'gold',
            label: `Gold bond ${grams}g`,
            units: grams,
            unitCost: pricePerGm,
            yieldRateAnnual: 0.025,
          });
          return `Bought ${grams}g gold`;
        },
      },
      { id: 'skip', label: 'Pass', apply: () => 'Passed' },
    ],
    temptation: 2,
    temptationReason: 'Your mom keeps reminding you that gold has never let her down.',
    coachNote:
      `Gold: long-term ~8% returns, mostly inflation hedge. Negative correlation with equity in crashes. ` +
      `Sovereign Gold Bonds (SGB) > physical gold: 2.5% extra interest, no storage, no making charges, ` +
      `capital gains tax-free if held to maturity. Keep gold under 10% of portfolio.`,
  };
}

function businessCard(state: GameState, rng: PRNG): Card {
  const ventures = [
    { name: 'Cloud kitchen franchise', cost: 8 * lakh, monthlyProfit: 25_000, risk: 'medium' },
    { name: 'Coffee cart', cost: 3 * lakh, monthlyProfit: 12_000, risk: 'low' },
    { name: 'D2C apparel brand', cost: 15 * lakh, monthlyProfit: 40_000, risk: 'high' },
    { name: 'Tuition center', cost: 5 * lakh, monthlyProfit: 18_000, risk: 'low' },
    { name: 'Friend\'s startup (angel)', cost: 5 * lakh, monthlyProfit: 0, risk: 'very high' },
  ];
  const pick = ventures[Math.floor(rng.next() * ventures.length)];
  const yieldAnnual = pick.cost > 0 ? (pick.monthlyProfit * 12) / pick.cost : 0;
  return {
    id: newId('card', state),
    kind: 'deal_business',
    emoji: '💼',
    title: pick.name,
    subtitle: `Risk: ${pick.risk}`,
    description: 'Side business opportunity. Illiquid; treat as long-term commitment.',
    rows: [
      { label: 'Investment', value: `₹${(pick.cost / lakh).toFixed(1)}L` },
      { label: 'Expected monthly', value: `₹${pick.monthlyProfit.toLocaleString('en-IN')}` },
      { label: 'Implied yield', value: `${(yieldAnnual * 100).toFixed(1)}% p.a.` },
    ],
    options: [
      {
        id: 'buy',
        label: `Invest ₹${(pick.cost / lakh).toFixed(1)}L`,
        cashCost: pick.cost,
        affordCheck: (s) => (s.cashOnHand < pick.cost ? 'Insufficient cash' : null),
        apply: (s) => {
          s.cashOnHand -= pick.cost;
          pushAsset(s, {
            kind: 'business_equity',
            label: pick.name,
            units: 1,
            unitCost: pick.cost,
            yieldRateAnnual: yieldAnnual,
          });
          return `Invested in ${pick.name}`;
        },
      },
      { id: 'skip', label: 'Pass', apply: () => 'Passed' },
    ],
    temptation: 3,
    temptationReason: 'Imagine the LinkedIn announcement. Imagine quitting your job.',
    coachNote:
      `Private business equity: high return potential (15-25%) but ~70% of small businesses fail in 5 years. ` +
      `Illiquid — you can't sell quickly if you need cash. Position max 10-15% of net worth. ` +
      `Angel/startup tickets: assume 0 unless you can wait 7-10 years and lose it all.`,
  };
}

function doodadCard(state: GameState, rng: PRNG): Card {
  const doodads = [
    { name: 'New iPhone Pro', cash: 1_50_000, monthly: 0, emoji: '📱', temptation: 5, reason: 'Your colleague pulled theirs out at lunch. Yours is suddenly embarrassing.' },
    { name: 'Weekend in Goa', cash: 35_000, monthly: 0, emoji: '🏖️', temptation: 4, reason: 'You\'ve been working hard. You DESERVE this. (Do you?)' },
    { name: 'Smart TV upgrade', cash: 85_000, monthly: 0, emoji: '📺', temptation: 3, reason: 'The new one is OLED. The current one is fine, but… OLED.' },
    { name: 'Wardrobe refresh', cash: 25_000, monthly: 0, emoji: '👗', temptation: 3, reason: 'Festive sale. 70% off. Limited stock. (Always limited.)' },
    { name: 'Gym membership', cash: 0, monthly: 3500, emoji: '💪', temptation: 4, reason: 'This is the year. You\'re absolutely going to use it. Definitely.' },
    { name: 'Streaming bundle', cash: 0, monthly: 1200, emoji: '🎬', temptation: 3, reason: 'It\'s ONLY ₹1200/mo. What\'s ₹1200/mo? (₹4.3L over 30 years.)' },
    { name: 'Fancy dining out', cash: 0, monthly: 6000, emoji: '🍽️', temptation: 4, reason: 'Date night, work dinners, weekend brunches. It\'s the lifestyle.' },
    { name: 'Designer handbag', cash: 65_000, monthly: 0, emoji: '👜', temptation: 4, reason: 'It\'s an investment. Bags hold value. (Spoiler: they mostly don\'t.)' },
    { name: 'Two-wheeler upgrade', cash: 1_80_000, monthly: 0, emoji: '🛵', temptation: 5, reason: 'The salesperson just let you sit on it. Game over.' },
    { name: 'Crypto plunge (memecoin)', cash: 40_000, monthly: 0, emoji: '🪙', temptation: 5, reason: 'A stranger on Twitter just 100x\'d. Your turn?' },
    { name: 'New car (downpayment)', cash: 3_00_000, monthly: 0, emoji: '🚗', temptation: 5, reason: 'Your old car still works. But the new one has VENTILATED SEATS.' },
  ];
  const pick = doodads[Math.floor(rng.next() * doodads.length)];
  const description = pick.monthly > 0
    ? `Adds ₹${pick.monthly.toLocaleString('en-IN')}/mo to lifestyle expenses forever.`
    : `One-time ₹${pick.cash.toLocaleString('en-IN')} hit to cash.`;
  return {
    id: newId('card', state),
    kind: 'doodad',
    emoji: pick.emoji,
    title: pick.name,
    subtitle: 'Doodad',
    description,
    rows: pick.monthly > 0
      ? [{ label: 'Monthly cost', value: `₹${pick.monthly.toLocaleString('en-IN')}` }]
      : [{ label: 'One-time cost', value: `₹${pick.cash.toLocaleString('en-IN')}` }],
    options: [
      {
        id: 'buy',
        label: pick.monthly > 0 ? 'Subscribe' : 'Buy it',
        cashCost: pick.cash > 0 ? pick.cash : undefined,
        affordCheck: (s) => (pick.cash > 0 && s.cashOnHand < pick.cash ? 'Insufficient cash' : null),
        apply: (s) => {
          if (pick.cash > 0) s.cashOnHand -= pick.cash;
          if (pick.monthly > 0) {
            const line = s.expenses.find((e) => e.category === 'lifestyle');
            if (line) line.monthlyAmount += pick.monthly;
            else
              s.expenses.push({
                category: 'lifestyle',
                label: pick.name,
                monthlyAmount: pick.monthly,
                inflationIndex: 'lifestyle',
                isVariable: false,
              });
          }
          return `Bought: ${pick.name}`;
        },
      },
      { id: 'skip', label: resistLabel(pick.temptation), apply: () => `Resisted ${pick.name}` },
    ],
    temptation: pick.temptation,
    temptationReason: pick.reason,
    coachNote: doodadCoachNote(pick.cash, pick.monthly, pick.name),
  };
}

function doodadCoachNote(oneTime: number, monthly: number, name: string): string {
  if (monthly > 0) {
    const futureValue = compounded30yMonthly(monthly);
    return (
      `Monthly subscription of ₹${monthly.toLocaleString('en-IN')} = ₹${(futureValue / 1e7).toFixed(1)} Cr ` +
      `if invested instead at 12% over 30 years. Lifestyle creep is the silent killer of wealth: ` +
      `small recurring expenses compound against you, just like investments compound for you.`
    );
  }
  const futureValue = compounded30y(oneTime);
  return (
    `₹${oneTime.toLocaleString('en-IN')} today = ₹${(futureValue / 1e5).toFixed(1)} L if invested at 12% over 30 years. ` +
    `That's the "${name}" tax on Future-You. Doesn't mean don't buy it — just buy it knowing the trade.`
  );
}

function resistLabel(temptation: number): string {
  if (temptation >= 5) return 'Resist (almost impossible)';
  if (temptation >= 4) return 'Resist (hard)';
  if (temptation >= 3) return 'Resist';
  return 'Pass';
}

function sideHustleCard(state: GameState, rng: PRNG): Card {
  const gigs = [
    { name: 'Weekend consulting', monthly: 25_000, months: 6 },
    { name: 'Online course royalties', monthly: 8_000, months: 24 },
    { name: 'Freelance design contract', monthly: 18_000, months: 4 },
    { name: 'Rental of spare room', monthly: 12_000, months: 12 },
  ];
  const pick = gigs[Math.floor(rng.next() * gigs.length)];
  return {
    id: newId('card', state),
    kind: 'side_hustle',
    emoji: '⚡',
    title: pick.name,
    subtitle: 'Side hustle',
    description: `Adds ₹${pick.monthly.toLocaleString('en-IN')}/mo for ~${pick.months} months. Costs evenings.`,
    rows: [
      { label: 'Income', value: `₹${pick.monthly.toLocaleString('en-IN')}/mo` },
      { label: 'Duration', value: `${pick.months} months (simplified: forever in v0.2)` },
    ],
    options: [
      {
        id: 'accept',
        label: 'Take it',
        apply: (s) => {
          s.incomeStreams.push({
            id: newId('inc', s),
            kind: 'freelance',
            monthlyGross: pick.monthly,
            tdsRate: 0.10,
            taxable: true,
          });
          return `Took side hustle: ${pick.name}`;
        },
      },
      { id: 'skip', label: 'Decline', apply: () => 'Declined gig' },
    ],
    temptation: 3,
    temptationReason: 'Easy extra income… but evenings and weekends are not free.',
    coachNote:
      `Side hustles are leverage on your time. The math: ₹${pick.monthly.toLocaleString('en-IN')}/mo for ${pick.months} months ` +
      `= ₹${(pick.monthly * pick.months).toLocaleString('en-IN')} gross. After 30% tax + opportunity cost of evenings, ` +
      `the net is real but smaller. Most useful for plugging a savings gap or funding a specific goal.`,
  };
}

function unseenExpenseCard(state: GameState, rng: PRNG): Card {
  const items = [
    { name: 'Car breakdown', cost: 22_000, emoji: '🔧' },
    { name: 'Laptop died', cost: 95_000, emoji: '💻' },
    { name: 'Family wedding contribution', cost: 75_000, emoji: '💒' },
    { name: 'Parents need help', cost: 40_000, emoji: '👨‍👩‍👧' },
    { name: 'Home repair (leak)', cost: 28_000, emoji: '🚰' },
    { name: 'Dental work', cost: 35_000, emoji: '🦷' },
    { name: 'Speeding ticket', cost: 5_000, emoji: '🚓' },
  ];
  const pick = items[Math.floor(rng.next() * items.length)];
  return {
    id: newId('card', state),
    kind: 'unseen_expense',
    emoji: pick.emoji,
    title: pick.name,
    subtitle: 'Unforeseen',
    description: `An unexpected ₹${pick.cost.toLocaleString('en-IN')} expense.`,
    rows: [{ label: 'Cost', value: `₹${pick.cost.toLocaleString('en-IN')}` }],
    options: [
      {
        id: 'pay',
        label: 'Pay from cash',
        cashCost: pick.cost,
        affordCheck: (s) => (s.cashOnHand < pick.cost ? `Need ₹${pick.cost.toLocaleString('en-IN')}` : null),
        apply: (s) => {
          s.cashOnHand -= pick.cost;
          return `Paid ₹${pick.cost.toLocaleString('en-IN')} for ${pick.name}`;
        },
        coachWarning: `Best option. Zero interest. This is why you keep an emergency fund.`,
      },
      {
        id: 'cc',
        label: 'Put on credit card (36% p.a.)',
        apply: (s) => {
          const emi = pushLoan(s, {
            kind: 'credit_card',
            label: `CC: ${pick.name}`,
            principal: pick.cost,
            tenureMonths: 6,
          });
          return `On credit card @ 36% — EMI ₹${emi.toLocaleString('en-IN')}/mo`;
        },
        coachWarning:
          `WORST option. 36% p.a. is loanshark territory. ` +
          `₹${pick.cost.toLocaleString('en-IN')} over 6 months ≈ ₹${Math.round(pick.cost * 0.11).toLocaleString('en-IN')} interest paid.`,
      },
      {
        id: 'personal',
        label: 'Personal loan (13.5% p.a., 3yr)',
        apply: (s) => {
          const emi = pushLoan(s, {
            kind: 'personal',
            label: `Loan for ${pick.name}`,
            principal: pick.cost,
            tenureMonths: 36,
          });
          return `Personal loan taken — EMI ₹${emi.toLocaleString('en-IN')}/mo`;
        },
        coachWarning:
          `OK if you must borrow. Rate ~3x cheaper than CC. ` +
          `Total interest over 3yr ≈ ₹${Math.round(pick.cost * 0.22).toLocaleString('en-IN')}.`,
      },
    ],
    temptation: 5,
    temptationReason: 'Not optional. Life doesn\'t ask permission.',
    coachNote:
      `Why emergency funds exist. Rule of thumb: 6 months of expenses parked in a liquid fund / savings (3-7% yield). ` +
      `Without one, you pay 36% on credit cards instead of earning 12% on equity — a 48-point swing on every rupee.`,
  };
}

function borrowOfferCard(state: GameState, rng: PRNG): Card {
  const offers: Array<{ kind: LoanKind; label: string; principal: number; tenureMonths: number; emoji: string }> = [
    { kind: 'personal', label: 'Pre-approved personal loan', principal: 5 * lakh, tenureMonths: 36, emoji: '🏦' },
    { kind: 'personal', label: 'Personal loan offer', principal: 10 * lakh, tenureMonths: 48, emoji: '🏦' },
    { kind: 'credit_card', label: 'New credit card (₹3L limit)', principal: 3 * lakh, tenureMonths: 1, emoji: '💳' },
    { kind: 'car', label: 'Car loan offer', principal: 8 * lakh, tenureMonths: 60, emoji: '🚗' },
  ];
  const pick = offers[Math.floor(rng.next() * offers.length)];
  const rate = LOAN_RATES[pick.kind].rate;
  const emi = Math.round(
    (pick.principal * (rate / 12) * Math.pow(1 + rate / 12, pick.tenureMonths)) /
      (Math.pow(1 + rate / 12, pick.tenureMonths) - 1),
  );
  return {
    id: newId('card', state),
    kind: 'borrow_offer',
    emoji: pick.emoji,
    title: pick.label,
    subtitle: `${(rate * 100).toFixed(1)}% p.a.`,
    description: 'Borrowed money is real money — and so is the EMI.',
    rows: [
      { label: 'Principal', value: `₹${(pick.principal / lakh).toFixed(1)}L` },
      { label: 'Tenure', value: `${pick.tenureMonths} months` },
      { label: 'EMI', value: `₹${emi.toLocaleString('en-IN')}/mo` },
    ],
    options: [
      {
        id: 'accept',
        label: `Take loan (+₹${(pick.principal / lakh).toFixed(1)}L cash)`,
        apply: (s) => {
          s.cashOnHand += pick.principal;
          pushLoan(s, { kind: pick.kind, label: pick.label, principal: pick.principal, tenureMonths: pick.tenureMonths });
          return `Took ${pick.label}`;
        },
        coachWarning:
          `Total interest over ${pick.tenureMonths} months ≈ ₹${(emi * pick.tenureMonths - pick.principal).toLocaleString('en-IN')}. ` +
          `If you can't articulate WHY you need this loan right now, decline.`,
      },
      { id: 'skip', label: 'Decline', apply: () => 'Declined offer' },
    ],
    temptation: 4,
    temptationReason: 'Pre-approved. One tap. Cash in your account by tomorrow.',
    coachNote:
      `DTI rule: total EMIs ÷ gross monthly income should stay under 40% (some say 30%). ` +
      `Pre-approved means the bank thinks you can pay, not that you should. Personal loans @ 13.5%+ ` +
      `only make sense for high-return investments — and there are very few of those.`,
  };
}

function paydayBonusCard(state: GameState, _rng: PRNG): Card {
  const salary = state.incomeStreams.find((i) => i.kind === 'salary')?.monthlyGross ?? 0;
  const bonus = Math.round(salary * (0.5 + Math.random() * 1.5));
  return {
    id: newId('card', state),
    kind: 'payday_bonus',
    emoji: '🎉',
    title: 'Performance bonus!',
    subtitle: 'Lump sum from employer',
    description: `Your manager hands you a bonus of ₹${bonus.toLocaleString('en-IN')}.`,
    rows: [{ label: 'Bonus', value: `₹${bonus.toLocaleString('en-IN')}` }],
    options: [
      {
        id: 'take',
        label: 'Cash it',
        apply: (s) => {
          s.cashOnHand += bonus;
          return `+₹${bonus.toLocaleString('en-IN')} bonus`;
        },
      },
    ],
    temptation: 1,
    temptationReason: 'Free money. Nothing to resist.',
    coachNote:
      `Windfall psychology: bonuses, tax refunds, gifts feel "free" so we spend them harder than salary. ` +
      `Pre-decide where windfalls go (50% invest, 30% goal, 20% guilt-free spend) before they arrive.`,
  };
}

function marketEventCard(state: GameState, _rng: PRNG): Card {
  const phase = state.market.phase;
  const isUp = phase === 'expansion' || phase === 'recovery';
  return {
    id: newId('card', state),
    kind: 'market_event',
    emoji: isUp ? '📰' : '⚠️',
    title: isUp ? 'Headline: markets rally' : 'Headline: markets jittery',
    subtitle: `Phase: ${phase}`,
    description: isUp
      ? 'Equities up sharply this month. FOMO is loud.'
      : 'Volatility spiked. Talking heads predict the worst.',
    rows: [
      { label: 'Equity index', value: state.market.indices.stocks.toFixed(2) },
      { label: 'Repo rate', value: `${(state.market.repoRate * 100).toFixed(2)}%` },
      { label: 'Inflation', value: `${(state.market.inflationAnnual * 100).toFixed(2)}%` },
    ],
    options: [{ id: 'ack', label: 'Noted', apply: () => 'Read the news' }],
    temptation: 1,
    temptationReason: 'A news headline. The action is what you do next month.',
    coachNote: isUp
      ? `Markets at peaks: this is when FOMO peaks too. Lump-sum entries into peaks underperform SIPs. ` +
        `Resist the urge to chase. Boring discipline beats hot tips.`
      : `Crashes are when fortunes get made — but only for those who already had cash. ` +
        `If you're forced-selling during a crash you've already lost. Emergency fund + SIPs through fear = the strategy.`,
  };
}

// ============================================================
// Random draw with weighting
// ============================================================

const GENERATORS: Array<{ weight: number; gen: (s: GameState, r: PRNG) => Card }> = [
  { weight: 3, gen: indexFundCard },
  { weight: 2, gen: stockCard },
  { weight: 2, gen: realEstateCard },
  { weight: 1, gen: goldCard },
  { weight: 1, gen: businessCard },
  { weight: 3, gen: doodadCard },
  { weight: 2, gen: sideHustleCard },
  { weight: 2, gen: unseenExpenseCard },
  { weight: 1, gen: borrowOfferCard },
  { weight: 2, gen: marketEventCard },
  { weight: 1, gen: paydayBonusCard },
];

export function drawRandomCard(state: GameState, rng: PRNG): Card {
  const total = GENERATORS.reduce((s, g) => s + g.weight, 0);
  const pick = rng.next() * total;
  let acc = 0;
  for (const g of GENERATORS) {
    acc += g.weight;
    if (pick < acc) return g.gen(state, rng);
  }
  return GENERATORS[0].gen(state, rng);
}

// ============================================================
// Tile types — the board square you land on biases the card
// ============================================================

export type TileType = 'deal' | 'temptation' | 'market' | 'chance' | 'payday';

/** Display metadata per tile type (board rendering). */
export const TILE_META: Record<TileType, { label: string; short: string }> = {
  deal: { label: 'Deal', short: 'Deal' },
  temptation: { label: 'Temptation', short: 'Want' },
  market: { label: 'Market', short: 'News' },
  chance: { label: 'Chance', short: 'Luck' },
  payday: { label: 'Payday', short: 'Pay' },
};

const TILE_POOLS: Record<TileType, Array<{ weight: number; gen: (s: GameState, r: PRNG) => Card }>> = {
  deal: [
    { weight: 3, gen: indexFundCard },
    { weight: 2, gen: stockCard },
    { weight: 2, gen: realEstateCard },
    { weight: 1, gen: goldCard },
    { weight: 1, gen: businessCard },
  ],
  temptation: [{ weight: 1, gen: doodadCard }],
  market: [{ weight: 1, gen: marketEventCard }],
  chance: [
    { weight: 2, gen: unseenExpenseCard },
    { weight: 2, gen: sideHustleCard },
    { weight: 1, gen: borrowOfferCard },
    { weight: 1, gen: paydayBonusCard },
  ],
  payday: [{ weight: 1, gen: paydayBonusCard }],
};

/** Draw a card appropriate to the tile the player landed on. */
export function drawCardForTile(state: GameState, rng: PRNG, tile: TileType): Card {
  const pool = TILE_POOLS[tile];
  const total = pool.reduce((s, g) => s + g.weight, 0);
  const pick = rng.next() * total;
  let acc = 0;
  for (const g of pool) {
    acc += g.weight;
    if (pick < acc) return g.gen(state, rng);
  }
  return pool[0].gen(state, rng);
}

/** Weighted assignment of a tile type for a freshly placed card square. */
export function rollTileType(rng: PRNG): TileType {
  const weights: Array<[TileType, number]> = [
    ['deal', 3], ['temptation', 3], ['market', 2], ['chance', 2], ['payday', 1],
  ];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  const pick = rng.next() * total;
  let acc = 0;
  for (const [t, w] of weights) {
    acc += w;
    if (pick < acc) return t;
  }
  return 'deal';
}
