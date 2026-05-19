import { describe, it, expect } from 'vitest';
import { buildInitialState, tick, runTicks } from '@/engine';

describe('tick engine smoke test', () => {
  it('builds an initial state', () => {
    const state = buildInitialState({
      seed: 42,
      playerName: 'Test',
      age: 28,
      profession: 'product_manager',
      city: 'T1',
      family: 'single',
    });
    expect(state.meta.tick).toBe(0);
    expect(state.player.name).toBe('Test');
    expect(state.incomeStreams[0].monthlyGross).toBeGreaterThan(0);
    expect(state.expenses.length).toBeGreaterThan(0);
  });

  it('advances a single tick and produces a history point', () => {
    const s0 = buildInitialState({ seed: 1, playerName: 'P', age: 25, profession: 'sde', city: 'T1', family: 'single' });
    const r = tick(s0, { actions: [] });
    expect(r.state.meta.tick).toBe(1);
    expect(r.state.history.length).toBe(1);
    expect(r.state.statement.netWorth).toBeDefined();
  });

  it('is deterministic given the same seed', () => {
    const a = runTicks(buildInitialState({ seed: 123, playerName: 'A', age: 30, profession: 'sde', city: 'T1', family: 'single' }), 60);
    const b = runTicks(buildInitialState({ seed: 123, playerName: 'A', age: 30, profession: 'sde', city: 'T1', family: 'single' }), 60);
    expect(a.statement.netWorth).toBe(b.statement.netWorth);
    expect(a.cashOnHand).toBe(b.cashOnHand);
  });

  it('runs 360 ticks (30 years) without crashing', () => {
    const s = buildInitialState({ seed: 99, playerName: 'P', age: 28, profession: 'product_manager', city: 'T1', family: 'single' });
    const final = runTicks(s, 360);
    expect(final.meta.tick).toBe(360);
    expect(final.history.length).toBe(360);
    // 30 years of inflation should leave housing expense materially higher
    const housing = final.expenses.find((e) => e.category === 'housing')!;
    const housingStart = s.expenses.find((e) => e.category === 'housing')!;
    expect(housing.monthlyAmount).toBeGreaterThan(housingStart.monthlyAmount * 2);
  });
});
