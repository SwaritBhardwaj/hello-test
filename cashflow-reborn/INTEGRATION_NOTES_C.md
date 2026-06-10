# Integration notes — Agent C (mobile layout overhaul)

Branch: `worktree-agent-ab0b511fe6aaba5c3` (worktree at `.claude/worktrees/agent-ab0b511fe6aaba5c3`).

## What changed

- **`src/ui/components/BoardPanel.tsx`**
  - `PathBoard` (mobile, `sm:hidden`) is now a horizontal scrolling track: one row of 31 day tiles
    (0..30) inside an `overflow-x-auto` strip with hidden scrollbar. Card-cell days use the existing
    `TILE_STYLE` chips (h-9 w-9) with glyph; plain days are small dot-tiles; day 30 is the gold ★.
    Tiny day number under each tile; the `Pawn` (layoutId `pawn-strip` spring) stands on the current
    tile. On `dayPosition` change the track auto-scrolls (smooth `scrollTo`) so the current tile sits
    ~30% from the left edge, keeping ~7-8 upcoming tiles visible ahead of the pawn. Cream strip with
    a dark connecting line behind the tiles, matching the printed-board look.
  - `Medallion`: desktop behavior unchanged (die is still the roll button). With `compact` (mobile)
    it is **status-only**: ring + Freedom % + a small non-interactive `Die` showing `lastRoll` +
    the "next: X" hint. The inner TAP TO ROLL button is gone on mobile; overall width shrunk to
    180px so medallion + track + sticky CTA fit one viewport.

- **`src/ui/components/BoardScreen.tsx`**
  - Sticky bottom bar remains the single mobile roll CTA. Disabled state now reads
    "Resolve the card…" while a card is open. Idle pulse: `cta-idle-pulse` CSS class
    (1.8s pulse starting after a 4s delay); the button is keyed on `dayPosition` so the delay
    restarts after every move. Marker comment `{/* INTEGRATION: payday CTA */}` sits directly above
    the bar for the orchestrator to wire a payday state.

- **`src/ui/components/HudBar.tsx`**
  - Header now contains only: identity (pawn + name + `LevelBadge`), the three `MoneyPill`s,
    [Sheet], and [⋯]. `LanguageToggle`, `MuteToggle` (as "Sound"), and `CoachToggle` behavior moved
    into the ⋯ menu as rows — language as the two-button row, coach/sound as labeled switch rows
    (new exported `MenuToggleRow`). `CoachStyleToggle` removed from the header entirely (component
    still exported; replacement ships elsewhere).
  - `LevelBadge`: thin brass progress bar (from `rankFor(...).progress`) under the rank label, and
    a 10px "→ {next.label}" hint when `next` exists.

- **`src/ui/components/CardModal.tsx`**
  - Restructured to header + temptation bar (unchanged) + scrollable body (`flex-1 min-h-0`) +
    **sticky footer** (`shrink-0`, `border-t-2`, paper bg) holding all option buttons + the borrow
    button + per-option coach warnings — decisions are never below the fold.
  - Coach note collapses to one line (`line-clamp-1`) with a tap-to-expand chevron
    (`aria-expanded`). "Your finances" accordion header slimmed to `py-1.5` with smaller text.
    Body padding/text tightened so a typical card fits a 390×844 viewport without scrolling.

- **`src/ui/components/AchievementToasts.tsx`** — renders at most 2 toasts (`toasts.slice(0, 2)`);
  the rest queue in the store and surface as visible ones auto-dismiss.

- **`src/ui/index.css`** (additions only) — `.scrollbar-hide`, `.cta-idle-pulse` +
  `@keyframes cta-pulse`. The existing `prefers-reduced-motion` block collapses the pulse too.

## New user-facing strings (English literals — Hindi keys wanted)

These are hard-coded in English pending i18n keys (do NOT exist in `src/i18n/strings.ts` yet):

| Suggested key        | English literal      | Where |
|----------------------|----------------------|-------|
| `board.resolveCard`  | `Resolve the card…`  | BoardScreen sticky bar disabled label |
| `menu.language`      | `Language`           | HudBar ⋯ menu row label |
| `menu.sound`         | `Sound`              | HudBar ⋯ menu row label (coach row reuses `coach.label`) |

When keys land, replace the literals with `t(...)` calls.

## Hooks for later work

- `{/* INTEGRATION: payday CTA */}` in `BoardScreen.tsx` marks where the payday CTA state goes on
  the sticky bar.
- `CoachInsight` is still mounted in `BoardScreen` exactly where it was (between the board and the
  history panel) for the agent replacing it.
- `store.ts` untouched; no new store fields referenced.
