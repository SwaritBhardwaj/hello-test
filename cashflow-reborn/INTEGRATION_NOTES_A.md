# Integration notes — Cash Calendar / Payday / Impact Toast (Agent A)

This branch adds the month "cash calendar" preview ledger, the Payday moment,
and the decision-impact toast. The engine (`src/engine/**`) is untouched; all
preview cash movements are reverted before each real `tick()`, so month-end
state is byte-identical to the previous code path.

## 1. Mounting (owned by the BoardScreen agent)

Two new self-contained components need to be mounted once, anywhere inside the
playing screen (they render `null` until their store fields are set, so it is
safe to mount them unconditionally):

```tsx
// src/ui/components/BoardScreen.tsx (or App-level, inside the playing branch)
import { PaydayModal } from './PaydayModal';
import { ImpactToast } from './ImpactToast';

// ... inside the JSX, as siblings of the other overlays/modals:
<PaydayModal />
<ImpactToast />
```

Placement notes:

- `PaydayModal` uses `ModalShell` (z-50). Mount it BEFORE/below `CardModal`
  and `OutcomeModal` in the tree if you want those to win when overlapping
  (later siblings paint on top at equal z-index). It auto-dismisses after 6s,
  is click-outside dismissible, and never blocks `rollDice()`.
- `ImpactToast` is `position: fixed`, bottom-center (`bottom-24` on mobile to
  clear the roll bar, `sm:bottom-8` on desktop), `z-[60]`, pointer-events-none.
  No props. Auto-hides 2.5s after each impact.

Neither component takes props; both read the store directly.

## 2. New store API (`src/ui/store.ts`)

### Fields

| Field | Type | Meaning |
|---|---|---|
| `monthPlan` | `MonthPlan \| null` | Preview ledger for the current month (sorted events, day 1..30). Rebuilt after every lap / `step` / `fastForward` / `initGame`. |
| `moneyEvents` | `AppliedMoneyEvent[]` | Rolling log (last 60) of preview events the pawn has crossed. Each entry = `MoneyEvent & { balanceAfter, monthTick }`. Useful for a ledger/feed UI. |
| `previewAppliedTotal` | `number` | Net signed preview amount currently applied to `state.cashOnHand`. Internal bookkeeping — reverted in full before each engine tick. UI normally doesn't need it. |
| `pendingPayday` | `PaydaySummary \| null` | Set when a lap completes while `gameStatus === 'playing'`. Cleared by `collectPayday()`. |
| `lastImpact` | `DecisionImpact \| null` | Set by `resolveCardOption`, `resolveCardOptionWithLoan`, `applyAction` when the decision changed cash/passive/freedom. `uid` increments every time so equal deltas still re-trigger the toast. |

### Actions

- `collectPayday(): void` — clears `pendingPayday` (the modal calls it on
  Collect / backdrop click / 6s auto-dismiss).

### Types (exported from `src/ui/store.ts`)

```ts
interface PaydaySummary {
  monthTick: number;       // month just closed ("Payday — Month N")
  salary: number;          // salary credited by the tick
  passive: number;         // statement.passiveIncome after the tick
  totalExpenses: number;   // statement.totalExpenses after the tick
  netDelta: number;        // actual cash change the engine tick produced
  freedomBefore: number;   // passive/expenses ratio before the tick (0..1+)
  freedomAfter: number;    // ... after the tick
}

interface DecisionImpact {
  cashDelta: number;       // immediate cash effect (₹)
  passiveDelta: number;    // change in monthly passive income (₹/mo)
  coverageDelta: number;   // change in freedom ratio (decimal, e.g. 0.009 = +0.9%)
  uid: number;
}
```

`MoneyEvent`, `MonthPlan`, `AppliedMoneyEvent` are re-exported from the store
(canonical home: `src/modules/calendar/monthPlan.ts`, which also exposes the
pure helpers `buildMonthPlan`, `planSeedFor`, `eventsCrossed`, `signedAmount`).

### Behavioral notes

- Crossed preview events also push human-readable lines into `notifications`
  (e.g. `Day 14 · ₹2,340 debited — Groceries`), so the existing log already
  shows them with no UI change.
- The preview ledger only affects `state.cashOnHand` (and the derived
  `statement`) between rolls; on lap completion the accumulated preview total
  is reverted before `tick()` runs. Invariant covered by
  `tests/calendar.test.ts` ("CRITICAL INVARIANT...", two consecutive laps).
- `step()` / `fastForward()` apply no previews; they revert any outstanding
  preview total first, then tick as before, then rebuild the plan.

## 3. Suggested i18n keys (currently plain English literals)

New UI copy uses English literals per the file-ownership rules. Suggested
keys for `src/i18n/strings.ts` (Hindi copy TBD by the i18n owner):

| Key | English |
|---|---|
| `payday.title` | `Payday — Month {n}` |
| `payday.salaryCredited` | `Salary credited` |
| `payday.passiveIncome` | `Passive income` |
| `payday.monthlyExpenses` | `Monthly expenses` |
| `payday.netThisMonth` | `Net this month` |
| `payday.freedom` | `Freedom` |
| `payday.collect` | `Collect` |
| `impact.passive` | `Passive {delta}/mo` |
| `impact.freedom` | `Freedom {delta}%` |
| `calendar.credited` | `credited` |
| `calendar.debited` | `debited` |
| `calendar.eventLine` | `Day {day} · {amount} {direction} — {label}` |
| `calendar.salary` | `Salary credited` |
| `calendar.rent` | `Rent / housing` |
| `calendar.utilities` | `Utility bills` |
| `calendar.subscriptions` | `Subscriptions` |
| `calendar.emi` | `{loan} EMI` |
| `calendar.premium` | `{policy} premium` |
| `calendar.windfall.cashback` | `UPI cashback` |
| `calendar.windfall.refund` | `Refund` |
| `calendar.windfall.friend` | `Friend repaid you` |
| `calendar.var.*` | The variable-debit labels in `VARIABLE_LABELS` (`Groceries`, `Dining out`, `Fuel`, `Cab`, …) in `src/modules/calendar/monthPlan.ts` |

## 4. Tests

`tests/calendar.test.ts` (13 tests): plan determinism + structure, the
month-end cash invariant across two laps via real `rollDice()` calls,
mid-month preview application + notification lines, payday lifecycle,
non-blocking roll while payday pending, and `step`/`fastForward` preview
cleanup. Full suite: 37/37 passing (`npm run typecheck && npm run test:run`).
