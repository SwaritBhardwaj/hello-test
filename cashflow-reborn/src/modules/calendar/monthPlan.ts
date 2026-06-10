import type { GameState, ExpenseCategory } from '@/types';
import { PRNG } from '@/engine/prng/prng';

// ============================================================
// Month plan — a PREVIEW ledger of when money moves during the
// month. Purely cosmetic/anticipatory: the engine tick remains
// the single source of truth. Every preview applied to cash is
// reverted before the real tick runs (see store.rollDice).
// ============================================================

export interface MoneyEvent {
  id: string;
  /** Calendar day this event lands on, 1..30. */
  day: number;
  label: string;
  /** Always a positive integer; direction comes from `kind`. */
  amount: number;
  kind: 'credit' | 'debit';
  category: string;
}

export interface MonthPlan {
  /** Seed the plan was built from (for determinism checks). */
  seed: number;
  /** Engine tick (month index) this plan previews. */
  monthTick: number;
  /** All events, sorted by day ascending. */
  events: MoneyEvent[];
}

/** A plan event that was actually applied to the preview cash balance. */
export type AppliedMoneyEvent = MoneyEvent & {
  balanceAfter: number;
  monthTick: number;
};

const SALARY_DAY = 1;
const HOUSING_DAY = 3;
const EMI_DAY = 5;
const INSURANCE_DAY = 10;
const UTILITIES_DAY = 15;
const SUBSCRIPTIONS_DAY = 18;

/** Variable categories that get split into several lifelike debits. */
const VARIABLE_CATEGORIES: ExpenseCategory[] = ['food', 'transport', 'lifestyle', 'misc'];

const VARIABLE_LABELS: Record<string, string[]> = {
  food: ['Groceries', 'Dining out', 'Food delivery', 'Vegetables & fruits', 'Snacks run'],
  transport: ['Fuel', 'Cab', 'Metro top-up', 'Auto rides', 'Parking & tolls'],
  lifestyle: ['Movie night', 'Shopping', 'Weekend outing', 'New headphones', 'Gym & hobbies'],
  misc: ['Mobile recharge', 'Household supplies', 'Small repairs', 'Courier & odds', 'Gifts'],
};

const SMALL_CREDIT_LABELS = ['UPI cashback', 'Refund', 'Friend repaid you'];

/** Deterministic plan seed for the month a state is currently in. */
export function planSeedFor(state: GameState): number {
  return ((state.meta.seed + state.meta.tick * 2654435761) ^ 0x85ebca6b) >>> 0;
}

function sumByCategory(state: GameState, category: ExpenseCategory): number {
  return state.expenses
    .filter((e) => e.category === category)
    .reduce((s, e) => s + e.monthlyAmount, 0);
}

/**
 * Build the preview ledger for the month `state` is currently in.
 * Deterministic: same state + same seed always yields the same plan.
 * Amounts are estimates derived from the statement inputs — the real
 * engine tick (with its own variance sampling) still settles the month.
 */
export function buildMonthPlan(state: GameState, seed: number): MonthPlan {
  const rng = new PRNG(seed >>> 0);
  const events: MoneyEvent[] = [];
  let n = 0;
  const push = (day: number, label: string, amount: number, kind: 'credit' | 'debit', category: string) => {
    const amt = Math.round(amount);
    if (amt <= 0) return;
    events.push({ id: `mev_${state.meta.tick}_${n++}`, day, label, amount: amt, kind, category });
  };

  // 1. Salary — day 1
  const salary = state.incomeStreams
    .filter((i) => i.kind === 'salary')
    .reduce((s, i) => s + i.monthlyGross, 0);
  push(SALARY_DAY, 'Salary credited', salary, 'credit', 'salary');

  // 2. Rent / housing — day 3
  push(HOUSING_DAY, 'Rent / housing', sumByCategory(state, 'housing'), 'debit', 'housing');

  // 3. Loan EMIs — day 5, one per loan
  for (const loan of state.liabilities) {
    push(EMI_DAY, `${loan.label} EMI`, loan.emi, 'debit', 'emi');
  }

  // 4. Insurance premiums — day 10, one per policy
  for (const policy of state.insurance) {
    push(INSURANCE_DAY, `${policy.label} premium`, policy.monthlyPremium, 'debit', 'insurance');
  }

  // 5. Other fixed expense buckets
  push(UTILITIES_DAY, 'Utility bills', sumByCategory(state, 'utilities'), 'debit', 'utilities');
  push(SUBSCRIPTIONS_DAY, 'Subscriptions', sumByCategory(state, 'subscriptions'), 'debit', 'subscriptions');

  // 6. Variable categories — split into 4–7 lifelike debits on days 2..29
  const present = VARIABLE_CATEGORIES.filter((c) => sumByCategory(state, c) > 0);
  if (present.length > 0) {
    const totalSplits = Math.max(rng.int(4, 7), present.length);
    // Every present category gets at least one debit; spread the rest randomly.
    const splitCount = new Map<ExpenseCategory, number>(present.map((c) => [c, 1]));
    for (let i = present.length; i < totalSplits; i++) {
      const c = present[rng.int(0, present.length - 1)];
      splitCount.set(c, (splitCount.get(c) ?? 0) + 1);
    }
    for (const cat of present) {
      const total = sumByCategory(state, cat);
      const k = splitCount.get(cat) ?? 1;
      // Random positive weights → portions that sum back to the total.
      const weights = Array.from({ length: k }, () => 0.5 + rng.next());
      const weightSum = weights.reduce((s, w) => s + w, 0);
      let allocated = 0;
      const labels = VARIABLE_LABELS[cat] ?? [cat];
      for (let i = 0; i < k; i++) {
        const amount = i === k - 1 ? total - allocated : Math.round((total * weights[i]) / weightSum);
        allocated += amount;
        const label = labels[(i + rng.int(0, labels.length - 1)) % labels.length];
        push(rng.int(2, 29), label, amount, 'debit', cat);
      }
    }
  }

  // 7. Remaining expense lines (healthcare, education, dependents, …)
  //    as single debits on a random mid-month day.
  const handled = new Set<string>(['housing', 'utilities', 'subscriptions', ...VARIABLE_CATEGORIES]);
  for (const line of state.expenses) {
    if (handled.has(line.category)) continue;
    push(rng.int(2, 29), line.label, line.monthlyAmount, 'debit', line.category);
  }

  // 8. ~10% chance of one small surprise credit
  if (rng.chance(0.1)) {
    const label = SMALL_CREDIT_LABELS[rng.int(0, SMALL_CREDIT_LABELS.length - 1)];
    push(rng.int(2, 29), label, rng.int(100, 2000), 'credit', 'windfall');
  }

  events.sort((a, b) => a.day - b.day);
  return { seed: seed >>> 0, monthTick: state.meta.tick, events };
}

/** Events that land strictly after `fromDay` and up to (incl.) `toDay`. */
export function eventsCrossed(plan: MonthPlan, fromDay: number, toDay: number): MoneyEvent[] {
  return plan.events.filter((e) => e.day > fromDay && e.day <= toDay);
}

/** Signed cash effect of an event (credit positive, debit negative). */
export function signedAmount(e: MoneyEvent): number {
  return e.kind === 'credit' ? e.amount : -e.amount;
}
