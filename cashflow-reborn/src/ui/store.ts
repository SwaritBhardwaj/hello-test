import { create } from 'zustand';
import type { GameState, TickInput, DecisionAction } from '@/types';
import { tick, buildInitialState, type SetupOptions, PRNG } from '@/engine';
import { drawRandomCard, type Card, type CardOption } from '@/modules/cards/cards';
import { buildLoan } from '@/modules/loans/loans';
import { computeStatement } from '@/modules/dashboard/statement';

const DAYS_PER_MONTH = 30;
const CARD_CELLS_PER_MONTH = 7;

function rollCardCells(seed: number): number[] {
  const rng = new PRNG(seed >>> 0);
  const cells = new Set<number>();
  while (cells.size < CARD_CELLS_PER_MONTH) {
    cells.add(rng.int(2, DAYS_PER_MONTH));
  }
  return [...cells].sort((a, b) => a - b);
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
  currentCard: Card | null;
  pendingCardCells: number[];   // queue of card cells crossed but not yet drawn
  // Outcome
  gameStatus: GameStatus;
  outcomeDismissed: boolean;    // user clicked "Keep playing" on a status modal
  // Learning aids
  coachMode: boolean;
  /** IDs of recently surfaced wisdom lessons (newest first), capped to ~6. */
  recentLessonIds: string[];
  // Actions
  initGame: (opts: SetupOptions) => void;
  toggleCoachMode: () => void;
  noteLessonShown: (id: string) => void;
  rollDice: () => void;
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
  currentCard: null,
  pendingCardCells: [],
  gameStatus: 'playing',
  outcomeDismissed: false,
  coachMode: loadCoachPref(),
  recentLessonIds: [],

  toggleCoachMode: () => {
    const next = !get().coachMode;
    saveCoachPref(next);
    set({ coachMode: next });
  },

  noteLessonShown: (id) => {
    const recent = get().recentLessonIds;
    if (recent[0] === id) return; // already at top
    set({ recentLessonIds: [id, ...recent.filter((x) => x !== id)].slice(0, 6) });
  },

  initGame: (opts) => {
    const state = buildInitialState(opts);
    set({
      state,
      notifications: [`🎲 Game started for ${opts.playerName}`],
      dayPosition: 0,
      lastRoll: null,
      cardCells: rollCardCells(opts.seed),
      currentCard: null,
      pendingCardCells: [],
      gameStatus: 'playing',
      outcomeDismissed: false,
      recentLessonIds: [],
    });
  },

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

    if (lapped) {
      // Run a month tick
      const result = tick(s.state, { actions: [] });
      const nextSeed = (result.state.meta.seed + result.state.meta.tick * 1009) >>> 0;
      set({
        state: result.state,
        notifications: [...s.notifications, `📅 Month ${result.state.meta.tick} closed`, ...result.notifications].slice(-25),
        dayPosition: finalDay,
        lastRoll: roll,
        cardCells: rollCardCells(nextSeed),
        pendingCardCells: crossed,
        isRolling: false,
        gameStatus: evaluateGameStatus(result.state, s.gameStatus),
      });
    } else {
      set({
        dayPosition: target,
        lastRoll: roll,
        pendingCardCells: crossed,
        isRolling: false,
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
    set({
      state: cloned,
      notifications: [...s.notifications, `🃏 ${note}`].slice(-25),
      currentCard: null,
      gameStatus: evaluateGameStatus(cloned, s.gameStatus),
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
    set({
      state: cloned,
      notifications: [
        ...s.notifications,
        `🏦 Borrowed ₹${principal.toLocaleString('en-IN')} (${loanKind}, EMI ₹${loan.emi.toLocaleString('en-IN')}/mo)`,
        `🃏 ${note}`,
      ].slice(-25),
      currentCard: null,
      gameStatus: evaluateGameStatus(cloned, s.gameStatus),
    });
    setTimeout(() => drawNextCard(), 200);
  },

  closeCard: () => {
    set({ currentCard: null });
    setTimeout(() => drawNextCard(), 100);
  },

  step: (actions = []) => {
    const cur = get().state;
    if (!cur) return;
    const input: TickInput = { actions };
    const result = tick(cur, input);
    const nextSeed = (result.state.meta.seed + result.state.meta.tick * 1009) >>> 0;
    set({
      state: result.state,
      notifications: [...get().notifications, ...result.notifications].slice(-25),
      cardCells: rollCardCells(nextSeed),
      dayPosition: 0,
      gameStatus: evaluateGameStatus(result.state, get().gameStatus),
    });
  },

  fastForward: (months) => {
    const cur = get().state;
    if (!cur) return;
    let s = cur;
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
      dayPosition: 0,
      gameStatus: status,
    });
  },

  applyAction: (action) => {
    const s = get();
    if (!s.state) return;
    const cloned: GameState = JSON.parse(JSON.stringify(s.state));
    const note = applyDecisionDirect(cloned, action);
    cloned.statement = computeStatement(cloned);
    set({
      state: cloned,
      notifications: [...s.notifications, note ?? '...'].slice(-25),
      gameStatus: evaluateGameStatus(cloned, s.gameStatus),
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
      currentCard: null,
      pendingCardCells: [],
      gameStatus: 'playing',
      outcomeDismissed: false,
      recentLessonIds: [],
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
  const [, ...rest] = s.pendingCardCells;
  const rng = new PRNG((s.state.meta.seed + s.state.meta.tick * 13 + s.dayPosition + Math.floor(Math.random() * 1000)) >>> 0);
  const card = drawRandomCard(s.state, rng);
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
