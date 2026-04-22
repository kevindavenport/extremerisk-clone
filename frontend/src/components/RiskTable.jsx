import Riskometer from "./Riskometer.jsx";
import "./RiskTable.css";

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
            <th className="num">1d Ret%</th>
            <th className="num">VaR HS</th>
            <th className="num">VaR EWMA</th>
            <th className="num">VaR GARCH</th>
            <th className="num">ES EWMA</th>
            <th className="center">Risk</th>
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
