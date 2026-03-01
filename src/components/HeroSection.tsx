"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

const capabilities = [
  { label: "PX4 AUTOPILOT", status: "CERTIFIED" },
  { label: "ROS2 HUMBLE", status: "ACTIVE" },
  { label: "GAZEBO SIM", status: "READY" },
  { label: "COMPUTER VISION", status: "ONLINE" },
  { label: "SLAM NAV", status: "OPERATIONAL" },
  { label: "OAK-D DEPTH AI", status: "LINKED" },
  { label: "MISSION PLANNER", status: "SYNCED" },
  { label: "CUSTOM FIRMWARE", status: "DEPLOYED" },
];

export default function HeroSection() {
  const [dateStr, setDateStr] = useState("----/--/--");

  useEffect(() => {
    setDateStr(new Date().toISOString().split("T")[0]);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden grid-bg">
      {/* Scanning effect */}
      <div className="absolute inset-0 scan-sweep overflow-hidden" />

      {/* Grid fade overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        {/* HUD top bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-4 mb-8"
        >
          <div className="w-2 h-2 bg-accent-green pulse-green" />
          <span className="font-mono text-[11px] tracking-[0.3em] text-accent-green">
            GROUND CONTROL STATION v2.4.1 INITIALIZED
          </span>
          <div className="h-px flex-1 bg-accent-green/20" />
          <span className="font-mono text-[11px] text-text-secondary">
            {dateStr}
          </span>
        </motion.div>

        {/* Main Headline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="mb-8"
        >
          <h1 className="font-mono text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            <span className="text-foreground">UAV Systems Contractor:</span>
            <br />
            <span className="text-accent-orange">From Simulation</span>
            <br />
            <span className="text-accent-green">to Maiden Flight.</span>
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-text-secondary max-w-2xl text-lg sm:text-xl leading-relaxed mb-10"
        >
          End-to-end drone development — custom hardware integration, autonomous
          flight software, computer vision pipelines, and high-fidelity digital
          twin simulation. Built to spec. Tested to standard.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="flex flex-col sm:flex-row gap-4 mb-16"
        >
          <Link
            href="/contact"
            className="btn-glitch inline-flex items-center justify-center gap-2 px-8 py-4 bg-accent-orange text-black font-mono text-sm tracking-widest font-bold rounded hover:bg-accent-orange/90 transition-colors"
          >
            <span>▶</span> REQUEST FOR QUOTE
          </Link>
          <Link
            href="/projects"
            className="btn-glitch inline-flex items-center justify-center gap-2 px-8 py-4 border border-accent-green text-accent-green font-mono text-sm tracking-widest rounded hover:bg-accent-green/10 transition-colors"
          >
            <span>◈</span> VIEW HANGAR
          </Link>
        </motion.div>

        {/* Capability Status Ticker */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="border-t border-b border-border-dim py-3 overflow-hidden"
        >
          <div className="flex items-center">
            <span className="font-mono text-[11px] tracking-widest text-accent-orange mr-4 shrink-0">
              CAPABILITY STATUS ▸
            </span>
            <div className="overflow-hidden flex-1">
              <div className="ticker-scroll flex items-center gap-6 whitespace-nowrap w-max">
                {[...capabilities, ...capabilities].map((cap, i) => (
                  <span key={i} className="inline-flex items-center gap-2 font-mono text-xs">
                    <span className="w-1 h-1 rounded-full bg-accent-green" />
                    <span className="text-text-secondary">{cap.label}</span>
                    <span className="text-accent-green">[{cap.status}]</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
