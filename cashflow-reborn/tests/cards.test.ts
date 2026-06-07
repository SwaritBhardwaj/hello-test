import { describe, it, expect } from 'vitest';
import { buildInitialState, PRNG } from '@/engine';
import { drawCardForTile, drawRandomCard, type Card } from '@/modules/cards/cards';

const baseState = () =>
  buildInitialState({ seed: 7, playerName: 'T', age: 30, profession: 'sde', city: 'T1', family: 'single' });

/** Draw a broad sample of cards across every tile type and many seeds. */
function sampleCards(n = 400): Card[] {
  const s = baseState();
  const cards: Card[] = [];
  const tiles = ['deal', 'temptation', 'market', 'chance', 'payday'] as const;
  for (let seed = 1; seed <= n; seed++) {
    cards.push(drawRandomCard(s, new PRNG(seed)));
    for (const tile of tiles) cards.push(drawCardForTile(s, new PRNG(seed * 31 + 7), tile));
  }
  return cards;
}

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

describe('temptation realism: level 5 means "unavoidable", not "strong want"', () => {
  const cards = sampleCards();

  it('every temptation is within 1..5', () => {
    for (const c of cards) {
      expect(c.temptation).toBeGreaterThanOrEqual(1);
      expect(c.temptation).toBeLessThanOrEqual(5);
    }
  });

  it('doodads (wants) are always resistible — capped at temptation 4 with a skip option', () => {
    const doodads = cards.filter((c) => c.kind === 'doodad');
    expect(doodads.length).toBeGreaterThan(0);
    for (const c of doodads) {
      expect(c.temptation).toBeLessThanOrEqual(4);
      expect(c.options.some((o) => o.id === 'skip')).toBe(true);
    }
  });

  it('any level-5 card is genuinely unavoidable (no skip option)', () => {
    // The card modal removes the skip button at t>=5, so a level-5 card must not
    // rely on one. This keeps "you can resist it" and "it shows a resist button"
    // in sync.
    const forced = cards.filter((c) => c.temptation >= 5);
    expect(forced.length).toBeGreaterThan(0);
    for (const c of forced) {
      expect(c.options.some((o) => o.id === 'skip')).toBe(false);
    }
  });

  it('conversely, anything with a skip option is resistible (temptation < 5)', () => {
    for (const c of cards) {
      if (c.options.some((o) => o.id === 'skip')) expect(c.temptation).toBeLessThan(5);
    }
  });

  it('the unavoidable life events (baby / accident / medical / downsizing) exist and are level 5', () => {
    const lifeTitles = ['baby', 'accident', 'medical', 'downsizing'];
    const found = cards.filter((c) => lifeTitles.some((t) => c.title.toLowerCase().includes(t)));
    expect(found.length).toBeGreaterThan(0);
    for (const c of found) expect(c.temptation).toBe(5);
  });

  it('downsizing actually cuts salary income', () => {
    const s = baseState();
    let downsizing: Card | undefined;
    for (let seed = 1; seed <= 2000 && !downsizing; seed++) {
      const c = drawCardForTile(s, new PRNG(seed), 'chance');
      if (c.title.toLowerCase().includes('downsizing')) downsizing = c;
    }
    expect(downsizing).toBeDefined();
    const before = s.incomeStreams.find((i) => i.kind === 'salary')!.monthlyGross;
    downsizing!.options[0].apply(s);
    const after = s.incomeStreams.find((i) => i.kind === 'salary')!.monthlyGross;
    expect(after).toBeLessThan(before);
  });
});
