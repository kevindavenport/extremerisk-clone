import yfinance as yf
import pandas as pd
import numpy as np



TICKERS = [
    "SPY", "QQQ", "GLD", "TLT", "EEM", "BTC-USD",
    "IWM", "HYG", "LQD", "XLF", "VNQ",
]

NAMES = {
    "SPY":    "S&P 500 ETF",
    "QQQ":    "Nasdaq 100 ETF",
    "GLD":    "Gold ETF",
    "TLT":    "20yr Treasury ETF",
    "EEM":    "Emerging Markets ETF",
    "BTC-USD":"Bitcoin / USD",
    "IWM":    "Russell 2000 ETF",
    "HYG":    "High Yield Bond ETF",
    "LQD":    "Investment Grade Bond ETF",
    "XLF":    "Financial Sector ETF",
    "VNQ":    "Real Estate ETF",
}

# Underlying holdings of Vanguard Target Retirement 2055 (VFFVX),
# mapped to ETF equivalents for transparent daily NAV access.
TDF_2055_TICKERS = ["VTI", "VXUS", "BND", "BNDX"]

TDF_2055_NAMES = {
    "VTI":  "Vanguard Total Stock Market ETF",
    "VXUS": "Vanguard Total International Stock ETF",
    "BND":  "Vanguard Total Bond Market ETF",
    "BNDX": "Vanguard Total International Bond ETF",
}

# Underlying holdings of American Funds Target Date Retirement 2055 (AAFTX).
# Capital Group TDFs hold actively-managed American Funds mutual funds, not
# ETFs — so the layered structure is materially different from Vanguard.
CG_2055_TICKERS = [
    "AGTHX", "AIVSX", "ANCFX", "AWSHX", "AMRMX",
    "ANWPX", "AEPGX", "CWGIX", "NEWFX", "SMCWX",
    "ABNDX", "AMUSX",
]

CG_2055_NAMES = {
    "AGTHX": "Growth Fund of America",
    "AIVSX": "Investment Company of America",
    "ANCFX": "Fundamental Investors",
    "AWSHX": "Washington Mutual Investors",
    "AMRMX": "American Mutual Fund",
    "ANWPX": "New Perspective Fund",
    "AEPGX": "EuroPacific Growth Fund",
    "CWGIX": "Capital World Growth & Income",
    "NEWFX": "New World Fund",
    "SMCWX": "SMALLCAP World Fund",
    "ABNDX": "Bond Fund of America",
    "AMUSX": "U.S. Government Securities Fund",
}


def fetch_prices(period: str = "10y", tickers: list = None) -> pd.DataFrame:
    if tickers is None:
        tickers = TICKERS

    frames = {}
    for ticker in tickers:
        try:
            raw = yf.download(ticker, period=period, auto_adjust=True,
                              progress=False, threads=False)
            if isinstance(raw.columns, pd.MultiIndex):
                col = raw["Close"].iloc[:, 0]
            else:
                col = raw["Close"]
            frames[ticker] = col
        except Exception as e:
            print(f"  WARNING: failed to download {ticker}: {e}")

    prices = pd.DataFrame(frames)
    prices = prices.reindex(columns=tickers)

    # Forward-fill gaps (handles BTC weekend data and other missing values)
    prices = prices.ffill()

    return prices


def compute_log_returns(prices: pd.DataFrame) -> pd.DataFrame:
    return np.log(prices / prices.shift(1)).dropna()

# TODO: Explore not going back as far given what we want to visualize (70s-80s)

def fetch_vix_history() -> pd.Series:
    """Fetch VIX index history for overlay on the S&P 500 chart."""
    raw = yf.download("^VIX", period="max", auto_adjust=True,
                      progress=False, threads=False)
    if isinstance(raw.columns, pd.MultiIndex):
        prices = raw["Close"].iloc[:, 0]
    else:
        prices = raw["Close"]
    return prices.ffill().dropna()


def fetch_sp500_history() -> tuple[pd.Series, pd.Series]:
    """Fetch maximum available S&P 500 history (^GSPC, back to 1927)."""
    raw = yf.download("^GSPC", period="max", auto_adjust=True,
                      progress=False, threads=False)
    if isinstance(raw.columns, pd.MultiIndex):
        prices = raw["Close"].iloc[:, 0]
    else:
        prices = raw["Close"]
    prices = prices.ffill().dropna()
    returns = np.log(prices / prices.shift(1)).dropna()
    return returns, prices
