import json
import os
import sys
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from fetch_data import NAMES, TICKERS, compute_log_returns, fetch_prices, fetch_sp500_history, fetch_vix_history
from risk_engine import compute_asset_risk, compute_sp500_history, compute_rolling_correlation, CORR_TICKERS

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "data", "risk_output.json")

# ---------------------------------------------------------------------------
# Hypothetical blended portfolio weights (must sum to 1.0)
#   Equity  60%: SPY 25, QQQ 12, EEM 8, IWM 7, XLF 5, CGUS 3
#   Fixed Income 30%: TLT 10, LQD 12, HYG 8
#   Real Assets  8%: GLD 5, VNQ 3
#   Crypto       2%: BTC-USD 2
# ---------------------------------------------------------------------------
PORTFOLIO_WEIGHTS = {
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


def compute_portfolio_row(returns: pd.DataFrame, prices: pd.DataFrame) -> dict:
    """
    Build a weighted portfolio return series and run all risk models on it.
    Uses the common date range across all tickers in PORTFOLIO_WEIGHTS.
    """
    avail = [t for t in PORTFOLIO_WEIGHTS if t in returns.columns]
    raw_weights = np.array([PORTFOLIO_WEIGHTS[t] for t in avail])
    weights = raw_weights / raw_weights.sum()           # re-normalize if any ticker missing

    # Align on common dates — dropna ensures we only use rows where all tickers traded
    ret_df = returns[avail].dropna()
    port_rets = pd.Series(ret_df.values @ weights, index=ret_df.index)

    # Synthetic NAV starting at $100 (for last_price display)
    port_prices = np.exp(port_rets.cumsum()) * 100

    print(f"  Portfolio: {len(port_rets)} trading days, {len(avail)} tickers, "
          f"weights sum={weights.sum():.4f}")

    data = compute_asset_risk("PORTFOLIO", port_rets, port_prices)
    data["name"] = "60/40 Blended Portfolio"
    data["is_portfolio"] = True
    data["weights"] = {t: round(float(PORTFOLIO_WEIGHTS[t]), 4) for t in PORTFOLIO_WEIGHTS}
    # Show NAV as last_price (starts at $100)
    data["nav"] = round(float(port_prices.iloc[-1]), 2)
    return data


def main():
    print("Fetching price data...")
    prices = fetch_prices(period="10y")

    print("Computing log returns...")
    returns = compute_log_returns(prices)

    assets = []
    for ticker in TICKERS:
        if ticker not in returns.columns:
            print(f"  WARNING: {ticker} not found in data, skipping")
            continue

        ticker_returns = returns[ticker].dropna()
        ticker_prices = prices[ticker].dropna()

        if len(ticker_returns) < 30:
            print(f"  WARNING: insufficient data for {ticker}, skipping")
            continue

        print(f"  Computing risk for {ticker}...")
        asset_data = compute_asset_risk(ticker, ticker_returns, ticker_prices)
        asset_data["name"] = NAMES.get(ticker, ticker)
        assets.append(asset_data)

    print("  Computing portfolio row...")
    portfolio_data = compute_portfolio_row(returns, prices)
    assets.append(portfolio_data)

    print("Fetching S&P 500 full history (^GSPC)...")
    sp500_returns, sp500_prices = fetch_sp500_history()
    print("Fetching VIX history...")
    vix = fetch_vix_history()
    print("  Computing yearly risk history...")
    sp500_history = compute_sp500_history(sp500_returns, sp500_prices, vix=vix)

    print("Computing rolling cross-asset correlation...")
    # Fetch a longer history for the correlation chart (20y) so GFC/COVID are both visible.
    # Uses only CORR_TICKERS so late-starting assets (CGUS) don't truncate the series.
    print("  Fetching 20y price history for correlation tickers...")
    corr_prices_long = fetch_prices(period="20y")
    corr_cols = [c for c in CORR_TICKERS if c in corr_prices_long.columns]
    corr_returns = compute_log_returns(corr_prices_long[corr_cols])
    corr_history = compute_rolling_correlation(corr_returns)

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "assets": assets,
        "portfolio_weights": PORTFOLIO_WEIGHTS,
        "sp500_history": sp500_history,
        "correlation_history": corr_history,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nWrote {len(assets)} assets to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
