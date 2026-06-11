import { describe, it, expect } from 'vitest';
import { buildInitialState } from '@/engine';
import type { GameState } from '@/types';
import type { CoachDecisionEntry } from '@/modules/coach/actionLog';
import { sellIntervention, cardOptionIntervention } from '@/modules/coach/interventions';
import { evaluateCounterfactuals, type CounterfactualRecord } from '@/modules/coach/counterfactual';

function freshState(): GameState {
  return buildInitialState({
    seed: 42, playerName: 'Test', age: 28, profession: 'product_manager', city: 'T1', family: 'single',
  });
}

function entry(over: Partial<CoachDecisionEntry>): CoachDecisionEntry {
  return {
    tick: 1, cardKind: 'doodad', optionId: 'buy', borrowed: false,
    marketPhase: 'expansion', category: 'doodad_oneshot', ...over,
  };
}

describe('repeat-mistake interventions', () => {
  it('warns on selling in a downturn only when the log shows prior panic-sells', () => {
    const state = freshState();
    state.market.phase = 'trough';
    const panicLog = [entry({ category: 'sell_asset', marketPhase: 'contraction', optionId: 'sell' })];
    expect(sellIntervention(state, panicLog)?.kind).toBe('panic_sell');
    expect(sellIntervention(state, [])).toBeNull();
    state.market.phase = 'expansion';
    expect(sellIntervention(state, panicLog)).toBeNull();
  });

  it('warns on borrowing for a doodad only after it happened before', () => {
    const state = freshState();
    const log = [entry({ category: 'doodad_oneshot', borrowed: true })];
    expect(cardOptionIntervention(state, log, { kind: 'doodad' }, 'buy', true)?.kind).toBe('borrow_doodad');
    expect(cardOptionIntervention(state, [], { kind: 'doodad' }, 'buy', true)).toBeNull();
    // cash purchase of a doodad is not intercepted
    expect(cardOptionIntervention(state, log, { kind: 'doodad' }, 'buy', false)).toBeNull();
    // resisting is never intercepted
    expect(cardOptionIntervention(state, log, { kind: 'doodad' }, 'skip', true)).toBeNull();
  });

  it('warns on repeat credit-card bailouts', () => {
    const state = freshState();
    const log = [entry({ cardKind: 'unseen_expense', optionId: 'cc', category: 'unseen_expense_cc' })];
    expect(cardOptionIntervention(state, log, { kind: 'unseen_expense' }, 'cc', false)?.kind).toBe('cc_bailout');
    expect(cardOptionIntervention(state, [], { kind: 'unseen_expense' }, 'cc', false)).toBeNull();
  });

  it('warns on repeat FOMO buys only at the peak', () => {
    const state = freshState();
    const log = [entry({ cardKind: 'deal_stock', category: 'invest_stock', marketPhase: 'peak' })];
    state.market.phase = 'peak';
    expect(cardOptionIntervention(state, log, { kind: 'deal_stock' }, 'buy', false)?.kind).toBe('fomo_buy');
    state.market.phase = 'expansion';
    expect(cardOptionIntervention(state, log, { kind: 'deal_stock' }, 'buy', false)).toBeNull();
  });
});

describe('counterfactual debrief', () => {
  it('quantifies a doodad purchase as roughly its cash cost on autopilot replay', () => {
    const before = freshState();
    const after: GameState = JSON.parse(JSON.stringify(before));
    after.cashOnHand -= 100_000;
    const rec: CounterfactualRecord = { tick: before.meta.tick, kind: 'doodad', label: 'Designer handbag', before, after };
    const results = evaluateCounterfactuals([rec], before.meta.tick + 12);
    expect(results).toHaveLength(1);
    expect(results[0].delta).toBeGreaterThan(50_000);
    expect(results[0].monthsEvaluated).toBe(12);
  });

  it('filters out gaps too small to be a lesson', () => {
    const before = freshState();
    const after: GameState = JSON.parse(JSON.stringify(before));
    after.cashOnHand -= 2_000;
    const rec: CounterfactualRecord = { tick: before.meta.tick, kind: 'doodad', label: 'Chai run', before, after };
    expect(evaluateCounterfactuals([rec], before.meta.tick + 6)).toHaveLength(0);
  });

  it('is deterministic — same records give identical deltas', () => {
    const before = freshState();
    const after: GameState = JSON.parse(JSON.stringify(before));
    after.cashOnHand -= 100_000;
    const rec: CounterfactualRecord = { tick: before.meta.tick, kind: 'doodad', label: 'TV', before, after };
    const a = evaluateCounterfactuals([rec], before.meta.tick + 24);
    const b = evaluateCounterfactuals([rec], before.meta.tick + 24);
    expect(a[0].delta).toBe(b[0].delta);
  });
});
