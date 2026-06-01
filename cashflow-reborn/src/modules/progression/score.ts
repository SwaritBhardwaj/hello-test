import type { GameState } from '@/types';
import type { CoachDecisionEntry } from '@/modules/coach/actionLog';

export type Grade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface RunScore {
  grade: Grade;
  /** 0..100 decision-quality score */
  decisionScore: number;
  goodMoves: number;
  badMoves: number;
  peakNetWorth: number;
  months: number;
}

const GOOD = new Set<CoachDecisionEntry['category']>([
  'invest_index', 'invest_real_estate', 'invest_gold', 'side_hustle_accept', 'resist', 'unseen_expense_cash',
]);
const BAD = new Set<CoachDecisionEntry['category']>([
  'doodad_oneshot', 'doodad_subscription', 'borrow_cc', 'unseen_expense_cc',
]);

/** Some moves are bad only in the wrong market context. */
function isContextBad(e: CoachDecisionEntry): boolean {
  if (e.category === 'sell_asset' && (e.marketPhase === 'contraction' || e.marketPhase === 'trough')) return true; // panic sell
  if (e.category.startsWith('invest_') && e.marketPhase === 'peak' && e.borrowed) return true; // leveraged FOMO at the top
  return false;
}

function gradeFromScore(s: number): Grade {
  if (s >= 92) return 'A+';
  if (s >= 82) return 'A';
  if (s >= 70) return 'B';
  if (s >= 55) return 'C';
  if (s >= 40) return 'D';
  return 'F';
}

export function scoreRun(state: GameState, log: CoachDecisionEntry[]): RunScore {
  let good = 0;
  let bad = 0;
  for (const e of log) {
    if (GOOD.has(e.category)) good++;
    if (BAD.has(e.category) || isContextBad(e)) bad++;
  }
  const decisions = Math.max(1, good + bad);
  const ratio = good / decisions; // 0..1
  // base on decision ratio, nudge by whether net worth ended positive
  let score = Math.round(ratio * 100);
  if (state.statement.netWorth <= 0) score = Math.max(0, score - 25);
  score = Math.max(0, Math.min(100, score));
  const peak = state.history.reduce((m, h) => Math.max(m, h.netWorth), state.statement.netWorth);
  return {
    grade: gradeFromScore(score),
    decisionScore: score,
    goodMoves: good,
    badMoves: bad,
    peakNetWorth: peak,
    months: state.meta.tick,
  };
}
