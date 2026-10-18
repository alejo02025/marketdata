# Market Radar audit — 2026-10-18

Reference: cf5a572. Keep Radar, Análisis, Daily. No Cartera, paid feed or backend.

## Diagnosis and changes
- Current and historical cards repeated the same event. Exclude the current session from history, deduplicate consecutive same-stage events, prioritize confirmed events.
- Snapshot generation date was labeled as market close. Use actual session date; retain retrieval timestamps separately.
- Failed fetch cleared all data. Keep last successful in-memory and local snapshot across reloads.
- Removed the unsupported add-ticker control: browser watchlists cannot alter the fixed server-side data universe.
- Chart showed EMA 50/200 while strategies used SMA. Replace custom SVG with Lightweight Charts, native pan/zoom and volume. Plot daily EMA20/SMA50/SMA200 consistently, sampled on weekly/monthly bars. Disclose available history and add accessible OHLCV table.
- EMA20 distinguishes alert from confirmed bounce. Golden Cross remains visible as an alert without volume confirmation. Breakout uses prior 55-session highs, trend, liquidity and 1.5x relative volume; redundant MACD/flow gates removed. No optimized thresholds.
- Legacy backtest mixed strategies and entered unconfirmed touches, excluded Golden Cross, and used inconsistent friction math. Separate three strategies; confirmed events only; next-open fills; 0.2% each side; 0.5% sensitivity; same-date SPY and buy/hold; independent cash starts for chronological slices. Fixed 126-session holding cap suits medium-term research; not calibrated to maximize returns.
- Daily is awaiting content. Remove promises of ChatGPT synchronization; retain bilingual editorial format and actual edition date. No fabricated briefing.
- Deterministic dependency lock; upgrade build tools; Python and desktop/mobile browser gates before Pages deployment; version.json checks exact deployed commit.

## Evidence limitations
Known strategy names are not evidence that these implementations outperform. AQR trend-following research addresses different portfolios/rules and does not validate these signals. Golden Cross has only 0–2 trades per asset in this five-year sample. No strategy is labeled validated.

Retrospective 60/40 split is not genuinely independent out-of-sample research. Current universe has survivorship/selection bias. Returns exclude dividends/taxes and cannot guarantee correct vendor corporate-action adjustments. Benchmarks use gross close-to-close price returns; strategies incur costs. Forced terminal liquidations count as trades. No portfolio-level capacity or statistical significance claim. Slippage assumptions are illustrative.

Data remain EOD via an unofficial Yahoo endpoint. No free realtime SLA; intraday is an external TradingView embed, with provider availability restrictions. 5A/MAX reflect available data, not unlimited history. iPhone-width Chromium tests are not physical iOS Safari certification.

## References
- https://www.tradingview.com/pine-script-docs/concepts/strategies/
- https://www.aqr.com/-/media/AQR/Documents/Insights/Journal-Article/AQR-JPM-Fall-2017.pdf
- https://tradingview.github.io/lightweight-charts/docs/5.0
