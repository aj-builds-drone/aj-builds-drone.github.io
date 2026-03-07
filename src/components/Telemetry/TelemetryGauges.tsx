"use client";

/* ── Telemetry Gauge Components ──
   Pure SVG gauges for altitude, battery, signal strength, compass, and data readouts. */

import type { TelemetryData, FlightMode } from "./telemetrySimulator";

/* ── Circular Gauge (reusable arc gauge) ── */
function ArcGauge({
  value,
  max,
  label,
  unit,
  color,
  size = 120,
}: {
  value: number;
  max: number;
  label: string;
  unit: string;
  color: string;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 12;
  const startAngle = 135;
  const endAngle = 405;
  const range = endAngle - startAngle;
  const progress = Math.min(value / max, 1);
  const currentAngle = startAngle + range * progress;

  function polarToCartesian(angle: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(currentAngle);
  const largeArc = currentAngle - startAngle > 180 ? 1 : 0;
  const bgEnd = polarToCartesian(endAngle);
  const bgLargeArc = range > 180 ? 1 : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      {/* Background arc */}
      <path
        d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${bgLargeArc} 1 ${bgEnd.x} ${bgEnd.y}`}
        fill="none" stroke="#222" strokeWidth="6" strokeLinecap="round"
      />
      {/* Value arc */}
      <path
        d={`M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`}
        fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
      />
      {/* Value text */}
      <text x={cx} y={cy - 2} textAnchor="middle" fill="#F0F0F0" fontFamily="monospace" fontSize="18" fontWeight="bold">
        {Math.round(value)}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#888" fontFamily="monospace" fontSize="8">
        {unit}
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" fill="#666" fontFamily="monospace" fontSize="7" letterSpacing="0.1em">
        {label}
      </text>
    </svg>
  );
}

/* ── Battery Bar ── */
function BatteryGauge({ percent, voltage }: { percent: number; voltage: number }) {
  const color = percent > 50 ? "#00FF41" : percent > 20 ? "#FF5F1F" : "#FF3333";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="44" height="24" viewBox="0 0 44 24" className="block">
        <rect x="1" y="3" width="36" height="18" rx="2" fill="none" stroke="#444" strokeWidth="1.5" />
        <rect x="37" y="8" width="4" height="8" rx="1" fill="#444" />
        <rect x="3" y="5" width={Math.max(0, (percent / 100) * 32)} height="14" rx="1" fill={color} />
      </svg>
      <span className="font-mono text-[10px] text-text-secondary">{percent.toFixed(0)}% / {voltage.toFixed(1)}V</span>
      <span className="font-mono text-[8px] text-text-secondary tracking-widest">BATTERY</span>
    </div>
  );
}

/* ── Signal Strength Bars ── */
function SignalBars({ rssi }: { rssi: number }) {
  const bars = 5;
  const activeCount = Math.ceil((rssi / 100) * bars);
  const color = rssi > 70 ? "#00FF41" : rssi > 40 ? "#FF5F1F" : "#FF3333";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="36" height="24" viewBox="0 0 36 24" className="block">
        {Array.from({ length: bars }).map((_, i) => (
          <rect
            key={i}
            x={i * 7 + 1}
            y={20 - (i + 1) * 4}
            width="5"
            height={(i + 1) * 4}
            rx="1"
            fill={i < activeCount ? color : "#333"}
          />
        ))}
      </svg>
      <span className="font-mono text-[10px] text-text-secondary">{rssi.toFixed(0)}%</span>
      <span className="font-mono text-[8px] text-text-secondary tracking-widest">RSSI</span>
    </div>
  );
}

/* ── Compass Heading ── */
function CompassHeading({ heading }: { heading: number }) {
  const cardinals = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(heading / 45) % 8;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="50" height="50" viewBox="0 0 50 50" className="block">
        <circle cx="25" cy="25" r="22" fill="none" stroke="#333" strokeWidth="1.5" />
        {/* Tick marks */}
        {Array.from({ length: 36 }).map((_, i) => {
          const angle = ((i * 10 - 90) * Math.PI) / 180;
          const inner = i % 9 === 0 ? 15 : 18;
          return (
            <line key={i}
              x1={25 + Math.cos(angle) * inner} y1={25 + Math.sin(angle) * inner}
              x2={25 + Math.cos(angle) * 20} y2={25 + Math.sin(angle) * 20}
              stroke={i % 9 === 0 ? "#888" : "#444"} strokeWidth={i % 9 === 0 ? "1.5" : "0.5"}
            />
          );
        })}
        {/* Heading pointer */}
        <g transform={`rotate(${heading}, 25, 25)`}>
          <polygon points="25,6 22,16 28,16" fill="#FF5F1F" />
          <polygon points="25,44 22,34 28,34" fill="#444" />
        </g>
        <text x="25" y="28" textAnchor="middle" fill="#F0F0F0" fontFamily="monospace" fontSize="9" fontWeight="bold">
          {Math.round(heading)}°
        </text>
      </svg>
      <span className="font-mono text-[10px] text-text-secondary">{cardinals[idx]}</span>
      <span className="font-mono text-[8px] text-text-secondary tracking-widest">HDG</span>
    </div>
  );
}

/* ── Flight Mode Badge ── */
function ModeBadge({ mode, armed }: { mode: FlightMode; armed: boolean }) {
  const colors: Record<FlightMode, string> = {
    IDLE: "text-text-secondary border-border-dim",
    ARMED: "text-accent-orange border-accent-orange",
    TAKEOFF: "text-accent-green border-accent-green",
    MISSION: "text-accent-green border-accent-green",
    RTL: "text-accent-orange border-accent-orange",
    LAND: "text-accent-cyan border-accent-cyan",
  };
  return (
    <div className="flex items-center gap-3">
      <span className={`font-mono text-sm font-bold tracking-widest px-3 py-1 border rounded ${colors[mode]}`}>
        {mode}
      </span>
      {armed && (
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-accent-green rounded-full pulse-green" />
          <span className="font-mono text-[10px] text-accent-green tracking-widest">ARMED</span>
        </span>
      )}
    </div>
  );
}

/* ── Data Readout Row ── */
function DataRow({ label, value, unit, color = "text-foreground" }: {
  label: string; value: string; unit?: string; color?: string;
}) {
  return (
    <div className="flex items-center justify-between font-mono text-xs">
      <span className="text-text-secondary tracking-widest">{label}</span>
      <span className={color}>
        {value}{unit && <span className="text-text-secondary text-[10px] ml-1">{unit}</span>}
      </span>
    </div>
  );
}

/* ── Exported Gauges ── */
export {
  ArcGauge,
  BatteryGauge,
  SignalBars,
  CompassHeading,
  ModeBadge,
  DataRow,
};
