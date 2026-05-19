import type { GameState, InsurancePolicy } from '@/types';

/**
 * Per-tick: debit premiums for all active policies.
 * Returns total premiums paid.
 */
export function applyInsuranceTick(state: GameState): number {
  let total = 0;
  for (const p of state.insurance) {
    total += p.monthlyPremium;
  }
  total = Math.round(total);
  state.cashOnHand -= total;
  return total;
}

/**
 * Process an insurance claim of `claimAmount` against the first eligible policy.
 * Returns the amount paid out by insurance.
 * STUB: v0.4 — claim eligibility, deductible, partial coverage.
 */
export function processClaim(
  state: GameState,
  kind: InsurancePolicy['kind'],
  claimAmount: number
): number {
  const policy = state.insurance.find((p) => p.kind === kind);
  if (!policy) return 0;
  const eligible = Math.max(0, claimAmount - policy.deductible);
  const paid = Math.min(eligible * policy.coverageRatio, policy.sumAssured);
  state.cashOnHand += Math.round(paid);
  return Math.round(paid);
}
