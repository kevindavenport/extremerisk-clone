# RiskLens

A financial market risk dashboard modelled on extremerisk.org. Computes 1% VaR and ES for six major assets using three volatility models, displayed in a dark quant-terminal UI.

**Assets:** SPY · QQQ · GLD · TLT · EEM · BTC-USD

---

## Setup

### Requirements

- Python 3.10+
- Node.js 18+ (for the frontend)

### 1. Clone and enter the repo

```bash
git clone <your-repo-url>
cd risklens
```

### 2. Python environment

Create an isolated environment (strongly recommended):

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r backend/requirements.lock.txt
```

> `requirements.lock.txt` has exact pins for reproducibility.
> Use `requirements.txt` if you want loose bounds and don't care about pinning.

### 3. Generate risk data

```bash
python backend/run.py
```

This fetches ~10 years of price data from yfinance and writes `data/risk_output.json`.
Takes ~30–60 seconds the first time.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### One-shot (runs backend then starts dev server)

```bash
./run_all.sh
```

---

## Risk models

| Model | Description |
|-------|-------------|
| **HS** | Historical Simulation — empirical quantile over 1000-day return window |
| **EWMA** | Exponentially Weighted MA volatility (λ=0.94), normal distribution |
| **GARCH(1,1)** | Conditional volatility via `arch`, normal innovations; falls back to EWMA on fit failure |

All figures are **1% VaR / ES**, expressed as **dollar loss on a $100 portfolio**.

**Risk gauge** — percentile rank of today's EWMA VaR vs the trailing 2-year history of daily EWMA VaR for that ticker. 0 = historically calm, 1 = historically extreme.

---

## Output schema

`data/risk_output.json` (generated, not committed):

```json
{
  "generated_at": "2026-04-22T03:45:07Z",
  "assets": [
    {
      "ticker": "SPY",
      "name": "S&P 500 ETF",
      "last_price": 704.08,
      "last_return_pct": -0.66,
      "var_hs": 2.08,
      "es_hs": 2.71,
      "var_ewma": 1.91,
      "es_ewma": 2.40,
      "var_garch": 1.72,
      "es_garch": 2.16,
      "risk_level": 0.59
    }
  ]
}
```

---

## Stack

- **Backend:** Python · yfinance · pandas · numpy · scipy · arch
- **Frontend:** React 18 · Vite · plain CSS (no UI framework)
