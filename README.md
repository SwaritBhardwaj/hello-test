# Cashflow Reborn

A boardgame-style financial literacy simulation. Realistic Indian context (₹ / EMIs / LTCG / RERA), market cycles, deal cards, and a coach mode that pulls wisdom from Buffett, Munger, Bogle, Housel, Mukherjea, Halan and 40+ other personalities — and flags your panic-sells & FOMO-buys based on your actual play.

**Live:** [swaritbhardwaj.github.io/cashflow-reborn](https://swaritbhardwaj.github.io/cashflow-reborn/)

The app lives in [`cashflow-reborn/`](./cashflow-reborn/). See its [README](./cashflow-reborn/README.md) for setup and module structure.

## Develop

```bash
cd cashflow-reborn
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run test:run
```

## Deploy

Pushes to `main` or `claude/create-new-project-92qfF` build the app via [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml) and publish to GitHub Pages.
