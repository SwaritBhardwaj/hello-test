import type { GameState, Loan, LoanKind } from '@/types';
import { LOAN_RATES, DTI_CAP } from '@/data/constants';

/** Standard EMI formula. P*r*(1+r)^n / ((1+r)^n - 1) where r is monthly rate. */
export function computeEMI(principal: number, annualRate: number, months: number): number {
  if (annualRate === 0) return Math.round(principal / months);
  const r = annualRate / 12;
  const num = principal * r * Math.pow(1 + r, months);
  const den = Math.pow(1 + r, months) - 1;
  return Math.round(num / den);
}

/** Build a loan structure given basic params. */
export function buildLoan(opts: {
  kind: LoanKind;
  label: string;
  principal: number;
  tenureMonths: number;
  rate?: number;
  linkedAssetId?: string;
}): Omit<Loan, 'id' | 'startedAt'> {
  const rate = opts.rate ?? LOAN_RATES[opts.kind].rate;
  const emi = computeEMI(opts.principal, rate, opts.tenureMonths);
  return {
    kind: opts.kind,
    label: opts.label,
    principalOutstanding: opts.principal,
    originalPrincipal: opts.principal,
    rateAnnual: rate,
    rateType: 'fixed',
    emi,
    remainingMonths: opts.tenureMonths,
    prepaymentPenalty: opts.kind === 'home' ? 0.02 : 0.04,
    linkedAssetId: opts.linkedAssetId,
  };
}

/**
 * Per-tick amortization: split EMI into interest + principal, reduce balance.
 * Returns total EMI paid this tick (for cashflow accounting).
 */
export function applyLoanAmortizationTick(state: GameState): { totalEMI: number; totalInterest: number; totalPrincipal: number } {
  let totalEMI = 0;
  let totalInterest = 0;
  let totalPrincipal = 0;

  for (const loan of state.liabilities) {
    if (loan.remainingMonths <= 0 || loan.principalOutstanding <= 0) continue;
    const monthlyRate = loan.rateAnnual / 12;
    const interest = Math.round(loan.principalOutstanding * monthlyRate);
    let principal = loan.emi - interest;
    if (principal > loan.principalOutstanding) principal = loan.principalOutstanding;

    const actualEMI = principal + interest;
    loan.principalOutstanding = Math.max(0, loan.principalOutstanding - principal);
    loan.remainingMonths -= 1;

    totalEMI += actualEMI;
    totalInterest += interest;
    totalPrincipal += principal;
  }

  state.cashOnHand -= totalEMI;
  // Cleanup paid-off loans
  state.liabilities = state.liabilities.filter((l) => l.principalOutstanding > 0);
  return { totalEMI, totalInterest, totalPrincipal };
}

/** Check if a new loan would push the player past the DTI cap. */
export function canAffordNewEMI(state: GameState, newEMI: number, grossMonthlyIncome: number): boolean {
  const currentEMIs = state.liabilities.reduce((s, l) => s + l.emi, 0);
  return (currentEMIs + newEMI) / grossMonthlyIncome <= DTI_CAP;
}

/** Prepay principal on a loan; charges prepayment penalty on the prepaid amount. */
export function prepayLoan(state: GameState, loanId: string, amount: number): string | null {
  const loan = state.liabilities.find((l) => l.id === loanId);
  if (!loan) return 'Loan not found';
  if (amount <= 0) return 'Invalid amount';
  if (state.cashOnHand < amount) return 'Insufficient cash';
  const penalty = Math.round(amount * loan.prepaymentPenalty);
  state.cashOnHand -= amount + penalty;
  loan.principalOutstanding = Math.max(0, loan.principalOutstanding - amount);
  // Recompute EMI to keep tenure constant (or could shorten tenure — make optional later)
  if (loan.principalOutstanding > 0 && loan.remainingMonths > 0) {
    loan.emi = computeEMI(loan.principalOutstanding, loan.rateAnnual, loan.remainingMonths);
  }
  return null;
}

/** Sum of all current EMIs (for DTI display). */
export function totalEMIs(state: GameState): number {
  return state.liabilities.reduce((s, l) => s + l.emi, 0);
}
