import type { GameState, Asset, AssetClass } from '@/types';
import type { PRNG } from '@/engine/prng/prng';
import { ASSET_RETURN_PROFILE, MARKET_CYCLE } from '@/data/constants';

/** Map asset class to its broad "type" for cycle multiplier lookup. */
function assetType(cls: AssetClass): 'equity' | 're' | 'gold' | 'fixed' {
  switch (cls) {
    case 'index_fund':
    case 'active_mf':
    case 'stocks':
    case 'business_equity':
      return 'equity';
    case 'real_estate_residential':
    case 'real_estate_commercial':
    case 'reit':
      return 're';
    case 'gold':
      return 'gold';
    case 'savings':
    case 'fd':
    case 'ppf':
    case 'nps':
    case 'crypto': // crypto handled separately below
      return 'fixed';
  }
}

/**
 * Per-tick asset valuation update.
 * - For each asset class, draw a monthly return from N(mean/12, std/sqrt(12))
 *   scaled by current market phase multiplier.
 * - Update unitPrice for each holding.
 * - Update market.indices for the asset class.
 */
export function applyAssetPricingTick(state: GameState, rng: PRNG): void {
  const phase = state.market.phase;
  const phaseMult = MARKET_CYCLE.phaseMultipliers[phase];

  // First update class-level indices
  for (const cls of Object.keys(ASSET_RETURN_PROFILE) as AssetClass[]) {
    const profile = ASSET_RETURN_PROFILE[cls];
    if (profile.std === 0) {
      // fixed-return classes — apply only the mean (monthly) compounding
      const mr = Math.pow(1 + profile.mean, 1 / 12) - 1;
      state.market.indices[cls] *= 1 + mr;
      continue;
    }
    const monthlyMean = profile.mean / 12;
    const monthlyStd = profile.std / Math.sqrt(12);
    const phaseAdj = cls === 'crypto' ? 1.0 : phaseMult[assetType(cls)];
    const ret = rng.gaussian(monthlyMean * phaseAdj, monthlyStd);
    state.market.indices[cls] *= 1 + ret;
  }

  // Now mark holdings to market by re-pricing per index
  for (const asset of state.assets) {
    const idx = state.market.indices[asset.kind];
    // Re-base: an asset bought at idx0 with cost C trades at C * idx/idx0
    // For simplicity at v0.1 we just apply the per-tick delta:
    const profile = ASSET_RETURN_PROFILE[asset.kind];
    if (profile.std === 0) {
      const mr = Math.pow(1 + profile.mean, 1 / 12) - 1;
      asset.currentPrice = Math.round(asset.currentPrice * (1 + mr));
    } else {
      asset.currentPrice = Math.round(asset.currentPrice * (1 + (idx / state.market.indices[asset.kind] - 1)));
      // ^ This is a no-op as written; v0.2 will properly track unit indices.
      // STUB: replace with per-asset baseline tracking.
    }
  }
}

/**
 * Per-tick yield income — dividends, interest, rent.
 * Adds to cashOnHand, applies TDS where relevant.
 */
export function applyYieldTick(state: GameState): number {
  let totalYield = 0;
  for (const asset of state.assets) {
    if (asset.yieldRateAnnual <= 0) continue;
    const monthlyYield = asset.currentPrice * asset.units * (asset.yieldRateAnnual / 12);
    totalYield += monthlyYield;
  }
  totalYield = Math.round(totalYield);
  state.cashOnHand += totalYield;
  return totalYield;
}

/** Compute total asset market value. */
export function totalAssetValue(assets: Asset[]): number {
  return assets.reduce((sum, a) => sum + a.currentPrice * a.units, 0);
}

/**
 * Buy an asset — deduct cash, add to holdings.
 * Returns null on success, error string on failure.
 */
export function buyAsset(state: GameState, asset: Omit<Asset, 'id' | 'acquiredAt'>): string | null {
  const cost = asset.currentPrice * asset.units;
  // TODO: brokerage, GST, stamp duty by class
  if (state.cashOnHand < cost) return 'Insufficient cash';
  state.cashOnHand -= cost;
  state.assets.push({
    ...asset,
    id: `asset_${state.assets.length + 1}_${state.meta.tick}`,
    acquiredAt: state.meta.tick,
  });
  return null;
}

/**
 * Sell N units of an asset.
 * Computes capital gain, defers tax to annual review (v0.2).
 */
export function sellAsset(state: GameState, assetId: string, units: number): string | null {
  const asset = state.assets.find((a) => a.id === assetId);
  if (!asset) return 'Asset not found';
  if (units > asset.units) return 'Not enough units';
  const proceeds = asset.currentPrice * units;
  // TODO: capital gains tax handling at sale or year-end
  state.cashOnHand += Math.round(proceeds);
  asset.units -= units;
  if (asset.units === 0) {
    state.assets = state.assets.filter((a) => a.id !== assetId);
  }
  return null;
}
