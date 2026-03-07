"use client";

/* ── Artificial Horizon / Attitude Indicator ──
   Pure SVG implementation — no libraries.
   Shows pitch ladder + roll arc, just like real avionics. */

interface AttitudeIndicatorProps {
  pitch: number;   // degrees, nose up positive
  roll: number;    // degrees, right wing down positive
  size?: number;
}

export default function AttitudeIndicator({ pitch, roll, size = 200 }: AttitudeIndicatorProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const pitchScale = r / 30; // 30° visible range

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="block"
      aria-label={`Attitude: pitch ${pitch.toFixed(1)}° roll ${roll.toFixed(1)}°`}
    >
      <defs>
        <clipPath id="ai-clip">
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a3a6e" />
          <stop offset="100%" stopColor="#2a5a9e" />
        </linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5a3a1a" />
          <stop offset="100%" stopColor="#3a2a10" />
        </linearGradient>
      </defs>

      {/* Rotating group for roll + pitch */}
      <g clipPath="url(#ai-clip)">
        <g transform={`rotate(${-roll}, ${cx}, ${cy})`}>
          <g transform={`translate(0, ${pitch * pitchScale})`}>
            {/* Sky */}
            <rect x={-size} y={-size * 2} width={size * 3} height={size * 2 + cy} fill="url(#sky)" />
            {/* Ground */}
            <rect x={-size} y={cy} width={size * 3} height={size * 2} fill="url(#ground)" />
            {/* Horizon line */}
            <line x1={-size} y1={cy} x2={size * 3} y2={cy} stroke="#fff" strokeWidth="1.5" />

            {/* Pitch ladder */}
            {[-20, -15, -10, -5, 5, 10, 15, 20].map((deg) => {
              const y = cy - deg * pitchScale;
              const half = deg % 10 === 0 ? 30 : 18;
              return (
                <g key={deg}>
                  <line x1={cx - half} y1={y} x2={cx + half} y2={y}
                    stroke="#fff" strokeWidth="1" opacity="0.7" />
                  {deg % 10 === 0 && (
                    <text x={cx + half + 4} y={y + 3}
                      fill="#fff" fontSize="8" fontFamily="monospace" opacity="0.7">
                      {Math.abs(deg)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </g>

      {/* Fixed aircraft symbol (center reference) */}
      <g stroke="#FF5F1F" strokeWidth="2.5" fill="none">
        <line x1={cx - 35} y1={cy} x2={cx - 12} y2={cy} />
        <line x1={cx + 12} y1={cy} x2={cx + 35} y2={cy} />
        <line x1={cx - 12} y1={cy} x2={cx - 12} y2={cy + 6} />
        <line x1={cx + 12} y1={cy} x2={cx + 12} y2={cy + 6} />
        <circle cx={cx} cy={cy} r="3" fill="#FF5F1F" />
      </g>

      {/* Roll indicator arc */}
      <g fill="none" stroke="#fff" strokeWidth="1" opacity="0.5">
        {[-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].map((deg) => {
          const angle = ((deg - 90) * Math.PI) / 180;
          const outerR = r - 2;
          const innerR = r - (deg % 30 === 0 ? 12 : 7);
          return (
            <line
              key={deg}
              x1={cx + Math.cos(angle) * innerR}
              y1={cy + Math.sin(angle) * innerR}
              x2={cx + Math.cos(angle) * outerR}
              y2={cy + Math.sin(angle) * outerR}
            />
          );
        })}
      </g>

      {/* Roll pointer (top center, rotates with roll) */}
      <g transform={`rotate(${-roll}, ${cx}, ${cy})`}>
        <polygon
          points={`${cx},${cy - r + 14} ${cx - 5},${cy - r + 5} ${cx + 5},${cy - r + 5}`}
          fill="#fff"
        />
      </g>

      {/* Bezel ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#333" strokeWidth="3" />
      <circle cx={cx} cy={cy} r={r + 1.5} fill="none" stroke="#00FF41" strokeWidth="0.5" opacity="0.3" />
    </svg>
  );
}
