import "./RiskBar.css";

export default function RiskBar({ level, trend, exceptionRate, exceptionCount }) {
  const pct = Math.round(level * 100);
  const hue = Math.round(120 - level * 120);
  const color = `hsl(${hue}, 85%, 52%)`;

  const trendIcon  = trend === "up" ? "↑" : trend === "down" ? "↓" : null;
  const trendColor = trend === "up" ? "var(--red)" : "var(--green)";

  const trendLabel = trend === "up"
    ? "VaR rising over last 5 days — risk is building"
    : trend === "down"
    ? "VaR falling over last 5 days — risk is easing"
    : null;

  const excLabel = exceptionRate != null
    ? `Model exceptions (2y): ${exceptionCount} days (${exceptionRate}% — expected ~1%). ${
        exceptionRate > 3
          ? "EWMA is underestimating tail risk for this asset."
          : exceptionRate > 1.5
          ? "Slight underestimation — consider EVT estimates."
          : "Model well-calibrated."
      }`
    : null;

  const title = [
    `Risk percentile: ${pct}% vs trailing 2-year history`,
    trendLabel,
    excLabel,
  ].filter(Boolean).join(" · ");

  return (
    <div className="risk-bar-wrapper" title={title}>
      <div className="risk-bar-track">
        <div
          className="risk-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="risk-bar-label" style={{ color }}>{pct}%</span>
      {trendIcon && (
        <span className="risk-bar-trend" style={{ color: trendColor }}>{trendIcon}</span>
      )}
    </div>
  );
}
