import type { Rupees, Percent } from '@/types';

/** Round to whole rupees. */
export const round = (n: number): Rupees => Math.round(n);

/** Convert annual percent rate to monthly. (1 + r)^(1/12) - 1 */
export const annualToMonthlyRate = (annual: Percent): Percent =>
  Math.pow(1 + annual, 1 / 12) - 1;

/** Format INR with Indian comma grouping. e.g. 12,34,567 */
export function formatINR(amount: Rupees, opts: { compact?: boolean } = {}): string {
  if (opts.compact) {
    const abs = Math.abs(amount);
    if (abs >= 1e7) return `₹${(amount / 1e7).toFixed(2)} Cr`;
    if (abs >= 1e5) return `₹${(amount / 1e5).toFixed(2)} L`;
    if (abs >= 1e3) return `₹${(amount / 1e3).toFixed(1)}K`;
    return `₹${amount.toFixed(0)}`;
  }
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export const formatPct = (p: Percent, digits = 2): string =>
  `${(p * 100).toFixed(digits)}%`;
