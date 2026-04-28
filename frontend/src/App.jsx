import { useEffect, useState } from "react";
import RiskTable from "./components/RiskTable.jsx";
import HistoricalChart from "./components/HistoricalChart.jsx";
import CorrelationChart from "./components/CorrelationChart.jsx";
import "./App.css";

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/risk_output.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (!json.assets || json.assets.length === 0) {
          throw new Error("No asset data — run the backend first.");
        }
        setData(json);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }) + " UTC";
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="logo">RISK<span className="logo-accent">LENS</span></span>
          <span className="subtitle">Quantitative tail risk · VaR · ES · Extreme Value Theory · Daily</span>
        </div>
        {data && (
          <div className="generated-at">
            <span className="label">Generated</span>
            <span className="value">{fmt(data.generated_at)}</span>
          </div>
        )}
      </header>

      <div className="legend">
        <span className="legend-item"><span className="dot green" />Low risk (&lt;2.5)</span>
        <span className="legend-item"><span className="dot yellow" />Elevated (2.5–5)</span>
        <span className="legend-item"><span className="dot red" />High (&gt;5)</span>
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
        {data && (
          <section className="section">
            <div className="section-header">
              <span className="section-title">Current Risk Snapshot</span>
              <span className="section-desc">How risky is each asset today, relative to its own two-year history? Rows default-sorted by risk level. VaR = the minimum expected loss on the worst 1% of trading days, on a $100 position. Five models are shown because their disagreement is itself a signal — a wide spread means the asset has tail behavior that normal assumptions miss.</span>
            </div>
            <RiskTable assets={data.assets} portfolioWeights={data.portfolio_weights} />
          </section>
        )}
        {data?.sp500_history && (
          <section className="section">
            <div className="section-header">
              <span className="section-title">S&amp;P 500 Historical Risk</span>
              <span className="section-desc">How has U.S. equity market stress evolved year by year? Each bar shows the range of modeled daily loss estimates for that year.</span>
            </div>
            <HistoricalChart data={data.sp500_history} />
          </section>
        )}
        {data?.correlation_history && (
          <section className="section">
            <div className="section-header">
              <span className="section-title">Cross-Asset Correlation</span>
              <span className="section-desc">Are markets moving in lockstep? When assets rise together, diversification breaks down and portfolio risk is higher than any single holding suggests.</span>
            </div>
            <CorrelationChart data={data.correlation_history} />
          </section>
        )}
      </main>

      <footer className="footer">
        <span>VaR models: Historical Simulation · EWMA (λ=0.94) · GARCH(1,1)</span>
        <span>Data via yfinance · Not financial advice · <a href="https://github.com/KLDGH/risklens/blob/main/FAQ.md" target="_blank" rel="noopener noreferrer" className="footer-link">Methodology &amp; FAQ</a></span>
      </footer>
    </div>
  );
}
