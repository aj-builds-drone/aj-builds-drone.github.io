"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";

/* ── Service Pricing Calculator ──
   Slider-based estimator for drone services.
   Generates a rough quote based on area, complexity, and deliverables. */

interface Deliverable {
  id: string;
  label: string;
  price: number;
}

const DELIVERABLES: Deliverable[] = [
  { id: "photo-4k", label: "4K Aerial Photography", price: 150 },
  { id: "video-cinematic", label: "Cinematic Video Capture", price: 300 },
  { id: "orthomosaic", label: "Orthomosaic Map", price: 500 },
  { id: "3d-model", label: "3D Terrain Model", price: 750 },
  { id: "thermal", label: "Thermal Inspection", price: 400 },
  { id: "lidar-scan", label: "LiDAR Point Cloud", price: 900 },
  { id: "report", label: "Technical Report & Analysis", price: 200 },
  { id: "raw-data", label: "Raw Sensor Data Package", price: 100 },
];

const COMPLEXITY_LABELS = ["Basic", "Standard", "Complex", "Advanced"];
const COMPLEXITY_MULTIPLIERS = [1.0, 1.3, 1.7, 2.2];

export default function PricingCalculator() {
  const [area, setArea] = useState(5); // acres
  const [complexity, setComplexity] = useState(1); // 0-3
  const [selected, setSelected] = useState<Set<string>>(new Set(["photo-4k"]));

  function toggleDeliverable(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const estimate = useMemo(() => {
    const baseDeliverables = DELIVERABLES.filter((d) => selected.has(d.id)).reduce(
      (sum, d) => sum + d.price,
      0,
    );
    const areaFactor = Math.max(1, area / 5); // Scales above 5 acres
    const complexityMultiplier = COMPLEXITY_MULTIPLIERS[complexity];
    const mobilization = 150; // Base mobilization fee
    const subtotal = baseDeliverables * areaFactor * complexityMultiplier + mobilization;
    return Math.round(subtotal / 10) * 10; // Round to nearest $10
  }, [area, complexity, selected]);

  return (
    <section id="pricing-calculator" className="py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <span className="font-mono text-xs text-accent-cyan tracking-widest">[EST]</span>
          <div className="h-px flex-1 bg-gradient-to-r from-accent-cyan/50 to-transparent" />
        </div>
        <h2 className="font-mono text-2xl md:text-3xl font-bold tracking-wider mb-2">
          MISSION COST ESTIMATOR
        </h2>
        <p className="text-text-secondary text-sm mb-10">
          Configure your mission parameters for a rough cost estimate. Final pricing is determined after site assessment.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column — Controls */}
          <div className="space-y-8">
            {/* Area Slider */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="font-mono text-xs tracking-widest text-text-secondary">
                  SURVEY AREA
                </label>
                <span className="font-mono text-sm text-accent-orange font-bold">{area} acres</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={area}
                onChange={(e) => setArea(Number(e.target.value))}
                className="w-full h-1 bg-border-dim rounded-full appearance-none cursor-pointer
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                           [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-orange [&::-webkit-slider-thumb]:cursor-pointer
                           [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                           [&::-moz-range-thumb]:bg-accent-orange [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
              />
              <div className="flex justify-between font-mono text-[10px] text-text-secondary/50 mt-1">
                <span>1 ac</span>
                <span>50 ac</span>
                <span>100 ac</span>
              </div>
            </div>

            {/* Complexity */}
            <div>
              <label className="font-mono text-xs tracking-widest text-text-secondary block mb-3">
                MISSION COMPLEXITY
              </label>
              <div className="grid grid-cols-4 gap-2">
                {COMPLEXITY_LABELS.map((label, i) => (
                  <button
                    key={label}
                    onClick={() => setComplexity(i)}
                    className={`py-2 px-1 rounded border font-mono text-[10px] tracking-widest transition-all ${
                      complexity === i
                        ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                        : "border-border-dim text-text-secondary hover:border-accent-cyan/30"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="font-mono text-[10px] text-text-secondary/60 mt-2">
                {complexity === 0 && "Open terrain, clear weather, standard altitude"}
                {complexity === 1 && "Mixed terrain, some obstacles, moderate coordination"}
                {complexity === 2 && "Urban/industrial, airspace authorization required"}
                {complexity === 3 && "Confined spaces, night ops, multi-sensor fusion"}
              </p>
            </div>

            {/* Deliverables */}
            <div>
              <label className="font-mono text-xs tracking-widest text-text-secondary block mb-3">
                DELIVERABLES
              </label>
              <div className="grid grid-cols-1 gap-2">
                {DELIVERABLES.map((d) => {
                  const isSelected = selected.has(d.id);
                  return (
                    <button
                      key={d.id}
                      onClick={() => toggleDeliverable(d.id)}
                      className={`flex items-center justify-between px-3 py-2 rounded border text-left transition-all ${
                        isSelected
                          ? "border-accent-green/50 bg-accent-green/5"
                          : "border-border-dim hover:border-accent-green/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-xs ${isSelected ? "text-accent-green" : "text-text-secondary/30"}`}
                        >
                          {isSelected ? "☑" : "☐"}
                        </span>
                        <span className={`font-mono text-xs ${isSelected ? "text-foreground" : "text-text-secondary"}`}>
                          {d.label}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-accent-orange">${d.price}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column — Estimate Output */}
          <div>
            <motion.div
              key={estimate}
              initial={{ scale: 0.98, opacity: 0.7 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="sticky top-24 border border-border-dim rounded-lg p-6 bg-surface/50"
            >
              <div className="font-mono text-[10px] tracking-widest text-text-secondary mb-4">
                ESTIMATED MISSION COST
              </div>

              <div className="text-center py-6 border-b border-border-dim mb-4">
                <div className="font-mono text-4xl md:text-5xl font-bold text-accent-green">
                  ${estimate.toLocaleString()}
                </div>
                <div className="font-mono text-[10px] text-text-secondary mt-2">
                  USD • ROUGH ESTIMATE
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-2 mb-6">
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-text-secondary">Survey Area</span>
                  <span>{area} acres</span>
                </div>
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-text-secondary">Complexity</span>
                  <span>
                    {COMPLEXITY_LABELS[complexity]} (×{COMPLEXITY_MULTIPLIERS[complexity]})
                  </span>
                </div>
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-text-secondary">Deliverables</span>
                  <span>{selected.size} selected</span>
                </div>
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-text-secondary">Mobilization Fee</span>
                  <span>$150</span>
                </div>
              </div>

              {/* Selected deliverables list */}
              {selected.size > 0 && (
                <div className="border-t border-border-dim pt-4 mb-6">
                  <div className="font-mono text-[10px] tracking-widest text-text-secondary mb-2">
                    INCLUDED
                  </div>
                  {DELIVERABLES.filter((d) => selected.has(d.id)).map((d) => (
                    <div key={d.id} className="flex items-center gap-2 font-mono text-xs text-accent-green mb-1">
                      <span>▸</span>
                      <span>{d.label}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="font-mono text-[10px] text-text-secondary/60 mb-4">
                * Estimate is for budgeting purposes only. Final quote provided after site assessment and mission planning.
              </div>

              <a
                href="/contact"
                className="btn-glitch block w-full text-center px-6 py-3 bg-accent-orange text-black font-mono text-xs tracking-widest font-bold rounded hover:bg-accent-orange/90 transition-colors"
              >
                ▶ REQUEST FORMAL QUOTE
              </a>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
