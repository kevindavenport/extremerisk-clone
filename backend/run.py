import json
import os
import sys
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from fetch_data import (
    NAMES, TICKERS,
    TDF_2055_TICKERS, TDF_2055_NAMES,
    CG_2055_TICKERS, CG_2055_NAMES,
    compute_log_returns, fetch_prices, fetch_sp500_history, fetch_vix_history,
)
from risk_engine import (
    compute_asset_risk, compute_sp500_history, compute_rolling_correlation,
    compute_scenarios, compute_hypothetical_scenarios, CORR_TICKERS,
)

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "data", "risk_output.json")

# ---------------------------------------------------------------------------
# Hypothetical blended portfolio weights (must sum to 1.0)
#   Equity  60%: SPY 25, QQQ 12, EEM 8, IWM 7, XLF 5, CGUS 3
#   Fixed Income 30%: TLT 10, LQD 12, HYG 8
#   Real Assets  8%: GLD 5, VNQ 3
#   Crypto       2%: BTC-USD 2
# ---------------------------------------------------------------------------
HYPOTHETICAL_WEIGHTS = {
    "SPY":     0.25,
    "QQQ":     0.12,
    "EEM":     0.08,
    "IWM":     0.07,
    "XLF":     0.05,
    "CGUS":    0.03,
    "TLT":     0.10,
    "LQD":     0.12,
    "HYG":     0.08,
    "GLD":     0.05,
    "VNQ":     0.03,
    "BTC-USD": 0.02,
}

# ---------------------------------------------------------------------------
# Vanguard Target Retirement 2055 (VFFVX) underlying allocation
# Source: Vanguard fund holdings (publicly disclosed quarterly).
#   ~54% Total US Equity      → VTI
#   ~36% Total Intl Equity    → VXUS
#   ~7%  Total US Bonds       → BND
#   ~3%  Total Intl Bonds     → BNDX
# ---------------------------------------------------------------------------
TDF_2055_WEIGHTS = {
    "VTI":  0.54,
    "VXUS": 0.36,
    "BND":  0.07,
    "BNDX": 0.03,
}

# ---------------------------------------------------------------------------
# American Funds Target Date Retirement 2055 (AAFTX) underlying allocation
# Source: Capital Group fund fact sheet (top holdings, ~95% coverage)
#   ~89% Equity (mix of US, intl, EM, global) split across 10 active funds
#   ~11% Fixed Income across 2 active bond funds
# ---------------------------------------------------------------------------
CG_2055_WEIGHTS = {
    "AGTHX": 0.13,   # Growth Fund of America — US large growth
    "AIVSX": 0.11,   # Investment Company of America — US large blend
    "ANCFX": 0.11,   # Fundamental Investors — US large blend
    "AWSHX": 0.06,   # Washington Mutual — US value
    "AMRMX": 0.06,   # American Mutual — US dividend
    "ANWPX": 0.12,   # New Perspective — global equity
    "AEPGX": 0.11,   # EuroPacific Growth — intl developed
    "CWGIX": 0.09,   # Capital World Growth & Income — global income
    "NEWFX": 0.06,   # New World — emerging markets
    "SMCWX": 0.04,   # SMALLCAP World — global small cap
    "ABNDX": 0.07,   # Bond Fund of America — US core bonds
    "AMUSX": 0.04,   # US Government Securities — Treasuries
}

PORTFOLIO_MODES = {
    "hypothetical": {
        "label":       "Hypothetical Portfolio",
        "description": "An illustrative diversified mix: 60% equity, 30% fixed income, 8% real assets, 2% crypto. Built from 12 sector and asset-class ETFs.",
        "tickers":     TICKERS,
        "names":       NAMES,
        "weights":     HYPOTHETICAL_WEIGHTS,
        "name":        "60/40 Blended Portfolio",
    },
    "tdf_2055": {
        "label":       "Vanguard Target 2055 (VFFVX)",
        "description": "Underlying holdings of the Vanguard 2055 target-date fund: ~90% equity (54% US, 36% intl) and ~10% bonds (7% US, 3% intl). Built from 4 broad passive index ETFs.",
        "tickers":     TDF_2055_TICKERS,
        "names":       TDF_2055_NAMES,
        "weights":     TDF_2055_WEIGHTS,
        "name":        "Vanguard Target Retirement 2055",
    },
    "cg_2055": {
        "label":       "AF Target 2055 (AAFTX)",
        "description": "~89% equity, ~11% bonds, split across 12 actively-managed American Funds mutual funds.",
        "tickers":     CG_2055_TICKERS,
        "names":       CG_2055_NAMES,
        "weights":     CG_2055_WEIGHTS,
        "name":        "American Funds Target 2055",
    },
}


def compute_portfolio_row(returns: pd.DataFrame, weights: dict, name: str) -> dict:
    """
    Build a weighted portfolio return series and run all risk models on it.
    Uses the common date range across all tickers in `weights`.
    """
    avail = [t for t in weights if t in returns.columns]
    raw_weights = np.array([weights[t] for t in avail])
    norm_weights = raw_weights / raw_weights.sum()  # re-normalize if any ticker missing

    ret_df = returns[avail].dropna()
    port_rets = pd.Series(ret_df.values @ norm_weights, index=ret_df.index)

    # Synthetic NAV starting at $100 (for last_price display)
    port_prices = np.exp(port_rets.cumsum()) * 100

    print(f"  Portfolio: {len(port_rets)} trading days, {len(avail)} tickers, "
          f"weights sum={norm_weights.sum():.4f}")

    data = compute_asset_risk("PORTFOLIO", port_rets, port_prices)
    data["name"] = name
    data["is_portfolio"] = True
    data["weights"] = {t: round(float(weights[t]), 4) for t in weights}
    data["nav"] = round(float(port_prices.iloc[-1]), 2)
    return data


def compute_mode(prices_10y: pd.DataFrame, returns_10y: pd.DataFrame,
                 prices_long: pd.DataFrame, mode_cfg: dict) -> dict:
    """Compute everything needed for one portfolio mode."""
    tickers  = mode_cfg["tickers"]
    names    = mode_cfg["names"]
    weights  = mode_cfg["weights"]

    # Per-asset risk rows
    assets = []
    for ticker in tickers:
        if ticker not in returns_10y.columns:
            print(f"  WARNING: {ticker} not in 10y data, skipping")
            continue
        ret = returns_10y[ticker].dropna()
        px  = prices_10y[ticker].dropna()
        if len(ret) < 30:
            print(f"  WARNING: insufficient data for {ticker}, skipping")
            continue
        print(f"  Computing risk for {ticker}...")
        row = compute_asset_risk(ticker, ret, px)
        row["name"] = names.get(ticker, ticker)
        assets.append(row)

    # Portfolio summary row
    print("  Computing portfolio row...")
    port_row = compute_portfolio_row(returns_10y, weights, mode_cfg["name"])
    assets.append(port_row)

    # Scenarios — historical (data-driven) + hypothetical (shock-driven)
    print("  Computing scenarios...")
    hist = compute_scenarios(prices_long, weights)
    for s in hist:
        s["type"] = "historical"
    hypo = compute_hypothetical_scenarios(weights)
    scenarios = hist + hypo

    return {
        "label":       mode_cfg["label"],
        "description": mode_cfg["description"],
        "weights":     weights,
        "assets":      assets,
        "scenarios":   scenarios,
    }


def main():
    # Master ticker list — union of everything we need across all modes
    all_tickers = list(dict.fromkeys(TICKERS + TDF_2055_TICKERS + CG_2055_TICKERS))

    print("Fetching 10y price data...")
    prices_10y = fetch_prices(period="10y", tickers=all_tickers)
    print("Computing log returns...")
    returns_10y = compute_log_returns(prices_10y)

    print("Fetching 20y price data (for scenarios + correlation)...")
    prices_long = fetch_prices(period="20y", tickers=all_tickers)

    # Compute each portfolio mode
    portfolios = {}
    for key, cfg in PORTFOLIO_MODES.items():
        print(f"\n=== Mode: {cfg['label']} ===")
        portfolios[key] = compute_mode(prices_10y, returns_10y, prices_long, cfg)

    # S&P 500 historical chart
    print("\nFetching S&P 500 full history (^GSPC)...")
    sp500_returns, sp500_prices = fetch_sp500_history()
    print("Fetching VIX history...")
    vix = fetch_vix_history()
    print("  Computing yearly risk history...")
    sp500_history = compute_sp500_history(sp500_returns, sp500_prices, vix=vix)

    # Cross-asset correlation
    print("Computing rolling cross-asset correlation...")
    corr_cols = [c for c in CORR_TICKERS if c in prices_long.columns]
    corr_returns = compute_log_returns(prices_long[corr_cols])
    corr_history = compute_rolling_correlation(corr_returns)

    # Latest trading date represented in the asset price data (typically yesterday's close)
    data_as_of = prices_10y.index[-1].strftime("%Y-%m-%d")

    output = {
        "generated_at":        datetime.now(timezone.utc).isoformat(),
        "data_as_of":          data_as_of,
        "default_mode":        "hypothetical",
        "portfolios":          portfolios,
        "sp500_history":       sp500_history,
        "correlation_history": corr_history,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    counts = {k: len(p["assets"]) for k, p in portfolios.items()}
    print(f"\nWrote portfolios → {OUTPUT_PATH}")
    for k, n in counts.items():
        print(f"  {k}: {n} asset rows")


if __name__ == "__main__":
    main()
