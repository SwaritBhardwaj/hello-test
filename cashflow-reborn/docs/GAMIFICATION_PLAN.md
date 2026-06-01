# Gamification Plan — Cashflow Reborn

**Status:** proposal, awaiting approval. No code written yet.
**Goal:** turn the simulation UI into something that *plays* like a game — nostalgic, warm, tactile, with real game pieces — across the full experience.
**Scope agreed:** all three phases. **Art direction agreed:** elevated board-game skin, nostalgic + gamey, **custom dice / board / card / coin art (SVG, not emoji).**

---

## 0. Art direction — "Nostalgic Board Night"

The feel: a well-loved physical board game from a shelf — *The Game of Life* / *Cashflow 101* / *Monopoly*, but crafted, not kitsch. Warm felt table, wood frame, brass fittings, printed-card paper grain, chunky tactile pieces.

| Token | Direction |
|---|---|
| **Surface** | Keep the green felt, add a subtle paper/canvas grain and a wood-and-brass board frame. Warm, dim "game night under a lamp" lighting. |
| **Palette** | Felt green base, warm woods (umber/walnut), brass/gold accents, printed-card cream. One alert red, one success green. **No purple/indigo** (drop the current "LILA" coach gradient). |
| **Type** | Nostalgic display face for headings (e.g. a friendly retro slab/rounded — candidates: *Fredoka*, *Bitter*, *Arvo*, or a vintage label sans). **Tabular/mono numerals** for all money so the ledger stays legible. Not Inter. |
| **Pieces** | Custom SVG art: a real **die** (pips, faces), a **pawn/token**, **card backs** per deck, **₹ coins**, **board tiles**, a **brass freedom gauge**, a **coach character**. These *replace* the emoji (🎲🃏💎💸…) everywhere. |
| **Motion** | Tactile and physical: dice tumble, pieces hop, cards deal and flip, coins pop, numbers roll. Warm not flashy. |

**Cross-cutting rules applied from the skills (non-negotiable, every phase):**
- `prefers-reduced-motion`: every animation has a reduced/instant fallback. *(Currently missing entirely.)*
- Animate only `transform` / `opacity`. No layout-property animation.
- Replace the modal-with-no-exit pattern with proper enter **and** exit transitions.
- Remove the `border-left` side-stripe accents (`App.tsx:813, 864`) — full borders / tinted backgrounds instead.
- Sweep em-dashes from UI copy.
- Add the missing favicon (the one console 404) — use the new die/coin mark.

---

## 0.5 Foundations — type, color, layout, responsive, UX

These are now **first-class requirements that run under all three phases**, not afterthoughts. Phase 1 lands the foundation; every later component is built on these tokens. The bar is explicitly "best-in-class UI/UX for a game of this kind," mobile included.

### Typography system

Self-hosted via `@fontsource` (no external requests, no layout shift). Three roles, clear contrast (ratio ≥ 1.25 between steps):

| Role | Face (candidate) | Use |
|---|---|---|
| **Display / headings / labels** | a nostalgic, friendly face — *Fredoka* or *Bricolage Grotesque* | titles, tile labels, CTAs, the "game box" feel |
| **UI / body** | *Geist* (or *Outfit*) — clean humanist sans, **not Inter** | descriptions, copy, controls |
| **Numerals / money** | *Geist Mono* (tabular figures) | every ₹ amount, %, ledger — columns align, digits don't jitter on count-up |

A defined scale (`text-xs` 12 → `display` ~40px) wired into Tailwind's `theme.fontSize`, so sizes are tokens, not ad-hoc. Money **always** uses tabular-nums so the Phase-1 count-up animation doesn't reflow.

### Color system (OKLCH tokens, warm-tinted neutrals)

A small, disciplined palette as CSS variables + Tailwind theme. No `#000`/`#fff`; neutrals tinted warm. **Purple/indigo removed.** Semantic money roles stay consistent everywhere (this is half the intuitiveness win):

| Token | Feel | Semantic role |
|---|---|---|
| `felt` | deep green table | app background |
| `wood` / `walnut` | warm umber frame | board frame, structure |
| `brass` | gold accent | the single celebratory accent (freedom, level-ups, coins) |
| `card` | printed cream | card/sheet surfaces |
| `ink` | warm near-black | text |
| `income` | green | money **in** (salary, yield, gains) — everywhere |
| `expense` | red | money **out** (EMIs, spend, losses) — everywhere |
| `caution` | amber | warnings, mid-temptation |

Shadows are **tinted to the surface hue**, not gray; the current outer **glow** (`glow-pulse`) is reserved for genuine celebration only, replaced elsewhere by depth via tinted shadow + border.

### Layout & information architecture

The current screen is one long vertical stack — fine on mobile, but it wastes desktop width and buries the goal. New responsive structure:

- **Persistent top status strip:** identity + level/title (Phase 2) + the **freedom gauge** (always visible — it's the win condition and should never scroll away).
- **Center stage:** the board + dice + the single primary action.
- **Dashboard rail:** stats, net-worth chart, game log — a **right rail on `lg+`**, collapsing **below** the board on mobile.
- **Declutter controls:** the five header buttons (Coach / Balance Sheet / +1yr / +5yr / Reset) get grouped — primary actions stay visible, time-skip + reset move into an overflow menu. Fewer competing buttons = more intuitive.

### Mobile-first responsive strategy (explicit requirement)

Designed phone-first, enhanced up. Concretely fixes what the 390px screenshot shows:

- Root uses `min-h-[100dvh]` (never `h-screen`), `max-w` container, `px-4`, single column; asymmetric/desktop layout only at `md:`+.
- **The board** can't be a 30-cell horizontal strip on a phone (it overflows off-screen today). Mobile gets a compact form — a **segmented arc / ring** or a **vertical zig-zag tile path** showing current tile + a mini-map — that fits with **no horizontal scroll**.
- **Card modal and balance sheet become bottom sheets** with a drag handle, thumb-reachable; the clipped tab row (`BORROW` cut off) becomes a **scrollable segmented control** or a 2×2.
- **Sticky bottom action bar** so the primary verb (**Roll**) is always under the thumb; secondary actions live there too.
- Touch targets ≥ 44px; `env(safe-area-inset-bottom)` respected; tap feedback (`active:scale`) on everything tappable.
- Verified at **390 / 768 / 1440** with screenshots each pass; no horizontal scroll at any width.

### Intuitiveness / UX bar ("intuitive as hell")

- **One obvious primary action at all times** (Roll), with progressive disclosure of everything else.
- **The goal is always on screen and explained** (the freedom gauge), so a first-timer knows what they're working toward in 5 seconds.
- **Consistent money semantics** (green in / red out) across board, cards, stats, ledger — no relearning per screen.
- **Decision cards preview their consequence** before you commit ("this adds ₹2,520/mo for 12 months").
- **First-run guided walkthrough** + real empty states (the chart's empty dashed box and "(none yet)" rows get designed) — Phase 3's onboarding, but the empty states land in Phase 1.
- **Feedback on every action**: motion + sound + a clear log/toast, so nothing happens silently.
- **Accessibility as table stakes**: AA contrast, visible focus rings, `prefers-reduced-motion`, and ARIA labels / text equivalents for the SVG dice, pawn, and coins.

---

## Current "game-feel" gaps this plan fixes

1. Dice don't roll — `DieFace` swaps a static glyph (`App.tsx:749`).
2. Token teleports — `dayPosition` jumps (`store.ts:174`); no cell-by-cell movement.
3. Board is a flat strip, not a board (`DayTrack`, `App.tsx:704`).
4. Cards don't deal — no deck, no flip; bouncy pop only.
5. Numbers snap — no count-up, no floating deltas.
6. No reward loop — no levels/XP/streaks/achievements/score; the rich `decisionLog` + behavioral data is shown only as tiny gray text (`App.tsx:664-673`).
7. No sound.
8. Deterministic replay (a headline engine feature) is unused — no run history, no ghost.

---

## Phase 1 — Juice the core loop (feel)

Transforms feel; touches **no game logic**. Highest impact per unit effort.

**Dependency:** introduce **`framer-motion`** for `AnimatePresence` (modal exits), spring physics, and `layout` transitions. *(Not currently installed — would run `npm install framer-motion`.)* Dice/coins/confetti can be CSS-only; framer-motion is for orchestration + presence.

**New assets** (in `public/` and a new `src/ui/art/`):
- `Die.tsx` — SVG die, 6 faces, tumble animation with anticipation → settle (no infinite spin; Emil-restraint on this high-frequency control).
- `Coin.tsx`, `Pawn.tsx`, `CardBack.tsx` — reusable SVG pieces.
- `sounds/` — dice clack, coin chime, card whoosh, soft danger sting, win fanfare (short, royalty-free or generated). `useSound` hook + a **mute toggle** persisted to localStorage.

**New UI primitives** (`src/ui/fx/`):
- `CountUp` — animated number roll for money/percent (respects reduced-motion).
- `FloatingDelta` — `+₹50,000` / `−₹X` floaters that rise and fade on cashflow events.
- `Confetti` — brass/gold burst on freedom; `useScreenShake` — short shake on a bankruptcy-month hit.

**Wiring (existing files):**
- `App.tsx` `DieFace` → `Die` with roll animation; trigger on `rollDice`.
- `DayTrack` → animate the pawn **hopping** cell-by-cell along the roll. Requires the store to expose the roll *path* (intermediate days), see below.
- `CardModal` → deal from a visible deck + flip; wrap it, `BalanceSheetDrawer`, and `OutcomeModal` in `AnimatePresence` for enter/exit.
- `Stat`, `FreedomBar`, balance-sheet totals → `CountUp`.
- `index.css` → reduced-motion block; replace the bounce `card-in` (line 26) with a subtler spring; add grain/wood/brass textures; new keyframes (tumble, coin-pop, float-up, shake).

**Store changes (`store.ts`):** `rollDice` currently jumps `dayPosition`. Add a derived **roll path** (sequence of day cells crossed) and an `isRolling`/animation-cursor the UI can play through, so movement is animated without changing the simulation result. Add `muted` flag.

---

## Phase 2 — Progression & reward systems (retention)

New pure module + light persistent state. Uses data the engine **already produces**.

**New module `src/modules/progression/`:**
- `titles.ts` — financial-rank ladder driven by net worth + passive coverage: *Paycheck-to-Paycheck → Saver → Investor → Landlord → Financially Free*. Returns current rank + progress to next.
- `achievements.ts` — definitions evaluated against `GameState` + `decisionLog` + behavioral context. First ₹1L / ₹10L / ₹1Cr net worth; first asset; debt-free; "Resisted 5 temptations"; "Survived a recession"; "Diversified (4+ asset classes)"; "FOMO-free year". (Directly reuses the signals in `coach/wisdom.ts`'s `CoachContext` and `behavioral/patterns.ts`.)
- `streaks.ts` — consecutive positive-cashflow months; resist streaks.
- `score.ts` — end-of-run score + **A–F decision grade** from time-to-freedom, peak net worth, and behavioral-pattern penalties (panic-sells/FOMO-buys hurt; resists help).

**Persistence (`src/modules/progression/storage.ts` + store):**
- Unlocked achievements, best streaks → localStorage.
- **Run history**: every finished run records `{ seed, profession, timeToFreedom, peakNetWorth, grade }`. Enables a personal best.
- **Ghost run**: because the engine is seeded-deterministic (README §Determinism), overlay your **past-best net-worth curve** on the chart and on the freedom bar ("Beat your escape: 14y 3m"). Near-zero engine cost, big retention hook.

**UI:**
- Level/title **badge** in the header (replaces the bare player chip).
- `AchievementToast` — slides in with a coin chime on unlock (AnimatePresence + reduced-motion fallback).
- Streak indicator near cashflow.
- `Scorecard` — richer end-of-run screen (grade, stats, achievements earned this run, "new best?") augmenting `OutcomeModal`.
- Ghost line on `FreedomBar` + net-worth chart.

---

## Phase 3 — The board as a real board + companion coach (identity)

Biggest visual change. **One logic decision needed** (flagged below).

**Themed board (`src/ui/board/GameBoard.tsx`, replacing `DayTrack`):**
- A looping oval/spiral of **tiles** with categories: *Start/Payday · Deal · Temptation · Tax · Market Move · Chance*. The pawn travels the loop; completing a lap = closing the month with a "payday" beat.
- **Logic coupling to decide:** today `cardCells` are random and `drawRandomCard` picks any card type (`store.ts:38, 384`). To make tiles meaningful, a tile's **category should bias which card it draws** (a Deal tile → a deal card, a Temptation tile → a doodad, etc.). This is the one change that affects gameplay feel/balance — I'll propose the mapping and keep the current random fallback as an option so we can compare.

**Companion coach (`src/ui/coach/CoachCompanion.tsx`):**
- Turn the wisdom engine (the project's soul) from a static gradient banner into a small **coach character** with reactive states (idle / approving / worried / alarmed) tied to the signals already computed in `CoachInsight` (`App.tsx:596`). Lessons appear as a speech bubble from the character. Citations/verification badges preserved exactly.

**Onboarding & empty states (impeccable `onboard` + taste Rule 5):**
- First-run guided overlay (roll → land on a tile → read a card → check the balance sheet → goal is the freedom bar).
- Real empty states for the chart, game log, and asset/loan tabs instead of bare "(none yet)".

---

## Sequencing, risk, and verification

| Phase | Risk | Touches game logic? | Visible payoff |
|---|---|---|---|
| 1 Juice | Low | No | Immediate — it suddenly feels alive |
| 2 Progression | Medium | No (reads existing data) | Reasons to replay |
| 3 Board + Coach | Higher | **Yes** (tile→card coupling) | Looks like a finished game |

- Each phase ships in small, screenshot/video-reviewed chunks (headless Chromium).
- `npm run typecheck` + `npm run test:run` stay green after every chunk; engine tests must not regress (Phase 3's coupling gets a test).
- New deps surfaced before install (`framer-motion`; fonts via `@fontsource` or CSS `@font-face`).
- Performance: transform/opacity only; perpetual/idle animations isolated and reduced-motion-aware.

## Open decisions for you (Phase 3, when we get there)
1. Board shape: **oval loop** vs **spiral** vs keep a (prettier) **linear track**.
2. Tile→card coupling: **on** (tiles mean something) vs **keep fully random**.
3. Coach character: **abstract mascot** (a brass owl/coin character) vs **a desk-coach avatar**.

*These don't block Phases 1–2; I'll confirm them before building Phase 3.*
