/**
 * Counterfactual debrief.
 *
 * Because every random call routes through the seeded PRNG, the engine is
 * deterministic: replaying the same pre-decision state always walks the same
 * market path. So we can answer "what if you hadn't?" exactly — replay the
 * state WITH and WITHOUT the decision to the same horizon and diff net worth.
 *
 * The store records (before, after) state pairs for decisions worth a debrief
 * (panic-sells in downturns, doodad buys, borrow-funded doodads). At run end
 * the outcome screen replays each pair on autopilot (no further decisions)
 * and surfaces the largest gaps.
 *
 * Gated by COACH_FLAGS.counterfactuals at the call sites.
 */
import type { GameState } from '@/types';
import { runTicks } from '@/engine';

export type CounterfactualKind = 'panic_sell' | 'doodad' | 'doodad_loan';

export interface CounterfactualRecord {
  tick: number;
  kind: CounterfactualKind;
  /** Human description of what was bought/sold (English). */
  label: string;
  /** State as it was had the player done nothing. */
  before: GameState;
  /** State right after the player's actual choice. */
  after: GameState;
}

export interface CounterfactualResult {
  tick: number;
  kind: CounterfactualKind;
  label: string;
  /** alternative net worth − actual net worth at the horizon.
   *  Positive ⇒ the decision cost money; negative ⇒ it paid off. */
  delta: number;
  monthsEvaluated: number;
}

/** Keep only this many records (most recent) — each holds two state clones. */
export const MAX_COUNTERFACTUAL_RECORDS = 8;

/** Ignore gaps smaller than this — noise, not a lesson. */
const MIN_DELTA = 10_000;

/** Cap the autopilot replay horizon so long runs stay fast. */
const HORIZON_CAP_MONTHS = 60;

export function evaluateCounterfactuals(
  records: CounterfactualRecord[],
  endTick: number,
  top = 3,
): CounterfactualResult[] {
  const results: CounterfactualResult[] = [];
  for (const r of records) {
    const months = Math.max(0, Math.min(endTick - r.tick, HORIZON_CAP_MONTHS));
    const alt = months > 0 ? runTicks(r.before, months) : r.before;
    const act = months > 0 ? runTicks(r.after, months) : r.after;
    const delta = alt.statement.netWorth - act.statement.netWorth;
    if (Math.abs(delta) < MIN_DELTA) continue;
    results.push({ tick: r.tick, kind: r.kind, label: r.label, delta, monthsEvaluated: months });
  }
  return results.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, top);
}
