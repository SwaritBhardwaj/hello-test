import type { GameState, BehavioralPattern } from '@/types';

/**
 * Inspect decision log + history and surface patterns.
 * Called from the annual review tick.
 *
 * STUB:
 *  - fomo_buyer: bought equity after >15% recent runup
 *  - panic_seller: sold equity within 90 days of crash > 10%
 *  - anchorer: held losing position past 3 years vs. better alt
 *  - lifestyle_creeper: lifestyle spend > 25% of income consistently
 *  - over_saver: cash > 12 months expenses for > 24 months
 *  - over_leverager: total EMI > 50% of income for > 12 months
 */
export function detectPatterns(state: GameState): BehavioralPattern[] {
  const found: BehavioralPattern[] = [];
  // TODO implement
  return Array.from(new Set([...state.detectedPatterns, ...found]));
}
