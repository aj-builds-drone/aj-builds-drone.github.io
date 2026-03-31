"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

interface ROIResult {
  traditionalCost: number;
  droneCost: number;
  savings: number;
  savingsPercent: number;
  traditionalTime: string;
  droneTime: string;
  traditionalAccuracy: string;
  droneAccuracy: string;
}

function calculateROI(acres: number, serviceType: string): ROIResult {
  const configs: Record<string, {
    tradCostPerAcre: number;
    droneCostPerAcre: number;
    tradHoursPerAcre: number;
    droneHoursPerAcre: number;
    tradAccuracy: string;
    droneAccuracy: string;
  }> = {
    survey: {
      tradCostPerAcre: 200,
      droneCostPerAcre: 25,
      tradHoursPerAcre: 2,
      droneHoursPerAcre: 0.1,
      tradAccuracy: "10-30cm",
      droneAccuracy: "<2cm (RTK)",
    },
    inspection: {
      tradCostPerAcre: 500,
      droneCostPerAcre: 75,
      tradHoursPerAcre: 8,
      droneHoursPerAcre: 0.5,
      tradAccuracy: "Visual only",
      droneAccuracy: "Sub-mm defect detection",
    },
    agriculture: {
      tradCostPerAcre: 150,
      droneCostPerAcre: 15,
      tradHoursPerAcre: 1.5,
      droneHoursPerAcre: 0.08,
      tradAccuracy: "Field-level sampling",
      droneAccuracy: "<1cm multispectral",
    },
    environmental: {
      tradCostPerAcre: 300,
      droneCostPerAcre: 40,
      tradHoursPerAcre: 4,
      droneHoursPerAcre: 0.15,
      tradAccuracy: "Point sampling",
      droneAccuracy: "Full-coverage mapping",
    },
  };

  const cfg = configs[serviceType] || configs.survey;
  const traditionalCost = acres * cfg.tradCostPerAcre;
  const droneCost = Math.max(acres * cfg.droneCostPerAcre, 500); // minimum engagement
  const savings = traditionalCost - droneCost;
  const savingsPercent = Math.round((savings / traditionalCost) * 100);

  const tradHours = acres * cfg.tradHoursPerAcre;
  const droneHours = acres * cfg.droneHoursPerAcre;

  const formatTime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} minutes`;
    if (hours < 24) return `${Math.round(hours)} hours`;
    const days = Math.round(hours / 8); // 8-hour work days
    return `${days} work day${days > 1 ? "s" : ""}`;
  };

  return {
    traditionalCost,
    droneCost,
    savings,
    savingsPercent,
    traditionalTime: formatTime(tradHours),
    droneTime: formatTime(droneHours),
    traditionalAccuracy: cfg.tradAccuracy,
    droneAccuracy: cfg.droneAccuracy,
  };
}

export default function ROICalculatorPage() {
  const [acres, setAcres] = useState(100);
  const [serviceType, setServiceType] = useState("survey");

  const result = useMemo(() => calculateROI(acres, serviceType), [acres, serviceType]);

  const serviceTypes = [
    { value: "survey", label: "Land Survey / Mapping" },
    { value: "inspection", label: "Infrastructure Inspection" },
    { value: "agriculture", label: "Agricultural Analysis" },
    { value: "environmental", label: "Environmental Monitoring" },
  ];

  return (
    <main className="min-h-screen pt-24 pb-16">
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-xs text-accent-green tracking-widest">[ROI]</span>
              <div className="h-px flex-1 bg-gradient-to-r from-accent-green/50 to-transparent" />
            </div>
            <h1 className="font-mono text-3xl md:text-4xl font-bold tracking-wider mb-4">
              ROI CALCULATOR
            </h1>
            <p className="text-text-secondary max-w-2xl text-lg mb-12">
              See how drone-based data collection compares to traditional methods for your project.
            </p>
          </motion.div>

          {/* Input Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div>
              <label className="font-mono text-xs tracking-widest text-text-secondary block mb-3">
                SURVEY AREA (ACRES)
              </label>
              <input
                type="range"
                min="10"
                max="5000"
                step="10"
                value={acres}
                onChange={(e) => setAcres(Number(e.target.value))}
                className="w-full accent-accent-green mb-2"
              />
              <div className="flex justify-between items-center">
                <span className="font-mono text-sm text-text-secondary">10 acres</span>
                <span className="font-mono text-2xl text-accent-green font-bold">{acres.toLocaleString()} acres</span>
                <span className="font-mono text-sm text-text-secondary">5,000 acres</span>
              </div>
            </div>
            <div>
              <label className="font-mono text-xs tracking-widest text-text-secondary block mb-3">
                SERVICE TYPE
              </label>
              <div className="grid grid-cols-2 gap-3">
                {serviceTypes.map((st) => (
                  <button
                    key={st.value}
                    onClick={() => setServiceType(st.value)}
                    className={`font-mono text-xs tracking-wider px-4 py-3 rounded border transition-colors ${
                      serviceType === st.value
                        ? "border-accent-green bg-accent-green/10 text-accent-green"
                        : "border-border-dim text-text-secondary hover:border-accent-green/30"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <motion.div
            key={`${acres}-${serviceType}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
          >
            {/* Traditional */}
            <div className="osd-card rounded-lg p-6 hud-corners">
              <h3 className="font-mono text-xs tracking-widest text-red-400 mb-4">TRADITIONAL METHOD</h3>
              <div className="space-y-4">
                <div>
                  <span className="font-mono text-3xl text-red-400 font-bold">
                    ${result.traditionalCost.toLocaleString()}
                  </span>
                  <p className="text-text-secondary text-xs mt-1">Estimated cost</p>
                </div>
                <div>
                  <span className="font-mono text-lg text-text-secondary">{result.traditionalTime}</span>
                  <p className="text-text-secondary text-xs mt-1">Time to complete</p>
                </div>
                <div>
                  <span className="font-mono text-sm text-text-secondary">{result.traditionalAccuracy}</span>
                  <p className="text-text-secondary text-xs mt-1">Accuracy</p>
                </div>
              </div>
            </div>

            {/* Savings */}
            <div className="osd-card rounded-lg p-6 hud-corners border-accent-green/30 bg-accent-green/5">
              <h3 className="font-mono text-xs tracking-widest text-accent-green mb-4">YOUR SAVINGS</h3>
              <div className="text-center">
                <span className="font-mono text-5xl text-accent-green font-bold">
                  {result.savingsPercent}%
                </span>
                <p className="text-text-secondary text-sm mt-2">Cost reduction</p>
                <div className="mt-6 font-mono text-2xl text-accent-green font-bold">
                  ${result.savings.toLocaleString()}
                </div>
                <p className="text-text-secondary text-xs mt-1">Total saved</p>
              </div>
            </div>

            {/* Drone */}
            <div className="osd-card rounded-lg p-6 hud-corners">
              <h3 className="font-mono text-xs tracking-widest text-accent-green mb-4">DRONE METHOD</h3>
              <div className="space-y-4">
                <div>
                  <span className="font-mono text-3xl text-accent-green font-bold">
                    ${result.droneCost.toLocaleString()}
                  </span>
                  <p className="text-text-secondary text-xs mt-1">Estimated cost</p>
                </div>
                <div>
                  <span className="font-mono text-lg text-accent-green">{result.droneTime}</span>
                  <p className="text-text-secondary text-xs mt-1">Time to complete</p>
                </div>
                <div>
                  <span className="font-mono text-sm text-accent-green">{result.droneAccuracy}</span>
                  <p className="text-text-secondary text-xs mt-1">Accuracy</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Additional Benefits */}
          <div className="osd-card rounded-lg p-6 hud-corners mb-12">
            <h3 className="font-mono text-sm tracking-widest text-accent-orange mb-4">ADDITIONAL BENEFITS</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { icon: "🔄", title: "Repeatable", desc: "Same flight path every time for longitudinal studies" },
                { icon: "🛡️", title: "Safety", desc: "No personnel in hazardous areas or at height" },
                { icon: "📊", title: "Rich Data", desc: "Multispectral, thermal, LiDAR, RGB — simultaneously" },
                { icon: "⚡", title: "Rapid Deploy", desc: "Same-day mobilization for time-sensitive work" },
              ].map((b) => (
                <div key={b.title} className="text-center">
                  <span className="text-2xl">{b.icon}</span>
                  <h4 className="font-mono text-xs font-bold tracking-wider mt-2 mb-1">{b.title}</h4>
                  <p className="text-text-secondary text-xs">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <p className="text-text-secondary mb-4">
              These estimates are based on industry averages. Get an exact quote for your project.
            </p>
            <Link
              href="/contact"
              className="btn-glitch inline-flex items-center gap-2 px-10 py-4 bg-accent-green text-black font-mono text-sm tracking-widest font-bold rounded hover:bg-accent-green/90 transition-colors"
            >
              ▶ GET EXACT QUOTE
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
