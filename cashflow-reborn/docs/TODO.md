# Open Items — TODO tracker

Grouped by module. Update as you build.

## engine/tick
- [ ] Replace JSON.parse(JSON.stringify(state)) with structuredClone or immer for perf
- [ ] Centralized notification typing (right now just strings)
- [ ] Tick-level error boundary — if a module throws, surface cleanly

## engine/events
- [ ] Apply consequences for: medical (minor, major), job loss, family obligation, promotion offer accept/decline, startup angel accept/decline
- [ ] Event queue with expiry — events not answered in N ticks have a default outcome
- [ ] Event templates externalized to data files

## modules/player/career
- [ ] Salary drift: monthly CAGR + gaussian noise, applied to incomeStream
- [ ] Promotion event: trigger on schedule, apply bumpRange via PRNG
- [ ] Layoff event: zero salary for N months, recovery via search
- [ ] Career switch action: salary gap + new curve adopted
- [ ] Side income unlock paths (freelance, content, consulting)
- [ ] Build full 25–40 profession catalog in data/professions.ts

## modules/expenses
- [ ] Dependents — kids age tick, education milestones cause step-ups
- [ ] Variable expense bounds: clip extreme draws so monthly food doesn't 10x
- [ ] Lifestyle resistance mechanic — player can opt out of creep

## modules/assets
- [ ] Per-asset baseline index tracking — currently pricing math is approximate
- [ ] Realistic friction: brokerage, STT, GST on RE registration, stamp duty
- [ ] Capital gains realization tracking for tax module
- [ ] Asset sale ≠ instant for RE — add time-on-market
- [ ] Crypto separated from cycle multipliers (correctly), but tighter spec

## modules/loans
- [ ] Variable rate option — repo-rate linked, updates with market cycle
- [ ] Credit score model: history, utilization, mix → affects rates offered
- [ ] Default cascade: missed EMI → late fee → credit hit → recovery
- [ ] Refinance action

## modules/tax
- [ ] Old regime vs. new regime annual choice
- [ ] Section 80C/80D/24b/80CCD deductions applied to taxable income
- [ ] Annual reconciliation — sum realized cap gains, square TDS vs. actual liability
- [ ] Indexation for debt LTCG / RE

## modules/market
- [ ] Verify phase multipliers produce realistic long-run returns
- [ ] Macro shocks layered on top of cycle (e.g. covid-like event)
- [ ] Historical replay mode — replace stochastic with actual 1995–2025 data

## modules/insurance
- [ ] Premium calc by age, sum assured, profile (not just static)
- [ ] Renewal flow — must be renewed every 12 ticks or lapses
- [ ] Underwriting — pre-existing conditions after a major medical event
- [ ] Claim flow tied into random events with consequences module

## modules/behavioral
- [ ] All 6 patterns from PRD: fomo_buyer, panic_seller, anchorer, lifestyle_creeper, over_saver, over_leverager
- [ ] Annual review surface with each pattern detected
- [ ] Optional nudge mode: coaching prompts when pattern fires

## modules/goals
- [ ] Custom goal builder UI
- [ ] Goal milestone events — fire as goal approaches or recedes
- [ ] Multiple parallel goals with priority

## modules/dashboard
- [ ] Cashflow waterfall per month and per year
- [ ] Asset allocation pie + drift line
- [ ] Tax summary per FY
- [ ] Decision log viewer with filters
- [ ] "What if" sandbox — fork run, change a decision, replay

## ui
- [ ] Decision event modal — show prompt, options, ms-countdown timer
- [ ] Asset purchase / sell flow with class-specific forms
- [ ] Loan origination flow with affordability preview
- [ ] Insurance shopping flow
- [ ] Onboarding tutorial — guided first 12 ticks

## Cross-cutting
- [ ] Save/load to localStorage (and optionally URL hash for sharing)
- [ ] Seed sharing for friends/family same-market comparison
- [ ] Replay mode — step backward through ticks
- [ ] Test suite: per-module unit tests + scenario tests (recession, layoff, FIRE path)
