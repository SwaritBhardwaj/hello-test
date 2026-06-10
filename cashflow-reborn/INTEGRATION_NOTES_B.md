# Integration notes — Coach Sprite / Wisdom Journal (Agent B)

New files (no existing files outside my ownership were touched):

- `src/ui/art/Coach.tsx` — `CoachMascot` extended: `mood: 'idle' | 'happy' | 'worried' | 'celebrate' | 'facepalm'` (old `'happy'`/`'worried'` callers keep working), plus optional `styleOverride?: 'coin' | 'owl'` prop.
- `src/ui/components/CoachSprite.tsx` — exports `CoachSprite` (no props, fully self-contained) and `verdictPoseFor` (pure, tested).
- `src/ui/components/WisdomJournal.tsx` — exports `WisdomJournal({ onClose }: { onClose: () => void })`.
- `src/modules/coach/journal.ts` — `recordLesson(id)`, `seenLessons()`, `journalStats()`, plus `subscribeJournal`/`journalVersion` for `useSyncExternalStore`.
- `tests/coach-sprite.test.ts`.

## 1. Mount `<CoachSprite />` in BoardScreen

In `src/ui/components/BoardScreen.tsx`:

```tsx
import { CoachSprite } from './CoachSprite';
```

Render it once anywhere inside the root `<div>` of `BoardScreen` (it positions itself with `position: fixed`); suggested spot is next to the other overlays:

```tsx
      {gameStatus === 'won' && !outcomeDismissed && <Confetti />}
      <AchievementToasts />
      <CoachSprite />
```

It reads `useGameStore`/`useProgression` itself and hides automatically when a card modal is open, coach mode is off, or no game is running. It sits at `z-40` (below the `z-50` modals).

## 2. Remove `<CoachInsight />`

In `BoardScreen.tsx`, delete the line `<CoachInsight />` and its import (`import { CoachInsight } from './CoachInsight';`). Do NOT delete the `CoachInsight.tsx` file itself. The sprite's speech bubble now carries the same lesson content (one-liner, then quote + attribution + book on expand) and additionally records every shown lesson into the journal.

## 3. Remove `CoachStyleToggle` from HudBar

In `src/ui/components/HudBar.tsx`, delete `<CoachStyleToggle />` from the header controls row (and optionally the now-unused `CoachStyleToggle` export + `useCoachStyle` import). The coin/owl style picker now lives inside the Wisdom Journal modal ("Coach look" row).

## 4. Add the Wisdom Journal to the ⋯ menu

In `HudBar.tsx`:

```tsx
import { WisdomJournal } from './WisdomJournal';
import { journalStats } from '@/modules/coach/journal';
```

Inside `HudBar`, add state and a menu item (the stats read is cheap; recompute when the menu opens):

```tsx
const [journalOpen, setJournalOpen] = useState(false);
const js = journalStats(); // { seen, total }
```

In the dropdown, above "New game":

```tsx
<MenuItem onClick={() => { setJournalOpen(true); setMenuOpen(false); }}>
  {`Wisdom Journal (${js.seen}/${js.total})`}
</MenuItem>
```

And render the modal (sibling of the dropdown, wrapped like the other modals):

```tsx
<AnimatePresence>{journalOpen && <WisdomJournal key="journal" onClose={() => setJournalOpen(false)} />}</AnimatePresence>
```

## 5. localStorage keys used

- `cashflow-reborn:journal:v1` — JSON array of seen lesson ids.
- `cashflow-reborn:tutorial-done` — set to `'1'` after the third scripted tutorial bubble.

## 6. i18n — desired Hindi keys

All new copy is plain-English literals for now. Suggested keys for `src/i18n/strings.ts` (owner of that file should wire them; English values shown):

| key | en |
| --- | --- |
| `coach.sprite.label` | `Coach` |
| `coach.sprite.tip` | `Coach tip {n}/3` |
| `coach.sprite.tapForMore` | `Tap for more` |
| `coach.sprite.niceResist` | `Nice resist.` |
| `coach.sprite.dismiss` | `Dismiss` |
| `coach.tutorial.roll` | `Tap the big dice to roll — each day costs and earns money.` |
| `coach.tutorial.cards` | `Tiles draw cards. Green deals grow money; red temptations drain it.` |
| `coach.tutorial.ring` | `See the ring? When passive income covers expenses, you're free. Fill it.` |
| `journal.title` | `Wisdom Journal — {seen}/{total} collected` |
| `journal.subtitle` | `Lessons the coach has shared with you` |
| `journal.menuItem` | `Wisdom Journal ({seen}/{total})` |
| `journal.locked` | `Keep playing to unlock` |
| `journal.coachLook` | `Coach look` |
| `journal.style.coin` | `Coin` |
| `journal.style.owl` | `Owl` |
| `journal.close` | `Close journal` |

Verdict bubble text comes from each card option's `coachWarning` (`Loc`), so it localizes automatically; pose classification ("Best"/"WORST" prefixes) intentionally runs against the English variant via `tr(loc, 'en')` and is language-independent.

## Behavior summary (for QA)

- Dock: bottom-left on mobile (above the sticky roll bar via `bottom: calc(env(safe-area-inset-bottom) + 84px)`), bottom-right on desktop. 56px sprite, idle bob, spring pose changes.
- Lessons: `pickLesson(state, decisionLog)` memoized; priority >= 4 auto-opens the bubble once per session per lesson; lower priority shows a "!" badge — tap the sprite to read. Every displayed lesson is recorded to the journal.
- Verdicts: after each card decision the sprite flashes the chosen option's `coachWarning` for ~2.5s — `Best…` → celebrate, `WORST…` → facepalm, other warnings → worried; doodad bought on credit → facepalm; resisting with no warning → happy + "Nice resist."
- Mood baseline: achievement toast visible → celebrate; trailing negative-cash months → worried; else idle (blinks).
- Tutorial: 3 scripted bubbles on a fresh profile (month < 2): before first roll, after first card resolution, after first lap; then `cashflow-reborn:tutorial-done` is set.
