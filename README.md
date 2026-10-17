# Market Radar

Personal investment research terminal. Private source repository.

## Stack
React 18, TypeScript, Vite, TradingView embed widgets, browser localStorage.

## Run
```bash
npm install
npm run dev
```

## Sections
- **Radar**: watchlist with technical research links and source-labelled charts.
- **Analysis**: interactive TradingView chart for a selected symbol.
- **Portfolio**: manually entered holdings persisted **only in this browser**. Import/export JSON.
- **Daily**: curated verified-source links; no fabricated automatic daily brief.

## Market-data integrity
TradingView widgets are provider-hosted and can be delayed. This app does not scrape Yahoo, TradingView or Investing. A public URL is not a free unrestricted API. No standalone price feed, automatic signals, real-time quotes or proven backtest is claimed in this first iteration.

## Security / privacy
The repository is private; deployment may not be. Browser localStorage is not encrypted or synced. Do not use this app on a shared device for sensitive holdings. Export a backup before clearing browser data. No API secrets are required.

## Deployment
Run `npm run build`, publish the `dist` output on a static host. The Vite base is `./`, suitable for subpaths. Verify host privacy separately.

## Next engineering milestones
Licensed historical price adapter, persisted versioned snapshots, indicator engine with unit tests, fundamental data and quantitative backtesting with out-of-sample validation, automated source-linked daily brief.
