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

  it('the unavoidable life events (medical / accident / new baby / pay cut) exist and are level 5', () => {
    const lifeSubtitles = ['medical emergency', 'accident', 'new baby', 'forced pay cut'];
    const found = cards.filter((c) => lifeSubtitles.includes((c.subtitle ?? '').toLowerCase()));
    expect(found.length).toBeGreaterThan(0);
    for (const c of found) expect(c.temptation).toBe(5);
  });

  it('life-event scenarios are concrete stories with a justified cost in the description', () => {
    const stories = cards.filter((c) => ['medical emergency', 'accident', 'new baby'].includes((c.subtitle ?? '').toLowerCase()));
    expect(stories.length).toBeGreaterThan(0);
    for (const c of stories) {
      // a real narrative, not "An unexpected ₹X expense"
      expect(c.description.length).toBeGreaterThan(40);
      // the rupee cost shown on the card matches the cost referenced in the story
      const shown = c.rows?.find((r) => r.label === 'Cost')?.value ?? '';
      expect(c.description).toContain(shown);
    }
  });

  it('downsizing actually cuts salary income', () => {
    const s = baseState();
    let downsizing: Card | undefined;
    for (let seed = 1; seed <= 4000 && !downsizing; seed++) {
      const c = drawCardForTile(s, new PRNG(seed), 'chance');
      if ((c.subtitle ?? '').toLowerCase() === 'forced pay cut') downsizing = c;
    }
    expect(downsizing).toBeDefined();
    const before = s.incomeStreams.find((i) => i.kind === 'salary')!.monthlyGross;
    downsizing!.options[0].apply(s);
    const after = s.incomeStreams.find((i) => i.kind === 'salary')!.monthlyGross;
    expect(after).toBeLessThan(before);
  });
});

describe('every card reads like a real-life scene, not a spec line', () => {
  const cards = sampleCards();

  it('all cards carry a narrative description and a flavor reason', () => {
    for (const c of cards) {
      expect(c.description.trim().length).toBeGreaterThanOrEqual(25);
      expect(c.temptationReason.trim().length).toBeGreaterThanOrEqual(12);
    }
  });

  it('deal / side-hustle / borrow cards are no longer the old generic blurbs', () => {
    const stale = [
      'A flat is on the market',
      'Equity in',
      'Diversified equity exposure. Lower variance than individual stocks.',
      'Government-backed gold bond. 2.5% nominal interest + price appreciation.',
      'Side business opportunity. Illiquid; treat as long-term commitment.',
      'Borrowed money is real money — and so is the EMI.',
    ];
    const narrativeKinds = new Set(['deal_real_estate', 'deal_stock', 'deal_index_fund', 'deal_gold', 'deal_business', 'side_hustle', 'borrow_offer']);
    for (const c of cards.filter((x) => narrativeKinds.has(x.kind))) {
      for (const phrase of stale) expect(c.description).not.toBe(phrase);
    }
  });
});
