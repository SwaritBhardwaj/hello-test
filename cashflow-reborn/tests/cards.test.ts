import { describe, it, expect } from 'vitest';
import { buildInitialState, PRNG } from '@/engine';
import { drawCardForTile } from '@/modules/cards/cards';

const baseState = () =>
  buildInitialState({ seed: 7, playerName: 'T', age: 30, profession: 'sde', city: 'T1', family: 'single' });

describe('tile → card coupling', () => {
  it('a Temptation tile always draws a doodad', () => {
    const s = baseState();
    for (let seed = 0; seed < 25; seed++) {
      const card = drawCardForTile(s, new PRNG(seed + 1), 'temptation');
      expect(card.kind).toBe('doodad');
    }
  });

  it('a Deal tile always draws an investment card', () => {
    const s = baseState();
    const dealKinds = ['deal_real_estate', 'deal_stock', 'deal_index_fund', 'deal_gold', 'deal_business'];
    for (let seed = 0; seed < 25; seed++) {
      const card = drawCardForTile(s, new PRNG(seed + 1), 'deal');
      expect(dealKinds).toContain(card.kind);
    }
  });

  it('a Payday tile always draws a payday bonus', () => {
    const s = baseState();
    const card = drawCardForTile(s, new PRNG(3), 'payday');
    expect(card.kind).toBe('payday_bonus');
  });

  it('a Market tile always draws a market event', () => {
    const s = baseState();
    const card = drawCardForTile(s, new PRNG(9), 'market');
    expect(card.kind).toBe('market_event');
  });
});
