import "./RiskBar.css";

export default function RiskBar({ level, trend, exceptionRate, exceptionCount }) {
  const pct = Math.round(level * 100);
  const hue = Math.round(120 - level * 120);
  const color = `hsl(${hue}, 85%, 52%)`;

  const trendIcon  = trend === "up" ? "↑" : trend === "down" ? "↓" : null;
  const trendColor = trend === "up" ? "var(--red)" : "var(--green)";

  // Exception rate coloring: green ≤1.5%, yellow ≤3%, red >3%
  const excColor = exceptionRate > 3 ? "var(--red)"
    : exceptionRate > 1.5 ? "var(--yellow)"
    : "var(--green)";

  const title = [
    `Risk percentile: ${pct}% vs trailing 2-year history`,
    trend !== "flat" ? `5-day trend: ${trend}` : null,
    exceptionRate != null
      ? `VaR exceptions (2y): ${exceptionCount} days (${exceptionRate}% — expected ~1%)`
      : null,
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
      {exceptionRate != null && (
        <span className="risk-bar-exc" style={{ color: excColor }}>
          {exceptionRate}%
        </span>
      )}
    </div>
  );
}
