/**
 * All economic constants in one place.
 * Treat this file as the calibration knob. Adjust here, not inline.
 * v1: India-centric, post-2025 base.
 */

import type { AssetClass, ExpenseCategory } from '@/types';

// ---------------- Inflation (annual, by CPI bucket) ----------------
export const INFLATION_BASE_ANNUAL = {
  housing: 0.055,
  food: 0.06,
  transport: 0.05,
  utilities: 0.055,
  healthcare: 0.085,        // healthcare inflates faster
  education: 0.08,
  insurance_premium: 0.07,
  lifestyle: 0.05,
  subscriptions: 0.05,
  dependents: 0.07,
  misc: 0.05,
} satisfies Record<ExpenseCategory, number>;

// ---------------- Asset class expected returns ----------------
// Tuple: [expectedAnnualMean, annualStdDev, yieldComponentOfTotal]
// Total return ≈ price appreciation + yield. yieldRateAnnual sits on the asset.
export const ASSET_RETURN_PROFILE = {
  savings:                  { mean: 0.035, std: 0.0, yield: 0.035 },
  fd:                       { mean: 0.07,  std: 0.0, yield: 0.07 },
  index_fund:               { mean: 0.12,  std: 0.18, yield: 0.012 },
  active_mf:                { mean: 0.11,  std: 0.22, yield: 0.010 },
  stocks:                   { mean: 0.13,  std: 0.30, yield: 0.012 },
  real_estate_residential:  { mean: 0.07,  std: 0.08, yield: 0.025 },
  real_estate_commercial:   { mean: 0.08,  std: 0.10, yield: 0.07 },
  reit:                     { mean: 0.085, std: 0.12, yield: 0.06 },
  gold:                     { mean: 0.08,  std: 0.14, yield: 0 },
  crypto:                   { mean: 0.20,  std: 0.80, yield: 0 },
  business_equity:          { mean: 0.18,  std: 0.50, yield: 0 },
  ppf:                      { mean: 0.072, std: 0.0, yield: 0.072 },
  nps:                      { mean: 0.10,  std: 0.10, yield: 0.04 },
} satisfies Record<AssetClass, { mean: number; std: number; yield: number }>;

// ---------------- Market cycle ----------------
export const MARKET_CYCLE = {
  /** Phase duration in months: [min, max] */
  phaseDurationRange: {
    expansion:   [24, 60],
    peak:        [3,  9],
    contraction: [6,  18],
    trough:      [3,  9],
    recovery:    [12, 36],
  },
  /** Return multipliers by phase × asset class type */
  phaseMultipliers: {
    expansion:   { equity: 1.0,  re: 1.0,  gold: 0.9,  fixed: 1.0 },
    peak:        { equity: 0.5,  re: 0.8,  gold: 1.0,  fixed: 1.0 },
    contraction: { equity: -1.5, re: -0.5, gold: 1.5,  fixed: 1.0 },
    trough:      { equity: 0.2,  re: -0.2, gold: 1.2,  fixed: 1.0 },
    recovery:    { equity: 1.3,  re: 1.1,  gold: 0.8,  fixed: 1.0 },
  },
} as const;

// ---------------- Loan defaults (annual rates) ----------------
export const LOAN_RATES = {
  home:        { rate: 0.085, maxTenureMonths: 30 * 12 },
  car:         { rate: 0.10,  maxTenureMonths: 7 * 12 },
  personal:    { rate: 0.135, maxTenureMonths: 5 * 12 },
  education:   { rate: 0.10,  maxTenureMonths: 10 * 12 },
  business:    { rate: 0.115, maxTenureMonths: 7 * 12 },
  credit_card: { rate: 0.36,  maxTenureMonths: 1 },     // revolving
} as const;

/** Banks reject if total EMI / gross monthly income > this */
export const DTI_CAP = 0.55;

// ---------------- Taxes (India FY assumptions, simplified) ----------------
export const TAX = {
  ltcgEquityRate: 0.10,         // > 1L exempt threshold per FY
  ltcgEquityExemption: 100_000,
  stcgEquityRate: 0.15,
  ltcgDebtRate: 0.20,           // with indexation (when applicable)
  ltcgDebtHoldingMonths: 24,
  reLtcgHoldingMonths: 24,
  // Slabs: new regime (FY 25-26 illustrative)
  slabsNewRegime: [
    { upTo: 300_000,   rate: 0 },
    { upTo: 700_000,   rate: 0.05 },
    { upTo: 1_000_000, rate: 0.10 },
    { upTo: 1_200_000, rate: 0.15 },
    { upTo: 1_500_000, rate: 0.20 },
    { upTo: Infinity,  rate: 0.30 },
  ],
  cessRate: 0.04,
} as const;

// ---------------- Lifestyle creep ----------------
/** When monthly income rises >= this %, lifestyle expenses creep up. */
export const LIFESTYLE_CREEP_INCOME_THRESHOLD = 0.20;
export const LIFESTYLE_CREEP_MULTIPLIER = 0.40; // 40% of income delta leaks to lifestyle

// ---------------- Random event probabilities (monthly) ----------------
export const EVENT_PROBABILITIES = {
  medicalEmergencyMinor:  0.005,
  medicalEmergencyMajor:  0.0015,
  jobLoss:                0.002,
  promotionOffer:         0.008,
  marketCrashTrigger:     0.001, // additional shock on top of cycle
  familyObligation:       0.004,
  startupAngelOffer:      0.001,
  rentalVacancy:          0.02,  // per tenanted property
} as const;
