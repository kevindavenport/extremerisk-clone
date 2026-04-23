# RiskLens — FAQ

Running list of questions from demos, reviews, and conversations. Updated as new ones come in.


## The basics

**Where does the data come from? Is it free?**
All price data is pulled from Yahoo Finance via a Python library called yfinance. Completely free, no API key required. It gives us daily adjusted closing prices — adjusted means splits and dividends are already baked in. There's roughly a one-day lag: if you run it after 4pm ET you get yesterday's close.

**How often does it update?**
The live site at kldgh.github.io/risklens refreshes automatically every weekday at 6:30am UTC via a scheduled GitHub Actions job. You can also trigger a manual refresh any time from the GitHub Actions tab.

**Is anything being pulled from a risk data vendor?**
No. The only thing fetched externally is raw closing prices. Every single metric in the table — VaR, ES, GARCH fits, EVT tail fits, the correlation series, the risk gauge percentile, the exception rates — is computed locally in Python on each run. The methodology is fully in the open in `backend/risk_engine.py`.


## The risk table

**Why are there five VaR columns? Can't you just pick one?**
The disagreement between models is itself the signal. When Historical Simulation says 2.1, EWMA says 1.9, and EVT says 6.7 — that spread tells you the asset has fat tails that normal-distribution models are missing. A single number hides that. The Range column (far right) makes the spread explicit: tight range means models agree, wide range means something structural is going on in the tail.

**Why 1-day VaR and not weekly or monthly?**
Convention, and it matches the liquidity assumption. For liquid ETFs you can exit a position in one day, so the relevant risk horizon is one day. Basel originally standardized on 10-day VaR (scaling 1-day by √10) but the industry mostly works in 1-day and scales when needed.

**What does the VaR number actually mean?**
Read it as: on the worst 1% of trading days historically, you'd lose at least this many dollars on a $100 position. SPY showing 2.10 means a genuinely bad day costs about 2.1% of notional. It's a floor estimate, not a ceiling — things can always be worse.

**What's the difference between VaR and ES? They sound the same.**
They're related but different. VaR tells you where the bad days start — the threshold. ES (also called CVaR — same thing, different name depending on who you learned it from) tells you how bad things are on average once you're past that threshold. ES is always larger than VaR. Regulators now prefer ES over VaR (Basel III/IV) precisely because it describes the shape of the tail, not just its starting point.

**What is the Consensus column?**
A simple average across all five VaR models. Treat it as a rough heuristic reference point, not a precise estimate — it has no theoretical grounding as a risk measure. It's useful for a quick single-number comparison across assets but the Range column is more informative.

**What is the Range column?**
Min and max VaR across all five models. When the range is tight, the models agree and standard assumptions hold. When it's wide — usually EVT pulling high — the asset's tail losses are more extreme than normal-distribution models assume. The color coding makes this visible: grey = tight, yellow = some divergence, red = EVT is seeing something significant.

**What is the α tail column?**
The tail index from Extreme Value Theory, estimated using the Hill estimator. Lower values mean fatter tails — more extreme events are possible than standard models assume. Broad equity indices (SPY, QQQ) typically sit around 3–4. Individual stocks have fatter tails than indices because index diversification smooths out idiosyncratic blowups — individual names often come in at 2–4. Gold and crypto frequently fall below 3. Long-duration treasuries like TLT can also be surprisingly fat-tailed, especially after 2022. Assets below 3 have meaningfully more tail risk than standard normal-distribution models assume.

**What is the Risk gauge?**
The most actionable number in the table. It's not absolute risk — it's the percentile rank of today's EWMA VaR vs the trailing two years of daily values for that specific asset. 85% means this asset is more volatile right now than it's been on 85% of days in the past two years. This matters because it accounts for each asset's own volatility regime: Bitcoin at 5% VaR might be perfectly normal; SPY at 5% VaR would be extreme.

**What do the arrows next to the Risk gauge mean?**
A 5-day trend indicator. ↑ in red means VaR has been rising — risk is building. ↓ in green means VaR has been falling — conditions are easing. Hover over any risk bar for the full per-asset detail including the trend explanation and exception rate.

**What are VaR exceptions?**
A day where the actual loss exceeded what the VaR model predicted. At 1% confidence, you expect roughly 1% of days to be exceptions — about 5 per year, 10 over 2 years. If an asset is running at 3-4%, EWMA is systematically underestimating tail risk for that asset and you should weight EVT estimates more heavily. You can see this in the hover tooltip on each risk bar.


## The charts

**What is the S&P 500 Risk and Losses chart showing?**
Three things at once for each year back to 1990: the calmest day's risk estimate (green bar), the most stressed day's risk estimate (blue bar), and the annual return when it was negative (red bar). The VIX line (amber, right axis) shows the market's own fear gauge — the annual average implied volatility priced into options. The key insight is that the blue bars spike during crises — the model sees stress building in real time — while the red bars only confirm the damage after the fact.

**Why does the VIX line matter?**
VIX is forward-looking in a way that our other models aren't. It reflects what options traders are paying to hedge — it's a market consensus on expected volatility for the next 30 days. Our VaR models are backward-looking (based on historical returns). When VIX spikes above our EWMA VaR estimates, the market is pricing in more stress than recent history suggests. That divergence is worth paying attention to.

**What is the Cross-Asset Correlation chart?**
Rolling 60-day average pairwise correlation across 10 core ETFs (SPY, QQQ, GLD, TLT, EEM, IWM, HYG, LQD, XLF, VNQ) going back to 2007. In normal markets this sits around 0.15–0.35 — assets move somewhat independently and diversification works. When it spikes, everything is moving together and diversification collapses.

**Why is 2022 the peak and not the GFC?**
This is the most counterintuitive finding in the data. In the GFC (2008-09), equities crashed but treasuries and gold surged — flight to safety kept average pairwise correlation moderate. In 2022, the Fed's aggressive rate hiking cycle caused stocks AND bonds to sell off simultaneously, breaking the traditional 60/40 hedge. The correlation hit 0.70 — the highest in the dataset. The correlation breakdown problem is most dangerous in inflation and rate shocks, not just in equity crashes.


## What would I actually do with this?

**What actions should I take based on these numbers?**
VaR alone doesn't tell you to do anything specific — it's a monitoring tool, not a signal generator. What it's useful for: position sizing (if BTC VaR is $12 on $100, a bad day costs 12% of notional — you might reduce size), risk budget allocation (no single asset should represent more than X% of portfolio daily loss), and regime awareness (multiple assets at 90%+ risk gauge simultaneously is a macro stress signal).

**Would this have helped historically?**
Mixed. The risk gauge would have been elevated going into 2008 and March 2020 — volatility was building before the crash peaks. But VaR is procyclical: it's low when markets are calm and spikes during the crash, not before it. You'd have seen the warning as it was already happening, not weeks ahead. The correlation chart is more interesting as a leading indicator — correlation was rising in late 2007 before the GFC peaked. The honest answer: VaR tells you how bad things are, not how bad they're about to get.

**What would make it genuinely predictive?**
A few additions with actual forward-looking evidence: (1) VaR trajectory — is risk trending up or down over 5 days? Already implemented via the arrows. (2) VaR exceptions — is the model systematically underestimating for a given asset? Already implemented in the hover tooltip. (3) VIX as a forward-looking overlay — already on the historical chart. (4) Term structure — comparing 1-day vs 20-day VaR ratios to detect structural stress building. Not yet built. (5) Options-implied vol per asset from the options chain — most forward-looking but most complex to implement.

**What's missing to make this production-ready for a real fund?**
The biggest gap is portfolio-level risk. Everything currently is per-asset. A real portfolio with $10M across 12 positions has a very different risk profile than the sum of its parts due to correlation. The natural next step is portfolio VaR (aggregate across positions weighted by actual holdings) and component VaR (each position's contribution to total portfolio risk). The correlation work already points toward this — it just needs the holdings layer on top.


## Technical

**Is all the math done from scratch?**
Yes for everything except the GARCH fitting, which uses the `arch` Python library. Historical simulation, EWMA, EVT, the Hill estimator, the risk gauge percentile rank, VaR exceptions, rolling correlation — all implemented directly in `backend/risk_engine.py`.

**Why five models? Isn't that redundant?**
They span fundamentally different approaches: non-parametric (HS), parametric with fast decay (EWMA), conditional volatility (GARCH), asymmetric volatility (tGARCH), and tail-specific (EVT). They make different assumptions and fail in different regimes. Having all five lets you see model disagreement directly rather than trusting a single number. When EVT diverges significantly from the others, that's a specific, actionable signal about tail behavior.

**Why does the correlation chart only go back to 2007 and not further?**
The shortest-history ticker in the correlation basket is HYG (launched April 2007). We exclude CGUS (launched 2022) and BTC-USD (launched 2014) from the correlation calculation specifically to preserve the longer history — otherwise the series would start in 2022 and miss the GFC entirely.

**Doesn't the high correlation between SPY and QQQ distort the average — double counting equity exposure?**
It influences the absolute level of the average but not the signal. SPY and QQQ are typically 0.95+ correlated, so that pair is always pulling the average up. But since it's always there, its contribution to the level is constant — what changes the average over time is when normally uncorrelated pairs start moving together. The most informative pairs in the basket are the cross-asset ones: SPY/GLD, TLT/SPY, HYG/TLT. In normal markets those correlations are low or negative. When they spike — as in 2022 when stocks and bonds both sold off — that's what drives the chart up. The SPY/QQQ pair being perpetually high is almost irrelevant to the regime signal.

A more rigorous version would use a weighted average that downweights highly collinear pairs — for example weighting each pair inversely by its long-run average correlation, or using PCA to weight by independent variance explained. That would lower the baseline level and give more signal weight to cross-asset relationships. A reasonable version 2 enhancement if the methodology gets scrutinized closely.
