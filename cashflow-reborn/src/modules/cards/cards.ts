import type { GameState, AssetClass, RealEstateMeta, LoanKind } from '@/types';
import { PRNG } from '@/engine/prng/prng';
import { buildLoan } from '@/modules/loans/loans';
import { LOAN_RATES } from '@/data/constants';
import { loc, type Loc } from '@/i18n/loc';

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
  label: Loc;
  detail?: Loc;
  apply: (state: GameState) => string;
  affordCheck?: (state: GameState) => string | null;
  /** Cash needed for this option. If set and cash < cashCost, the UI offers a
   *  "Borrow & buy" alternative that takes a personal loan to cover the gap. */
  cashCost?: number;
  /** Coach-mode warning: shown under the button to teach what choosing this means. */
  coachWarning?: Loc;
}

export interface Card {
  id: string;
  kind: CardKind;
  emoji: string;
  title: Loc;
  subtitle?: Loc;
  description: Loc;
  rows?: { label: Loc; value: string }[];
  options: CardOption[];
  /** 1 = barely tempting, 5 = "you NEED this". UX nudge only. */
  temptation: number;
  /** One-line flavor explaining the temptation. */
  temptationReason: Loc;
  /** Coach-mode lesson: the financial concept behind this card. */
  coachNote?: Loc;
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

/** Pick one item from a list using the card RNG — used for narrative variety. */
function oneOf<T>(rng: PRNG, arr: readonly T[]): T {
  return arr[Math.floor(rng.next() * arr.length)];
}

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
    title: loc(`${pick.label.charAt(0).toUpperCase() + pick.label.slice(1)} in ${city}`, `${city} में ${pick.label}`),
    subtitle: loc(`Market: ${state.market.phase}`, `बाज़ार: ${state.market.phase}`),
    description: oneOf(rng, [
      loc(
        `A broker calls at 9pm: "Sir, a ${pick.label} in ${city}, ₹${(price / lakh).toFixed(1)}L — and honestly, three other parties are looking." It would rent for about ${(pick.rentPctAnnual * 100).toFixed(1)}% a year.`,
        `रात 9 बजे ब्रोकर का फ़ोन: "सर, ${city} में एक ${pick.label}, ₹${(price / lakh).toFixed(1)}L — और सच कहूँ तो तीन और पार्टियाँ देख रही हैं।" किराये से सालाना करीब ${(pick.rentPctAnnual * 100).toFixed(1)}% मिलेगा।`,
      ),
      loc(
        `Your uncle forwards a listing on the family WhatsApp: a ${pick.label} in ${city} for ₹${(price / lakh).toFixed(1)}L. "Property never goes down, beta." It would rent for about ${(pick.rentPctAnnual * 100).toFixed(1)}% a year.`,
        `अंकल ने फैमिली व्हाट्सऐप पर लिस्टिंग भेजी: ${city} में ${pick.label}, ₹${(price / lakh).toFixed(1)}L। "प्रॉपर्टी कभी नीचे नहीं जाती, बेटा।" किराये से सालाना करीब ${(pick.rentPctAnnual * 100).toFixed(1)}% मिलेगा।`,
      ),
      loc(
        `You tour a ${pick.label} in ${city} on a Sunday. The builder's agent hands you chai and a ₹${(price / lakh).toFixed(1)}L quote before you've taken your shoes off. It rents for about ${(pick.rentPctAnnual * 100).toFixed(1)}% a year.`,
        `रविवार को आप ${city} में एक ${pick.label} देखने जाते हैं। जूते उतारने से पहले ही बिल्डर का एजेंट चाय और ₹${(price / lakh).toFixed(1)}L का भाव थमा देता है। किराये से सालाना करीब ${(pick.rentPctAnnual * 100).toFixed(1)}%।`,
      ),
    ]),
    rows: [
      { label: loc('Price', 'कीमत'), value: `₹${(price / lakh).toFixed(1)}L` },
      { label: loc('Monthly rent', 'मासिक किराया'), value: `₹${monthlyRent.toLocaleString('en-IN')}` },
      { label: loc('25% down + costs', '25% डाउन + खर्च'), value: `₹${(totalCash / lakh).toFixed(1)}L` },
      { label: loc('EMI (20y @ 8.5%)', 'ईएमआई (20 साल @ 8.5%)'), value: `₹${homeEMI.toLocaleString('en-IN')}/mo` },
    ],
    options: [
      {
        id: 'cash',
        label: loc(
          `Buy outright (₹${(price / lakh).toFixed(1)}L + ₹${(closingCosts / lakh).toFixed(1)}L costs)`,
          `पूरा नकद खरीदें (₹${(price / lakh).toFixed(1)}L + ₹${(closingCosts / lakh).toFixed(1)}L खर्च)`,
        ),
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
        label: loc(
          `Buy with ₹${(totalCash / lakh).toFixed(1)}L down + home loan`,
          `₹${(totalCash / lakh).toFixed(1)}L डाउन + होम लोन से खरीदें`,
        ),
        cashCost: totalCash,
        detail: loc(
          `EMI ₹${homeEMI.toLocaleString('en-IN')}/mo · cashflow ${monthlyRent - homeEMI >= 0 ? '+' : ''}₹${(monthlyRent - homeEMI).toLocaleString('en-IN')}/mo`,
          `ईएमआई ₹${homeEMI.toLocaleString('en-IN')}/माह · नकद प्रवाह ${monthlyRent - homeEMI >= 0 ? '+' : ''}₹${(monthlyRent - homeEMI).toLocaleString('en-IN')}/माह`,
        ),
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
      { id: 'skip', label: loc('Pass', 'छोड़ें'), apply: () => 'Passed on deal' },
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
    subtitle: loc(`Market: ${state.market.phase}`, `बाज़ार: ${state.market.phase}`),
    description: oneOf(rng, [
      loc(
        `Your office group chat won't shut up about ${pick.sym}. Someone just posted a green P&L screenshot. It's at ₹${basePrice.toLocaleString('en-IN')}. Single stock — high volatility; sellable any month.`,
        `ऑफिस के ग्रुप चैट में सब ${pick.sym} की ही बात कर रहे हैं। किसी ने अभी हरा-भरा P&L स्क्रीनशॉट डाला। भाव ₹${basePrice.toLocaleString('en-IN')}। सिंगल स्टॉक — बहुत उतार-चढ़ाव; कभी भी बेच सकते हैं।`,
      ),
      loc(
        `A "tip" lands in your DMs: ${pick.sym} (${pick.sector}) is "about to run." The chart does look exciting at ₹${basePrice.toLocaleString('en-IN')}. Single stock — high volatility; sellable any month.`,
        `आपके DM में एक "टिप" आती है: ${pick.sym} (${pick.sector}) "बस उड़ने वाला है।" ₹${basePrice.toLocaleString('en-IN')} पर चार्ट सच में रोमांचक लगता है। सिंगल स्टॉक — बहुत उतार-चढ़ाव; कभी भी बेच सकते हैं।`,
      ),
      loc(
        `A finance YouTuber just made ${pick.sym} their "high-conviction pick of the month." Trading at ₹${basePrice.toLocaleString('en-IN')}. Single stock — high volatility; sellable any month.`,
        `एक फाइनेंस यूट्यूबर ने ${pick.sym} को इस महीने का "हाई-कन्विक्शन पिक" बताया है। भाव ₹${basePrice.toLocaleString('en-IN')}। सिंगल स्टॉक — बहुत उतार-चढ़ाव; कभी भी बेच सकते हैं।`,
      ),
    ]),
    rows: [
      { label: loc('Price/share', 'भाव/शेयर'), value: `₹${basePrice.toLocaleString('en-IN')}` },
      { label: loc('Suggested lot', 'सुझाया लॉट'), value: `${lotSize} shares` },
      { label: loc('Lot cost', 'लॉट लागत'), value: `₹${totalCost.toLocaleString('en-IN')}` },
      { label: loc('Dividend yield', 'लाभांश प्रतिफल'), value: `${(pick.yieldAnnual * 100).toFixed(2)}% p.a.` },
    ],
    options: [
      {
        id: 'buy',
        label: loc(`Buy ${lotSize} shares (₹${totalCost.toLocaleString('en-IN')})`, `${lotSize} शेयर खरीदें (₹${totalCost.toLocaleString('en-IN')})`),
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
      { id: 'skip', label: loc('Pass', 'छोड़ें'), apply: () => 'Passed on stock' },
    ],
    temptation: 3,
    temptationReason: loc('A friend on WhatsApp says this is going to 5x by year-end. The chart looks bullish.', 'व्हाट्सऐप पर एक दोस्त कहता है साल के अंत तक यह 5 गुना हो जाएगा। चार्ट तेज़ी का लग रहा है।'),
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
    subtitle: loc('SIP-eligible', 'SIP योग्य'),
    description:
      pick.kind === 'reit'
        ? loc(
            `Your colleague who "doesn't do stocks" mentions ${pick.name} — owning rental buildings without the tenant headaches. NAV ₹${nav}.`,
            `आपका सहकर्मी जो "स्टॉक नहीं करता" ${pick.name} का ज़िक्र करता है — किरायेदारों के झंझट बिना किराये की इमारतों का मालिकाना। NAV ₹${nav}।`,
          )
        : oneOf(rng, [
            loc(
              `Your most boring, most reliable friend has quietly SIP-ed into ${pick.name} for years. "Just start," she shrugs. NAV ₹${nav}.`,
              `आपकी सबसे "बोरिंग", सबसे भरोसेमंद दोस्त सालों से चुपचाप ${pick.name} में SIP कर रही है। "बस शुरू कर दो," वह कंधे उचकाती है। NAV ₹${nav}।`,
            ),
            loc(
              `No tip, no hype — just ${pick.name} tracking the whole market at a rock-bottom fee. NAV ₹${nav}. (The dopamine is in the compounding.)`,
              `कोई टिप नहीं, कोई शोर नहीं — बस ${pick.name}, पूरे बाज़ार को सबसे कम फीस पर ट्रैक करता हुआ। NAV ₹${nav}। (मज़ा कंपाउंडिंग में है।)`,
            ),
          ]),
    rows: [
      { label: loc('NAV', 'NAV'), value: `₹${nav}` },
      { label: loc('Suggested SIP lot', 'सुझाया SIP लॉट'), value: `${units} units = ₹${cost.toLocaleString('en-IN')}` },
      { label: loc('Yield', 'प्रतिफल'), value: `${(pick.yield * 100).toFixed(2)}% p.a.` },
    ],
    options: [
      {
        id: 'buy',
        label: loc(`Buy ${units} units (₹${cost.toLocaleString('en-IN')})`, `${units} यूनिट खरीदें (₹${cost.toLocaleString('en-IN')})`),
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
      { id: 'skip', label: loc('Pass', 'छोड़ें'), apply: () => 'Passed' },
    ],
    temptation: 2,
    temptationReason: loc('The boring sensible choice. No dopamine, just compounding.', 'उबाऊ पर समझदारी भरा विकल्प। कोई जोश नहीं, बस कंपाउंडिंग।'),
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
    title: loc('Sovereign Gold Bond', 'सॉवरेन गोल्ड बॉन्ड'),
    subtitle: loc('Hedge against inflation', 'महँगाई से बचाव'),
    description: oneOf(rng, [
      loc(
        `It's Dhanteras. Your mother reminds you — again — that gold is the only thing that's never betrayed the family. Today's rate: ₹${pricePerGm.toLocaleString('en-IN')}/gm. SGBs pay 2.5% interest on top — no locker, no purity worries.`,
        `धनतेरस है। माँ फिर याद दिलाती हैं कि सोना ही एकमात्र चीज़ है जिसने परिवार को कभी धोखा नहीं दिया। आज का भाव: ₹${pricePerGm.toLocaleString('en-IN')}/ग्राम। SGB पर ऊपर से 2.5% ब्याज भी — न लॉकर, न शुद्धता की चिंता।`,
      ),
      loc(
        `Wedding season is coming and so is the lecture about "real assets." A Sovereign Gold Bond skips the jeweller's making charges at ₹${pricePerGm.toLocaleString('en-IN')}/gm. SGBs pay 2.5% interest on top — no locker, no purity worries.`,
        `शादी का मौसम आ रहा है और साथ में "असली संपत्ति" का भाषण भी। सॉवरेन गोल्ड बॉन्ड में ज्वैलर का मेकिंग चार्ज नहीं लगता — ₹${pricePerGm.toLocaleString('en-IN')}/ग्राम। ऊपर से 2.5% ब्याज — न लॉकर, न शुद्धता की चिंता।`,
      ),
    ]),
    rows: [
      { label: loc('Price/gm', 'भाव/ग्राम'), value: `₹${pricePerGm.toLocaleString('en-IN')}` },
      { label: loc('Lot', 'लॉट'), value: `${grams}g` },
      { label: loc('Lot cost', 'लॉट लागत'), value: `₹${cost.toLocaleString('en-IN')}` },
    ],
    options: [
      {
        id: 'buy',
        label: loc(`Buy ${grams}g (₹${cost.toLocaleString('en-IN')})`, `${grams}g खरीदें (₹${cost.toLocaleString('en-IN')})`),
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
      { id: 'skip', label: loc('Pass', 'छोड़ें'), apply: () => 'Passed' },
    ],
    temptation: 2,
    temptationReason: loc('Your mom keeps reminding you that gold has never let her down.', 'माँ बार-बार याद दिलाती हैं कि सोने ने उन्हें कभी निराश नहीं किया।'),
    coachNote:
      `Gold: long-term ~8% returns, mostly inflation hedge. Negative correlation with equity in crashes. ` +
      `Sovereign Gold Bonds (SGB) > physical gold: 2.5% extra interest, no storage, no making charges, ` +
      `capital gains tax-free if held to maturity. Keep gold under 10% of portfolio.`,
  };
}

function businessCard(state: GameState, rng: PRNG): Card {
  const ventures = [
    { name: 'Cloud kitchen franchise', cost: 8 * lakh, monthlyProfit: 25_000, risk: 'medium',
      pitch: 'A franchise rep shows you glossy unit economics over a tasting platter. "Break-even in 14 months, guaranteed brand pull."',
      pitchHi: 'एक फ्रैंचाइज़ी रेप टेस्टिंग प्लैटर के साथ चमकदार यूनिट इकोनॉमिक्स दिखाता है। "14 महीने में ब्रेक-ईवन, ब्रांड की पक्की पकड़।"' },
    { name: 'Coffee cart', cost: 3 * lakh, monthlyProfit: 12_000, risk: 'low',
      pitch: 'A spot opens up outside the metro station. You can already picture the morning queue of office-goers.',
      pitchHi: 'मेट्रो स्टेशन के बाहर एक जगह खाली होती है। आप सुबह ऑफिस जाने वालों की कतार अभी से देख सकते हैं।' },
    { name: 'D2C apparel brand', cost: 15 * lakh, monthlyProfit: 40_000, risk: 'high',
      pitch: 'Your designer cousin has the Instagram following and the samples. "We just need inventory and ad spend," she says.',
      pitchHi: 'आपकी डिज़ाइनर कज़िन के पास इंस्टाग्राम फॉलोइंग और सैंपल हैं। "बस इन्वेंटरी और विज्ञापन का खर्च चाहिए," वह कहती है।' },
    { name: 'Tuition center', cost: 5 * lakh, monthlyProfit: 18_000, risk: 'low',
      pitch: 'Parents in your area are desperate for good coaching. A retired teacher offers to run the classes if you fund the place.',
      pitchHi: 'आपके इलाके के माता-पिता अच्छी कोचिंग के लिए परेशान हैं। एक रिटायर्ड शिक्षक क्लास चलाने को तैयार है, बस जगह का खर्च आपका।' },
    { name: 'Friend\'s startup (angel)', cost: 5 * lakh, monthlyProfit: 0, risk: 'very high',
      pitch: 'Your friend pitches over chai, eyes shining: "₹5L for 0.5%. We\'ll be the next big thing — get in early."',
      pitchHi: 'चाय पर आपका दोस्त चमकती आँखों से कहता है: "0.5% के लिए ₹5L। हम अगली बड़ी चीज़ बनेंगे — जल्दी आ जाओ।"' },
  ];
  const pick = ventures[Math.floor(rng.next() * ventures.length)];
  const yieldAnnual = pick.cost > 0 ? (pick.monthlyProfit * 12) / pick.cost : 0;
  const riskHi: Record<string, string> = { medium: 'मध्यम', low: 'कम', high: 'ऊँचा', 'very high': 'बहुत ऊँचा' };
  return {
    id: newId('card', state),
    kind: 'deal_business',
    emoji: '💼',
    title: pick.name,
    subtitle: loc(`Risk: ${pick.risk}`, `जोखिम: ${riskHi[pick.risk] ?? pick.risk}`),
    description: loc(`${pick.pitch} (Illiquid — treat it as a long-term commitment.)`, `${pick.pitchHi} (नकदी में बदलना मुश्किल — इसे लंबी अवधि की प्रतिबद्धता मानें।)`),
    rows: [
      { label: loc('Investment', 'निवेश'), value: `₹${(pick.cost / lakh).toFixed(1)}L` },
      { label: loc('Expected monthly', 'अनुमानित मासिक'), value: `₹${pick.monthlyProfit.toLocaleString('en-IN')}` },
      { label: loc('Implied yield', 'अनुमानित प्रतिफल'), value: `${(yieldAnnual * 100).toFixed(1)}% p.a.` },
    ],
    options: [
      {
        id: 'buy',
        label: loc(`Invest ₹${(pick.cost / lakh).toFixed(1)}L`, `₹${(pick.cost / lakh).toFixed(1)}L निवेश करें`),
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
      { id: 'skip', label: loc('Pass', 'छोड़ें'), apply: () => 'Passed' },
    ],
    temptation: 3,
    temptationReason: loc('Imagine the LinkedIn announcement. Imagine quitting your job.', 'सोचिए वो लिंक्डइन पोस्ट। सोचिए नौकरी छोड़ना।'),
    coachNote:
      `Private business equity: high return potential (15-25%) but ~70% of small businesses fail in 5 years. ` +
      `Illiquid — you can't sell quickly if you need cash. Position max 10-15% of net worth. ` +
      `Angel/startup tickets: assume 0 unless you can wait 7-10 years and lose it all.`,
  };
}

function doodadCard(state: GameState, rng: PRNG): Card {
  const doodads = [
    // NOTE: doodads are *wants*. However strong the marketing pull, you can always
    // walk away — so they cap at temptation 4. Level 5 (the no-skip "unavoidable"
    // tier) is reserved for genuine life emergencies (see lifeEventCard).
    { name: 'New iPhone Pro', nameHi: 'नया iPhone Pro', cash: 1_50_000, monthly: 0, emoji: '📱', temptation: 4, reason: 'Your colleague pulled theirs out at lunch. Yours is suddenly embarrassing.', reasonHi: 'लंच पर सहकर्मी ने अपना निकाला। आपका अचानक शर्मिंदगी का सबब बन गया।' },
    { name: 'Weekend in Goa', nameHi: 'गोवा का वीकेंड', cash: 35_000, monthly: 0, emoji: '🏖️', temptation: 4, reason: 'You\'ve been working hard. You DESERVE this. (Do you?)', reasonHi: 'आपने बहुत मेहनत की है। आप इसके हकदार हैं। (सच में?)' },
    { name: 'Smart TV upgrade', nameHi: 'नया स्मार्ट टीवी', cash: 85_000, monthly: 0, emoji: '📺', temptation: 3, reason: 'The new one is OLED. The current one is fine, but… OLED.', reasonHi: 'नया वाला OLED है। पुराना ठीक है, पर… OLED है।' },
    { name: 'Wardrobe refresh', nameHi: 'नई अलमारी', cash: 25_000, monthly: 0, emoji: '👗', temptation: 3, reason: 'Festive sale. 70% off. Limited stock. (Always limited.)', reasonHi: 'त्योहारी सेल। 70% छूट। सीमित स्टॉक। (हमेशा सीमित।)' },
    { name: 'Gym membership', nameHi: 'जिम मेंबरशिप', cash: 0, monthly: 3500, emoji: '💪', temptation: 4, reason: 'This is the year. You\'re absolutely going to use it. Definitely.', reasonHi: 'इस साल तो पक्का। आप ज़रूर जाएँगे। बिल्कुल।' },
    { name: 'Streaming bundle', nameHi: 'स्ट्रीमिंग बंडल', cash: 0, monthly: 1200, emoji: '🎬', temptation: 3, reason: 'It\'s ONLY ₹1200/mo. What\'s ₹1200/mo? (₹4.3L over 30 years.)', reasonHi: 'बस ₹1200/माह तो है। ₹1200/माह क्या होता है? (30 साल में ₹4.3L।)' },
    { name: 'Fancy dining out', nameHi: 'बढ़िया डाइनिंग', cash: 0, monthly: 6000, emoji: '🍽️', temptation: 4, reason: 'Date night, work dinners, weekend brunches. It\'s the lifestyle.', reasonHi: 'डेट नाइट, ऑफिस डिनर, वीकेंड ब्रंच। यही तो लाइफस्टाइल है।' },
    { name: 'Designer handbag', nameHi: 'डिज़ाइनर हैंडबैग', cash: 65_000, monthly: 0, emoji: '👜', temptation: 4, reason: 'It\'s an investment. Bags hold value. (Spoiler: they mostly don\'t.)', reasonHi: 'यह निवेश है। बैग की कीमत बनी रहती है। (सच: ज़्यादातर नहीं रहती।)' },
    { name: 'Two-wheeler upgrade', nameHi: 'नया टू-व्हीलर', cash: 1_80_000, monthly: 0, emoji: '🛵', temptation: 4, reason: 'The salesperson just let you sit on it. Game over.', reasonHi: 'सेल्समैन ने बस उस पर बैठने दिया। खेल खत्म।' },
    { name: 'Crypto plunge (memecoin)', nameHi: 'क्रिप्टो छलांग (मीमकॉइन)', cash: 40_000, monthly: 0, emoji: '🪙', temptation: 4, reason: 'A stranger on Twitter just 100x\'d. Your turn?', reasonHi: 'ट्विटर पर एक अजनबी ने अभी 100 गुना कमाया। अब आपकी बारी?' },
    { name: 'New car (downpayment)', nameHi: 'नई कार (डाउनपेमेंट)', cash: 3_00_000, monthly: 0, emoji: '🚗', temptation: 4, reason: 'Your old car still works. But the new one has VENTILATED SEATS.', reasonHi: 'पुरानी कार अब भी चलती है। पर नई में वेंटिलेटेड सीटें हैं।' },
  ];
  const pick = doodads[Math.floor(rng.next() * doodads.length)];
  const description = pick.monthly > 0
    ? loc(`Adds ₹${pick.monthly.toLocaleString('en-IN')}/mo to lifestyle expenses forever.`, `लाइफस्टाइल खर्च में हमेशा के लिए ₹${pick.monthly.toLocaleString('en-IN')}/माह जुड़ जाते हैं।`)
    : loc(`One-time ₹${pick.cash.toLocaleString('en-IN')} hit to cash.`, `नकद पर एकमुश्त ₹${pick.cash.toLocaleString('en-IN')} का झटका।`);
  return {
    id: newId('card', state),
    kind: 'doodad',
    emoji: pick.emoji,
    title: loc(pick.name, pick.nameHi),
    subtitle: loc('Doodad', 'फिज़ूलखर्ची'),
    description,
    rows: pick.monthly > 0
      ? [{ label: loc('Monthly cost', 'मासिक खर्च'), value: `₹${pick.monthly.toLocaleString('en-IN')}` }]
      : [{ label: loc('One-time cost', 'एकमुश्त लागत'), value: `₹${pick.cash.toLocaleString('en-IN')}` }],
    options: [
      {
        id: 'buy',
        label: pick.monthly > 0 ? loc('Subscribe', 'सब्सक्राइब करें') : loc('Buy it', 'खरीद लें'),
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
    temptationReason: loc(pick.reason, pick.reasonHi),
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

function resistLabel(temptation: number): Loc {
  if (temptation >= 5) return loc('Resist (almost impossible)', 'टालें (लगभग नामुमकिन)');
  if (temptation >= 4) return loc('Resist (hard)', 'टालें (मुश्किल)');
  if (temptation >= 3) return loc('Resist', 'टालें');
  return loc('Pass', 'छोड़ें');
}

function sideHustleCard(state: GameState, rng: PRNG): Card {
  const gigs = [
    { name: 'Weekend consulting', nameHi: 'वीकेंड कंसल्टिंग', monthly: 25_000, months: 6,
      pitch: 'An ex-manager pings you: "Two days a month of your brain, decent money. Interested?"',
      pitchHi: 'एक पुराने मैनेजर का मैसेज: "महीने के दो दिन आपका दिमाग, ठीक-ठाक पैसा। दिलचस्पी है?"' },
    { name: 'Online course royalties', nameHi: 'ऑनलाइन कोर्स रॉयल्टी', monthly: 8_000, months: 24,
      pitch: 'You finally record that course you keep talking about. It could trickle in royalties for years.',
      pitchHi: 'आप आख़िरकार वो कोर्स रिकॉर्ड कर लेते हैं जिसकी बात करते रहते हैं। सालों तक थोड़ी-थोड़ी रॉयल्टी आ सकती है।' },
    { name: 'Freelance design contract', nameHi: 'फ्रीलांस डिज़ाइन कॉन्ट्रैक्ट', monthly: 18_000, months: 4,
      pitch: 'A startup needs a freelancer "yesterday." Good rate, tight deadlines, your evenings.',
      pitchHi: 'एक स्टार्टअप को फ्रीलांसर "कल ही" चाहिए। अच्छा रेट, टाइट डेडलाइन, आपकी शामें।' },
    { name: 'Rental of spare room', nameHi: 'खाली कमरे का किराया', monthly: 12_000, months: 12,
      pitch: 'The spare room is just collecting boxes. A verified tenant on the app is ready to move in.',
      pitchHi: 'खाली कमरे में बस डिब्बे जमा हो रहे हैं। ऐप पर एक वेरिफाइड किरायेदार आने को तैयार है।' },
  ];
  const pick = gigs[Math.floor(rng.next() * gigs.length)];
  return {
    id: newId('card', state),
    kind: 'side_hustle',
    emoji: '⚡',
    title: loc(pick.name, pick.nameHi),
    subtitle: loc('Side hustle', 'साइड हसल'),
    description: loc(
      `${pick.pitch} It adds about ₹${pick.monthly.toLocaleString('en-IN')}/mo — but the time has to come from somewhere.`,
      `${pick.pitchHi} इससे करीब ₹${pick.monthly.toLocaleString('en-IN')}/माह जुड़ते हैं — पर समय कहीं से तो निकालना होगा।`,
    ),
    rows: [
      { label: loc('Income', 'आय'), value: `₹${pick.monthly.toLocaleString('en-IN')}/mo` },
      { label: loc('Duration', 'अवधि'), value: `${pick.months} months (simplified: forever in v0.2)` },
    ],
    options: [
      {
        id: 'accept',
        label: loc('Take it', 'ले लें'),
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
      { id: 'skip', label: loc('Decline', 'मना करें'), apply: () => 'Declined gig' },
    ],
    temptation: 3,
    temptationReason: loc('Easy extra income… but evenings and weekends are not free.', 'आसान अतिरिक्त कमाई… पर शामें और वीकेंड मुफ़्त नहीं हैं।'),
    coachNote:
      `Side hustles are leverage on your time. The math: ₹${pick.monthly.toLocaleString('en-IN')}/mo for ${pick.months} months ` +
      `= ₹${(pick.monthly * pick.months).toLocaleString('en-IN')} gross. After 30% tax + opportunity cost of evenings, ` +
      `the net is real but smaller. Most useful for plugging a savings gap or funding a specific goal.`,
  };
}

function unseenExpenseCard(state: GameState, rng: PRNG): Card {
  // Each is a concrete, imaginable scenario; the cost fits the specific story.
  const items = [
    { name: 'Car won\'t start', nameHi: 'कार स्टार्ट नहीं हो रही', cost: 22_000, emoji: '🔧',
      story: 'Monday morning, dead in the driveway. The mechanic diagnoses the clutch assembly — ₹22,000 and two days in the garage.',
      storyHi: 'सोमवार सुबह, ड्राइववे में बंद। मैकेनिक क्लच असेंबली की खराबी बताता है — ₹22,000 और दो दिन गैराज में।',
      reason: 'No car, no commute. It has to be fixed.', reasonHi: 'कार नहीं तो आना-जाना नहीं। ठीक तो करवानी ही होगी।' },
    { name: 'Laptop won\'t boot', nameHi: 'लैपटॉप चालू नहीं हो रहा', cost: 95_000, emoji: '💻',
      story: 'The screen flickers once and dies mid-deadline. The motherboard is fried; a replacement is ₹95,000.',
      storyHi: 'डेडलाइन के बीच स्क्रीन एक बार झपकती है और बंद। मदरबोर्ड जल गया; नया ₹95,000 का है।',
      reason: 'Your work lives on it. No laptop, no income.', reasonHi: 'आपका काम इसी पर है। लैपटॉप नहीं तो कमाई नहीं।' },
    { name: 'Cousin\'s wedding', nameHi: 'कज़िन की शादी', cost: 75_000, emoji: '💒',
      story: 'The whole family is going. Your share of the gift, outfits, and travel comes to ₹75,000. Saying no isn\'t really an option.',
      storyHi: 'पूरा परिवार जा रहा है। गिफ्ट, कपड़े और सफ़र में आपका हिस्सा ₹75,000 बनता है। मना करना कोई विकल्प नहीं।',
      reason: 'Family. You already RSVP\'d in your heart.', reasonHi: 'परिवार है। दिल से तो आप हाँ कह ही चुके हैं।' },
    { name: 'Parents need help', nameHi: 'माता-पिता को मदद चाहिए', cost: 40_000, emoji: '👨‍👩‍👧',
      story: 'Dad\'s pension fell short and the house back home needs urgent repairs. They\'d never ask — which is exactly why you send ₹40,000.',
      storyHi: 'पापा की पेंशन कम पड़ गई और घर की मरम्मत ज़रूरी है। वे कभी नहीं माँगेंगे — इसीलिए आप ₹40,000 भेज देते हैं।',
      reason: 'They raised you. This isn\'t a question.', reasonHi: 'उन्होंने आपको पाला है। इसमें सोचना क्या।' },
    { name: 'Burst water pipe', nameHi: 'पानी की पाइप फटी', cost: 28_000, emoji: '🚰',
      story: 'A pipe gives way behind the bathroom wall at midnight. Plumber, re-tiling, and a ruined cupboard: ₹28,000.',
      storyHi: 'आधी रात बाथरूम की दीवार के पीछे पाइप फट जाती है। प्लंबर, दोबारा टाइल, और बर्बाद अलमारी: ₹28,000।',
      reason: 'The water won\'t stop until you pay someone to stop it.', reasonHi: 'पानी तब तक नहीं रुकेगा जब तक किसी को पैसे देकर न रुकवाएँ।' },
    { name: 'Root canal', nameHi: 'रूट कैनाल', cost: 35_000, emoji: '🦷',
      story: 'A molar that\'s been "fine" finally isn\'t. Root canal plus a crown: ₹35,000.',
      storyHi: 'जो दाढ़ अब तक "ठीक" थी, अब नहीं रही। रूट कैनाल और क्राउन: ₹35,000।',
      reason: 'The pain decides for you.', reasonHi: 'दर्द आपके लिए फैसला कर देता है।' },
    { name: 'Traffic challan', nameHi: 'ट्रैफिक चालान', cost: 5_000, emoji: '🚓',
      story: 'Clocked at 78 in a 50 zone by an AI camera. The challan lands on your phone before you\'re even home: ₹5,000.',
      storyHi: '50 ज़ोन में 78 की रफ़्तार, AI कैमरे में कैद। घर पहुँचने से पहले ही फ़ोन पर चालान: ₹5,000।',
      reason: 'The camera already has your number plate.', reasonHi: 'कैमरे के पास आपकी नंबर प्लेट पहले से है।' },
  ];
  const pick = items[Math.floor(rng.next() * items.length)];
  return {
    id: newId('card', state),
    kind: 'unseen_expense',
    emoji: pick.emoji,
    title: loc(pick.name, pick.nameHi),
    subtitle: loc('Unforeseen', 'अप्रत्याशित'),
    description: loc(pick.story, pick.storyHi),
    rows: [{ label: loc('Cost', 'लागत'), value: `₹${pick.cost.toLocaleString('en-IN')}` }],
    options: [
      {
        id: 'pay',
        label: loc('Pay from cash', 'नकद से चुकाएँ'),
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
        label: loc('Put on credit card (36% p.a.)', 'क्रेडिट कार्ड पर डालें (36% सालाना)'),
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
        label: loc('Personal loan (13.5% p.a., 3yr)', 'पर्सनल लोन (13.5% सालाना, 3 साल)'),
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
    temptationReason: loc(pick.reason, pick.reasonHi),
    coachNote:
      `Why emergency funds exist. Rule of thumb: 6 months of expenses parked in a liquid fund / savings (3-7% yield). ` +
      `Without one, you pay 36% on credit cards instead of earning 12% on equity — a 48-point swing on every rupee.`,
  };
}

/**
 * Genuine life emergencies — temptation 5 (truly unavoidable, no "skip").
 * Every one is a specific, imaginable story, and the price tag fits that exact
 * scenario (a heart attack costs what a heart attack costs — no random ranges).
 * A new baby, a serious accident, a major medical event, or a forced pay cut.
 * Big, non-negotiable, and the whole point of an emergency fund.
 */
function lifeEventCard(state: GameState, rng: PRNG): Card {
  // ---- Income downsizing: a forced salary cut, not an expense (~25% of draws) ----
  if (rng.next() < 0.25) {
    const downsizings = [
      { emoji: '❄️', title: 'Funding winter', titleHi: 'फंडिंग विंटर', cut: 0.30,
        story: (p: number) => `Your startup\'s next round falls through. To stretch the runway, every salary is cut ${p}% — yours included, effective this month.`,
        storyHi: (p: number) => `आपके स्टार्टअप की अगली फंडिंग नहीं हो पाती। रनवे बढ़ाने के लिए हर सैलरी ${p}% कट जाती है — आपकी भी, इसी महीने से।`,
        reason: 'Survive now; the equity dream waits.', reasonHi: 'अभी टिको; इक्विटी का सपना इंतज़ार करेगा।' },
      { emoji: '🤖', title: 'Restructured out of your role', titleHi: 'रीस्ट्रक्चरिंग में पद बदला', cut: 0.25,
        story: (p: number) => `Half your team\'s work just got automated. HR offers you a "lateral move" — same desk, ${p}% less pay. The alternative is the door.`,
        storyHi: (p: number) => `आपकी टीम का आधा काम ऑटोमेट हो गया। HR "लेटरल मूव" देता है — वही डेस्क, ${p}% कम पगार। विकल्प है दरवाज़ा।`,
        reason: 'The org chart shrank. So did your CTC.', reasonHi: 'ऑर्ग चार्ट सिकुड़ा। आपका CTC भी।' },
      { emoji: '📉', title: 'Recession cost-cutting', titleHi: 'मंदी में लागत-कटौती', cut: 0.20,
        story: (p: number) => `Third quarter missed in a row. Variable pay is frozen and base takes a ${p}% haircut across the company.`,
        storyHi: (p: number) => `लगातार तीसरी तिमाही चूक गई। वेरिएबल पे फ्रीज़ और पूरी कंपनी में बेसिक पर ${p}% की कटौती।`,
        reason: 'The market decides. Your budget gets no vote.', reasonHi: 'बाज़ार तय करता है। आपके बजट को वोट नहीं मिलता।' },
    ];
    const d = downsizings[Math.floor(rng.next() * downsizings.length)];
    const cutPct = d.cut;
    const salary = state.incomeStreams.find((i) => i.kind === 'salary');
    const oldSalary = salary?.monthlyGross ?? 0;
    const newSalary = Math.round(oldSalary * (1 - cutPct));
    const drop = oldSalary - newSalary;
    const pctNum = Math.round(cutPct * 100);
    return {
      id: newId('card', state),
      kind: 'market_event', // no spend decision → behaviorally a no-op for scoring
      emoji: d.emoji,
      title: loc(d.title, d.titleHi),
      subtitle: loc('Forced pay cut', 'मजबूरी में पगार कटौती'),
      description: loc(d.story(pctNum), d.storyHi(pctNum)),
      rows: [
        { label: loc('Old salary', 'पुरानी पगार'), value: `₹${oldSalary.toLocaleString('en-IN')}/mo` },
        { label: loc('New salary', 'नई पगार'), value: `₹${newSalary.toLocaleString('en-IN')}/mo` },
        { label: loc('Monthly hit', 'मासिक झटका'), value: `−₹${drop.toLocaleString('en-IN')}` },
      ],
      options: [
        {
          id: 'absorb',
          label: loc('You have no say in this', 'इसमें आपकी कोई नहीं चलती'),
          apply: (s) => {
            const sal = s.incomeStreams.find((i) => i.kind === 'salary');
            if (sal) sal.monthlyGross = Math.round(sal.monthlyGross * (1 - cutPct));
            return `Salary cut by ${Math.round(cutPct * 100)}%`;
          },
        },
      ],
      temptation: 5,
      temptationReason: loc(d.reason, d.reasonHi),
      coachNote:
        `Income shocks are why fixed costs (rent, EMIs) should stay well under your salary and why you keep ` +
        `6 months of expenses liquid. A ${Math.round(cutPct * 100)}% pay cut should be survivable without fire-selling assets in a down market.`,
    };
  }

  // ---- Catastrophic forced expenses: each story carries its own justified cost ----
  const scenarios = [
    // Medical
    { subtitle: 'Medical emergency', subtitleHi: 'मेडिकल इमरजेंसी', emoji: '🫀', title: 'Dad collapses at home', titleHi: 'पापा घर पर गिर पड़े', cost: 4_50_000,
      story: 'A heart attack. The cardiac unit won\'t wheel him in until ₹4,50,000 for the angioplasty and two stents is cleared.',
      storyHi: 'हार्ट अटैक। कार्डियक यूनिट तब तक अंदर नहीं ले जाएगी जब तक एंजियोप्लास्टी और दो स्टेंट के ₹4,50,000 जमा न हों।',
      reason: 'It\'s your father. You pay, and you pay now.', reasonHi: 'आपके पिता हैं। आप चुकाएँगे, और अभी चुकाएँगे।' },
    { subtitle: 'Medical emergency', subtitleHi: 'मेडिकल इमरजेंसी', emoji: '🏥', title: 'Appendix bursts at 2 a.m.', titleHi: 'रात 2 बजे अपेंडिक्स फटा', cost: 1_75_000,
      story: 'Emergency appendectomy and four nights admitted. The bill at discharge: ₹1,75,000.',
      storyHi: 'इमरजेंसी अपेंडिक्स ऑपरेशन और चार रात भर्ती। छुट्टी पर बिल: ₹1,75,000।',
      reason: 'Surgery tonight, not next payday.', reasonHi: 'ऑपरेशन आज रात, अगली तनख्वाह पर नहीं।' },
    { subtitle: 'Medical emergency', subtitleHi: 'मेडिकल इमरजेंसी', emoji: '🦵', title: 'Mom\'s knee can\'t wait', titleHi: 'माँ का घुटना और इंतज़ार नहीं कर सकता', cost: 3_20_000,
      story: 'The orthopaedic surgeon says one more monsoon and she won\'t walk. Knee replacement plus an imported implant: ₹3,20,000.',
      storyHi: 'हड्डी रोग सर्जन कहते हैं एक और बारिश और वे चल नहीं पाएँगी। घुटना रिप्लेसमेंट और इम्पोर्टेड इम्प्लांट: ₹3,20,000।',
      reason: 'She carried you. Now it\'s your turn.', reasonHi: 'उन्होंने आपको उठाया था। अब आपकी बारी।' },
    { subtitle: 'Medical emergency', subtitleHi: 'मेडिकल इमरजेंसी', emoji: '🩸', title: 'Dengue turns serious', titleHi: 'डेंगू गंभीर हो गया', cost: 2_40_000,
      story: 'Platelets crash overnight. Six days in the ICU with transfusions and round-the-clock monitoring: ₹2,40,000.',
      storyHi: 'रातों-रात प्लेटलेट्स गिर गईं। छह दिन ICU में, खून चढ़ाना और चौबीसों घंटे निगरानी: ₹2,40,000।',
      reason: 'The ICU doesn\'t take EMIs at the door.', reasonHi: 'ICU दरवाज़े पर ईएमआई नहीं लेता।' },
    // Accident
    { subtitle: 'Accident', subtitleHi: 'दुर्घटना', emoji: '🏍️', title: 'Bike skid on a wet road', titleHi: 'गीली सड़क पर बाइक फिसली', cost: 2_80_000,
      story: 'A fractured tibia. Surgery to insert a titanium rod, plus eight weeks of physiotherapy: ₹2,80,000.',
      storyHi: 'टिबिया में फ्रैक्चर। टाइटेनियम रॉड डालने का ऑपरेशन और आठ हफ़्ते फिज़ियोथेरेपी: ₹2,80,000।',
      reason: 'You\'re on the operating table either way.', reasonHi: 'चाहे जो हो, आप ऑपरेशन टेबल पर हैं।' },
    { subtitle: 'Accident', subtitleHi: 'दुर्घटना', emoji: '🚗', title: 'Highway pile-up', titleHi: 'हाईवे पर भिड़ंत', cost: 3_60_000,
      story: 'You walk away with a dislocated shoulder and a ₹3,60,000 hospital bill. (The totalled car is a separate heartbreak.)',
      storyHi: 'आप कंधा उतरने और ₹3,60,000 के अस्पताल बिल के साथ बच निकलते हैं। (टूटी कार का दुख अलग है।)',
      reason: 'One careless truck. Your problem now.', reasonHi: 'एक लापरवाह ट्रक। अब आपकी मुसीबत।' },
    { subtitle: 'Accident', subtitleHi: 'दुर्घटना', emoji: '🩼', title: 'A bad fall at the office', titleHi: 'ऑफिस में बुरी तरह गिरे', cost: 2_10_000,
      story: 'Two slipped discs from a tumble down the stairs. Spinal procedure and a month of recovery: ₹2,10,000.',
      storyHi: 'सीढ़ियों से गिरने पर दो स्लिप डिस्क। रीढ़ का ऑपरेशन और महीने भर आराम: ₹2,10,000।',
      reason: 'Your spine isn\'t negotiable.', reasonHi: 'रीढ़ पर समझौता नहीं होता।' },
    // New baby
    { subtitle: 'New baby', subtitleHi: 'नया बच्चा', emoji: '👶', title: 'It\'s twins!', titleHi: 'जुड़वाँ हैं!', cost: 3_80_000,
      story: 'A C-section, and the smaller twin needs a week in the NICU. The hospital bill: ₹3,80,000. (The diapers come later.)',
      storyHi: 'सी-सेक्शन, और छोटे जुड़वाँ को हफ़्ते भर NICU चाहिए। अस्पताल बिल: ₹3,80,000। (डायपर बाद में।)',
      reason: 'Two heartbeats on the scan. No going back.', reasonHi: 'स्कैन पर दो धड़कनें। अब पीछे नहीं हटा जा सकता।' },
    { subtitle: 'New baby', subtitleHi: 'नया बच्चा', emoji: '🍼', title: 'Your first child arrives', titleHi: 'आपका पहला बच्चा आ रहा है', cost: 1_60_000,
      story: 'An emergency C-section after 14 hours of labour. Delivery and hospital stay: ₹1,60,000.',
      storyHi: '14 घंटे के दर्द के बाद इमरजेंसी सी-सेक्शन। डिलीवरी और अस्पताल: ₹1,60,000।',
      reason: 'Today is the day, ready or not.', reasonHi: 'आज का दिन आ गया, तैयार हों या न हों।' },
    { subtitle: 'New baby', subtitleHi: 'नया बच्चा', emoji: '🤰', title: 'Delivery day', titleHi: 'डिलीवरी का दिन', cost: 95_000,
      story: 'A textbook delivery — but the gynaecologist, three nights, and newborn screening still total ₹95,000.',
      storyHi: 'बिल्कुल सामान्य डिलीवरी — फिर भी गायनाकोलॉजिस्ट, तीन रातें और नवजात जाँच मिलाकर ₹95,000।',
      reason: 'Babies don\'t check your bank balance first.', reasonHi: 'बच्चे पहले आपका बैंक बैलेंस नहीं देखते।' },
  ];
  const pick = scenarios[Math.floor(rng.next() * scenarios.length)];
  const cost = pick.cost;

  return {
    id: newId('card', state),
    kind: 'unseen_expense',
    emoji: pick.emoji,
    title: loc(pick.title, pick.titleHi),
    subtitle: loc(pick.subtitle, pick.subtitleHi),
    description: loc(pick.story, pick.storyHi),
    rows: [{ label: loc('Cost', 'लागत'), value: `₹${cost.toLocaleString('en-IN')}` }],
    options: [
      {
        id: 'pay',
        label: loc('Pay from cash', 'नकद से चुकाएँ'),
        cashCost: cost,
        affordCheck: (s) => (s.cashOnHand < cost ? `Need ₹${cost.toLocaleString('en-IN')} — short by ₹${(cost - s.cashOnHand).toLocaleString('en-IN')}` : null),
        apply: (s) => {
          s.cashOnHand -= cost;
          return `Paid ₹${cost.toLocaleString('en-IN')} — ${pick.title}`;
        },
        coachWarning: `Best case: your emergency fund absorbs this with zero interest. This is exactly what it's for.`,
      },
      {
        id: 'personal',
        label: loc('Personal loan (13.5% p.a., 3yr)', 'पर्सनल लोन (13.5% सालाना, 3 साल)'),
        apply: (s) => {
          const emi = pushLoan(s, {
            kind: 'personal',
            label: `Loan: ${pick.title}`,
            principal: cost,
            tenureMonths: 36,
          });
          return `Personal loan taken — EMI ₹${emi.toLocaleString('en-IN')}/mo`;
        },
        coachWarning: `Survivable if you must borrow. ~3x cheaper than a credit card. Total interest over 3yr ≈ ₹${Math.round(cost * 0.22).toLocaleString('en-IN')}.`,
      },
      {
        id: 'cc',
        label: loc('Put on credit card (36% p.a.)', 'क्रेडिट कार्ड पर डालें (36% सालाना)'),
        apply: (s) => {
          const emi = pushLoan(s, {
            kind: 'credit_card',
            label: `CC: ${pick.title}`,
            principal: cost,
            tenureMonths: 6,
          });
          return `On credit card @ 36% — EMI ₹${emi.toLocaleString('en-IN')}/mo`;
        },
        coachWarning: `WORST option. 36% p.a. is loanshark territory. This is how one emergency becomes years of debt.`,
      },
    ],
    temptation: 5,
    temptationReason: loc(pick.reason, pick.reasonHi),
    coachNote:
      `This is the scenario emergency funds and health/term insurance exist for. ₹6L liquid (6 months of expenses) ` +
      `plus a ₹1Cr health floater (~₹15-25K/yr) turns a life-altering bill into a manageable one.`,
  };
}

function borrowOfferCard(state: GameState, rng: PRNG): Card {
  const offers: Array<{ kind: LoanKind; label: string; labelHi: string; principal: number; tenureMonths: number; emoji: string }> = [
    { kind: 'personal', label: 'Pre-approved personal loan', labelHi: 'प्री-अप्रूव्ड पर्सनल लोन', principal: 5 * lakh, tenureMonths: 36, emoji: '🏦' },
    { kind: 'personal', label: 'Personal loan offer', labelHi: 'पर्सनल लोन ऑफर', principal: 10 * lakh, tenureMonths: 48, emoji: '🏦' },
    { kind: 'credit_card', label: 'New credit card (₹3L limit)', labelHi: 'नया क्रेडिट कार्ड (₹3L लिमिट)', principal: 3 * lakh, tenureMonths: 1, emoji: '💳' },
    { kind: 'car', label: 'Car loan offer', labelHi: 'कार लोन ऑफर', principal: 8 * lakh, tenureMonths: 60, emoji: '🚗' },
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
    title: loc(pick.label, pick.labelHi),
    subtitle: `${(rate * 100).toFixed(1)}% p.a.`,
    description: oneOf(rng, [
      loc(
        `Your banking app flashes a pre-approved ${pick.label.toLowerCase()}: "₹${(pick.principal / lakh).toFixed(1)}L, instant disbursal, tap to accept." The button is a very inviting shade of green. Borrowed money is real money — and so is the EMI.`,
        `आपका बैंकिंग ऐप एक प्री-अप्रूव्ड ${pick.labelHi} दिखाता है: "₹${(pick.principal / lakh).toFixed(1)}L, तुरंत डिस्बर्सल, स्वीकार करने के लिए टैप करें।" बटन हरे रंग का बहुत लुभावना शेड है। उधार का पैसा भी असली पैसा है — और ईएमआई भी।`,
      ),
      loc(
        `A bank caller knows your name and your salary: "Sir, you're pre-qualified for ₹${(pick.principal / lakh).toFixed(1)}L. Shall I just get it processed?" Borrowed money is real money — and so is the EMI.`,
        `बैंक का कॉलर आपका नाम और सैलरी जानता है: "सर, आप ₹${(pick.principal / lakh).toFixed(1)}L के लिए प्री-क्वालिफाइड हैं। बस प्रोसेस कर दूँ?" उधार का पैसा भी असली पैसा है — और ईएमआई भी।`,
      ),
    ]),
    rows: [
      { label: loc('Principal', 'मूलधन'), value: `₹${(pick.principal / lakh).toFixed(1)}L` },
      { label: loc('Tenure', 'अवधि'), value: `${pick.tenureMonths} months` },
      { label: loc('EMI', 'ईएमआई'), value: `₹${emi.toLocaleString('en-IN')}/mo` },
    ],
    options: [
      {
        id: 'accept',
        label: loc(`Take loan (+₹${(pick.principal / lakh).toFixed(1)}L cash)`, `लोन लें (+₹${(pick.principal / lakh).toFixed(1)}L नकद)`),
        apply: (s) => {
          s.cashOnHand += pick.principal;
          pushLoan(s, { kind: pick.kind, label: pick.label, principal: pick.principal, tenureMonths: pick.tenureMonths });
          return `Took ${pick.label}`;
        },
        coachWarning:
          `Total interest over ${pick.tenureMonths} months ≈ ₹${(emi * pick.tenureMonths - pick.principal).toLocaleString('en-IN')}. ` +
          `If you can't articulate WHY you need this loan right now, decline.`,
      },
      { id: 'skip', label: loc('Decline', 'मना करें'), apply: () => 'Declined offer' },
    ],
    temptation: 4,
    temptationReason: loc('Pre-approved. One tap. Cash in your account by tomorrow.', 'प्री-अप्रूव्ड। एक टैप। कल तक पैसा आपके खाते में।'),
    coachNote:
      `DTI rule: total EMIs ÷ gross monthly income should stay under 40% (some say 30%). ` +
      `Pre-approved means the bank thinks you can pay, not that you should. Personal loans @ 13.5%+ ` +
      `only make sense for high-return investments — and there are very few of those.`,
  };
}

function paydayBonusCard(state: GameState, rng: PRNG): Card {
  const salary = state.incomeStreams.find((i) => i.kind === 'salary')?.monthlyGross ?? 0;
  const bonus = Math.round(salary * (0.5 + Math.random() * 1.5));
  return {
    id: newId('card', state),
    kind: 'payday_bonus',
    emoji: '🎉',
    title: loc('Performance bonus!', 'परफॉर्मेंस बोनस!'),
    subtitle: loc('Lump sum from employer', 'नियोक्ता से एकमुश्त राशि'),
    description: oneOf(rng, [
      loc(
        `Appraisal cycle closes well. Your manager slides an envelope across the desk: ₹${bonus.toLocaleString('en-IN')}.`,
        `अप्रेज़ल अच्छा रहा। मैनेजर डेस्क पर एक लिफाफा सरकाते हैं: ₹${bonus.toLocaleString('en-IN')}।`,
      ),
      loc(
        `The company beat its targets and you got a shout-out. A surprise ₹${bonus.toLocaleString('en-IN')} lands in your account.`,
        `कंपनी ने टारगेट पार किया और आपकी तारीफ हुई। एक सरप्राइज़ ₹${bonus.toLocaleString('en-IN')} आपके खाते में आ गया।`,
      ),
      loc(
        `Diwali bonus season. HR drops a mail: ₹${bonus.toLocaleString('en-IN')} credited. It already feels spent.`,
        `दिवाली बोनस का मौसम। HR का मेल: ₹${bonus.toLocaleString('en-IN')} जमा। अभी से खर्च हुआ-सा लगता है।`,
      ),
    ]),
    rows: [{ label: loc('Bonus', 'बोनस'), value: `₹${bonus.toLocaleString('en-IN')}` }],
    options: [
      {
        id: 'take',
        label: loc('Cash it', 'भुना लें'),
        apply: (s) => {
          s.cashOnHand += bonus;
          return `+₹${bonus.toLocaleString('en-IN')} bonus`;
        },
      },
    ],
    temptation: 1,
    temptationReason: loc('Free money. Nothing to resist.', 'मुफ़्त का पैसा। रोकने को कुछ नहीं।'),
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
    title: isUp ? loc('Headline: markets rally', 'सुर्खी: बाज़ार में तेज़ी') : loc('Headline: markets jittery', 'सुर्खी: बाज़ार घबराया'),
    subtitle: loc(`Phase: ${phase}`, `दौर: ${phase}`),
    description: isUp
      ? loc('Equities up sharply this month. FOMO is loud.', 'इस महीने शेयर तेज़ी से ऊपर। FOMO ज़ोरों पर।')
      : loc('Volatility spiked. Talking heads predict the worst.', 'उतार-चढ़ाव बढ़ा। टीवी वाले सबसे बुरे की भविष्यवाणी कर रहे हैं।'),
    rows: [
      { label: loc('Equity index', 'इक्विटी सूचकांक'), value: state.market.indices.stocks.toFixed(2) },
      { label: loc('Repo rate', 'रेपो दर'), value: `${(state.market.repoRate * 100).toFixed(2)}%` },
      { label: loc('Inflation', 'महँगाई'), value: `${(state.market.inflationAnnual * 100).toFixed(2)}%` },
    ],
    options: [{ id: 'ack', label: loc('Noted', 'समझ गए'), apply: () => 'Read the news' }],
    temptation: 1,
    temptationReason: loc('A news headline. The action is what you do next month.', 'बस एक खबर। असली कदम वो है जो आप अगले महीने उठाते हैं।'),
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
  { weight: 1, gen: lifeEventCard },
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
    { weight: 1, gen: lifeEventCard },
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
