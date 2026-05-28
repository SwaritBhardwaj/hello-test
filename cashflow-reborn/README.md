# Cashflow Reborn

A realistic financial literacy simulation game.

**Play it live:** [swaritbhardwaj.github.io/cashflow-reborn](https://swaritbhardwaj.github.io/cashflow-reborn/)

See `docs/PRD.md` (or the parent folder's PRD) for product context.

## Quick start

```bash
npm install
npm run typecheck   # strict TS compile
npm run test:run    # smoke tests
npm run dev         # Vite dev server with playable UI
```

## Repo structure

```
src/
├── engine/              # Core sim engine — pure, deterministic
│   ├── tick/            # The monthly tick orchestrator
│   ├── events/          # Random + decision event generators
│   ├── prng/            # Seeded PRNG (Mulberry32)
│   ├── setup.ts         # Initial state builder
│   └── index.ts         # Public engine API
├── modules/             # Domain modules — one folder each
│   ├── player/          # Career, salary growth, promotions, layoffs
│   ├── expenses/        # Inflation, lifestyle creep, realized expenses
│   ├── assets/          # Pricing, yields, buy/sell flows
│   ├── loans/           # EMI math, amortization, DTI, prepayment
│   ├── tax/             # Slabs, TDS, LTCG/STCG (India)
│   ├── market/          # Cycle phases, macro indicators
│   ├── insurance/       # Premiums, claims
│   ├── behavioral/      # Pattern detection (FOMO, panic, etc.)
│   ├── goals/           # Escape conditions, FIRE, custom
│   └── dashboard/       # Financial statement computation
├── types/               # Shared TypeScript types — the spine
├── data/                # Tunable constants — calibration knobs
├── ui/                  # React components, Zustand store, charts
├── utils/               # Money formatting, helpers
└── main.tsx             # Vite entry

tests/                   # Vitest tests — smoke + module unit tests
docs/                    # Phase plans, design notes
```

## Module status (v0.1)

| Module | Status | Next step (v0.2+) |
|---|---|---|
| `engine/tick` | ✅ orchestrator wired, all modules called in order | Profile + optimize clone, structured events |
| `engine/prng` | ✅ Mulberry32 + gaussian + chance | — |
| `engine/events` | 🟡 events generate, consequences stubbed | Apply consequences (medical, layoff, etc.) |
| `engine/setup` | ✅ builds full initial state | More profession defaults, custom start positions |
| `modules/player` | 🟡 9 professions, age tick only | Salary drift, promotions, layoffs, career switch |
| `modules/expenses` | ✅ inflation, lifestyle creep, variable sampling | Dependents over time, education milestones |
| `modules/assets` | 🟡 valuation + yield work, pricing simplistic | Per-asset baseline indexing, friction costs |
| `modules/loans` | ✅ EMI, amortization, DTI, prepayment | Variable rates, credit score model |
| `modules/tax` | 🟡 new regime slabs + LTCG/STCG | Annual reconciliation, deductions, old regime |
| `modules/market` | ✅ phase state machine + macro deltas | Realistic asset correlations, indexed cycles |
| `modules/insurance` | 🟡 premiums debit, claim formula | Underwriting, age-based premiums, renewals |
| `modules/behavioral` | 🔴 stubbed | Pattern detection logic |
| `modules/goals` | 🟡 escape + FIRE checks | Custom goal kinds, milestone events |
| `modules/dashboard` | ✅ financial statement compute | Cashflow waterfall, allocation drift |
| `ui` | 🟡 setup + dashboard + chart | Decision modals, allocation views, debrief |

✅ Functional · 🟡 Partial · 🔴 Stub only

## Determinism

Every random call routes through the seeded PRNG. Same seed + same input sequence = identical run. This makes save/load, replay, and multiplayer (same-seed comparison) trivial.

## Calibration

All economic constants live in `src/data/constants.ts`. Adjust returns, inflation, cycle lengths, event probabilities there — not inline.

## Build phasing (from PRD)

- **v0.1** (this scaffold) — engine wired, all modules called, UI runs ✓
- **v0.2** — fix asset baseline indexing, real salary growth, first decision modal
- **v0.3** — diversification: FD, gold, RE; tax annual reconciliation
- **v0.4** — emergencies, insurance claims, behavioral patterns
- **v0.5** — engagement (achievements, professions, time pressure)
- **v1.0** — async multiplayer, polish
