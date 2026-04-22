# RiskLens — Executive Summary


## What It Is

RiskLens is a quantitative market risk dashboard that computes daily Value-at-Risk (VaR) and tail-risk metrics across a portfolio of assets using multiple statistical models. It is modelled on academic risk measurement tools used by institutional researchers, but built to be accessible and visual. In its current form it covers twelve major liquid assets (S&P 500, Nasdaq 100, Gold, Long-dated Treasuries, Emerging Markets, Bitcoin, Russell 2000, High Yield Bonds, Investment Grade Bonds, Financials, Real Estate, and Capital Group Core Equity) and produces a fresh risk snapshot each time the backend is run.


## What the Metrics Mean

**Value at Risk (VaR)** answers one question: *on a bad day, how much can I expect to lose?* Specifically, a 1% VaR of $3.44 on a $100 position means that on the worst 1% of trading days historically, you'd lose at least $3.44. It's a floor, not a ceiling.

RiskLens computes VaR five ways, each with different assumptions:

- **Historical Simulation (HS)** — no model assumptions. Just ranks the last 1,000 actual trading days and reads off the 1st percentile. Honest but slow to react to regime changes.
- **EWMA** — uses exponentially weighted volatility, giving more weight to recent days (λ=0.94). Reacts quickly to spikes in volatility. The industry standard for daily risk desks.
- **GARCH(1,1)** — models volatility as a process that mean-reverts over time. Better at capturing the clustering effect: volatile days tend to follow volatile days.
- **GJR-GARCH (tGARCH)** — extends GARCH to treat negative shocks differently from positive ones. Empirically, bad news increases volatility more than good news of the same magnitude. This is a more realistic model for equity markets.
- **EVT (Extreme Value Theory)** — fits a statistical distribution specifically to the *tail* of losses rather than the whole return distribution. The most rigorous approach for rare, extreme events. Often produces meaningfully higher estimates than the others — that gap is important information, not noise.

**Expected Shortfall (ES / CVaR)** goes one step further than VaR: *given that today is a bad day, how bad on average?* ES is the mean loss across all days worse than the VaR threshold. Regulators (Basel III/IV) now prefer ES over VaR precisely because it captures what happens in the tail, not just where the tail begins.

**The tail index (α)** from Extreme Value Theory describes how fat the tails are. Lower values mean more extreme events are possible. Equities typically sit around 3–4; assets below 3 (Gold currently ~2.3) have meaningfully fatter tails than standard models assume.

**The Risk Gauge** contextualises today's EWMA VaR against the past two years of daily estimates for that asset. A reading of 85% doesn't mean high absolute risk — it means risk is elevated relative to recent history. This is more actionable than a raw number because it accounts for the asset's own volatility regime.

**The Cross-Asset Correlation Chart** shows the 60-day rolling average pairwise correlation across ten core ETFs. In normal markets this sits around 0.15–0.35 — assets move independently and diversification works. The all-time peak in the dataset is 2022, not the GFC: the Fed's rate hike cycle caused stocks and bonds to sell off simultaneously, breaking the traditional 60/40 hedge. In the GFC, treasuries and gold surged as equities fell (flight to safety), so average correlation stayed moderate. This distinction matters — the correlation breakdown problem is most dangerous in rate and inflation shocks, not just in equity crashes.


## Current Usefulness — Even as a Pilot

In its current form, RiskLens already does something most Bloomberg terminals and risk systems don't do cleanly: **it shows model disagreement at a glance.** When HS says 2.1, EWMA says 1.9, GARCH says 1.7, but EVT says 6.7 — that spread is a signal. It means the asset's tail behaviour is not well-described by a normal distribution and a naive risk number is likely understating true exposure. That's actionable intelligence for a PM today.

The historical S&P 500 chart provides instant macro context: where does current volatility sit relative to the Dot-com crash, GFC, and Covid? The correlation chart adds a second dimension: is the current stress broad-based (everything correlated) or idiosyncratic (one asset moving independently)? That framing matters for risk communication to clients and investment committees.


## What It Becomes with Fund-Specific Work

The real value for a PM comes from pointing this at *the actual portfolio* rather than benchmark indices. Near-term additions that would make this production-ready:

**Portfolio-level risk** — aggregate VaR across positions weighted by actual holdings. A $10M book with 40% SPY, 30% GLD, 30% BTC has a very different risk profile than the sum of its parts due to correlation. Portfolio VaR and component VaR (each position's contribution) is the natural next step.

**Correlation and diversification metrics** — show whether the portfolio is genuinely diversified or just holding assets that move together in a crisis (the correlation breakdown problem). This matters most when it matters most.

**Custom ticker list** — swap in the fund's actual holdings: individual equities, sector ETFs, FX pairs, commodity futures. The backend handles any ticker yfinance supports.

**Backtesting / VaR exceptions** — count how many days actual losses exceeded the VaR forecast. Regulators call these "exceptions." A well-calibrated model should produce roughly 2–3 per year at 1%. Showing this gives the PM and risk committee confidence in which model to trust.

**Threshold alerts** — flag when any asset's risk gauge crosses 80% or when VaR jumps more than X% day-over-day. Deliverable as email or Slack.

**PDF/scheduled reporting** — daily one-pager auto-generated and distributed to the investment committee. The data is already there; it's a rendering problem.


## Bottom Line

RiskLens in its current form is a functioning multi-model risk monitor with 35 years of S&P context, real-time metrics on twelve major assets, and a live cross-asset correlation chart that makes the diversification illusion visible. The infrastructure — Python risk engine, JSON data layer, React dashboard — is designed to scale. Pointing it at a real fund's book, adding portfolio aggregation, and wiring up alerts would take it from a well-built pilot to a daily risk tool a PM would actually rely on.
