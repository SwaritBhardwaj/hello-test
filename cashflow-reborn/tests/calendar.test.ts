import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildInitialState, tick } from '@/engine';
import { buildLoan } from '@/modules/loans/loans';
import { buildMonthPlan, planSeedFor, eventsCrossed, signedAmount } from '@/modules/calendar/monthPlan';
import { useGameStore } from '@/ui/store';
import type { GameState } from '@/types';

const SETUP = {
  seed: 42,
  playerName: 'Cal',
  age: 28,
  profession: 'product_manager' as const,
  city: 'T1' as const,
  family: 'single' as const,
  startDate: '2026-01-01',
};

function freshState(): GameState {
  const s = buildInitialState(SETUP);
  // Add a loan + an insurance policy so EMI/premium events exist.
  s.liabilities.push({
    ...buildLoan({ kind: 'personal', label: 'Bike loan', principal: 120_000, tenureMonths: 24 }),
    id: 'loan_test_1',
    startedAt: 0,
  });
  s.insurance.push({
    id: 'ins_test_1',
    kind: 'health_family_floater',
    label: 'Health cover',
    sumAssured: 1_000_000,
    monthlyPremium: 1_500,
    startedAt: 0,
    renewalTick: 12,
    deductible: 0,
    coverageRatio: 0.8,
  });
  return s;
}

describe('buildMonthPlan', () => {
  it('is deterministic for the same state + seed', () => {
    const a = buildMonthPlan(freshState(), 777);
    const b = buildMonthPlan(freshState(), 777);
    expect(a).toEqual(b);
  });

  it('schedules the anchor events on their fixed days', () => {
    const state = freshState();
    const plan = buildMonthPlan(state, planSeedFor(state));

    const salary = plan.events.find((e) => e.category === 'salary')!;
    expect(salary.day).toBe(1);
    expect(salary.kind).toBe('credit');
    expect(salary.label).toBe('Salary credited');
    expect(salary.amount).toBe(state.incomeStreams[0].monthlyGross);

    const housing = plan.events.find((e) => e.category === 'housing')!;
    expect(housing.day).toBe(3);
    expect(housing.kind).toBe('debit');

    const emi = plan.events.find((e) => e.category === 'emi')!;
    expect(emi.day).toBe(5);
    expect(emi.amount).toBe(state.liabilities[0].emi);
    expect(emi.label).toContain('Bike loan');

    const premium = plan.events.find((e) => e.category === 'insurance')!;
    expect(premium.day).toBe(10);
    expect(premium.amount).toBe(1500);

    expect(plan.events.find((e) => e.category === 'utilities')!.day).toBe(15);
    expect(plan.events.find((e) => e.category === 'subscriptions')!.day).toBe(18);
  });

  it('splits variable categories into 4–7 debits on days 2..29 that sum to the monthly amounts', () => {
    const state = freshState();
    const plan = buildMonthPlan(state, planSeedFor(state));
    const variable = plan.events.filter((e) => ['food', 'transport', 'lifestyle', 'misc'].includes(e.category));
    expect(variable.length).toBeGreaterThanOrEqual(4);
    expect(variable.length).toBeLessThanOrEqual(7);
    for (const e of variable) {
      expect(e.kind).toBe('debit');
      expect(e.day).toBeGreaterThanOrEqual(2);
      expect(e.day).toBeLessThanOrEqual(29);
      expect(e.amount).toBeGreaterThan(0);
      expect(Number.isInteger(e.amount)).toBe(true);
    }
    for (const cat of ['food', 'transport', 'lifestyle', 'misc'] as const) {
      const planned = variable.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
      const actual = state.expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.monthlyAmount, 0);
      expect(planned).toBe(actual);
    }
  });

  it('keeps every event inside the month with positive integer amounts, sorted by day', () => {
    const state = freshState();
    const plan = buildMonthPlan(state, planSeedFor(state));
    let prevDay = 0;
    for (const e of plan.events) {
      expect(e.day).toBeGreaterThanOrEqual(1);
      expect(e.day).toBeLessThanOrEqual(30);
      expect(e.amount).toBeGreaterThan(0);
      expect(Number.isInteger(e.amount)).toBe(true);
      expect(e.day).toBeGreaterThanOrEqual(prevDay);
      prevDay = e.day;
    }
  });

  it('produces the small surprise credit roughly 10% of the time', () => {
    const state = freshState();
    let hits = 0;
    for (let seed = 0; seed < 400; seed++) {
      const plan = buildMonthPlan(state, seed);
      const windfalls = plan.events.filter((e) => e.category === 'windfall');
      expect(windfalls.length).toBeLessThanOrEqual(1);
      if (windfalls.length === 1) {
        hits++;
        expect(windfalls[0].kind).toBe('credit');
        expect(windfalls[0].amount).toBeGreaterThanOrEqual(100);
        expect(windfalls[0].amount).toBeLessThanOrEqual(2000);
      }
    }
    expect(hits / 400).toBeGreaterThan(0.04);
    expect(hits / 400).toBeLessThan(0.2);
  });

  it('eventsCrossed picks the (from, to] window and signedAmount signs by kind', () => {
    const state = freshState();
    const plan = buildMonthPlan(state, planSeedFor(state));
    const crossed = eventsCrossed(plan, 0, 5);
    expect(crossed.every((e) => e.day >= 1 && e.day <= 5)).toBe(true);
    expect(crossed.some((e) => e.category === 'salary')).toBe(true);
    expect(eventsCrossed(plan, 5, 5)).toEqual([]);
    const salary = plan.events.find((e) => e.category === 'salary')!;
    const emi = plan.events.find((e) => e.category === 'emi')!;
    expect(signedAmount(salary)).toBe(salary.amount);
    expect(signedAmount(emi)).toBe(-emi.amount);
  });
});

describe('store preview ledger (full lap via rollDice)', () => {
  beforeEach(() => {
    vi.useFakeTimers(); // keeps drawNextCard from opening card modals mid-lap
    useGameStore.getState().reset();
    useGameStore.getState().initGame(SETUP);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function rollUntilLap(targetTick = 1): void {
    let guard = 0;
    while (useGameStore.getState().state!.meta.tick < targetTick) {
      useGameStore.getState().rollDice();
      if (++guard > 60 * targetTick) throw new Error('lap never completed');
    }
  }

  it('CRITICAL INVARIANT: month-end cash matches a plain tick() on the pre-lap state', () => {
    const pristine: GameState = JSON.parse(JSON.stringify(useGameStore.getState().state));
    const expected = tick(pristine, { actions: [] }).state;

    rollUntilLap();
    const after = useGameStore.getState();

    // Previews actually happened during the month (the invariant is non-trivial).
    expect(after.moneyEvents.length).toBeGreaterThan(0);

    expect(after.state!.cashOnHand).toBe(expected.cashOnHand);
    expect(after.state!.statement.netWorth).toBe(expected.statement.netWorth);
    expect(after.state!.history).toEqual(expected.history);
    expect(after.state!.meta.tick).toBe(1);

    // Second lap (now starting from a mid-month pawn position) holds too.
    const pristine2: GameState = JSON.parse(JSON.stringify(after.state));
    const expected2 = tick(pristine2, { actions: [] }).state;
    rollUntilLap(2);
    const after2 = useGameStore.getState();
    expect(after2.state!.cashOnHand).toBe(expected2.cashOnHand);
    expect(after2.state!.history).toEqual(expected2.history);
  });

  it('applies crossed plan events to cash mid-month and logs them', () => {
    const before = useGameStore.getState();
    const plan = before.monthPlan!;
    const startCash = before.state!.cashOnHand;

    useGameStore.getState().rollDice();
    const after = useGameStore.getState();
    if (after.state!.meta.tick > 0) return; // (cannot lap on the first roll of day 0..6, but stay safe)

    const crossed = eventsCrossed(plan, 0, after.dayPosition);
    const expectedDelta = crossed.reduce((s, e) => s + signedAmount(e), 0);
    expect(after.state!.cashOnHand).toBe(startCash + expectedDelta);
    expect(after.previewAppliedTotal).toBe(expectedDelta);
    expect(after.moneyEvents.map((m) => m.id)).toEqual(crossed.map((c) => c.id));
    // Ledger entries carry running balances and the month tick.
    for (const m of after.moneyEvents) {
      expect(m.monthTick).toBe(0);
      expect(Number.isFinite(m.balanceAfter)).toBe(true);
    }
    // Human-readable lines landed in the notification log.
    for (const e of crossed) {
      expect(after.notifications.some((n) => n.includes(`Day ${e.day}`) && n.includes(e.label))).toBe(true);
    }
  });

  it('rebuilds the plan, clears previews, and sets pendingPayday after a lap', () => {
    const pristine: GameState = JSON.parse(JSON.stringify(useGameStore.getState().state));
    const expected = tick(pristine, { actions: [] }).state;

    rollUntilLap();
    const after = useGameStore.getState();

    expect(after.previewAppliedTotal).toBe(0);
    expect(after.monthPlan!.monthTick).toBe(1);
    expect(after.monthPlan).toEqual(buildMonthPlan(after.state!, planSeedFor(after.state!)));

    const payday = after.pendingPayday!;
    expect(payday).not.toBeNull();
    expect(payday.monthTick).toBe(1);
    expect(payday.salary).toBe(pristine.incomeStreams[0].monthlyGross);
    expect(payday.netDelta).toBe(expected.cashOnHand - pristine.cashOnHand);
    expect(payday.freedomAfter).toBeCloseTo(expected.statement.passiveIncome / expected.statement.totalExpenses, 10);

    useGameStore.getState().collectPayday();
    expect(useGameStore.getState().pendingPayday).toBeNull();
  });

  it('rollDice still works while pendingPayday is set (modal never blocks the game)', () => {
    rollUntilLap();
    expect(useGameStore.getState().pendingPayday).not.toBeNull();
    const dayBefore = useGameStore.getState().dayPosition;
    useGameStore.getState().rollDice();
    expect(useGameStore.getState().dayPosition).not.toBe(dayBefore);
  });

  it('step() discards previews safely and rebuilds the plan', () => {
    useGameStore.getState().rollDice(); // accrue some previews
    const g = useGameStore.getState();
    const reverted: GameState = JSON.parse(JSON.stringify(g.state));
    reverted.cashOnHand -= g.previewAppliedTotal;
    const expected = tick(reverted, { actions: [] }).state;

    useGameStore.getState().step();
    const after = useGameStore.getState();
    expect(after.state!.cashOnHand).toBe(expected.cashOnHand);
    expect(after.previewAppliedTotal).toBe(0);
    expect(after.monthPlan!.monthTick).toBe(after.state!.meta.tick);
  });

  it('fastForward() discards previews safely and rebuilds the plan', () => {
    useGameStore.getState().rollDice(); // accrue some previews
    const g = useGameStore.getState();
    const reverted: GameState = JSON.parse(JSON.stringify(g.state));
    reverted.cashOnHand -= g.previewAppliedTotal;
    let expected = reverted;
    for (let i = 0; i < 3; i++) expected = tick(expected, { actions: [] }).state;

    useGameStore.getState().fastForward(3);
    const after = useGameStore.getState();
    expect(after.state!.cashOnHand).toBe(expected.cashOnHand);
    expect(after.previewAppliedTotal).toBe(0);
    expect(after.monthPlan!.monthTick).toBe(after.state!.meta.tick);
  });
});

describe('decision impact (lastImpact)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.getState().reset();
    useGameStore.getState().initGame(SETUP);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('applyAction(sell/take_loan) records cash and passive deltas', () => {
    const g = useGameStore.getState();
    const before = g.state!;
    useGameStore.getState().applyAction({
      kind: 'take_loan',
      loan: {
        kind: 'personal', label: 'Test loan', principalOutstanding: 50_000, originalPrincipal: 50_000,
        rateAnnual: 0.14, rateType: 'fixed', emi: 2_400, remainingMonths: 24, prepaymentPenalty: 0.02,
      },
    });
    const impact = useGameStore.getState().lastImpact!;
    expect(impact).not.toBeNull();
    expect(impact.cashDelta).toBe(50_000);
    // New EMI raises expenses → freedom coverage drops (passive income is 0 here, so 0 delta is fine)
    expect(impact.coverageDelta).toBeLessThanOrEqual(0);
    expect(useGameStore.getState().state!.cashOnHand).toBe(before.cashOnHand + 50_000);
  });
});
