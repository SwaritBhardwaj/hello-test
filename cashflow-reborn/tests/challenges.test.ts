import { describe, it, expect } from 'vitest';
import { buildInitialState } from '@/engine';
import {
  CHALLENGES,
  ACTIVE_CHALLENGE_COUNT,
  CHALLENGE_ROTATION_MONTHS,
  activeChallenges,
  challengeById,
} from '@/modules/progression/challenges';
import type { CoachDecisionEntry } from '@/modules/coach/actionLog';

function freshState() {
  return buildInitialState({
    seed: 42,
    playerName: 'Test',
    age: 28,
    profession: 'product_manager',
    city: 'T1',
    family: 'single',
  });
}

function resistEntry(tick: number): CoachDecisionEntry {
  return {
    tick,
    cardKind: 'doodad',
    optionId: 'skip',
    borrowed: false,
    marketPhase: 'expansion',
    category: 'resist',
  };
}

describe('run challenges', () => {
  it('exposes a pool of at least 8 challenges with unique ids', () => {
    expect(CHALLENGES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
  });

  it('selects active challenges deterministically for the same seed and month', () => {
    const a = activeChallenges(123, 5).map((c) => c.id);
    const b = activeChallenges(123, 5).map((c) => c.id);
    expect(a).toEqual(b);
    expect(a).toHaveLength(ACTIVE_CHALLENGE_COUNT);
    expect(new Set(a).size).toBe(ACTIVE_CHALLENGE_COUNT);
  });

  it('keeps the same set within a rotation window and rotates at the epoch boundary', () => {
    const seed = 99;
    const inWindow = activeChallenges(seed, 0).map((c) => c.id);
    expect(activeChallenges(seed, CHALLENGE_ROTATION_MONTHS - 1).map((c) => c.id)).toEqual(inWindow);
    const nextEpoch = activeChallenges(seed, CHALLENGE_ROTATION_MONTHS).map((c) => c.id);
    expect(nextEpoch).not.toEqual(inWindow);
  });

  it('eventually cycles through every challenge in the pool', () => {
    const seen = new Set<string>();
    for (let epoch = 0; epoch < CHALLENGES.length; epoch++) {
      for (const c of activeChallenges(7, epoch * CHALLENGE_ROTATION_MONTHS)) seen.add(c.id);
    }
    expect(seen.size).toBe(CHALLENGES.length);
  });

  it('iron_wallet counts resisted temptations from the decision log, clamped to target', () => {
    const c = challengeById('iron_wallet')!;
    const state = freshState();
    expect(c.progress(state, [])).toBe(0);
    expect(c.progress(state, [resistEntry(1), resistEntry(2)])).toBe(2);
    const many = Array.from({ length: 10 }, (_, i) => resistEntry(i));
    expect(c.progress(state, many)).toBe(c.target);
  });

  it('state-based progress functions start at 0 on a fresh state and never exceed target', () => {
    const state = freshState();
    for (const c of CHALLENGES) {
      const p = c.progress(state, []);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(c.target);
    }
  });
});
