import type { GameState } from '@/types';
import { TAX } from '@/data/constants';

/**
 * Compute income tax (new regime) on given annual taxable income.
 * Returns total tax including cess.
 */
export function incomeTaxNewRegime(annualTaxableIncome: number): number {
  let tax = 0;
  let prevSlab = 0;
  for (const slab of TAX.slabsNewRegime) {
    if (annualTaxableIncome > slab.upTo) {
      tax += (slab.upTo - prevSlab) * slab.rate;
      prevSlab = slab.upTo;
    } else {
      tax += (annualTaxableIncome - prevSlab) * slab.rate;
      break;
    }
  }
  return Math.round(tax * (1 + TAX.cessRate));
}

/** Equity LTCG: 10% on gains above ₹1L/FY. */
export function ltcgEquityTax(gain: number): number {
  const taxable = Math.max(0, gain - TAX.ltcgEquityExemption);
  return Math.round(taxable * TAX.ltcgEquityRate);
}

export function stcgEquityTax(gain: number): number {
  return Math.round(Math.max(0, gain) * TAX.stcgEquityRate);
}

/**
 * Apply per-tick TDS withholding on salary.
 * Spreads expected annual tax over 12 months.
 * STUB: v0.1 — assumes salary-only income; will expand in v0.3.
 */
export function applyTDSTick(state: GameState, monthlyGrossSalary: number): number {
  const annualGross = monthlyGrossSalary * 12;
  const annualTax = incomeTaxNewRegime(annualGross);
  const monthlyTDS = Math.round(annualTax / 12);
  state.cashOnHand -= monthlyTDS;
  return monthlyTDS;
}

/**
 * Annual review tax reconciliation.
 * STUB: v0.3 — captures realized capital gains, deductions, and squares up.
 */
export function applyAnnualTaxReconciliation(_state: GameState): { refund: number; payable: number } {
  return { refund: 0, payable: 0 };
}
