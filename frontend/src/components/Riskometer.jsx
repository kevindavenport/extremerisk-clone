export default function Riskometer({ level }) {
  // Arc from 210° to -30° (240° sweep), centre at (30,30), radius 22
  const W = 60;
  const CX = 30;
  const CY = 32;
  const R = 20;
  const START_DEG = 210;
  const SWEEP = 240;

  const toRad = (d) => (d * Math.PI) / 180;

  const arcPoint = (deg) => ({
    x: CX + R * Math.cos(toRad(deg)),
    y: CY + R * Math.sin(toRad(deg)),
  });

  const arcPath = (startDeg, endDeg) => {
    const s = arcPoint(startDeg);
    const e = arcPoint(endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  // Background arc (full sweep)
  const bgPath = arcPath(START_DEG, START_DEG + SWEEP);

  // Filled arc up to level
  const fillEnd = START_DEG + SWEEP * Math.min(Math.max(level, 0), 1);
  const fillPath = level > 0.01 ? arcPath(START_DEG, fillEnd) : null;

  // Needle angle
  const needleDeg = START_DEG + SWEEP * Math.min(Math.max(level, 0), 1);
  const needleRad = toRad(needleDeg);
  const needleLen = R - 3;
  const nx = CX + needleLen * Math.cos(needleRad);
  const ny = CY + needleLen * Math.sin(needleRad);

  // Color: green → yellow → red based on level
  const hue = Math.round(120 - level * 120); // 120=green, 0=red
  const fillColor = `hsl(${hue}, 90%, 50%)`;

  return (
    <svg width={W} height={42} aria-label={`Risk level ${Math.round(level * 100)}%`}>
      {/* Background track */}
      <path
        d={bgPath}
        fill="none"
        stroke="#1e2530"
        strokeWidth={4}
        strokeLinecap="round"
      />
      {/* Filled track */}
      {fillPath && (
        <path
          d={fillPath}
          fill="none"
          stroke={fillColor}
          strokeWidth={4}
          strokeLinecap="round"
        />
      )}
      {/* Needle */}
      <line
        x1={CX}
        y1={CY}
        x2={nx}
        y2={ny}
        stroke={fillColor}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Centre dot */}
      <circle cx={CX} cy={CY} r={2.5} fill={fillColor} />
      {/* Percentage label */}
      <text
        x={CX}
        y={CY + 13}
        textAnchor="middle"
        fill={fillColor}
        fontSize="7"
        fontFamily="JetBrains Mono, monospace"
        fontWeight="600"
      >
        {Math.round(level * 100)}%
      </text>
    </svg>
  );
}
