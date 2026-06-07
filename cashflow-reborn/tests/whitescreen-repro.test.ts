import { describe, it, expect } from 'vitest';
import { buildInitialState, tick } from '@/engine';
import { drawCardForTile, rollTileType } from '@/modules/cards/cards';
import { PRNG } from '@/engine/prng/prng';
import { pickLesson, buildCoachContext, WISDOM } from '@/modules/coach/wisdom';
import { computeStatement } from '@/modules/dashboard/statement';
import type { GameState } from '@/types';
import type { CoachDecisionEntry } from '@/modules/coach/actionLog';

/**
 * Regression guard for the "screen turns white after a couple of months" bug.
 *
 * HISTORY (the bug): the white screen was a React "Maximum update depth exceeded"
 * crash with no error boundary. The loop lived in <CoachInsight>:
 *
 *   const picked = useMemo(() => pickLesson(state, log, recent), [..., recent]);
 *   useEffect(() => { if (picked.id !== seenRef) note(picked.id); }, [picked]);
 *
 * `note` pushed the id into `recentLessonIds` (capped at 6) and `pickLesson`
 * *deprioritized* recently-shown lessons — so once MORE THAN 6 lessons applied
 * at once, the pick never stabilized: every render noted a different lesson,
 * which evicted the oldest from the 6-slot window, which made it eligible again
 * next render. setState-every-render -> unmount -> blank white page.
 *
 * THE FIX: pickLesson is now a pure function of (state, log) with no "recently
 * shown" feedback, and <CoachInsight> no longer writes back into its own input.
 * These tests verify (a) the trigger condition still occurs (>6 lessons apply),
 * and (b) the pick is now stable, so the loop is structurally impossible.
 */

const NEW = () =>
  buildInitialState({ seed: 7, playerName: 'Repro', age: 28, profession: 'product_manager', city: 'T1', family: 'single' });

function applicableCount(state: GameState, log: CoachDecisionEntry[]): number {
  const ctx = buildCoachContext(state, log);
  return WISDOM.filter((l) => { try { return l.applies(state, ctx); } catch { return false; } }).length;
}

/** Play a deterministic game, taking/resisting cards like a real player. */
function playOneMonth(state: GameState, log: CoachDecisionEntry[]): void {
  for (let c = 0; c < 6; c++) {
    const rng = new PRNG((state.meta.seed + state.meta.tick * 13 + c * 7) >>> 0);
    const tile = rollTileType(rng);
    const card = drawCardForTile(state, rng, tile);
    const wantsBuy = (state.meta.tick + c) % 2 === 0;
    const opt = wantsBuy
      ? card.options.find((o) => o.id !== 'skip') ?? card.options[0]
      : card.options.find((o) => o.id === 'skip') ?? card.options[0];
    if (!opt.affordCheck?.(state)) { try { opt.apply(state); } catch { /* ignore */ } }
    state.statement = computeStatement(state);
    log.push({
      tick: state.meta.tick, cardKind: card.kind, optionId: opt.id,
      borrowed: false, marketPhase: state.market.phase,
      category: opt.id === 'skip' ? 'resist' : 'noop',
    });
  }
}

describe('white-screen regression: CoachInsight can no longer infinite-loop', () => {
  it('pickLesson is a pure, stable function of (state, log) — repeated calls never differ', () => {
    let state = NEW();
    state.statement = computeStatement(state);
    const log: CoachDecisionEntry[] = [];
    let sawOverflowMonth = false; // a month where the OLD code would have looped

    for (let month = 0; month < 120; month++) {
      playOneMonth(state, log);

      if (applicableCount(state, log) > 6) sawOverflowMonth = true;

      // The render loop was: pick -> note -> repick. Re-invoking pickLesson 50
      // times (simulating 50 nested re-renders) must converge to one lesson.
      const first = pickLesson(state, log)?.lesson.id ?? null;
      for (let r = 0; r < 50; r++) {
        expect(pickLesson(state, log)?.lesson.id ?? null).toBe(first);
      }

      state = tick(state, { actions: [] }).state;
    }

    // The dangerous condition (>6 applicable) really does occur in normal play —
    // proving this fix is load-bearing, not vacuous.
    expect(sawOverflowMonth).toBe(true);
  });

  it('pickLesson takes only (state, log) — no recency feedback channel exists', () => {
    // The loop required a "recently shown" argument to feed the panel's output
    // back in as input. Guard that the signature no longer has one.
    expect(pickLesson.length).toBe(2);
  });

  it('still surfaces a relevant lesson when many apply (feature intact)', () => {
    let state = NEW();
    state.statement = computeStatement(state);
    const log: CoachDecisionEntry[] = [];
    for (let m = 0; m < 40; m++) { playOneMonth(state, log); state = tick(state, { actions: [] }).state; }
    state.statement = computeStatement(state);
    expect(applicableCount(state, log)).toBeGreaterThan(6);
    expect(pickLesson(state, log)?.lesson).toBeTruthy();
  });
});
