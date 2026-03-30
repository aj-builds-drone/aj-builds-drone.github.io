"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

/* ─── Types ─── */
type Point = { x: number; y: number };

interface CameraType {
  name: string;
  fovDeg: number; // horizontal FOV in degrees
  resolutionMP: number;
  frameSize: number; // MB per frame
}

const CAMERAS: CameraType[] = [
  { name: "DJI Zenmuse P1 (45MP)", fovDeg: 63.5, fovDegV: 46.8, resolutionMP: 45, frameSize: 30 } as CameraType & { fovDegV: number },
  { name: "DJI Zenmuse L2 (LiDAR)", fovDeg: 70, resolutionMP: 20, frameSize: 8 },
  { name: "MicaSense RedEdge-P", fovDeg: 47.2, resolutionMP: 6, frameSize: 12 },
  { name: "Sony A7R IV (61MP)", fovDeg: 63.9, resolutionMP: 61, frameSize: 45 },
  { name: "FLIR Vue TZ20 (Thermal)", fovDeg: 57.4, resolutionMP: 0.3, frameSize: 1 },
];

/* ─── Helpers ─── */
function polygonArea(pts: Point[]): number {
  if (pts.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

function centroid(pts: Point[]): Point {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return { x: cx, y: cy };
}

function polygonBounds(pts: Point[]) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** Generate lawnmower flight path lines across polygon bounding box */
function generateFlightPath(pts: Point[], spacingPx: number): Point[] {
  if (pts.length < 3 || spacingPx <= 0) return [];
  const { minX, maxX, minY, maxY } = polygonBounds(pts);
  const path: Point[] = [];
  let left = true;
  for (let y = minY; y <= maxY; y += spacingPx) {
    if (left) {
      path.push({ x: minX, y }, { x: maxX, y });
    } else {
      path.push({ x: maxX, y }, { x: minX, y });
    }
    left = !left;
  }
  return path;
}

function pathLength(pts: Point[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return d;
}

/* ─── Constants ─── */
const SVG_W = 800;
const SVG_H = 600;
const SCALE = 0.5; // 1 SVG px = 0.5 m at default

/* ─── Main Component ─── */
export default function FlightPlanner() {
  const [points, setPoints] = useState<Point[]>([]);
  const [closed, setClosed] = useState(false);
  const [altitude, setAltitude] = useState(80); // metres
  const [overlap, setOverlap] = useState(75); // %
  const [cameraIdx, setCameraIdx] = useState(0);
  const [speed, setSpeed] = useState(8); // m/s
  const svgRef = useRef<SVGSVGElement>(null);

  /* drone animation */
  const [droneProgress, setDroneProgress] = useState(0);
  const animRef = useRef<number>(0);

  const camera = CAMERAS[cameraIdx];

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (closed) return;
      const svg = svgRef.current!;
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * SVG_W;
      const y = ((e.clientY - rect.top) / rect.height) * SVG_H;
      // close polygon if clicking near first point
      if (points.length >= 3) {
        const d = Math.hypot(x - points[0].x, y - points[0].y);
        if (d < 15) {
          setClosed(true);
          return;
        }
      }
      setPoints((prev) => [...prev, { x, y }]);
    },
    [closed, points]
  );

  const reset = () => {
    setPoints([]);
    setClosed(false);
    setDroneProgress(0);
  };

  /* calculations */
  const calcs = useMemo(() => {
    if (!closed || points.length < 3) return null;
    const areaPx = polygonArea(points);
    const areaM2 = areaPx * SCALE * SCALE;
    const areaAcres = areaM2 / 4046.86;
    const fovRad = (camera.fovDeg * Math.PI) / 180;
    const swathM = 2 * altitude * Math.tan(fovRad / 2);
    const spacingM = swathM * (1 - overlap / 100);
    const spacingPx = spacingM / SCALE;

    const fp = generateFlightPath(points, spacingPx);
    const totalDistPx = pathLength(fp);
    const totalDistM = totalDistPx * SCALE;
    const passes = Math.ceil((polygonBounds(points).maxY - polygonBounds(points).minY) * SCALE / spacingM);
    const flightTimeSec = totalDistM / speed + passes * 3; // 3s per turn
    const flightTimeMin = flightTimeSec / 60;
    const batterySwaps = Math.max(0, Math.ceil(flightTimeMin / 25) - 1);
    const frameInterval = spacingM; // one frame per spacing
    const numFrames = Math.ceil(totalDistM / frameInterval);
    const dataGB = (numFrames * camera.frameSize) / 1024;

    return { areaM2, areaAcres, swathM, spacingPx, fp, totalDistM, passes, flightTimeMin, batterySwaps, numFrames, dataGB };
  }, [closed, points, altitude, overlap, cameraIdx, speed, camera]);

  /* animate drone along path */
  useEffect(() => {
    if (!calcs?.fp.length) return;
    let start: number | null = null;
    const duration = calcs.flightTimeMin * 1000; // speed up: 1 min = 1s
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = ((ts - start) % duration) / duration;
      setDroneProgress(p);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [calcs]);

  const dronePos = useMemo(() => {
    if (!calcs?.fp.length) return null;
    const total = pathLength(calcs.fp);
    let target = total * droneProgress;
    for (let i = 1; i < calcs.fp.length; i++) {
      const seg = Math.hypot(calcs.fp[i].x - calcs.fp[i - 1].x, calcs.fp[i].y - calcs.fp[i - 1].y);
      if (target <= seg) {
        const t = target / seg;
        return {
          x: calcs.fp[i - 1].x + (calcs.fp[i].x - calcs.fp[i - 1].x) * t,
          y: calcs.fp[i - 1].y + (calcs.fp[i].y - calcs.fp[i - 1].y) * t,
        };
      }
      target -= seg;
    }
    return calcs.fp[calcs.fp.length - 1];
  }, [calcs, droneProgress]);

  return (
    <div className="max-w-7xl mx-auto px-4 pb-20">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="font-mono text-xs text-accent-orange tracking-widest">[FLT-PLN]</span>
          <div className="h-px flex-1 bg-gradient-to-r from-accent-orange/50 to-transparent" />
        </div>
        <h1 className="font-mono text-2xl md:text-4xl font-bold tracking-wider">FLIGHT PLANNER</h1>
        <p className="text-zinc-400 mt-2 max-w-2xl">
          Draw a survey area on the map below, adjust mission parameters, and see real-time flight calculations.
          This is how we plan every data collection mission.
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        {/* SVG Canvas */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative border border-accent-orange/30 rounded-lg overflow-hidden bg-black/60 backdrop-blur"
        >
          {/* instruction overlay */}
          <AnimatePresence>
            {!closed && points.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
              >
                <div className="text-center">
                  <div className="text-accent-orange font-mono text-lg mb-2">CLICK TO DRAW SURVEY AREA</div>
                  <div className="text-zinc-500 text-sm">Click points to define polygon • Click first point to close</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full cursor-crosshair"
            onClick={handleSvgClick}
            style={{ aspectRatio: `${SVG_W}/${SVG_H}` }}
          >
            {/* Grid */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(245,158,11,0.08)" strokeWidth="0.5" />
              </pattern>
              <pattern id="gridLg" width="200" height="200" patternUnits="userSpaceOnUse">
                <path d="M 200 0 L 0 0 0 200" fill="none" stroke="rgba(245,158,11,0.15)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width={SVG_W} height={SVG_H} fill="url(#grid)" />
            <rect width={SVG_W} height={SVG_H} fill="url(#gridLg)" />

            {/* Scanline */}
            <motion.rect
              x={0}
              width={SVG_W}
              height={2}
              fill="rgba(245,158,11,0.12)"
              animate={{ y: [0, SVG_H] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />

            {/* Flight path */}
            {calcs?.fp && (
              <polyline
                points={calcs.fp.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="rgba(59,130,246,0.5)"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
            )}

            {/* Polygon */}
            {points.length >= 2 && (
              <polyline
                points={[...points, ...(closed ? [points[0]] : [])].map((p) => `${p.x},${p.y}`).join(" ")}
                fill={closed ? "rgba(245,158,11,0.08)" : "none"}
                stroke="rgba(245,158,11,0.8)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            )}

            {/* Vertices */}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="5" fill="rgba(245,158,11,0.9)" stroke="#000" strokeWidth="1" />
                <text x={p.x + 8} y={p.y - 8} fill="rgba(245,158,11,0.6)" fontSize="10" fontFamily="monospace">
                  P{i + 1}
                </text>
              </g>
            ))}

            {/* Drone icon */}
            {dronePos && (
              <g>
                {/* glow */}
                <circle cx={dronePos.x} cy={dronePos.y} r="12" fill="rgba(59,130,246,0.2)">
                  <animate attributeName="r" values="10;16;10" dur="1s" repeatCount="indefinite" />
                </circle>
                {/* body */}
                <circle cx={dronePos.x} cy={dronePos.y} r="5" fill="#3b82f6" stroke="#1e3a5f" strokeWidth="1.5" />
                {/* arms */}
                {[0, 90, 180, 270].map((deg) => {
                  const rad = (deg * Math.PI) / 180;
                  return (
                    <line
                      key={deg}
                      x1={dronePos.x}
                      y1={dronePos.y}
                      x2={dronePos.x + Math.cos(rad) * 9}
                      y2={dronePos.y + Math.sin(rad) * 9}
                      stroke="#3b82f6"
                      strokeWidth="1.5"
                    />
                  );
                })}
                {/* propellers */}
                {[45, 135, 225, 315].map((deg) => {
                  const rad = (deg * Math.PI) / 180;
                  return (
                    <circle
                      key={deg}
                      cx={dronePos.x + Math.cos(rad) * 9}
                      cy={dronePos.y + Math.sin(rad) * 9}
                      r="3"
                      fill="none"
                      stroke="rgba(59,130,246,0.6)"
                      strokeWidth="0.8"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from={`0 ${dronePos.x + Math.cos(rad) * 9} ${dronePos.y + Math.sin(rad) * 9}`}
                        to={`360 ${dronePos.x + Math.cos(rad) * 9} ${dronePos.y + Math.sin(rad) * 9}`}
                        dur="0.3s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  );
                })}
              </g>
            )}

            {/* Scale indicator */}
            <g transform={`translate(${SVG_W - 120}, ${SVG_H - 30})`}>
              <line x1="0" y1="0" x2="80" y2="0" stroke="rgba(245,158,11,0.5)" strokeWidth="1" />
              <line x1="0" y1="-4" x2="0" y2="4" stroke="rgba(245,158,11,0.5)" strokeWidth="1" />
              <line x1="80" y1="-4" x2="80" y2="4" stroke="rgba(245,158,11,0.5)" strokeWidth="1" />
              <text x="40" y="-6" fill="rgba(245,158,11,0.5)" fontSize="9" fontFamily="monospace" textAnchor="middle">
                {(80 * SCALE).toFixed(0)}m
              </text>
            </g>
          </svg>

          {/* Reset button */}
          {points.length > 0 && (
            <button
              onClick={reset}
              className="absolute top-3 right-3 px-3 py-1 text-xs font-mono bg-red-900/50 text-red-300 border border-red-700/50 rounded hover:bg-red-800/60 transition"
            >
              RESET
            </button>
          )}
        </motion.div>

        {/* Parameters Panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          {/* Controls */}
          <div className="border border-accent-orange/20 rounded-lg p-4 bg-black/40 backdrop-blur">
            <h3 className="font-mono text-xs text-accent-orange tracking-widest mb-4">[PARAMETERS]</h3>

            <label className="block mb-3">
              <span className="font-mono text-xs text-zinc-400">ALTITUDE: {altitude}m ({(altitude * 3.28).toFixed(0)}ft)</span>
              <input
                type="range"
                min={20}
                max={400}
                value={altitude}
                onChange={(e) => setAltitude(+e.target.value)}
                className="w-full mt-1 accent-amber-500"
              />
            </label>

            <label className="block mb-3">
              <span className="font-mono text-xs text-zinc-400">OVERLAP: {overlap}%</span>
              <input
                type="range"
                min={30}
                max={90}
                value={overlap}
                onChange={(e) => setOverlap(+e.target.value)}
                className="w-full mt-1 accent-amber-500"
              />
            </label>

            <label className="block mb-3">
              <span className="font-mono text-xs text-zinc-400">SPEED: {speed} m/s ({(speed * 2.237).toFixed(1)} mph)</span>
              <input
                type="range"
                min={2}
                max={20}
                value={speed}
                onChange={(e) => setSpeed(+e.target.value)}
                className="w-full mt-1 accent-amber-500"
              />
            </label>

            <label className="block mb-1">
              <span className="font-mono text-xs text-zinc-400">CAMERA</span>
              <select
                value={cameraIdx}
                onChange={(e) => setCameraIdx(+e.target.value)}
                className="w-full mt-1 bg-black/60 border border-zinc-700 rounded px-2 py-1.5 font-mono text-xs text-zinc-200"
              >
                {CAMERAS.map((c, i) => (
                  <option key={i} value={i}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Results */}
          <div className="border border-accent-orange/20 rounded-lg p-4 bg-black/40 backdrop-blur">
            <h3 className="font-mono text-xs text-accent-orange tracking-widest mb-4">[MISSION ESTIMATE]</h3>
            {calcs ? (
              <div className="space-y-3 font-mono text-sm">
                <Stat label="Survey Area" value={`${calcs.areaAcres.toFixed(1)} acres (${(calcs.areaM2 / 10000).toFixed(2)} ha)`} />
                <Stat label="Swath Width" value={`${calcs.swathM.toFixed(1)} m`} />
                <Stat label="Flight Passes" value={calcs.passes.toString()} />
                <Stat label="Total Distance" value={`${(calcs.totalDistM / 1000).toFixed(1)} km`} />
                <Stat label="Flight Time" value={`${calcs.flightTimeMin.toFixed(1)} min`} highlight />
                <Stat label="Battery Swaps" value={calcs.batterySwaps.toString()} highlight={calcs.batterySwaps > 0} />
                <Stat label="Photo Count" value={calcs.numFrames.toLocaleString()} />
                <Stat label="Est. Data Volume" value={`${calcs.dataGB.toFixed(1)} GB`} highlight />
              </div>
            ) : (
              <p className="text-zinc-500 text-xs">Draw a survey polygon to see estimates…</p>
            )}
          </div>

          {/* CTA */}
          <Link
            href="/contact"
            className="block w-full text-center font-mono text-sm bg-accent-orange/90 hover:bg-accent-orange text-black py-3 rounded-lg transition font-bold tracking-wider"
          >
            PLAN YOUR MISSION →
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-zinc-500 text-xs">{label}</span>
      <span className={highlight ? "text-accent-orange font-bold" : "text-zinc-200"}>{value}</span>
    </div>
  );
}
