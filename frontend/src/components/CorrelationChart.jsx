import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import "./HistoricalChart.css"; // reuse shared chart styles

// Crisis events — we'll find the nearest data point for each
const CRISES = [
  { target: "2008-10", label: "GFC" },
  { target: "2020-03", label: "COVID" },
  { target: "2022-06", label: "Rate hike cycle" },
  { target: "2025-04", label: "Tariff shock" },
];

function findNearest(data, targetDate) {
  if (!data?.length) return null;
  const t = new Date(targetDate).getTime();
  return data.reduce((best, d) => {
    const diff = Math.abs(new Date(d.date).getTime() - t);
    const bestDiff = Math.abs(new Date(best.date).getTime() - t);
    return diff < bestDiff ? d : best;
  }).date;
}

const CrisisLabel = ({ viewBox, label }) => {
  if (!viewBox) return null;
  const { x, y } = viewBox;
  return (
    <g>
      <text
        x={x + 4}
        y={y + 14}
        fill="#f59e0b"
        fontSize={10}
        fontFamily="JetBrains Mono, monospace"
        fontWeight="600"
      >
        {label}
      </text>
    </g>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  const val = d?.avg_corr?.toFixed(2);
  const level =
    d?.avg_corr >= 0.65 ? "High — diversification strained"
    : d?.avg_corr >= 0.5 ? "Elevated — assets moving together"
    : d?.avg_corr >= 0.35 ? "Normal — typical market correlation"
    : "Low — strong diversification benefit";
  return (
    <div className="chart-tooltip">
      <div className="tt-year">{d?.date}</div>
      <div className="tt-row">
        <span style={{ color: "#60a5fa" }}>Avg corr</span>
        <span>{val}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: "#8896aa", lineHeight: 1.4 }}>
        {level}
      </div>
    </div>
  );
};

export default function CorrelationChart({ data }) {
  const [insightOpen, setInsightOpen] = useState(false);
  if (!data?.length) return null;

  const tickInterval = Math.max(1, Math.floor(data.length / 14));

  // Find nearest dates for crisis annotations
  const crisisLines = CRISES.map((c) => ({
    ...c,
    date: findNearest(data, c.target),
  })).filter((c) => c.date);

  return (
    <div className="historical-chart-wrapper" style={{ marginTop: 24 }}>
      <div className="chart-header">
        <span className="chart-title">Cross-Asset Correlation</span>
        <span className="chart-subtitle">
          60-day rolling avg pairwise correlation · SPY QQQ GLD TLT EEM IWM HYG LQD XLF VNQ
        </span>
        <button
          className="insight-toggle"
          onClick={() => setInsightOpen((o) => !o)}
          aria-expanded={insightOpen}
        >
          {insightOpen ? "▾" : "▸"} Key insight
        </button>
      </div>

      {insightOpen && (
        <div className="insight-panel">
          <span className="insight-label">💡</span>
          <p>
            In normal markets these ten ETFs have an average pairwise correlation of roughly{" "}
            <strong>0.15–0.35</strong> — they move independently and diversification works.
            The all-time peak in this dataset is <strong>2022</strong>, not the GFC — because in 2022
            the Fed's aggressive rate hike cycle caused stocks <em>and</em> bonds to sell off
            simultaneously, breaking the traditional 60/40 hedge. In the GFC, treasuries and gold
            surged as stocks fell (flight to safety), keeping average correlation moderate.
            The <em>correlation breakdown problem</em> is most dangerous precisely when it's
            least expected: a portfolio built for normal-market diversification can behave
            like a concentrated bet in a rate or inflation shock.
          </p>
        </div>
      )}

      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 16, right: 40, left: 4, bottom: 0 }}
          >
            <defs>
              <linearGradient id="corrFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#ef4444" stopOpacity={0.55} />
                <stop offset="45%"  stopColor="#3b82f6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#0d1526" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke="#162038" />

            <XAxis
              dataKey="date"
              tickFormatter={(v) => v.slice(0, 4)}
              interval={tickInterval}
              tick={{ fill: "#8896aa", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#1e2530" }}
            />

            <YAxis
              domain={[0, 1]}
              tickFormatter={(v) => v.toFixed(1)}
              tick={{ fill: "#8896aa", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
              tickLine={false}
              axisLine={false}
              width={38}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />

            {/* Warning threshold */}
            <ReferenceLine
              y={0.6}
              stroke="#f59e0b"
              strokeDasharray="4 3"
              strokeOpacity={0.6}
              label={{
                value: "diversification under stress",
                position: "insideTopRight",
                fill: "#f59e0b",
                fontSize: 10,
                fontFamily: "JetBrains Mono, monospace",
                opacity: 0.8,
              }}
            />

            {/* Crisis event lines */}
            {crisisLines.map((c) => (
              <ReferenceLine
                key={c.label}
                x={c.date}
                stroke="#f59e0b"
                strokeOpacity={0.45}
                strokeWidth={1}
                strokeDasharray="3 3"
                label={<CrisisLabel label={c.label} />}
              />
            ))}

            <Area
              type="monotone"
              dataKey="avg_corr"
              stroke="#60a5fa"
              strokeWidth={1.5}
              fill="url(#corrFill)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ fontSize: 11, color: "#4a5a6e", marginTop: 8, textAlign: "right" }}>
        Amber line = 60% correlation threshold · crisis labels = 60-day window centered near peak stress
      </div>
    </div>
  );
}
