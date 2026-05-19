// =============================================================
// Core primitive types
// =============================================================

/** Indian Rupees in whole numbers. Avoid floats where possible. */
export type Rupees = number;

/** Number of months since game start. Tick 0 = start. */
export type TickIndex = number;

/** Percentage as a decimal. 0.07 = 7%. */
export type Percent = number;

/** Seeded PRNG state. */
export type Seed = number;

// =============================================================
// Player
// =============================================================

export type CityTier = 'T1' | 'T2' | 'T3';

export type FamilyStatus = 'single' | 'married' | 'married_with_kids';

export type ProfessionId =
  | 'sde'
  | 'doctor'
  | 'product_manager'
  | 'teacher'
  | 'ca'
  | 'designer'
  | 'sales'
  | 'govt_clerk'
  | 'founder'
  // ... extend in /data/professions.ts
  ;

export interface Player {
  name: string;
  age: number;             // years at game start
  ageInMonths: number;     // increments every tick
  profession: ProfessionId;
  city: CityTier;
  family: FamilyStatus;
  dependents: Dependent[];
  yearsOfExperience: number;
}

export interface Dependent {
  id: string;
  kind: 'child' | 'parent' | 'spouse';
  ageInMonths: number;
}

// =============================================================
// Income
// =============================================================

export interface IncomeStream {
  id: string;
  kind: 'salary' | 'freelance' | 'rental' | 'dividend' | 'interest' | 'business' | 'other';
  monthlyGross: Rupees;
  tdsRate: Percent;   // tax deducted at source
  taxable: boolean;
}

// =============================================================
// Expenses
// =============================================================

export type ExpenseCategory =
  | 'housing'
  | 'food'
  | 'transport'
  | 'utilities'
  | 'healthcare'
  | 'education'
  | 'insurance_premium'
  | 'lifestyle'
  | 'subscriptions'
  | 'dependents'
  | 'misc';

export interface ExpenseLine {
  category: ExpenseCategory;
  label: string;
  monthlyAmount: Rupees;
  inflationIndex: ExpenseCategory; // which CPI bucket drives growth
  isVariable: boolean;             // if true, sample monthly within bounds
  varianceBps?: number;            // basis points of variance
}

// =============================================================
// Assets
// =============================================================

export type AssetClass =
  | 'savings'
  | 'fd'
  | 'index_fund'
  | 'active_mf'
  | 'stocks'
  | 'real_estate_residential'
  | 'real_estate_commercial'
  | 'reit'
  | 'gold'
  | 'crypto'
  | 'business_equity'
  | 'ppf'
  | 'nps';

export interface Asset {
  id: string;
  kind: AssetClass;
  label: string;
  units: number;           // e.g. shares; for RE use 1
  unitCost: Rupees;        // average cost basis per unit
  currentPrice: Rupees;    // per unit market price
  acquiredAt: TickIndex;
  // Income generation
  yieldRateAnnual: Percent;        // dividend/rent/interest yield
  // Asset-specific metadata
  meta?: AssetMeta;
}

export type AssetMeta =
  | RealEstateMeta
  | FdMeta
  | BusinessEquityMeta
  | Record<string, never>;

export interface RealEstateMeta {
  city: CityTier;
  propertyType: 'flat_1bhk' | 'flat_2bhk' | 'flat_3bhk' | 'villa' | 'plot' | 'commercial';
  isTenanted: boolean;
  monthlyRent: Rupees;
  maintenancePerMonth: Rupees;
  propertyTaxPerYear: Rupees;
  vacancyProbability: Percent;
}

export interface FdMeta {
  bookedRate: Percent;
  maturityTick: TickIndex;
  penaltyOnEarlyExit: Percent;
}

export interface BusinessEquityMeta {
  stake: Percent;
  lastValuation: Rupees;
  liquidityYears: number;
}

// =============================================================
// Liabilities (loans)
// =============================================================

export type LoanKind =
  | 'home'
  | 'car'
  | 'personal'
  | 'education'
  | 'business'
  | 'credit_card';

export interface Loan {
  id: string;
  kind: LoanKind;
  label: string;
  principalOutstanding: Rupees;
  originalPrincipal: Rupees;
  rateAnnual: Percent;
  rateType: 'fixed' | 'variable';
  emi: Rupees;
  remainingMonths: number;
  startedAt: TickIndex;
  prepaymentPenalty: Percent;
  linkedAssetId?: string;   // e.g. home loan ↔ property
}

// =============================================================
// Insurance
// =============================================================

export type InsuranceKind =
  | 'term_life'
  | 'health_family_floater'
  | 'critical_illness'
  | 'disability'
  | 'property'
  | 'vehicle';

export interface InsurancePolicy {
  id: string;
  kind: InsuranceKind;
  label: string;
  sumAssured: Rupees;
  monthlyPremium: Rupees;
  startedAt: TickIndex;
  renewalTick: TickIndex;
  deductible: Rupees;
  coverageRatio: Percent;   // e.g. 0.8 = 80% of claim paid
}

// =============================================================
// Market
// =============================================================

export type MarketPhase = 'expansion' | 'peak' | 'contraction' | 'trough' | 'recovery';

export interface MarketState {
  phase: MarketPhase;
  phaseStartedAt: TickIndex;
  inflationAnnual: Percent;          // CPI
  repoRate: Percent;
  gdpGrowthAnnual: Percent;
  /** Indices by asset class — base = 1.0 at game start */
  indices: Record<AssetClass, number>;
  /** Per-category CPI multipliers — base 1.0 */
  cpiByCategory: Record<ExpenseCategory, number>;
}

// =============================================================
// Behavioral logging
// =============================================================

export interface DecisionLogEntry {
  tick: TickIndex;
  eventId: string;
  prompt: string;
  options: string[];
  chosen: number;
  msToDecide: number;
  marketPhaseAtTime: MarketPhase;
}

export type BehavioralPattern =
  | 'fomo_buyer'
  | 'panic_seller'
  | 'anchorer'
  | 'lifestyle_creeper'
  | 'over_saver'
  | 'over_leverager';

// =============================================================
// Goals
// =============================================================

export interface Goal {
  id: string;
  kind: 'rat_race_escape' | 'fire' | 'net_worth_by_age' | 'child_education' | 'home_down_payment' | 'custom';
  label: string;
  targetRupees?: Rupees;
  targetTick?: TickIndex;
  achievedAt?: TickIndex;
}

// =============================================================
// Events
// =============================================================

export type GameEventKind =
  | 'random'        // unsolicited (medical, layoff, etc.)
  | 'decision'      // player must choose
  | 'milestone'     // marriage, kid, retirement target hit
  | 'market'        // crash, boom
  | 'recurring';    // scheduled (e.g. annual review)

export interface GameEvent {
  id: string;
  kind: GameEventKind;
  triggeredAt: TickIndex;
  title: string;
  description: string;
  payload?: Record<string, unknown>;
}

// =============================================================
// Aggregated state
// =============================================================

export interface FinancialStatement {
  totalIncome: Rupees;          // monthly
  totalExpenses: Rupees;        // monthly
  totalAssets: Rupees;
  totalLiabilities: Rupees;
  netWorth: Rupees;
  passiveIncome: Rupees;
  savingsRate: Percent;
}

export interface HistoryPoint {
  tick: TickIndex;
  netWorth: Rupees;
  income: Rupees;
  expenses: Rupees;
  cashOnHand: Rupees;
  marketPhase: MarketPhase;
}

// =============================================================
// THE GameState — single source of truth
// =============================================================

export interface GameState {
  meta: {
    seed: Seed;
    tick: TickIndex;
    startDate: string; // ISO yyyy-mm-dd
    version: '0.1.0';
  };
  player: Player;
  cashOnHand: Rupees;
  incomeStreams: IncomeStream[];
  expenses: ExpenseLine[];
  assets: Asset[];
  liabilities: Loan[];
  insurance: InsurancePolicy[];
  market: MarketState;
  goals: Goal[];
  history: HistoryPoint[];
  decisionLog: DecisionLogEntry[];
  pendingEvents: GameEvent[];
  detectedPatterns: BehavioralPattern[];
  // derived; recomputed every tick by dashboard module
  statement: FinancialStatement;
}

// =============================================================
// Decisions — the input to a tick
// =============================================================

export type DecisionAction =
  | { kind: 'noop' }
  | { kind: 'buy_asset'; assetTemplate: Omit<Asset, 'id' | 'acquiredAt'> }
  | { kind: 'sell_asset'; assetId: string; units: number }
  | { kind: 'take_loan'; loan: Omit<Loan, 'id' | 'startedAt'> }
  | { kind: 'prepay_loan'; loanId: string; amount: Rupees }
  | { kind: 'buy_insurance'; policy: Omit<InsurancePolicy, 'id' | 'startedAt'> }
  | { kind: 'cancel_insurance'; policyId: string }
  | { kind: 'adjust_expense'; category: ExpenseCategory; delta: Rupees }
  | { kind: 'switch_career'; newProfession: ProfessionId; salaryGapMonths: number }
  | { kind: 'answer_event'; eventId: string; optionIndex: number; msToDecide: number };

export interface TickInput {
  actions: DecisionAction[];
}

export interface TickResult {
  state: GameState;
  newEvents: GameEvent[];
  notifications: string[];
}
