/**
 * Repeat-mistake interventions.
 *
 * Pure helpers that decide when the coach should physically step in front of
 * an action button because the player is about to repeat a pattern their own
 * decision log already shows. Never blocks — the UI asks for one extra tap.
 *
 * Gated by COACH_FLAGS.interventions at the call sites.
 */
import type { GameState } from '@/types';
import type { CoachDecisionEntry } from './actionLog';
import { buildCoachContext } from './wisdom';
import type { Card } from '@/modules/cards/cards';

export type InterventionKind = 'panic_sell' | 'borrow_doodad' | 'cc_bailout' | 'fomo_buy';

export interface Intervention {
  kind: InterventionKind;
  /** Personal callback shown in the coach's notice. */
  message: string;
}

/** Guard for sell buttons (balance sheet, card finance panel). Fires when the
 *  market is down AND the log shows the player has panic-sold before. */
export function sellIntervention(state: GameState, log: CoachDecisionEntry[]): Intervention | null {
  const phase = state.market.phase;
  if (phase !== 'contraction' && phase !== 'trough') return null;
  const ctx = buildCoachContext(state, log);
  if (ctx.panicSellsLast24mo < 1) return null;
  return {
    kind: 'panic_sell',
    message:
      'Selling into a falling market — again? Last time you locked in the loss and missed the rebound. Still sure?',
  };
}

/** Guard for card option buttons (and the borrow-to-buy button). */
export function cardOptionIntervention(
  state: GameState,
  log: CoachDecisionEntry[],
  card: Pick<Card, 'kind'>,
  optionId: string,
  viaBorrow: boolean,
): Intervention | null {
  if (optionId === 'skip') return null;
  const ctx = buildCoachContext(state, log);
  if (card.kind === 'doodad' && viaBorrow && ctx.borrowedForDoodadEver >= 1) {
    return {
      kind: 'borrow_doodad',
      message:
        "An EMI for a toy — again? You've paid interest on fun before, and the interest outlived the fun. Still sure?",
    };
  }
  if (card.kind === 'unseen_expense' && optionId === 'cc' && ctx.ccBailoutsLast24mo >= 1) {
    return {
      kind: 'cc_bailout',
      message:
        'Swiping the card again? Your last credit-card bailout charged ~42% a year for the privilege. Still sure?',
    };
  }
  if (card.kind === 'deal_stock' && state.market.phase === 'peak' && ctx.fomoBuysAtPeakLast24mo >= 1) {
    return {
      kind: 'fomo_buy',
      message:
        'Buying at the top of the cycle — your last peak buy went underwater. Markets were cheaper when you were scared. Still sure?',
    };
  }
  return null;
}
