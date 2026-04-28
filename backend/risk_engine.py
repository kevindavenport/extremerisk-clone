import numpy as np
import pandas as pd
from scipy.stats import norm, genpareto
from arch import arch_model

WINDOW = 1000
P = 0.01
PORTFOLIO_VALUE = 100
CAP = 100.0


def _cap(x: float) -> float:
    return min(float(x), CAP)


def var_es_hs(returns: np.ndarray, p: float = P) -> tuple[float, float]:
    """Historical Simulation VaR and ES."""
    T = len(returns)
    sorted_rets = np.sort(returns)
    idx = int(T * p)
    var = -sorted_rets[idx] * PORTFOLIO_VALUE
    es = -np.mean(sorted_rets[: idx + 1]) * PORTFOLIO_VALUE
    return _cap(var), _cap(es)


def var_es_ewma(returns: np.ndarray, p: float = P, lam: float = 0.94) -> tuple[float, float]:
    """EWMA volatility VaR and ES (normal assumption)."""
    var_t = np.var(returns[:30]) if len(returns) >= 30 else returns[0] ** 2
    for r in returns:
        var_t = (1 - lam) * r**2 + lam * var_t
    sigma = np.sqrt(var_t)

    z = norm.ppf(1 - p)
    var_val = sigma * z * PORTFOLIO_VALUE
    es_val = sigma * norm.pdf(norm.ppf(p)) / p * PORTFOLIO_VALUE
    return _cap(var_val), _cap(es_val)


def var_es_tgarch(returns: np.ndarray, p: float = P) -> tuple[float, float]:
    """GJR-GARCH(1,1,1) — asymmetric GARCH that weights negative shocks more heavily."""
    try:
        scaled = returns * 100
        am = arch_model(scaled, vol="GARCH", p=1, o=1, q=1, dist="normal", rescale=False)
        res = am.fit(disp="off", show_warning=False)
        forecast = res.forecast(horizon=1, reindex=False)
        var_forecast = forecast.variance.iloc[-1, 0]
        sigma = np.sqrt(var_forecast) / 100
        z = norm.ppf(1 - p)
        var_val = sigma * z * PORTFOLIO_VALUE
        es_val = sigma * norm.pdf(norm.ppf(p)) / p * PORTFOLIO_VALUE
        return _cap(var_val), _cap(es_val)
    except Exception:
        return var_es_ewma(returns, p)


def var_es_evt(returns: np.ndarray, p: float = P, threshold_pct: float = 0.10) -> tuple[float, float]:
    """Peaks-over-Threshold EVT using Generalized Pareto Distribution."""
    try:
        losses = -returns
        u = np.quantile(losses, 1 - threshold_pct)
        exceedances = losses[losses > u] - u
        if len(exceedances) < 10:
            return var_es_ewma(returns, p)
        xi, _, sigma = genpareto.fit(exceedances, floc=0)
        n = len(losses)
        Nu = len(exceedances)
        if abs(xi) < 1e-8:
            var = u + sigma * np.log(n / (Nu * p))
        else:
            var = u + (sigma / xi) * ((n / (Nu * p)) ** xi - 1)
        if xi < 1:
            es = (var + sigma - xi * u) / (1 - xi)
        else:
            es = var * 1.5
        return _cap(var * PORTFOLIO_VALUE), _cap(es * PORTFOLIO_VALUE)
    except Exception:
        return var_es_hs(returns, p)


def tail_index_hill(returns: np.ndarray) -> float:
    """Hill estimator for tail index alpha. Lower = fatter tails."""
    losses = np.sort(-returns)[::-1]
    k = max(10, int(len(losses) ** 0.5))
    k = min(k, len(losses) - 1)
    alpha = k / np.sum(np.log(losses[:k] / losses[k]))
    return round(float(alpha), 2)


def var_es_garch(returns: np.ndarray, p: float = P) -> tuple[float, float]:
    """GARCH(1,1) VaR and ES with fallback to EWMA."""
    try:
        scaled = returns * 100
        am = arch_model(scaled, vol="GARCH", p=1, q=1, dist="normal", rescale=False)
        res = am.fit(disp="off", show_warning=False)
        forecast = res.forecast(horizon=1, reindex=False)
        var_forecast = forecast.variance.iloc[-1, 0]
        sigma = np.sqrt(var_forecast) / 100

        z = norm.ppf(1 - p)
        var_val = sigma * z * PORTFOLIO_VALUE
        es_val = sigma * norm.pdf(norm.ppf(p)) / p * PORTFOLIO_VALUE
        return _cap(var_val), _cap(es_val)
    except Exception:
        return var_es_ewma(returns, p)


def compute_risk_level(ticker_returns: pd.Series, window: int = WINDOW) -> float:
    """
    Percentile rank of current EWMA VaR vs trailing 2-year (504 trading day) history.
    Returns a value in [0, 1].
    """
    history_window = 504
    if len(ticker_returns) < window + history_window:
        return 0.5

    ewma_vars = []
    lam = 0.94
    for i in range(history_window):
        end = len(ticker_returns) - history_window + i + 1
        start = max(0, end - window)
        chunk = ticker_returns.values[start:end]
        _, es = var_es_ewma(chunk)
        ewma_vars.append(es)

    current_var, _ = var_es_ewma(ticker_returns.values[-window:])
    rank = np.mean(np.array(ewma_vars) <= current_var)
    return float(np.clip(rank, 0.0, 1.0))


def compute_daily_ewma_var(returns: pd.Series, p: float = P, lam: float = 0.94, warmup: int = 252) -> pd.Series:
    """Daily EWMA VaR series for the full return history."""
    z = norm.ppf(1 - p)
    vals = returns.values
    var_t = np.var(vals[:warmup]) if len(vals) >= warmup else np.var(vals)
    results = np.full(len(vals), np.nan)
    for i, r in enumerate(vals):
        if i >= warmup:
            results[i] = np.sqrt(var_t) * z * PORTFOLIO_VALUE
        var_t = (1 - lam) * r ** 2 + lam * var_t
    return pd.Series(results, index=returns.index)


def compute_sp500_history(returns: pd.Series, prices: pd.Series, vix: pd.Series = None) -> list[dict]:
    """Per-year min/max EWMA VaR and annual return for the S&P 500 historical chart."""
    daily_var = compute_daily_ewma_var(returns)
    daily_var = daily_var.dropna()

    # Annual return: last price of year / first price of year - 1
    annual_ret = prices.resample("YE").last().pct_change() * 100

    # Annual average VIX per year
    vix_annual = {}
    if vix is not None:
        for year, group in vix.groupby(vix.index.year):
            vix_annual[year] = round(float(group.mean()), 2)

    rows = []
    for year, group in daily_var.groupby(daily_var.index.year):
        if len(group) < 20:
            continue
        ret = float(annual_ret[annual_ret.index.year == year].iloc[0]) if year in annual_ret.index.year else None
        rows.append({
            "year": year,
            "min_var": round(float(group.min()), 2),
            "max_var": round(float(group.max()), 2),
            "annual_return_pct": round(ret, 2) if ret is not None else None,
            "vix_avg": vix_annual.get(year),
        })
    return rows


# Tickers with sufficient history for the cross-asset correlation chart.
# Excludes CGUS (launched 2022) and BTC-USD (launched 2014) so the series
# starts ~2007 and captures the GFC.
CORR_TICKERS = ["SPY", "QQQ", "GLD", "TLT", "EEM", "IWM", "HYG", "LQD", "XLF", "VNQ"]


def compute_rolling_correlation(returns: pd.DataFrame, window: int = 60, sample_every: int = 5) -> list[dict]:
    """
    Rolling average pairwise correlation across core ETFs.
    Returns a list of {date, avg_corr} sampled every `sample_every` trading days.
    """
    cols = [c for c in CORR_TICKERS if c in returns.columns]
    df = returns[cols].dropna()

    n = len(cols)
    results = []
    for i in range(window, len(df), sample_every):
        chunk = df.iloc[i - window:i]
        corr_matrix = chunk.corr().values
        # Mean of upper triangle (excluding diagonal)
        pairs = [corr_matrix[r, c] for r in range(n) for c in range(r + 1, n)]
        avg_corr = float(np.nanmean(pairs))
        results.append({
            "date": df.index[i].strftime("%Y-%m-%d"),
            "avg_corr": round(avg_corr, 4),
        })
    return results


def compute_var_trend(daily_var: pd.Series, days: int = 5) -> str:
    """Direction of EWMA VaR over the last `days` trading days."""
    series = daily_var.dropna()
    if len(series) < days + 1:
        return "flat"
    current = series.iloc[-1]
    past = series.iloc[-(days + 1)]
    if past == 0:
        return "flat"
    change = (current - past) / past
    if change > 0.05:
        return "up"
    elif change < -0.05:
        return "down"
    return "flat"


def compute_var_exceptions(returns: pd.Series, daily_var: pd.Series, lookback: int = 504) -> dict:
    """
    Count days in the last `lookback` trading days where actual loss exceeded EWMA VaR.
    Expected rate at 1% confidence: ~1% (~5 per year, ~10 over 2 years).
    """
    series = daily_var.dropna()
    recent_var = series.iloc[-lookback:]
    recent_ret = returns.reindex(recent_var.index)
    df = pd.DataFrame({"var": recent_var, "ret": recent_ret}).dropna()
    # Actual loss in dollar terms on $100 portfolio
    actual_loss = -df["ret"] * 100
    exceptions = int((actual_loss > df["var"]).sum())
    total = len(df)
    rate = round(exceptions / total * 100, 2) if total > 0 else 0.0
    return {"exception_count": exceptions, "exception_rate": rate}


def compute_asset_risk(ticker: str, returns: pd.Series, prices: pd.Series) -> dict:
    if len(returns) < WINDOW:
        window_rets = returns.values
    else:
        window_rets = returns.values[-WINDOW:]

    var_hs, es_hs = var_es_hs(window_rets)
    var_ewma, es_ewma = var_es_ewma(window_rets)
    var_garch, es_garch = var_es_garch(window_rets)
    var_tgarch, es_tgarch = var_es_tgarch(window_rets)
    var_evt, es_evt = var_es_evt(window_rets)
    alpha = tail_index_hill(window_rets)

    mean_var = round(float(np.mean([var_hs, var_ewma, var_garch, var_tgarch, var_evt])), 4)

    risk_level = compute_risk_level(returns)

    # Compute daily EWMA VaR series once — reused for trend and exceptions
    daily_var_series = compute_daily_ewma_var(returns)
    trend = compute_var_trend(daily_var_series)
    exc = compute_var_exceptions(returns, daily_var_series)

    last_price = float(prices.iloc[-1])
    # Use second-to-last return when the last row is a forward-fill artifact (yfinance
    # sometimes appends today's incomplete trading day with 0% change for closed markets)
    last_ret = float(returns.iloc[-1])
    if last_ret == 0.0 and len(returns) > 1:
        last_ret = float(returns.iloc[-2])
    last_return_pct = last_ret * 100

    return {
        "ticker": ticker,
        "last_price": round(last_price, 2),
        "last_return_pct": round(last_return_pct, 4),
        "var_hs": round(var_hs, 4),
        "es_hs": round(es_hs, 4),
        "var_ewma": round(var_ewma, 4),
        "es_ewma": round(es_ewma, 4),
        "var_garch": round(var_garch, 4),
        "es_garch": round(es_garch, 4),
        "var_tgarch": round(var_tgarch, 4),
        "es_tgarch": round(es_tgarch, 4),
        "var_evt": round(var_evt, 4),
        "es_evt": round(es_evt, 4),
        "tail_index": alpha,
        "mean_var": mean_var,
        "risk_level": round(risk_level, 4),
        "var_trend": trend,
        "exception_count": exc["exception_count"],
        "exception_rate": exc["exception_rate"],
    }


# ---------------------------------------------------------------------------
# Historical scenario analysis
# ---------------------------------------------------------------------------

SCENARIOS = [
    {
        "id": "gfc",
        "name": "Global Financial Crisis",
        "desc": "Lehman Brothers collapse triggers global credit freeze",
        "start": "2008-09-15",
        "end": "2009-03-09",
    },
    {
        "id": "covid",
        "name": "COVID Crash",
        "desc": "Pandemic panic selling, fastest 30% drop in S&P history",
        "start": "2020-02-20",
        "end": "2020-03-23",
    },
    {
        "id": "rate_shock_2022",
        "name": "Fed Rate Shock 2022",
        "desc": "Most aggressive hiking cycle in 40 years breaks stocks AND bonds",
        "start": "2022-01-03",
        "end": "2022-10-12",
    },
    {
        "id": "russia_ukraine",
        "name": "Russia–Ukraine Invasion",
        "desc": "Full-scale invasion triggers energy shock and risk-off selloff",
        "start": "2022-02-24",
        "end": "2022-03-14",
    },
    {
        "id": "q4_2018",
        "name": "Q4 2018 Sell-off",
        "desc": "Fed tightening fears and trade war escalation hit markets",
        "start": "2018-10-03",
        "end": "2018-12-24",
    },
]


# ---------------------------------------------------------------------------
# Hypothetical / forward-looking scenarios
# Shocks are analyst-estimated % moves per ETF under each scenario.
# These are illustrative assumptions, not forecasts.
# ---------------------------------------------------------------------------

HYPOTHETICAL_SCENARIOS = [
    {
        "id": "taiwan_invasion",
        "name": "Taiwan Invasion",
        "desc": "PLA military action triggers semiconductor supply shock and broad Asia risk-off",
        "shocks": {
            "SPY":     -0.15,
            "QQQ":     -0.22,   # TSMC/NVDA/ASML heavy in Nasdaq
            "GLD":     +0.14,   # flight to safety
            "TLT":     +0.09,   # flight to safety, rate cut expectations
            "EEM":     -0.22,   # EM Asia exposure
            "BTC-USD": -0.28,   # crypto risk-off
            "IWM":     -0.14,
            "HYG":     -0.09,   # credit spread widening
            "LQD":     +0.02,
            "XLF":     -0.11,
            "VNQ":     -0.10,
            "CGUS":    -0.15,
        },
    },
    {
        "id": "iran_conflict",
        "name": "Iran Conflict / Oil Shock",
        "desc": "Strait of Hormuz disruption drives oil toward $150, stagflation fears spike",
        "shocks": {
            "SPY":     -0.09,
            "QQQ":     -0.08,
            "GLD":     +0.13,   # oil/safe haven
            "TLT":     +0.04,
            "EEM":     -0.13,
            "BTC-USD": -0.18,
            "IWM":     -0.09,
            "HYG":     -0.07,
            "LQD":     +0.01,
            "XLF":     -0.08,
            "VNQ":     -0.07,
            "CGUS":    -0.09,
        },
    },
    {
        "id": "us_recession",
        "name": "U.S. Recession",
        "desc": "GDP contraction triggers Fed pivot, credit spreads widen, earnings fall",
        "shocks": {
            "SPY":     -0.28,
            "QQQ":     -0.32,
            "GLD":     +0.08,
            "TLT":     +0.18,   # aggressive rate cuts
            "EEM":     -0.22,
            "BTC-USD": -0.45,
            "IWM":     -0.32,   # small caps hit hardest
            "HYG":     -0.16,   # high yield blowout
            "LQD":     +0.04,
            "XLF":     -0.30,   # financials crater
            "VNQ":     -0.22,
            "CGUS":    -0.28,
        },
    },
    {
        "id": "ai_bubble_burst",
        "name": "AI Bubble Burst",
        "desc": "Demand disappointment or capex reality check causes mega-cap tech repricing",
        "shocks": {
            "SPY":     -0.18,
            "QQQ":     -0.35,   # highest concentration in AI names
            "GLD":     +0.05,
            "TLT":     +0.08,
            "EEM":     -0.10,
            "BTC-USD": -0.30,   # correlated risk-off
            "IWM":     -0.12,
            "HYG":     -0.08,
            "LQD":     +0.02,
            "XLF":     -0.14,
            "VNQ":     -0.08,
            "CGUS":    -0.18,
        },
    },
]


def compute_hypothetical_scenarios(weights: dict) -> list[dict]:
    """
    Apply analyst-estimated shock vectors to portfolio weights.
    No historical price data required — pure assumption-based stress test.
    """
    results = []
    for s in HYPOTHETICAL_SCENARIOS:
        shocks  = s["shocks"]
        avail   = [t for t in weights if t in shocks]
        raw_w   = {t: weights[t] for t in avail}
        total_w = sum(raw_w.values())
        norm_w  = {t: w / total_w for t, w in raw_w.items()}

        port_return   = sum(shocks[t] * norm_w[t] for t in avail)
        contributions = {t: round(shocks[t] * norm_w[t] * 100, 2) for t in avail}

        results.append({
            "id":            s["id"],
            "name":          s["name"],
            "desc":          s["desc"],
            "type":          "hypothetical",
            "portfolio_pnl": round(port_return * 100, 2),
            "coverage_pct":  round(total_w * 100, 1),
            "asset_returns": {t: round(shocks[t] * 100, 1) for t in avail},
            "contributions": contributions,
        })
    return results


def compute_scenarios(prices: pd.DataFrame, weights: dict) -> list[dict]:
    """
    For each historical scenario, compute portfolio and per-asset total returns
    over the scenario date range. Missing tickers (e.g. BTC pre-2014, CGUS pre-2022)
    are excluded and weights re-normalized so the portfolio return is still meaningful.
    """
    results = []

    for s in SCENARIOS:
        start = pd.Timestamp(s["start"])
        end   = pd.Timestamp(s["end"])

        mask   = (prices.index >= start) & (prices.index <= end)
        window = prices[mask].copy()

        if len(window) < 2:
            continue

        # Only include tickers that have full non-NaN data across the window
        avail = [
            t for t in weights
            if t in window.columns and window[t].notna().sum() >= 2
        ]
        if not avail:
            continue

        # Total return per ticker: (last / first) - 1
        asset_returns = {}
        for t in avail:
            series = window[t].dropna()
            if len(series) >= 2:
                asset_returns[t] = float(series.iloc[-1] / series.iloc[0] - 1)

        if not asset_returns:
            continue

        # Re-normalize weights to available tickers
        raw_w   = {t: weights[t] for t in asset_returns}
        total_w = sum(raw_w.values())
        norm_w  = {t: w / total_w for t, w in raw_w.items()}

        # Portfolio return (normalized weights)
        port_return = sum(asset_returns[t] * norm_w[t] for t in asset_returns)

        # Per-asset contribution = return × normalized weight
        contributions = {
            t: round(asset_returns[t] * norm_w[t] * 100, 2)
            for t in asset_returns
        }

        results.append({
            "id":               s["id"],
            "name":             s["name"],
            "desc":             s["desc"],
            "start":            s["start"],
            "end":              s["end"],
            "portfolio_pnl":    round(port_return * 100, 2),
            "coverage_pct":     round(total_w * 100, 1),
            "asset_returns":    {t: round(v * 100, 2) for t, v in asset_returns.items()},
            "contributions":    contributions,
        })

    return results
