import { useEffect, useState, useMemo } from "react";
import RiskTable from "./components/RiskTable.jsx";
import HistoricalChart from "./components/HistoricalChart.jsx";
import CorrelationChart from "./components/CorrelationChart.jsx";
import IntradayCorrelationChart from "./components/IntradayCorrelationChart.jsx";
import PortfolioRiskChart from "./components/PortfolioRiskChart.jsx";
import BacktestPanel from "./components/BacktestPanel.jsx";
import ScenarioPanel from "./components/ScenarioPanel.jsx";
import InfoTip from "./components/InfoTip.jsx";
import "./App.css";

const NAV_LINKS = [
  { id: "risk-snapshot",   label: "Risk Snapshot" },
  { id: "risk-trajectory", label: "Risk Trajectory" },
  { id: "model-validation", label: "Model Validation" },
  { id: "stress-tests",    label: "Stress Tests" },
  { id: "sp500-history",   label: "S&P 500 History" },
  { id: "correlation",     label: "Correlation" },
  { id: "intraday-corr",   label: "Intraday Corr" },
];

// Short label shown on the portfolio summary row of the risk table.
// Falls back to a generic "PORTFOLIO" label for any unknown mode.
const PORTFOLIO_SHORT_LABELS = {
  hypothetical: "HYPOTHETICAL PORTFOLIO",
  tdf_2055:     "VANGUARD 2055",
  cg_2055:      "AF TARGET 2055",
};

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("hypothetical");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/risk_output.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (!json.portfolios) {
          throw new Error("No portfolio data — run the backend first.");
        }
        setData(json);
        setMode(json.default_mode ?? "hypothetical");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const fmtDate = (iso) => {
    if (!iso) return "";
    // Parse YYYY-MM-DD as a date-only value (no time-zone fiddling)
    const [y, m, d] = iso.split("-").map(Number);
    const dateStr = new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    // All US assets reference the 4:00 PM ET market close — standard data-as-of convention
    return `${dateStr} · 4:00 PM ET`;
  };

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Active portfolio bundle (assets + scenarios + weights for selected mode)
  const portfolio = data?.portfolios?.[mode];
  const modeKeys = data ? Object.keys(data.portfolios) : [];

  // Pre-compute cross-mode comparison data for each scenario id
  // (lets the headline P&L hover show "this portfolio vs others")
  const scenarioComparisons = useMemo(() => {
    if (!data?.portfolios) return {};
    const map = {};
    for (const [key, mode] of Object.entries(data.portfolios)) {
      for (const s of mode.scenarios ?? []) {
        if (!map[s.id]) map[s.id] = {};
        map[s.id][key] = { label: mode.label, pnl: s.portfolio_pnl };
      }
    }
    return map;
  }, [data]);

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="logo">RISK<span className="logo-accent">LENS</span></span>
        </div>
        {data && (
          <div className="generated-at">
            <span className="label">Data as of</span>
            <span className="value">{fmtDate(data.data_as_of)}</span>
          </div>
        )}
      </header>

      {data && (
        <nav className="page-nav">
          <span className="nav-label">Sections:</span>
          {NAV_LINKS.map(({ id, label }) => (
            <button key={id} className="nav-btn" onClick={() => scrollTo(id)}>
              {label}
            </button>
          ))}
          <a
            href="https://github.com/KLDGH/risklens/blob/main/FAQ.md"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-btn nav-external"
          >
            Methodology &amp; FAQ ↗
          </a>
        </nav>
      )}

      {portfolio && (
        <div className="mode-bar">
          <div className="mode-info">
            <span className="mode-label">Active portfolio</span>
            <span className="mode-name">{portfolio.label}</span>
            <span className="mode-desc">{portfolio.description}</span>
          </div>
          <div className="mode-toggle">
            {modeKeys.map((k) => (
              <button
                key={k}
                className={`mode-btn ${mode === k ? "active" : ""}`}
                onClick={() => setMode(k)}
              >
                {data.portfolios[k].label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="legend">
        <span className="legend-item"><span className="dot green" />Low risk (&lt;2.5)</span>
        <span className="legend-item"><span className="dot yellow" />Elevated (2.5–5)</span>
        <span className="legend-item"><span className="dot red" />High (&gt;5)<InfoTip text="These thresholds are pragmatic rules of thumb, not a regulatory standard. Calibrated for daily 1% VaR on liquid ETFs: diversified US equity (SPY) historically sits around 1.5–2.5%; sector ETFs 2–3%; individual stocks 3–5%; crypto and volatile names often 5%+. Different asset classes warrant different thresholds, which is why the per-asset Risk gauge (percentile rank vs 2-year history) is the more rigorous comparison on this page." /></span>
        <span className="legend-item legend-note">VaR expressed as $ loss on $100 portfolio</span>
      </div>

      <main className="main">
        {loading && (
          <div className="state-msg">
            <span className="blink">█</span> Loading risk data...
          </div>
        )}
        {error && (
          <div className="state-msg error">
            <span className="label">ERROR</span> {error}
            <div className="hint">Run <code>python backend/run.py</code> to generate data.</div>
          </div>
        )}
        {portfolio && (
          <section id="risk-snapshot" className="section">
            <div className="section-header">
              <span className="section-title">Current Risk Snapshot</span>
              <span className="section-desc">How risky is each asset today, relative to its own two-year history? Rows default-sorted by risk level. VaR = the minimum expected loss on the worst 1% of trading days, on a $100 position. Five models are shown because their disagreement is itself a signal — a wide spread means the asset has tail behavior that normal assumptions miss.</span>
            </div>
            <RiskTable
              assets={portfolio.assets}
              portfolioWeights={portfolio.weights}
              portfolioLabel={PORTFOLIO_SHORT_LABELS[mode] ?? "PORTFOLIO"}
            />
          </section>
        )}
        {portfolio?.risk_history?.length > 0 && (
          <section id="risk-trajectory" className="section">
            <div className="section-header">
              <span className="section-title">Portfolio Risk Trajectory</span>
              <span className="section-desc">How has the active portfolio's daily risk evolved over time? This is the same EWMA VaR as the portfolio summary row in the table above, computed every trading day rather than just today's snapshot. Spikes line up with crises; the gradual return to baseline shows how regimes resolve. The history depth depends on which mode is selected — Vanguard reaches back to 2014, American Funds to 2007.</span>
            </div>
            <PortfolioRiskChart data={portfolio.risk_history} portfolioLabel={portfolio.label} />
          </section>
        )}
        {portfolio?.backtests && (
          <section id="model-validation" className="section">
            <div className="section-header">
              <span className="section-title">VaR Model Validation</span>
              <span className="section-desc">Out-of-sample backtest of HS, EWMA, and EVT VaR models on the active portfolio. For each of the last 504 trading days, the model is given only the prior 1000 days to forecast that day's 1% VaR; we then compare against actual realized losses. The Kupiec test checks whether the observed exception rate matches the expected 1%; the Christoffersen test checks whether exceptions cluster (a sign of time-varying risk the model misses).</span>
            </div>
            <BacktestPanel data={portfolio.backtests} portfolioLabel={portfolio.label} />
          </section>
        )}
        {portfolio?.scenarios && (
          <section id="stress-tests" className="section">
            <div className="section-header">
              <span className="section-title">Historical Stress Tests &amp; Scenarios</span>
              <span className="section-desc">How would the active portfolio have performed during major market crises (data-driven), and how might it respond to forward-looking scenarios (assumption-driven)? Each card shows total P&amp;L and which holdings hurt — or helped — the most.</span>
            </div>
            <ScenarioPanel
              scenarios={portfolio.scenarios}
              weights={portfolio.weights}
              comparisons={scenarioComparisons}
              currentMode={mode}
            />
          </section>
        )}
        {data?.sp500_history && (
          <section id="sp500-history" className="section">
            <div className="section-header">
              <span className="section-title">Market Context — S&amp;P 500 Historical Risk</span>
              <span className="section-desc">How has U.S. equity market stress evolved year by year? Each bar shows the range of modeled daily loss estimates for that year. Reference data — does not change with portfolio toggle.</span>
            </div>
            <HistoricalChart data={data.sp500_history} />
          </section>
        )}
        {data?.correlation_history && (
          <section id="correlation" className="section">
            <div className="section-header">
              <span className="section-title">Market Context — Cross-Asset Correlation</span>
              <span className="section-desc">Are markets moving in lockstep? When assets rise together, diversification breaks down and portfolio risk is higher than any single holding suggests. Reference data — does not change with portfolio toggle.</span>
            </div>
            <CorrelationChart data={data.correlation_history} />
          </section>
        )}
        {data?.intraday_corr_history?.length > 0 && (
          <section id="intraday-corr" className="section">
            <div className="section-header">
              <span className="section-title">Market Context — Intraday Stock-Bond Correlation</span>
              <span className="section-desc">A leading version of the chart above. Each bar is one trading day's SPY-TLT correlation computed from 5-minute bars (n ≈ 78 per session) — so each daily value is statistically meaningful on its own. A run of consecutive same-sign days is a much sharper regime-shift signal than the smoothed 60-day daily-data correlation can produce. Free intraday data via yfinance, limited to the last 60 trading days.</span>
            </div>
            <IntradayCorrelationChart data={data.intraday_corr_history} />
          </section>
        )}
      </main>

      <footer className="footer">
        <span>VaR models: Historical Simulation · EWMA (λ=0.94) · GARCH(1,1)</span>
        <span>Data via yfinance · Not financial advice</span>
      </footer>
    </div>
  );
}
