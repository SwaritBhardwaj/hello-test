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
import type { Loc } from '@/i18n/loc';

export type InterventionKind = 'panic_sell' | 'borrow_doodad' | 'cc_bailout' | 'fomo_buy';

export interface Intervention {
  kind: InterventionKind;
  /** Personal callback shown in the coach's notice (localized). */
  message: Loc;
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
    message: {
      en: 'Selling into a falling market — again? Last time you locked in the loss and missed the rebound. Still sure?',
      hi: 'गिरते बाज़ार में फिर बेच रहे हैं? पिछली बार नुकसान पक्का किया और सुधार चूक गए। पक्का है?',
    },
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
      message: {
        en: "An EMI for a toy — again? You've paid interest on fun before, and the interest outlived the fun. Still sure?",
        hi: 'मनोरंजन के लिए फिर ईएमआई? पहले भी शौक पर ब्याज चुका चुके हैं, और ब्याज शौक से लंबा टिका। पक्का है?',
      },
    };
  }
  if (card.kind === 'unseen_expense' && optionId === 'cc' && ctx.ccBailoutsLast24mo >= 1) {
    return {
      kind: 'cc_bailout',
      message: {
        en: 'Swiping the card again? Your last credit-card bailout charged ~42% a year for the privilege. Still sure?',
        hi: 'फिर कार्ड स्वाइप? पिछली बार क्रेडिट कार्ड ने ~42% सालाना ब्याज लिया था। पक्का है?',
      },
    };
  }
  if (card.kind === 'deal_stock' && state.market.phase === 'peak' && ctx.fomoBuysAtPeakLast24mo >= 1) {
    return {
      kind: 'fomo_buy',
      message: {
        en: 'Buying at the top of the cycle — your last peak buy went underwater. Markets were cheaper when you were scared. Still sure?',
        hi: 'चक्र के शिखर पर खरीद रहे हैं — पिछली बार की पीक खरीद डूब गई थी। जब डर था, बाज़ार सस्ता था। पक्का है?',
      },
    };
  }
  return null;
}
