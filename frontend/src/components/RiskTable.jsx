import Riskometer from "./Riskometer.jsx";
import InfoTip from "./InfoTip.jsx";
import "./RiskTable.css";

const TIPS = {
  ret: "Yesterday's log return for this asset.",
  varHs: "Historical Simulation VaR — the 1% worst daily loss drawn directly from the last 1000 trading days of returns. No distribution assumption.",
  varEwma: "EWMA VaR — Value at Risk assuming normal returns, using exponentially weighted volatility (λ=0.94). Recent days get more weight than older ones.",
  varGarch: "GARCH(1,1) VaR — like EWMA but uses a GARCH model to forecast tomorrow's volatility. Falls back to EWMA if the model fails to converge.",
  esEwma: "Expected Shortfall (CVaR) — the average loss on the worst 1% of days. Always larger than VaR; a better measure of tail risk.",
  risk: "Percentile rank of today's EWMA VaR vs the past 2 years of daily EWMA VaR for this asset. 100% = highest risk seen in 2 years.",
};

function ReturnCell({ value }) {
  const color = value > 0 ? "var(--green)" : value < 0 ? "var(--red)" : "var(--text-dim)";
  const sign = value > 0 ? "+" : "";
  return (
    <td className="num" style={{ color }}>
      {sign}{value.toFixed(2)}%
    </td>
  );
}

function VarCell({ value }) {
  let color = "var(--green)";
  if (value > 5) color = "var(--red)";
  else if (value > 2.5) color = "var(--yellow)";
  return (
    <td className="num" style={{ color }}>
      {value.toFixed(2)}
    </td>
  );
}

export default function RiskTable({ assets }) {
  return (
    <div className="table-wrapper">
      <table className="risk-table">
        <thead>
          <tr>
            <th className="left">Asset</th>
            <th className="num">Price</th>
            <th className="num">1d Ret% <InfoTip text={TIPS.ret} /></th>
            <th className="num">VaR HS <InfoTip text={TIPS.varHs} /></th>
            <th className="num">VaR EWMA <InfoTip text={TIPS.varEwma} /></th>
            <th className="num">VaR GARCH <InfoTip text={TIPS.varGarch} /></th>
            <th className="num">ES EWMA <InfoTip text={TIPS.esEwma} /></th>
            <th className="center">Risk <InfoTip text={TIPS.risk} /></th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.ticker}>
              <td className="left asset-cell">
                <span className="ticker">{a.ticker}</span>
                <span className="name">{a.name}</span>
              </td>
              <td className="num price">${a.last_price.toLocaleString()}</td>
              <ReturnCell value={a.last_return_pct} />
              <VarCell value={a.var_hs} />
              <VarCell value={a.var_ewma} />
              <VarCell value={a.var_garch} />
              <VarCell value={a.es_ewma} />
              <td className="center gauge-cell">
                <Riskometer level={a.risk_level} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
