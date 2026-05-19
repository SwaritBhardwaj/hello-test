import type { GameState, MarketPhase } from '@/types';
import type { PRNG } from '@/engine/prng/prng';
import { MARKET_CYCLE } from '@/data/constants';

const NEXT_PHASE: Record<MarketPhase, MarketPhase> = {
  expansion:   'peak',
  peak:        'contraction',
  contraction: 'trough',
  trough:      'recovery',
  recovery:    'expansion',
};

/** Decide if the current market phase should transition this tick. */
export function applyMarketCycleTick(state: GameState, rng: PRNG): boolean {
  const phase = state.market.phase;
  const inPhaseFor = state.meta.tick - state.market.phaseStartedAt;
  const [minD, maxD] = MARKET_CYCLE.phaseDurationRange[phase];

  // Hard transition at max duration
  if (inPhaseFor >= maxD) {
    transitionTo(state, NEXT_PHASE[phase]);
    return true;
  }
  // After min duration, probabilistic transition
  if (inPhaseFor >= minD) {
    const remaining = maxD - inPhaseFor;
    const p = 1 / Math.max(remaining, 1);
    if (rng.chance(p)) {
      transitionTo(state, NEXT_PHASE[phase]);
      return true;
    }
  }
  return false;
}

function transitionTo(state: GameState, next: MarketPhase): void {
  state.market.phase = next;
  state.market.phaseStartedAt = state.meta.tick;
  // Adjust macro indicators by phase
  switch (next) {
    case 'expansion':
      state.market.inflationAnnual = 0.055;
      state.market.repoRate = 0.065;
      state.market.gdpGrowthAnnual = 0.07;
      break;
    case 'peak':
      state.market.inflationAnnual = 0.075;
      state.market.repoRate = 0.075;
      state.market.gdpGrowthAnnual = 0.05;
      break;
    case 'contraction':
      state.market.inflationAnnual = 0.06;
      state.market.repoRate = 0.07;
      state.market.gdpGrowthAnnual = -0.02;
      break;
    case 'trough':
      state.market.inflationAnnual = 0.03;
      state.market.repoRate = 0.05;
      state.market.gdpGrowthAnnual = 0.01;
      break;
    case 'recovery':
      state.market.inflationAnnual = 0.04;
      state.market.repoRate = 0.055;
      state.market.gdpGrowthAnnual = 0.06;
      break;
  }
}
