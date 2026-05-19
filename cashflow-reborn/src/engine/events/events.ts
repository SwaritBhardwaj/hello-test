import type { GameState, GameEvent } from '@/types';
import type { PRNG } from '@/engine/prng/prng';
import { EVENT_PROBABILITIES } from '@/data/constants';

/**
 * Roll all monthly random events.
 * Returns the list of events triggered this tick.
 *
 * STUB: v0.4 — implement consequence application for each event type.
 *  - Medical emergency: claim insurance, force cash payment, or push debt
 *  - Job loss: zero salary income for N months
 *  - Promotion offer: decision event with city/salary tradeoff
 *  - Family obligation: cash outflow
 *  - Startup angel: decision event for illiquid investment
 */
export function rollRandomEvents(state: GameState, rng: PRNG): GameEvent[] {
  const tick = state.meta.tick;
  const out: GameEvent[] = [];

  if (rng.chance(EVENT_PROBABILITIES.medicalEmergencyMinor)) {
    out.push({
      id: `evt_med_minor_${tick}`,
      kind: 'random',
      triggeredAt: tick,
      title: 'Medical emergency (minor)',
      description: 'A family member needs urgent care.',
      payload: { severity: 'minor', cost: 30_000 + Math.floor(rng.next() * 50_000) },
    });
  }
  if (rng.chance(EVENT_PROBABILITIES.medicalEmergencyMajor)) {
    out.push({
      id: `evt_med_major_${tick}`,
      kind: 'random',
      triggeredAt: tick,
      title: 'Medical emergency (major)',
      description: 'A major medical procedure is required.',
      payload: { severity: 'major', cost: 200_000 + Math.floor(rng.next() * 600_000) },
    });
  }
  if (rng.chance(EVENT_PROBABILITIES.jobLoss)) {
    out.push({
      id: `evt_layoff_${tick}`,
      kind: 'random',
      triggeredAt: tick,
      title: 'Job loss',
      description: 'You have been laid off. Salary stops next month.',
      payload: { monthsToRecover: 3 + Math.floor(rng.next() * 6) },
    });
  }
  if (rng.chance(EVENT_PROBABILITIES.promotionOffer)) {
    out.push({
      id: `evt_promo_${tick}`,
      kind: 'decision',
      triggeredAt: tick,
      title: 'Promotion offer',
      description: 'A larger role is on the table — possibly in a more expensive city.',
      payload: { salaryBumpPct: 0.20 + rng.next() * 0.20, requiresRelocation: rng.chance(0.5) },
    });
  }
  if (rng.chance(EVENT_PROBABILITIES.startupAngelOffer)) {
    out.push({
      id: `evt_angel_${tick}`,
      kind: 'decision',
      triggeredAt: tick,
      title: 'Startup angel round',
      description: 'A friend\'s startup is raising. ₹5L for 0.5% — risky and illiquid.',
      payload: { check: 500_000, equity: 0.005 },
    });
  }
  return out;
}
