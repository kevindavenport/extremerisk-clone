import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from "recharts";
import "./HistoricalChart.css"; // reuse shared chart styles

// Per-day bar color: red if positive corr (rates regime), green if negative
function barColor(c) {
  if (c == null) return "#444";
  return c >= 0 ? "#e53e3e" : "#00c97a";
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const c = d?.corr;
  const sign = c >= 0 ? "rates regime" : "growth regime";
  const strength =
      Math.abs(c) >= 0.6 ? "strong"
    : Math.abs(c) >= 0.3 ? "moderate"
                          : "weak";
  return (
    <div className="chart-tooltip">
      <div className="tt-year">{label}</div>
      <div className="tt-row">
        <span style={{ color: c >= 0 ? "#e53e3e" : "#4ade80" }}>SPY-TLT corr</span>
        <span>{c >= 0 ? "+" : ""}{c?.toFixed(3)}</span>
      </div>
      <div className="tt-row">
        <span style={{ color: "#8896aa" }}>5-min bars</span>
        <span>{d?.n_obs}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: "#8896aa", lineHeight: 1.4 }}>
        {strength} {sign}
      </div>
    </div>
  );
};


export default function IntradayCorrelationChart({ data }) {
  const [insightOpen, setInsightOpen] = useState(false);
  if (!data?.length) return null;

  // Identify the trailing same-sign streak (the regime-shift signal)
  const last = data[data.length - 1];
  const lastSign = last.corr > 0 ? 1 : last.corr < 0 ? -1 : 0;
  let streak = 0;
  if (lastSign !== 0) {
    for (let i = data.length - 1; i >= 0; i--) {
      const s = data[i].corr > 0 ? 1 : data[i].corr < 0 ? -1 : 0;
      if (s === lastSign) streak++;
      else break;
    }
  }

  const nPositive = data.filter((d) => d.corr > 0).length;
  const nTotal = data.length;
  const pctPositive = ((nPositive / nTotal) * 100).toFixed(0);

  // Streak callout copy
  const streakLabel =
    streak === 0 ? null
  : lastSign > 0 ? `${streak} consecutive positive days — rates-regime signal`
                 : `${streak} consecutive negative days — growth-regime / diversification working`;

  // Sample x-axis ticks every ~7 trading days
  const tickInterval = Math.max(1, Math.floor(data.length / 8));

  return (
    <div className="historical-chart-wrapper" style={{ marginTop: 0 }}>
      <div className="chart-header">
        <span className="chart-title">Intraday Stock-Bond Correlation</span>
        <span className="chart-subtitle">
          SPY × TLT correlation from 5-minute bars · daily values · {nTotal} trading days · {pctPositive}% positive
        </span>
        <button
          className={`insight-toggle${insightOpen ? " open" : ""}`}
          onClick={() => setInsightOpen((o) => !o)}
          aria-expanded={insightOpen}
        >
          {insightOpen ? "▾ Hide insight" : "▸ Key insight"}
        </button>
      </div>

      {streakLabel && (
        <div className={`intraday-streak-callout ${lastSign > 0 ? "rates" : "growth"}`}>
          <span className="streak-bullet">●</span>
          <span className="streak-text">{streakLabel}</span>
        </div>
      )}

      {insightOpen && (
        <div className="insight-panel">
          <span className="insight-label">💡</span>
          <p>
            Each bar is one trading day's correlation between SPY and TLT
            <em> within</em> that day, computed from 5-minute log returns
            (n ≈ 78 bars per US session). <strong>Red = positive correlation
            (rates regime)</strong>: stocks and bonds moved the same direction
            on the day, meaning the dominant news driver was about rates rather
            than growth. <strong>Green = negative correlation (growth regime)</strong>:
            the textbook flight-to-safety pattern where bad equity news lifts
            bonds. The signal here is the <strong>streak</strong>. A single
            day's intraday correlation has 78 observations behind it — a run of
            consecutive same-sign days is statistically a much sharper
            regime-shift indicator than the smoothed 60-day daily-data
            correlation above. The 60-day daily series is a lagging average;
            this is the leading version of the same question.
          </p>
        </div>
      )}

      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 16, right: 40, left: 4, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="#162038" />

            <XAxis
              dataKey="date"
              tickFormatter={(v) => {
                // Format as "MM-DD" for compactness
                const parts = v.split("-");
                return `${parts[1]}-${parts[2]}`;
              }}
              interval={tickInterval}
              tick={{ fill: "#8896aa", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#1e2530" }}
            />

            <YAxis
              domain={[-1, 1]}
              tickFormatter={(v) => v.toFixed(1)}
              tick={{ fill: "#8896aa", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
              tickLine={false}
              axisLine={false}
              width={36}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />

            <ReferenceLine y={0} stroke="#2e4460" strokeWidth={1.5} />

            <Bar dataKey="corr" maxBarSize={12} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={i} fill={barColor(d.corr)} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ fontSize: 11, color: "#4a5a6e", marginTop: 8, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span>
          Red = positive correlation (rates regime, diversification fails) ·
          Green = negative correlation (growth regime, diversification works)
        </span>
        <span>5-min bars · last 60 trading days (yfinance limit)</span>
      </div>
    </div>
  );
}
