import { describe, it, expect } from 'vitest';
import { buildInitialState, tick } from '@/engine';
import { drawCardForTile, rollTileType } from '@/modules/cards/cards';
import { PRNG } from '@/engine/prng/prng';
import { pickLesson, buildCoachContext, WISDOM } from '@/modules/coach/wisdom';
import { computeStatement } from '@/modules/dashboard/statement';
import type { GameState } from '@/types';
import type { CoachDecisionEntry } from '@/modules/coach/actionLog';

/**
 * Reproduction harness for the "screen turns white after a couple of months" bug.
 *
 * The white screen is a React "Maximum update depth exceeded" crash with no
 * error boundary (see main.tsx). The infinite loop lives in <CoachInsight>:
 *
 *   const picked = useMemo(() => pickLesson(state, log, recent), [..., recent]);
 *   useEffect(() => { if (picked.id !== seenRef) note(picked.id); }, [picked]);
 *
 * `note` (store.noteLessonShown) pushes the id into `recentLessonIds`, capped at 6.
 * `pickLesson` *deprioritizes* recently-shown lessons. So once MORE THAN 6 lessons
 * are simultaneously applicable, every render the panel picks a different "freshest"
 * lesson, notes it, which evicts the oldest from the 6-slot window, which makes that
 * old lesson eligible again next render -> the pick never stabilizes -> setState every
 * render -> React bails out and unmounts the tree -> blank white page.
 *
 * This file (a) measures when >6 lessons become applicable during normal play, and
 * (b) replays the exact CoachInsight effect+reducer cycle and shows it never reaches
 * a fixed point.
 */

const NEW = () =>
  buildInitialState({ seed: 7, playerName: 'Repro', age: 28, profession: 'product_manager', city: 'T1', family: 'single' });

/** Faithful copy of store.noteLessonShown's reducer (store.ts). */
function noteReducer(recent: string[], id: string): string[] {
  if (recent[0] === id) return recent; // already at top -> no state change
  return [id, ...recent.filter((x) => x !== id)].slice(0, 6);
}

/**
 * Replays the <CoachInsight> render loop for a fixed state/log until it either
 * reaches a stable fixed point (no setState) or exceeds `maxRenders`.
 * Returns the number of consecutive state-changing renders. React throws
 * "Maximum update depth exceeded" at ~50 nested synchronous updates.
 */
function simulateCoachInsightLoop(state: GameState, log: CoachDecisionEntry[], maxRenders = 200): number {
  let recent: string[] = [];
  let seenRef: string | null = null;
  let stateChangingRenders = 0;
  for (let i = 0; i < maxRenders; i++) {
    const picked = pickLesson(state, log, recent)?.lesson.id ?? null;
    if (!picked || picked === seenRef) return stateChangingRenders; // effect no-ops -> stable
    seenRef = picked;
    const next = noteReducer(recent, picked);
    if (next === recent) return stateChangingRenders; // reducer no-ops -> stable
    recent = next;
    stateChangingRenders++; // this render scheduled a new render
  }
  return stateChangingRenders; // hit the cap == infinite loop
}

describe('white-screen root cause: CoachInsight infinite render loop', () => {
  it('pickLesson deprioritizes recently-shown lessons (the loop ingredient)', () => {
    // With an empty "recent" the top lesson is X; once X is "recent", a different
    // lesson must surface (otherwise the panel could never cycle).
    const s = NEW();
    s.statement = computeStatement(s);
    const log: CoachDecisionEntry[] = [];
    const first = pickLesson(s, log, [])?.lesson.id;
    expect(first).toBeTruthy();
    const second = pickLesson(s, log, [first!])?.lesson.id;
    // Only meaningful when >1 lesson applies; if so, the pick must change.
    const applicable = WISDOM.filter((l) => {
      try { return l.applies(s, buildCoachContext(s, log)); } catch { return false; }
    });
    if (applicable.length > 1) expect(second).not.toBe(first);
  });

  it('finds the in-game month where >6 lessons apply and the panel stops converging', () => {
    let state = NEW();
    state.statement = computeStatement(state);
    const log: CoachDecisionEntry[] = [];

    let firstBadMonth = -1;
    let maxApplicable = 0;

    for (let month = 0; month < 120; month++) {
      // simulate ~6 card cells per month, resolving doodads/deals like a player
      for (let c = 0; c < 6; c++) {
        const tileRng = new PRNG((state.meta.seed + state.meta.tick * 13 + c * 7) >>> 0);
        const tile = rollTileType(tileRng);
        const card = drawCardForTile(state, tileRng, tile);
        // "player" takes the first non-skip option ~half the time, else resists
        const wantsBuy = (state.meta.tick + c) % 2 === 0;
        const opt = wantsBuy
          ? card.options.find((o) => o.id !== 'skip') ?? card.options[0]
          : card.options.find((o) => o.id === 'skip') ?? card.options[0];
        const affordErr = opt.affordCheck?.(state);
        if (!affordErr) {
          try { opt.apply(state); } catch { /* ignore */ }
        }
        state.statement = computeStatement(state);
        log.push({
          tick: state.meta.tick,
          cardKind: card.kind,
          optionId: opt.id,
          borrowed: false,
          marketPhase: state.market.phase,
          category: opt.id === 'skip' ? 'resist' : 'noop',
        });
      }

      const ctx = buildCoachContext(state, log);
      const applicable = WISDOM.filter((l) => { try { return l.applies(state, ctx); } catch { return false; } });
      maxApplicable = Math.max(maxApplicable, applicable.length);

      const renders = simulateCoachInsightLoop(state, log);
      const looping = renders >= 200;
      if (looping && firstBadMonth === -1) firstBadMonth = state.meta.tick;

      state = tick(state, { actions: [] }).state;
    }

    // diagnostics
    // eslint-disable-next-line no-console
    console.log(`max applicable lessons at once: ${maxApplicable}`);
    // eslint-disable-next-line no-console
    console.log(`first month CoachInsight fails to converge (>=200 renders): ${firstBadMonth}`);

    expect(maxApplicable).toBeGreaterThan(6);          // more lessons than the 6-slot window
    expect(firstBadMonth).toBeGreaterThan(-1);         // the loop does happen during normal play
  });

  it('the loop is caused exactly by crossing the 6-lesson window (causation)', () => {
    // Walk a real game month by month, recording (applicableCount, didLoop) per month.
    let state = NEW();
    state.statement = computeStatement(state);
    const log: CoachDecisionEntry[] = [];
    const samples: { month: number; applicable: number; looped: boolean }[] = [];

    for (let month = 0; month < 120; month++) {
      for (let c = 0; c < 6; c++) {
        const tileRng = new PRNG((state.meta.seed + state.meta.tick * 13 + c * 7) >>> 0);
        const tile = rollTileType(tileRng);
        const card = drawCardForTile(state, tileRng, tile);
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
      const ctx = buildCoachContext(state, log);
      const applicable = WISDOM.filter((l) => { try { return l.applies(state, ctx); } catch { return false; } }).length;
      const looped = simulateCoachInsightLoop(state, log, 200) >= 200;
      samples.push({ month: state.meta.tick, applicable, looped });
      state = tick(state, { actions: [] }).state;
    }

    // Causation: a month loops if and only if more than 6 lessons apply.
    for (const s of samples) {
      if (s.looped) expect(s.applicable).toBeGreaterThan(6);  // looping => >6
      if (s.applicable <= 6) expect(s.looped).toBe(false);    // <=6 => converges
    }
    // Both regimes are actually observed in a single playthrough.
    expect(samples.some((s) => s.applicable <= 6 && !s.looped)).toBe(true);
    expect(samples.some((s) => s.applicable > 6 && s.looped)).toBe(true);
  });
});
