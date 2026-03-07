"use client";

/* ── Drone Telemetry Dashboard ──
   Simulated live flight data with SVG gauges, attitude indicator,
   and real-time data readouts. State machine cycles through a full
   flight: IDLE → ARMED → TAKEOFF → MISSION → RTL → LAND → repeat. */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import AttitudeIndicator from "./AttitudeIndicator";
import {
  ArcGauge,
  BatteryGauge,
  SignalBars,
  CompassHeading,
  ModeBadge,
  DataRow,
} from "./TelemetryGauges";
import { createTelemetrySimulator, type TelemetryData } from "./telemetrySimulator";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function TelemetryDashboard() {
  const [data, setData] = useState<TelemetryData | null>(null);
  const simRef = useRef<ReturnType<typeof createTelemetrySimulator> | null>(null);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number>(0);

  const animate = useCallback((time: number) => {
    if (!simRef.current) return;
    if (lastTimeRef.current === 0) lastTimeRef.current = time;
    const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1); // cap dt
    lastTimeRef.current = time;

    const newData = simRef.current.tick(dt);
    setData(newData);
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    simRef.current = createTelemetrySimulator();
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  if (!data) return null;

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-xs text-accent-orange tracking-widest">[TLM]</span>
            <div className="h-px flex-1 bg-gradient-to-r from-accent-orange/50 to-transparent" />
          </div>
          <h2 className="font-mono text-2xl md:text-3xl font-bold tracking-wider">
            LIVE TELEMETRY
          </h2>
          <p className="mt-2 text-text-secondary text-sm">
            Simulated UAV flight data — full mission cycle with real-time SVG gauges.
          </p>
        </motion.div>

        {/* Dashboard Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative border border-border-dim bg-surface rounded-lg overflow-hidden hud-corners"
        >
          {/* Top status bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-b border-border-dim">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-accent-green rounded-full pulse-green" />
              <span className="font-mono text-[10px] tracking-[0.2em] text-accent-green">
                GCS TELEMETRY FEED
              </span>
            </div>
            <ModeBadge mode={data.mode} armed={data.armed} />
            <span className="font-mono text-[10px] text-text-secondary">
              T+ {formatTime(data.flightTime)}
            </span>
          </div>

          {/* Main gauges grid */}
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Left column: Attitude + Compass */}
              <div className="flex flex-col items-center gap-4">
                <AttitudeIndicator pitch={data.pitch} roll={data.roll} size={180} />
                <CompassHeading heading={data.heading} />
              </div>

              {/* Center column: Arc gauges */}
              <div className="grid grid-cols-2 gap-4 place-items-center">
                <ArcGauge value={data.altitude} max={150} label="ALTITUDE" unit="m AGL" color="#00FF41" />
                <ArcGauge value={data.speed} max={20} label="GND SPEED" unit="m/s" color="#00D4FF" />
                <ArcGauge value={Math.abs(data.verticalSpeed)} max={5} label="V/S" unit="m/s" color={data.verticalSpeed >= 0 ? "#00FF41" : "#FF5F1F"} />
                <ArcGauge value={data.current} max={40} label="CURRENT" unit="A" color="#FF5F1F" />
              </div>

              {/* Right column: Data readouts */}
              <div className="space-y-5">
                {/* Battery + Signal */}
                <div className="flex items-start justify-around">
                  <BatteryGauge percent={data.battery} voltage={data.voltage} />
                  <SignalBars rssi={data.rssi} />
                </div>

                {/* GPS Block */}
                <div className="bg-background border border-border-dim rounded p-3 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 bg-accent-green rounded-full" />
                    <span className="font-mono text-[10px] tracking-widest text-accent-green">GPS FIX 3D</span>
                  </div>
                  <DataRow label="LAT" value={data.gpsLat.toFixed(6)} unit="°" />
                  <DataRow label="LON" value={data.gpsLon.toFixed(6)} unit="°" />
                  <DataRow label="SATS" value={data.gpsSats.toString()} color="text-accent-green" />
                  <DataRow label="HDOP" value={data.gpsHdop.toFixed(1)} />
                </div>

                {/* Mission progress */}
                <div className="bg-background border border-border-dim rounded p-3 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-1.5 h-1.5 bg-accent-orange rounded-full" />
                    <span className="font-mono text-[10px] tracking-widest text-accent-orange">MISSION</span>
                  </div>
                  <DataRow label="WP" value={`${data.waypointIndex} / ${data.waypointTotal}`} color="text-accent-orange" />
                  <div className="w-full bg-[#1a1a1a] rounded-full h-1.5 mt-1">
                    <div
                      className="h-1.5 rounded-full bg-accent-orange transition-all duration-300"
                      style={{ width: `${(data.waypointIndex / data.waypointTotal) * 100}%` }}
                    />
                  </div>
                  <DataRow label="ALT TGT" value={data.altitudeTarget.toFixed(0)} unit="m" />
                  <DataRow label="HDG" value={`${data.heading.toFixed(0)}°`} />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0a] border-t border-border-dim font-mono text-[9px] text-text-secondary tracking-wider">
            <span>MAVLink v2.0 // 10Hz</span>
            <span>PX4 v1.15.4</span>
            <span>FRAME: GENERIC QUAD X</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
