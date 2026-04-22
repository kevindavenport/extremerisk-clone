import json
import os
import sys
from datetime import datetime, timezone

from fetch_data import NAMES, TICKERS, compute_log_returns, fetch_prices, fetch_sp500_history
from risk_engine import compute_asset_risk, compute_sp500_history, compute_rolling_correlation, CORR_TICKERS

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "data", "risk_output.json")


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

    print("Fetching S&P 500 full history (^GSPC)...")
    sp500_returns, sp500_prices = fetch_sp500_history()
    print("  Computing yearly risk history...")
    sp500_history = compute_sp500_history(sp500_returns, sp500_prices)

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
        "sp500_history": sp500_history,
        "correlation_history": corr_history,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nWrote {len(assets)} assets to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
