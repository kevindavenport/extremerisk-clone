import { useEffect, useState } from "react";
import RiskTable from "./components/RiskTable.jsx";
import HistoricalChart from "./components/HistoricalChart.jsx";
import CorrelationChart from "./components/CorrelationChart.jsx";
import ScenarioPanel from "./components/ScenarioPanel.jsx";
import InfoTip from "./components/InfoTip.jsx";
import "./App.css";

const NAV_LINKS = [
  { id: "risk-snapshot",   label: "Risk Snapshot" },
  { id: "stress-tests",    label: "Stress Tests" },
  { id: "sp500-history",   label: "S&P 500 History" },
  { id: "correlation",     label: "Correlation" },
];

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
            <RiskTable assets={portfolio.assets} portfolioWeights={portfolio.weights} />
          </section>
        )}
        {portfolio?.scenarios && (
          <section id="stress-tests" className="section">
            <div className="section-header">
              <span className="section-title">Historical Stress Tests &amp; Scenarios</span>
              <span className="section-desc">How would the active portfolio have performed during major market crises (data-driven), and how might it respond to forward-looking scenarios (assumption-driven)? Each card shows total P&amp;L and which holdings hurt — or helped — the most.</span>
            </div>
            <ScenarioPanel scenarios={portfolio.scenarios} />
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
      </main>

      <footer className="footer">
        <span>VaR models: Historical Simulation · EWMA (λ=0.94) · GARCH(1,1)</span>
        <span>Data via yfinance · Not financial advice</span>
      </footer>
    </div>
  );
}
