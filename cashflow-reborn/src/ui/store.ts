import { create } from 'zustand';
import type { GameState, TickInput, DecisionAction, FinancialStatement } from '@/types';
import { tick, buildInitialState, type SetupOptions, PRNG } from '@/engine';
import { drawRandomCard, drawCardForTile, rollTileType, type TileType, type Card, type CardOption } from '@/modules/cards/cards';
import { buildLoan } from '@/modules/loans/loans';
import { computeStatement } from '@/modules/dashboard/statement';
import type { CoachDecisionEntry, DecisionCategory } from '@/modules/coach/actionLog';
import {
  buildMonthPlan,
  planSeedFor,
  eventsCrossed,
  signedAmount,
  type MonthPlan,
  type AppliedMoneyEvent,
} from '@/modules/calendar/monthPlan';
import { formatINR } from '@/utils/money';

export type { MonthPlan, MoneyEvent, AppliedMoneyEvent } from '@/modules/calendar/monthPlan';

/** Snapshot shown by the Payday modal when a lap (month) completes. */
export interface PaydaySummary {
  /** Month number just closed (matches the "Month N closed" log line). */
  monthTick: number;
  salary: number;
  passive: number;
  totalExpenses: number;
  /** Actual cash change produced by the engine tick. */
  netDelta: number;
  /** passiveIncome / totalExpenses before the tick (0..1+). */
  freedomBefore: number;
  /** passiveIncome / totalExpenses after the tick (0..1+). */
  freedomAfter: number;
}

/** Before/after effect of a player decision, for the impact toast. */
export interface DecisionImpact {
  cashDelta: number;
  /** Change in monthly passive income. */
  passiveDelta: number;
  /** Change in freedom ratio (passive/expenses), as a decimal. */
  coverageDelta: number;
  uid: number;
}

/** Freedom ratio = passive income / total expenses (guarded). */
function freedomRatio(st: FinancialStatement): number {
  return st.totalExpenses > 0 ? st.passiveIncome / st.totalExpenses : 0;
}

let impactUid = 0;
/** Diff two states into a DecisionImpact; null when nothing visibly changed. */
function computeImpact(before: GameState, after: GameState): DecisionImpact | null {
  const sb = computeStatement(before);
  const sa = computeStatement(after);
  const cashDelta = Math.round(after.cashOnHand - before.cashOnHand);
  const passiveDelta = Math.round(sa.passiveIncome - sb.passiveIncome);
  const coverageDelta = freedomRatio(sa) - freedomRatio(sb);
  if (cashDelta === 0 && passiveDelta === 0 && Math.abs(coverageDelta) < 0.0005) return null;
  return { cashDelta, passiveDelta, coverageDelta, uid: ++impactUid };
}

const DAYS_PER_MONTH = 30;
const CARD_CELLS_PER_MONTH = 7;

/** Classify a card option resolution into a coarse behavioral category. */
function categorize(card: Card, optionId: string): DecisionCategory {
  if (optionId === 'skip') return 'resist';
  switch (card.kind) {
    case 'doodad': {
      // Subscription = adds to monthly lifestyle expense (id still 'buy' but apply pushes monthly)
      // We can't introspect apply(); but the card row label says "Monthly cost" for subs.
      const isSub = card.rows?.some((r) => r.label === 'Monthly cost') ?? false;
      return isSub ? 'doodad_subscription' : 'doodad_oneshot';
    }
    case 'deal_real_estate': return 'invest_real_estate';
    case 'deal_stock':       return 'invest_stock';
    case 'deal_index_fund':  return 'invest_index';
    case 'deal_gold':        return 'invest_gold';
    case 'deal_business':    return 'invest_business';
    case 'side_hustle':      return optionId === 'accept' ? 'side_hustle_accept' : 'resist';
    case 'unseen_expense':
      if (optionId === 'cc') return 'unseen_expense_cc';
      if (optionId === 'personal') return 'unseen_expense_loan';
      return 'unseen_expense_cash';
    case 'borrow_offer':     return optionId === 'accept' ? 'borrow_personal' : 'resist';
    case 'market_event':
    case 'payday_bonus':     return 'noop';
  }
}

function rollCardCells(seed: number): number[] {
  const rng = new PRNG(seed >>> 0);
  const cells = new Set<number>();
  while (cells.size < CARD_CELLS_PER_MONTH) {
    cells.add(rng.int(2, DAYS_PER_MONTH));
  }
  return [...cells].sort((a, b) => a - b);
}

/** Assign a tile type to each card cell (deterministic from the same seed). */
function assignCellTypes(cells: number[], seed: number): Record<number, TileType> {
  const rng = new PRNG((seed ^ 0x9e3779b9) >>> 0);
  const out: Record<number, TileType> = {};
  for (const day of cells) out[day] = rollTileType(rng);
  return out;
}

export type GameStatus = 'playing' | 'won' | 'lost';

/** Months of running cash < 0 before bankruptcy triggers. */
export const BANKRUPTCY_GRACE_MONTHS = 6;

const COACH_KEY = 'cashflow-reborn:coach';
function loadCoachPref(): boolean {
  if (typeof localStorage === 'undefined') return true;
  const stored = localStorage.getItem(COACH_KEY);
  return stored === null ? true : stored === '1'; // default ON for new players
}
function saveCoachPref(on: boolean): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(COACH_KEY, on ? '1' : '0');
}

interface GameStore {
  state: GameState | null;
  notifications: string[];
  // Board game layer
  dayPosition: number;          // 0..DAYS_PER_MONTH (30 = lap finished)
  lastRoll: number | null;
  isRolling: boolean;
  cardCells: number[];          // day indices that draw a card
  cellTypes: Record<number, TileType>; // tile type per card cell
  currentCard: Card | null;
  pendingCardCells: number[];   // queue of card cells crossed but not yet drawn
  // Outcome
  gameStatus: GameStatus;
  outcomeDismissed: boolean;    // user clicked "Keep playing" on a status modal
  // Learning aids
  coachMode: boolean;
  /** Player's actual card decisions over time — drives behavioral-pattern lessons. */
  decisionLog: CoachDecisionEntry[];
  // Cash calendar (preview ledger — engine untouched)
  /** Preview plan of when money moves this month. */
  monthPlan: MonthPlan | null;
  /** Rolling ledger of preview events the pawn has crossed (last 60). */
  moneyEvents: AppliedMoneyEvent[];
  /** Net signed preview amount currently applied to cashOnHand; reverted before each tick. */
  previewAppliedTotal: number;
  // Payday moment
  pendingPayday: PaydaySummary | null;
  // Decision impact toast
  lastImpact: DecisionImpact | null;
  // Actions
  initGame: (opts: SetupOptions) => void;
  toggleCoachMode: () => void;
  rollDice: () => void;
  collectPayday: () => void;
  resolveCardOption: (optionId: string) => void;
  resolveCardOptionWithLoan: (optionId: string, loanKind?: 'personal' | 'credit_card') => void;
  closeCard: () => void;
  step: (actions?: DecisionAction[]) => void;
  fastForward: (months: number) => void;
  applyAction: (action: DecisionAction) => void;
  dismissOutcome: () => void;
  reset: () => void;
}

export const DAYS_IN_MONTH = DAYS_PER_MONTH;

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  notifications: [],
  dayPosition: 0,
  lastRoll: null,
  isRolling: false,
  cardCells: [],
  cellTypes: {},
  currentCard: null,
  pendingCardCells: [],
  gameStatus: 'playing',
  outcomeDismissed: false,
  coachMode: loadCoachPref(),
  decisionLog: [],
  monthPlan: null,
  moneyEvents: [],
  previewAppliedTotal: 0,
  pendingPayday: null,
  lastImpact: null,

  toggleCoachMode: () => {
    const next = !get().coachMode;
    saveCoachPref(next);
    set({ coachMode: next });
  },

  initGame: (opts) => {
    const state = buildInitialState(opts);
    set({
      state,
      notifications: [`🎲 Game started for ${opts.playerName}`],
      dayPosition: 0,
      lastRoll: null,
      cardCells: rollCardCells(opts.seed),
      cellTypes: assignCellTypes(rollCardCells(opts.seed), opts.seed),
      currentCard: null,
      pendingCardCells: [],
      gameStatus: 'playing',
      outcomeDismissed: false,
      decisionLog: [],
      monthPlan: buildMonthPlan(state, planSeedFor(state)),
      moneyEvents: [],
      previewAppliedTotal: 0,
      pendingPayday: null,
      lastImpact: null,
    });
  },

  collectPayday: () => set({ pendingPayday: null }),

  rollDice: () => {
    const s = get();
    if (!s.state || s.currentCard || s.isRolling) return;
    set({ isRolling: true });
    const rng = new PRNG((s.state.meta.seed + s.state.meta.tick * 31 + s.dayPosition * 7) >>> 0);
    const roll = rng.int(1, 6);

    // Determine cards crossed in [prev+1 .. nextDay]
    const prev = s.dayPosition;
    const target = prev + roll;
    const lapped = target >= DAYS_PER_MONTH;
    const finalDay = lapped ? target - DAYS_PER_MONTH : target;

    // Cells crossed this lap (within [prev+1, DAYS_PER_MONTH] if lapped, else [prev+1, target])
    const upper = lapped ? DAYS_PER_MONTH : target;
    const crossed = s.cardCells.filter((c) => c > prev && c <= upper);

    // ---- Cash-calendar preview: apply plan events the pawn crossed ----
    // These are cosmetic previews of the month; everything applied here is
    // reverted before the engine tick so month-end cash is byte-identical
    // to the original (no-preview) code path.
    const planEvents = s.monthPlan && s.monthPlan.monthTick === s.state.meta.tick
      ? eventsCrossed(s.monthPlan, prev, upper)
      : [];
    let working = s.state;
    const appliedEntries: AppliedMoneyEvent[] = [];
    const eventNotes: string[] = [];
    let appliedDelta = 0;
    if (planEvents.length > 0) {
      working = JSON.parse(JSON.stringify(s.state)) as GameState;
      for (const e of planEvents) {
        working.cashOnHand += signedAmount(e);
        appliedDelta += signedAmount(e);
        appliedEntries.push({ ...e, balanceAfter: working.cashOnHand, monthTick: working.meta.tick });
        eventNotes.push(`Day ${e.day} · ${formatINR(e.amount)} ${e.kind === 'credit' ? 'credited' : 'debited'} — ${e.label}`);
      }
      working.statement = computeStatement(working);
    }
    const previewTotal = s.previewAppliedTotal + appliedDelta;
    const moneyEvents = [...s.moneyEvents, ...appliedEntries].slice(-60);

    if (lapped) {
      // Revert ALL previews applied this month so tick() starts from the
      // exact state the old code path would have ticked.
      const preTick: GameState = working === s.state
        ? (JSON.parse(JSON.stringify(s.state)) as GameState)
        : working;
      preTick.cashOnHand -= previewTotal;
      const cashBeforeTick = preTick.cashOnHand;
      const freedomBefore = freedomRatio(computeStatement(preTick));
      const salaryThisTick = preTick.incomeStreams
        .filter((i) => i.kind === 'salary')
        .reduce((sum, i) => sum + i.monthlyGross, 0);

      // Run a month tick (exactly as before)
      const result = tick(preTick, { actions: [] });
      const nextSeed = (result.state.meta.seed + result.state.meta.tick * 1009) >>> 0;
      const status = evaluateGameStatus(result.state, s.gameStatus);
      const payday: PaydaySummary | null = status === 'playing'
        ? {
            monthTick: result.state.meta.tick,
            salary: salaryThisTick,
            passive: Math.round(result.state.statement.passiveIncome),
            totalExpenses: Math.round(result.state.statement.totalExpenses),
            netDelta: result.state.cashOnHand - cashBeforeTick,
            freedomBefore,
            freedomAfter: freedomRatio(result.state.statement),
          }
        : null;
      set({
        state: result.state,
        notifications: [...s.notifications, ...eventNotes, `📅 Month ${result.state.meta.tick} closed`, ...result.notifications].slice(-25),
        dayPosition: finalDay,
        lastRoll: roll,
        cardCells: rollCardCells(nextSeed),
        cellTypes: assignCellTypes(rollCardCells(nextSeed), nextSeed),
        pendingCardCells: crossed,
        isRolling: false,
        gameStatus: status,
        monthPlan: buildMonthPlan(result.state, planSeedFor(result.state)),
        moneyEvents,
        previewAppliedTotal: 0,
        pendingPayday: payday,
      });
    } else {
      set({
        state: working,
        notifications: eventNotes.length > 0 ? [...s.notifications, ...eventNotes].slice(-25) : s.notifications,
        dayPosition: target,
        lastRoll: roll,
        pendingCardCells: crossed,
        isRolling: false,
        moneyEvents,
        previewAppliedTotal: previewTotal,
      });
    }

    // After update, draw a card if any pending
    setTimeout(() => drawNextCard(), 250);
  },

  resolveCardOption: (optionId) => {
    const s = get();
    if (!s.state || !s.currentCard) return;
    const opt = s.currentCard.options.find((o) => o.id === optionId);
    if (!opt) return;
    const cantAfford = opt.affordCheck?.(s.state);
    if (cantAfford) {
      set({ notifications: [...s.notifications, `⚠️ ${cantAfford}`].slice(-25) });
      return;
    }
    // Clone state, mutate, set back
    const cloned: GameState = JSON.parse(JSON.stringify(s.state));
    const note = applyOption(cloned, opt);
    cloned.statement = computeStatement(cloned);
    const entry: CoachDecisionEntry = {
      tick: cloned.meta.tick,
      cardKind: s.currentCard.kind,
      optionId,
      borrowed: false,
      marketPhase: cloned.market.phase,
      category: categorize(s.currentCard, optionId),
    };
    set({
      state: cloned,
      notifications: [...s.notifications, `🃏 ${note}`].slice(-25),
      currentCard: null,
      gameStatus: evaluateGameStatus(cloned, s.gameStatus),
      decisionLog: [...s.decisionLog, entry],
      lastImpact: computeImpact(s.state, cloned) ?? s.lastImpact,
    });
    // Draw next pending if any
    setTimeout(() => drawNextCard(), 200);
  },

  resolveCardOptionWithLoan: (optionId, loanKind = 'personal') => {
    const s = get();
    if (!s.state || !s.currentCard) return;
    const opt = s.currentCard.options.find((o) => o.id === optionId);
    if (!opt || !opt.cashCost) return;
    const cloned: GameState = JSON.parse(JSON.stringify(s.state));
    const shortfall = Math.max(0, opt.cashCost - cloned.cashOnHand);
    // Round shortfall up to nearest 10k for clean loan amounts
    const principal = Math.ceil(shortfall / 10_000) * 10_000;
    const tenureMonths = loanKind === 'credit_card' ? 6 : 36;
    const loan = buildLoan({
      kind: loanKind,
      label: `Loan for ${s.currentCard.title}`,
      principal,
      tenureMonths,
    });
    cloned.liabilities.push({
      ...loan,
      id: `loan_${cloned.liabilities.length + 1}_${cloned.meta.tick}`,
      startedAt: cloned.meta.tick,
    });
    cloned.cashOnHand += principal;
    const note = applyOption(cloned, opt);
    cloned.statement = computeStatement(cloned);
    const entry: CoachDecisionEntry = {
      tick: cloned.meta.tick,
      cardKind: s.currentCard.kind,
      optionId,
      borrowed: true,
      marketPhase: cloned.market.phase,
      category: categorize(s.currentCard, optionId),
    };
    set({
      state: cloned,
      notifications: [
        ...s.notifications,
        `🏦 Borrowed ₹${principal.toLocaleString('en-IN')} (${loanKind}, EMI ₹${loan.emi.toLocaleString('en-IN')}/mo)`,
        `🃏 ${note}`,
      ].slice(-25),
      currentCard: null,
      gameStatus: evaluateGameStatus(cloned, s.gameStatus),
      decisionLog: [...s.decisionLog, entry],
      lastImpact: computeImpact(s.state, cloned) ?? s.lastImpact,
    });
    setTimeout(() => drawNextCard(), 200);
  },

  closeCard: () => {
    set({ currentCard: null });
    setTimeout(() => drawNextCard(), 100);
  },

  step: (actions = []) => {
    const g = get();
    const cur = g.state;
    if (!cur) return;
    // Discard any cash previews before the real tick (no previews in step).
    let base = cur;
    if (g.previewAppliedTotal !== 0) {
      base = JSON.parse(JSON.stringify(cur)) as GameState;
      base.cashOnHand -= g.previewAppliedTotal;
    }
    const input: TickInput = { actions };
    const result = tick(base, input);
    const nextSeed = (result.state.meta.seed + result.state.meta.tick * 1009) >>> 0;
    set({
      state: result.state,
      notifications: [...get().notifications, ...result.notifications].slice(-25),
      cardCells: rollCardCells(nextSeed),
      cellTypes: assignCellTypes(rollCardCells(nextSeed), nextSeed),
      dayPosition: 0,
      gameStatus: evaluateGameStatus(result.state, get().gameStatus),
      monthPlan: buildMonthPlan(result.state, planSeedFor(result.state)),
      previewAppliedTotal: 0,
    });
  },

  fastForward: (months) => {
    const g = get();
    const cur = g.state;
    if (!cur) return;
    // Discard any cash previews before ticking (no previews in fast-forward).
    let s = cur;
    if (g.previewAppliedTotal !== 0) {
      s = JSON.parse(JSON.stringify(cur)) as GameState;
      s.cashOnHand -= g.previewAppliedTotal;
    }
    const allNotes: string[] = [];
    let status = get().gameStatus;
    for (let i = 0; i < months; i++) {
      const r = tick(s, { actions: [] });
      s = r.state;
      allNotes.push(...r.notifications);
      // Stop fast-forwarding immediately if outcome reached
      status = evaluateGameStatus(s, status);
      if (status !== 'playing') break;
    }
    const nextSeed = (s.meta.seed + s.meta.tick * 1009) >>> 0;
    set({
      state: s,
      notifications: [...get().notifications, `⏩ Fast-forwarded ${months} months`, ...allNotes].slice(-25),
      cardCells: rollCardCells(nextSeed),
      cellTypes: assignCellTypes(rollCardCells(nextSeed), nextSeed),
      dayPosition: 0,
      gameStatus: status,
      monthPlan: buildMonthPlan(s, planSeedFor(s)),
      previewAppliedTotal: 0,
    });
  },

  applyAction: (action) => {
    const s = get();
    if (!s.state) return;
    const cloned: GameState = JSON.parse(JSON.stringify(s.state));
    const note = applyDecisionDirect(cloned, action);
    cloned.statement = computeStatement(cloned);
    // Log balance-sheet actions so behavioral lessons can see them
    const log = [...s.decisionLog];
    if (action.kind === 'sell_asset') {
      log.push({
        tick: cloned.meta.tick,
        cardKind: 'deal_stock', // synthetic — we only need category for pattern detection
        optionId: 'sell',
        borrowed: false,
        marketPhase: cloned.market.phase,
        category: 'sell_asset',
      });
    }
    set({
      state: cloned,
      notifications: [...s.notifications, note ?? '...'].slice(-25),
      gameStatus: evaluateGameStatus(cloned, s.gameStatus),
      decisionLog: log,
      lastImpact: computeImpact(s.state, cloned) ?? s.lastImpact,
    });
  },

  dismissOutcome: () => set({ outcomeDismissed: true }),

  reset: () =>
    set({
      state: null,
      notifications: [],
      dayPosition: 0,
      lastRoll: null,
      cardCells: [],
      cellTypes: {},
      currentCard: null,
      pendingCardCells: [],
      gameStatus: 'playing',
      outcomeDismissed: false,
      decisionLog: [],
      monthPlan: null,
      moneyEvents: [],
      previewAppliedTotal: 0,
      pendingPayday: null,
      lastImpact: null,
    }),
}));

// Expose store in dev for manual testing/automation
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { __game: typeof useGameStore }).__game = useGameStore;
}

/** Evaluate win/loss conditions from the current state. */
export function evaluateGameStatus(state: GameState | null, currentStatus: GameStatus): GameStatus {
  if (!state || currentStatus !== 'playing') return currentStatus;
  // Win: passive income covers monthly expenses (Rat Race escaped)
  if (state.statement.passiveIncome >= state.statement.totalExpenses && state.statement.totalExpenses > 0) {
    return 'won';
  }
  // Lose: 6 consecutive months ending in negative cash
  const last = state.history.slice(-BANKRUPTCY_GRACE_MONTHS);
  if (last.length >= BANKRUPTCY_GRACE_MONTHS && last.every((h) => h.cashOnHand < 0)) {
    return 'lost';
  }
  return 'playing';
}

/** Count trailing months of negative cash (for the "bankruptcy in N months" warning). */
export function trailingNegativeCashMonths(state: GameState | null): number {
  if (!state) return 0;
  let count = 0;
  for (let i = state.history.length - 1; i >= 0; i--) {
    if (state.history[i].cashOnHand < 0) count++;
    else break;
  }
  return count;
}

function drawNextCard() {
  const s = useGameStore.getState();
  if (s.currentCard || !s.state) return;
  if (s.pendingCardCells.length === 0) return;
  const [day, ...rest] = s.pendingCardCells;
  const rng = new PRNG((s.state.meta.seed + s.state.meta.tick * 13 + s.dayPosition + Math.floor(Math.random() * 1000)) >>> 0);
  const tile = s.cellTypes[day];
  const card = tile ? drawCardForTile(s.state, rng, tile) : drawRandomCard(s.state, rng);
  useGameStore.setState({ currentCard: card, pendingCardCells: rest });
}

function applyOption(state: GameState, opt: CardOption): string {
  try {
    return opt.apply(state);
  } catch (e: unknown) {
    return `Error applying card: ${(e as Error).message}`;
  }
}

// Direct mutation (no full tick) for sell/prepay/borrow from balance sheet
function applyDecisionDirect(state: GameState, action: DecisionAction): string | null {
  switch (action.kind) {
    case 'sell_asset': {
      const asset = state.assets.find((a) => a.id === action.assetId);
      if (!asset) return 'Asset not found';
      if (action.units > asset.units) return 'Not enough units';
      const proceeds = asset.currentPrice * action.units;
      state.cashOnHand += Math.round(proceeds);
      asset.units -= action.units;
      if (asset.units === 0) state.assets = state.assets.filter((a) => a.id !== action.assetId);
      return `Sold ${action.units} of ${asset.label} for ₹${Math.round(proceeds).toLocaleString('en-IN')}`;
    }
    case 'prepay_loan': {
      const loan = state.liabilities.find((l) => l.id === action.loanId);
      if (!loan) return 'Loan not found';
      if (state.cashOnHand < action.amount) return 'Insufficient cash';
      const penalty = Math.round(action.amount * loan.prepaymentPenalty);
      state.cashOnHand -= action.amount + penalty;
      loan.principalOutstanding = Math.max(0, loan.principalOutstanding - action.amount);
      if (loan.principalOutstanding === 0) {
        state.liabilities = state.liabilities.filter((l) => l.id !== action.loanId);
        return `Paid off ${loan.label} (penalty ₹${penalty.toLocaleString('en-IN')})`;
      }
      return `Prepaid ₹${action.amount.toLocaleString('en-IN')} on ${loan.label}`;
    }
    case 'take_loan': {
      state.liabilities.push({
        ...action.loan,
        id: `loan_${state.liabilities.length + 1}_${state.meta.tick}`,
        startedAt: state.meta.tick,
      });
      state.cashOnHand += action.loan.principalOutstanding;
      return `Took loan: ${action.loan.label} (+₹${action.loan.principalOutstanding.toLocaleString('en-IN')})`;
    }
    default:
      return null;
  }
}
