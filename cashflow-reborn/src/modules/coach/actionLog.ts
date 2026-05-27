import type { MarketPhase } from '@/types';
import type { CardKind } from '@/modules/cards/cards';

export interface CoachDecisionEntry {
  tick: number;
  cardKind: CardKind;
  optionId: string;        // 'buy' | 'pay' | 'cc' | 'personal' | 'skip' | 'accept' | etc.
  borrowed: boolean;       // true if "Borrow & buy" path used
  marketPhase: MarketPhase;
  /** "doodad", "lifestyle_subscription", "buy_stock", etc. — coarse category for pattern matching */
  category: DecisionCategory;
}

export type DecisionCategory =
  | 'doodad_oneshot'         // bought a one-time doodad
  | 'doodad_subscription'    // added a monthly lifestyle expense
  | 'invest_stock'           // single-stock buy
  | 'invest_index'           // index fund / mutual fund buy
  | 'invest_real_estate'     // RE purchase
  | 'invest_gold'
  | 'invest_business'
  | 'invest_crypto'
  | 'borrow_personal'
  | 'borrow_cc'
  | 'borrow_home'
  | 'sell_asset'
  | 'side_hustle_accept'
  | 'unseen_expense_cash'
  | 'unseen_expense_cc'
  | 'unseen_expense_loan'
  | 'resist'                 // skipped/declined the card
  | 'noop';                  // market headline, payday, etc.
