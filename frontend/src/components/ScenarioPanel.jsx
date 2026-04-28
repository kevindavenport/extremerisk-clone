import "./ScenarioPanel.css";

const fmt = (iso) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });

function ContribBar({ ticker, contrib, maxAbs }) {
  const isGain = contrib >= 0;
  const width = Math.min(100, (Math.abs(contrib) / maxAbs) * 100);
  return (
    <div className="contrib-row">
      <span className="contrib-ticker">{ticker}</span>
      <div className="contrib-track">
        <div
          className={`contrib-fill ${isGain ? "gain" : "loss"}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className={`contrib-ret ${isGain ? "gain" : "loss"}`}>
        {contrib > 0 ? "+" : ""}{contrib.toFixed(2)}
      </span>
    </div>
  );
}

function ScenarioCard({ s }) {
  const isHypo = s.type === "hypothetical";
  const isLoss  = s.portfolio_pnl < 0;

  const sorted = Object.entries(s.contributions).sort((a, b) => a[1] - b[1]);
  const maxAbs = Math.max(...sorted.map(([, v]) => Math.abs(v)));

  return (
    <div className={`scenario-card ${isHypo ? "hypo" : "historical"}`}>
      <div className="scenario-card-top">
        <div className="scenario-name-row">
          <span className="scenario-name">{s.name}</span>
          <span className={`scenario-badge ${isHypo ? "badge-hypo" : "badge-hist"}`}>
            {isHypo ? "HYPOTHETICAL" : "HISTORICAL"}
          </span>
        </div>
        <div className="scenario-dates">
          {isHypo
            ? "Analyst-estimated shock scenario"
            : `${fmt(s.start)} — ${fmt(s.end)}`}
        </div>
        <div className="scenario-desc">{s.desc}</div>
      </div>

      <div className={`scenario-pnl ${isLoss ? "loss" : "gain"}`}>
        {s.portfolio_pnl > 0 ? "+" : ""}{s.portfolio_pnl.toFixed(1)}%
        <span className="scenario-pnl-label">
          {isHypo ? "estimated portfolio P&L on $100" : "portfolio P&L on $100"}
        </span>
      </div>

      <div className="contrib-list">
        {sorted.map(([ticker, contrib]) => (
          <ContribBar key={ticker} ticker={ticker} contrib={contrib} maxAbs={maxAbs} />
        ))}
      </div>

      {s.coverage_pct < 100 && (
        <div className="scenario-coverage">
          {s.coverage_pct}% of portfolio weight covered — some assets didn't exist yet
        </div>
      )}

      {isHypo && (
        <div className="scenario-coverage">
          Assumptions are illustrative estimates, not forecasts. Shocks reflect analyst consensus on directional exposure.
        </div>
      )}
    </div>
  );
}

export default function ScenarioPanel({ scenarios }) {
  if (!scenarios || scenarios.length === 0) return null;

  return (
    <div className="scenario-section">
      <div className="scenario-grid">
        {scenarios.map((s) => <ScenarioCard key={s.id} s={s} />)}
      </div>
    </div>
  );
}
