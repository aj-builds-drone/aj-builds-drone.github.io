"use client";

import { useState } from "react";
import { motion } from "framer-motion";

/* ── State/location data ── */
interface LocationPin {
  id: string;
  name: string;
  type: "primary" | "university" | "service-area";
  detail: string;
  cx: number;
  cy: number;
}

const LOCATION_PINS: LocationPin[] = [
  { id: "austin", name: "Austin, TX", type: "primary", detail: "Primary Operations Base — FAA Part 107 Certified", cx: 478, cy: 380 },
  { id: "ut-austin", name: "UT Austin", type: "university", detail: "Computer Science & Engineering Research", cx: 475, cy: 376 },
  { id: "tamu", name: "Texas A&M", type: "university", detail: "Agricultural & Environmental Engineering", cx: 490, cy: 372 },
  { id: "uh", name: "University of Houston", type: "university", detail: "Civil & Environmental Engineering", cx: 500, cy: 385 },
  { id: "utd", name: "UT Dallas", type: "university", detail: "Computer Science & Robotics", cx: 488, cy: 350 },
  { id: "rice", name: "Rice University", type: "university", detail: "Engineering & Applied Sciences", cx: 498, cy: 383 },
  { id: "oklahoma", name: "University of Oklahoma", type: "university", detail: "Atmospheric Science & Environmental Studies", cx: 478, cy: 318 },
  { id: "lsu", name: "Louisiana State University", type: "university", detail: "Coastal & Environmental Science", cx: 535, cy: 375 },
  { id: "uark", name: "University of Arkansas", type: "university", detail: "Agricultural Systems & Engineering", cx: 515, cy: 330 },
];

/* Simplified US state paths — Texas highlighted, surrounding states available, rest dimmed */
const TX_PRIMARY = "M420,340 L430,310 L460,300 L490,310 L520,320 L530,350 L530,380 L520,400 L510,410 L490,420 L460,420 L440,410 L420,400 L410,380 L415,360 Z";
const SURROUNDING_STATES: { id: string; name: string; d: string }[] = [
  { id: "OK", name: "Oklahoma", d: "M420,290 L430,280 L480,280 L520,285 L520,320 L490,310 L460,300 L430,310 L420,340 L410,330 L410,310 Z" },
  { id: "NM", name: "New Mexico", d: "M350,290 L420,290 L420,340 L415,360 L410,380 L370,400 L340,380 L340,320 Z" },
  { id: "LA", name: "Louisiana", d: "M520,340 L560,330 L575,345 L570,380 L545,395 L530,380 L530,350 Z" },
  { id: "AR", name: "Arkansas", d: "M520,285 L560,280 L570,300 L560,330 L520,340 L520,320 Z" },
];

const OTHER_STATES_OUTLINE = "M150,100 L250,70 L380,60 L450,55 L550,50 L650,55 L720,70 L740,100 L750,140 L740,180 L720,220 L730,260 L720,280 L700,300 L680,320 L660,340 L640,350 L620,340 L600,320 L575,345 L570,300 L560,280 L520,285 L480,280 L430,280 L420,290 L350,290 L340,320 L310,340 L280,340 L250,320 L220,310 L200,280 L180,260 L160,230 L140,200 L130,160 Z";

export default function ServiceAreaMap() {
  const [hoveredPin, setHoveredPin] = useState<LocationPin | null>(null);
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  return (
    <section className="py-24 border-t border-border-dim relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <span className="font-mono text-xs text-accent-cyan tracking-widest">[SAM]</span>
          <div className="h-px flex-1 bg-gradient-to-r from-accent-cyan/50 to-transparent" />
        </div>
        <h2 className="font-mono text-2xl md:text-3xl font-bold tracking-wider mb-2">SERVICE AREA MAP</h2>
        <p className="text-text-secondary text-sm mb-8 max-w-xl">
          Drone operations coverage across the United States. Available for deployment nationwide with 48hr notice.
        </p>

        {/* Map Container */}
        <div className="relative">
          {/* Scanline effect */}
          <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-lg">
            <motion.div
              className="absolute left-0 right-0 h-px bg-accent-cyan/20"
              animate={{ y: [0, 500, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
          </div>

          {/* SVG Map */}
          <div className="relative bg-surface/30 border border-border-dim rounded-lg p-4 md:p-8">
            <svg
              viewBox="100 30 700 420"
              className="w-full h-auto"
              style={{ maxHeight: "500px" }}
            >
              {/* Grid lines */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,255,255,0.03)" strokeWidth="0.5" />
                </pattern>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <radialGradient id="pinGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(0,255,255,0.6)" />
                  <stop offset="100%" stopColor="rgba(0,255,255,0)" />
                </radialGradient>
                <radialGradient id="primaryGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(255,165,0,0.6)" />
                  <stop offset="100%" stopColor="rgba(255,165,0,0)" />
                </radialGradient>
              </defs>
              <rect x="100" y="30" width="700" height="420" fill="url(#grid)" />

              {/* US outline (other states) */}
              <path
                d={OTHER_STATES_OUTLINE}
                fill="rgba(255,255,255,0.02)"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />

              {/* Surrounding states */}
              {SURROUNDING_STATES.map((state) => (
                <path
                  key={state.id}
                  d={state.d}
                  fill={hoveredState === state.id ? "rgba(0,255,255,0.12)" : "rgba(0,255,255,0.05)"}
                  stroke="rgba(0,255,255,0.3)"
                  strokeWidth="1"
                  className="cursor-pointer transition-all duration-300"
                  onMouseEnter={() => setHoveredState(state.id)}
                  onMouseLeave={() => setHoveredState(null)}
                />
              ))}

              {/* Texas - Primary */}
              <path
                d={TX_PRIMARY}
                fill={hoveredState === "TX" ? "rgba(255,165,0,0.25)" : "rgba(255,165,0,0.15)"}
                stroke="rgba(255,165,0,0.6)"
                strokeWidth="1.5"
                className="cursor-pointer transition-all duration-300"
                filter="url(#glow)"
                onMouseEnter={() => setHoveredState("TX")}
                onMouseLeave={() => setHoveredState(null)}
              />

              {/* Location pins */}
              {LOCATION_PINS.map((pin) => (
                <g
                  key={pin.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPin(pin)}
                  onMouseLeave={() => setHoveredPin(null)}
                >
                  {/* Glow circle */}
                  <circle
                    cx={pin.cx}
                    cy={pin.cy}
                    r={pin.type === "primary" ? 12 : 8}
                    fill={pin.type === "primary" ? "url(#primaryGlow)" : "url(#pinGlow)"}
                    className="animate-pulse"
                  />
                  {/* Pin dot */}
                  <circle
                    cx={pin.cx}
                    cy={pin.cy}
                    r={pin.type === "primary" ? 4 : 2.5}
                    fill={pin.type === "primary" ? "#ff9900" : "#00ffff"}
                    stroke={pin.type === "primary" ? "#ff9900" : "#00ffff"}
                    strokeWidth="1"
                    filter="url(#glow)"
                  />
                  {/* Pulse ring for primary */}
                  {pin.type === "primary" && (
                    <circle
                      cx={pin.cx}
                      cy={pin.cy}
                      r="8"
                      fill="none"
                      stroke="#ff9900"
                      strokeWidth="0.5"
                      opacity="0.5"
                    >
                      <animate attributeName="r" from="6" to="18" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                </g>
              ))}

              {/* Hovered state label */}
              {hoveredState && (
                <text
                  x="750"
                  y="60"
                  textAnchor="end"
                  className="font-mono"
                  fill="rgba(0,255,255,0.8)"
                  fontSize="10"
                >
                  {hoveredState === "TX" ? "TEXAS — PRIMARY OPS" : SURROUNDING_STATES.find(s => s.id === hoveredState)?.name.toUpperCase() + " — AVAILABLE"}
                </text>
              )}
            </svg>

            {/* Hover tooltip */}
            {hoveredPin && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-4 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-72 bg-black/90 border border-accent-cyan/30 rounded-lg p-4 backdrop-blur-sm z-30"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${hoveredPin.type === "primary" ? "bg-accent-orange" : "bg-accent-cyan"}`} />
                  <span className="font-mono text-xs font-bold tracking-wider text-foreground">{hoveredPin.name}</span>
                </div>
                <span className={`font-mono text-[9px] tracking-widest ${hoveredPin.type === "primary" ? "text-accent-orange" : "text-accent-cyan"}`}>
                  {hoveredPin.type === "primary" ? "PRIMARY BASE" : hoveredPin.type === "university" ? "UNIVERSITY PARTNER" : "SERVICE AREA"}
                </span>
                <p className="font-mono text-[11px] text-text-secondary mt-2">{hoveredPin.detail}</p>
              </motion.div>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-6 mt-4 font-mono text-[10px] text-text-secondary">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent-orange/60 border border-accent-orange" />
              <span>Primary Operations</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent-cyan border border-accent-cyan" />
              <span>University Partners</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 rounded bg-accent-cyan/10 border border-accent-cyan/30" />
              <span>Available Area</span>
            </div>
            <div className="ml-auto text-accent-green">
              ▸ Available for deployment nationwide with 48hr notice
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
