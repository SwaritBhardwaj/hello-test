import type { GameState, TickInput, TickResult, DecisionAction } from '@/types';
import { PRNG } from '@/engine/prng/prng';
import { applyCareerTick } from '@/modules/player/career';
import { applyInflationTick, realizedExpensesThisTick, applyLifestyleCreep } from '@/modules/expenses/expenses';
import { applyAssetPricingTick, applyYieldTick, buyAsset, sellAsset } from '@/modules/assets/assets';
import { applyLoanAmortizationTick, prepayLoan } from '@/modules/loans/loans';
import { applyTDSTick } from '@/modules/tax/tax';
import { applyMarketCycleTick } from '@/modules/market/market';
import { applyInsuranceTick } from '@/modules/insurance/insurance';
import { rollRandomEvents } from '@/engine/events/events';
import { detectPatterns } from '@/modules/behavioral/patterns';
import { checkGoals } from '@/modules/goals/goals';
import { computeStatement } from '@/modules/dashboard/statement';

/**
 * The heart of the simulation.
 * Pure-ish: mutates a working copy of state, returns the new state.
 *
 * Order of operations:
 *  1. Pre-tick: apply player decisions (buy/sell/loan/insurance)
 *  2. Market cycle phase update
 *  3. Asset prices update
 *  4. Income credit (salary + yield)
 *  5. TDS withholding
 *  6. Loan EMIs
 *  7. Insurance premiums
 *  8. Expense inflation step + realized expenses debit
 *  9. Lifestyle creep check
 * 10. Random/decision events
 * 11. Behavioral pattern detection (monthly cheap pass)
 * 12. Goal checks
 * 13. Statement & history snapshot
 */
export function tick(prevState: GameState, input: TickInput): TickResult {
  // Deep clone so engine remains pure-ish. For perf, replace with structured clone or immer later.
  const state: GameState = JSON.parse(JSON.stringify(prevState));
  const rng = new PRNG(state.meta.seed + state.meta.tick * 7919);
  const notifications: string[] = [];

  // 1. Apply decisions
  for (const action of input.actions) {
    const note = applyDecision(state, action);
    if (note) notifications.push(note);
  }

  // 2. Market cycle
  const phaseChanged = applyMarketCycleTick(state, rng);
  if (phaseChanged) notifications.push(`Market entered ${state.market.phase} phase`);

  // 3. Asset prices
  applyAssetPricingTick(state, rng);

  // 4. Income
  const salaryThisTick = state.incomeStreams
    .filter((i) => i.kind === 'salary')
    .reduce((s, i) => s + i.monthlyGross, 0);
  state.cashOnHand += salaryThisTick;
  const yieldEarned = applyYieldTick(state);
  if (yieldEarned > 0) notifications.push(`Passive income: ₹${yieldEarned.toLocaleString('en-IN')}`);

  // 5. TDS
  applyTDSTick(state, salaryThisTick);

  // 6. Loans
  applyLoanAmortizationTick(state);

  // 7. Insurance premiums
  applyInsuranceTick(state);

  // 8. Expense inflation + realized debit
  applyInflationTick(state);
  const realizedExp = realizedExpensesThisTick(state, rng);
  state.cashOnHand -= realizedExp;

  // 9. Lifestyle creep
  const crept = applyLifestyleCreep(state, salaryThisTick);
  if (crept) notifications.push('Lifestyle expenses crept up with rising income.');

  // 10. Career tick (handles age, salary drift, promotions in v0.2)
  applyCareerTick(state, rng);

  // 11. Events
  const newEvents = rollRandomEvents(state, rng);
  state.pendingEvents.push(...newEvents);

  // 12. Behavior + goals
  state.detectedPatterns = detectPatterns(state);
  const achieved = checkGoals(state);
  for (const g of achieved) {
    notifications.push(`🏆 Goal achieved: ${g.label}`);
  }

  // 13. Statement + history
  state.statement = computeStatement(state);
  state.history.push({
    tick: state.meta.tick,
    netWorth: state.statement.netWorth,
    income: salaryThisTick + yieldEarned,
    expenses: realizedExp,
    cashOnHand: state.cashOnHand,
    marketPhase: state.market.phase,
  });

  // Advance tick last
  state.meta.tick += 1;

  return { state, newEvents, notifications };
}

function applyDecision(state: GameState, action: DecisionAction): string | null {
  switch (action.kind) {
    case 'noop': return null;
    case 'buy_asset': {
      const err = buyAsset(state, action.assetTemplate);
      return err ?? `Bought ${action.assetTemplate.label}`;
    }
    case 'sell_asset': {
      const err = sellAsset(state, action.assetId, action.units);
      return err ?? 'Sold asset';
    }
    case 'prepay_loan': {
      const err = prepayLoan(state, action.loanId, action.amount);
      return err ?? 'Loan prepaid';
    }
    case 'answer_event': {
      // STUB: record in decisionLog and apply consequence
      state.decisionLog.push({
        tick: state.meta.tick,
        eventId: action.eventId,
        prompt: '(stub)',
        options: [],
        chosen: action.optionIndex,
        msToDecide: action.msToDecide,
        marketPhaseAtTime: state.market.phase,
      });
      state.pendingEvents = state.pendingEvents.filter((e) => e.id !== action.eventId);
      return null;
    }
    default:
      return null;
  }
}

/**
 * Convenience: run N ticks with no player input.
 * Useful for fast-forwarding or testing.
 */
export function runTicks(state: GameState, count: number): GameState {
  let cur = state;
  for (let i = 0; i < count; i++) {
    cur = tick(cur, { actions: [] }).state;
  }
  return cur;
}
