"use client";

import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

/* ── Types ── */
interface SensorOption {
  id: string;
  label: string;
  costPerMission: number;
  equipmentCost: number;
}

/* ── Constants ── */
const RESEARCH_TYPES = [
  { id: "field-survey", label: "Field Survey" },
  { id: "structural-inspection", label: "Structural Inspection" },
  { id: "environmental-monitoring", label: "Environmental Monitoring" },
  { id: "agricultural", label: "Agricultural" },
  { id: "custom", label: "Custom Research" },
];

const FREQUENCIES = [
  { id: "one-time", label: "One-Time", missionsPerMonth: 0, totalMissions: 1 },
  { id: "weekly", label: "Weekly", missionsPerMonth: 4, totalMissions: 0 },
  { id: "monthly", label: "Monthly", missionsPerMonth: 1, totalMissions: 0 },
  { id: "continuous", label: "Continuous", missionsPerMonth: 20, totalMissions: 0 },
];

const AREA_SIZES = [
  { id: "small", label: "Small (<10 acres)", multiplier: 1.0, traditional: 800 },
  { id: "medium", label: "Medium (10-100 acres)", multiplier: 2.5, traditional: 3500 },
  { id: "large", label: "Large (100+ acres)", multiplier: 5.0, traditional: 12000 },
];

const SENSORS: SensorOption[] = [
  { id: "rgb", label: "RGB Camera", costPerMission: 0, equipmentCost: 0 },
  { id: "multispectral", label: "Multispectral", costPerMission: 150, equipmentCost: 6000 },
  { id: "thermal", label: "Thermal", costPerMission: 100, equipmentCost: 4500 },
  { id: "lidar", label: "LiDAR", costPerMission: 250, equipmentCost: 15000 },
  { id: "custom-payload", label: "Custom Payload", costPerMission: 200, equipmentCost: 8000 },
];

const DURATIONS = [3, 6, 12, 24, 36];

const RESEARCH_BASE_COSTS: Record<string, number> = {
  "field-survey": 400,
  "structural-inspection": 600,
  "environmental-monitoring": 500,
  "agricultural": 450,
  "custom": 700,
};

const TRADITIONAL_MULTIPLIERS: Record<string, number> = {
  "field-survey": 3.2,
  "structural-inspection": 4.5,
  "environmental-monitoring": 3.8,
  "agricultural": 2.8,
  "custom": 4.0,
};

export default function GrantBudgetCalculator() {
  const [researchType, setResearchType] = useState("field-survey");
  const [frequency, setFrequency] = useState("monthly");
  const [areaSize, setAreaSize] = useState("small");
  const [selectedSensors, setSelectedSensors] = useState<Set<string>>(new Set(["rgb"]));
  const [duration, setDuration] = useState(12);
  const pdfRef = useRef<HTMLDivElement>(null);

  function toggleSensor(id: string) {
    setSelectedSensors((prev) => {
      const next = new Set(prev);
      if (id === "rgb") return next; // RGB always included
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const estimate = useMemo(() => {
    const freq = FREQUENCIES.find((f) => f.id === frequency)!;
    const area = AREA_SIZES.find((a) => a.id === areaSize)!;
    const baseCost = RESEARCH_BASE_COSTS[researchType];
    const sensors = SENSORS.filter((s) => selectedSensors.has(s.id));

    // Calculate total missions
    const totalMissions = freq.totalMissions || freq.missionsPerMonth * duration;

    // Per-mission cost
    const sensorMissionCost = sensors.reduce((s, sensor) => s + sensor.costPerMission, 0);
    const perMission = (baseCost + sensorMissionCost) * area.multiplier;

    // Equipment (one-time)
    const equipmentCost = sensors.reduce((s, sensor) => s + sensor.equipmentCost, 0);

    // Operator cost (per mission)
    const operatorPerMission = perMission * 0.35;
    const operatorTotal = operatorPerMission * totalMissions;

    // Data processing (per mission)
    const dataProcessingPerMission = perMission * 0.25;
    const dataProcessingTotal = dataProcessingPerMission * totalMissions;

    // Reporting (monthly)
    const reportingMonthly = 300 * area.multiplier;
    const reportingTotal = reportingMonthly * duration;

    // Mission operations total
    const missionOpsTotal = perMission * totalMissions;

    // Total
    const totalLow = Math.round((equipmentCost + missionOpsTotal + dataProcessingTotal + reportingTotal) * 0.85 / 100) * 100;
    const totalHigh = Math.round((equipmentCost + missionOpsTotal + dataProcessingTotal + reportingTotal) * 1.15 / 100) * 100;
    const totalMid = Math.round((totalLow + totalHigh) / 2 / 100) * 100;

    // Traditional comparison
    const traditionalPerMission = area.traditional * TRADITIONAL_MULTIPLIERS[researchType];
    const traditionalTotal = traditionalPerMission * totalMissions + equipmentCost * 1.5;

    const savings = traditionalTotal - totalMid;
    const savingsPercent = Math.round((savings / traditionalTotal) * 100);

    // Breakdown for chart
    const breakdown = {
      equipment: equipmentCost,
      operator: Math.round(operatorTotal),
      dataProcessing: Math.round(dataProcessingTotal),
      reporting: Math.round(reportingTotal),
      missions: Math.round(missionOpsTotal - operatorTotal - dataProcessingTotal),
    };

    const nsfSupplemental = totalHigh <= 100000;

    return {
      totalLow,
      totalHigh,
      totalMid,
      perMission: Math.round(perMission),
      totalMissions,
      breakdown,
      traditionalTotal: Math.round(traditionalTotal),
      savings: Math.round(savings),
      savingsPercent,
      nsfSupplemental,
      duration,
      equipmentCost,
    };
  }, [researchType, frequency, areaSize, selectedSensors, duration]);

  const breakdownTotal = Object.values(estimate.breakdown).reduce((s, v) => s + v, 0);
  const breakdownEntries = [
    { label: "Equipment", value: estimate.breakdown.equipment, color: "bg-accent-cyan" },
    { label: "Flight Ops", value: estimate.breakdown.missions, color: "bg-accent-orange" },
    { label: "Operator", value: estimate.breakdown.operator, color: "bg-yellow-500" },
    { label: "Data Processing", value: estimate.breakdown.dataProcessing, color: "bg-purple-500" },
    { label: "Reporting", value: estimate.breakdown.reporting, color: "bg-accent-green" },
  ].filter((e) => e.value > 0);

  function handleDownloadPDF() {
    // Generate a printable summary in a new window
    const w = window.open("", "_blank");
    if (!w) return;
    const freq = FREQUENCIES.find((f) => f.id === frequency)!;
    const area = AREA_SIZES.find((a) => a.id === areaSize)!;
    const type = RESEARCH_TYPES.find((t) => t.id === researchType)!;
    const sensorNames = SENSORS.filter((s) => selectedSensors.has(s.id)).map((s) => s.label).join(", ");

    w.document.write(`<!DOCTYPE html><html><head><title>Drone Budget Estimate - Grant Proposal</title>
<style>
body{font-family:'Courier New',monospace;max-width:700px;margin:40px auto;color:#222;line-height:1.6}
h1{font-size:20px;border-bottom:2px solid #333;padding-bottom:8px}
h2{font-size:16px;margin-top:24px;color:#555}
table{width:100%;border-collapse:collapse;margin:12px 0}
td,th{padding:8px 12px;text-align:left;border-bottom:1px solid #ddd}
th{background:#f5f5f5;font-weight:bold}
.total{font-size:18px;font-weight:bold;color:#0a7}
.savings{background:#e8ffe8;padding:12px;border-radius:6px;margin:16px 0}
.note{font-size:11px;color:#888;margin-top:24px}
@media print{body{margin:20px}}
</style></head><body>
<h1>🛸 Drone Integration Budget Estimate</h1>
<p>Prepared by AJ Builds Drone — aj-builds-drone.github.io</p>
<h2>Project Parameters</h2>
<table>
<tr><td>Research Type</td><td><strong>${type.label}</strong></td></tr>
<tr><td>Data Collection</td><td><strong>${freq.label}</strong></td></tr>
<tr><td>Coverage Area</td><td><strong>${area.label}</strong></td></tr>
<tr><td>Sensors</td><td><strong>${sensorNames}</strong></td></tr>
<tr><td>Duration</td><td><strong>${duration} months</strong></td></tr>
<tr><td>Total Missions</td><td><strong>${estimate.totalMissions}</strong></td></tr>
</table>
<h2>Cost Estimate</h2>
<table>
<tr><th>Category</th><th>Amount</th></tr>
${breakdownEntries.map((e) => `<tr><td>${e.label}</td><td>$${e.value.toLocaleString()}</td></tr>`).join("\n")}
<tr style="border-top:2px solid #333"><td><strong>Estimated Total Range</strong></td><td class="total">$${estimate.totalLow.toLocaleString()} – $${estimate.totalHigh.toLocaleString()}</td></tr>
<tr><td>Per-Mission Cost</td><td>$${estimate.perMission.toLocaleString()}</td></tr>
</table>
<div class="savings">
<strong>💰 Cost Savings vs Traditional Methods</strong><br/>
Traditional data collection estimate: $${estimate.traditionalTotal.toLocaleString()}<br/>
Drone-based estimate: ~$${estimate.totalMid.toLocaleString()}<br/>
<strong>Projected savings: $${estimate.savings.toLocaleString()} (${estimate.savingsPercent}%)</strong>
</div>
${estimate.nsfSupplemental ? "<p>✅ <strong>This budget fits within an NSF supplemental funding request.</strong></p>" : ""}
<p class="note">* This estimate is for grant proposal budgeting purposes only. Final pricing is determined after consultation and site assessment. Contact us for a detailed formal quote.</p>
<p class="note">Generated ${new Date().toLocaleDateString()} | AJ Builds Drone | aj-builds-drone.github.io/contact</p>
</body></html>`);
    w.document.close();
    w.print();
  }

  return (
    <div ref={pdfRef} className="space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left: Inputs */}
        <div className="space-y-8">
          {/* Research Type */}
          <div>
            <label className="font-mono text-[10px] tracking-widest text-text-secondary block mb-3">
              RESEARCH TYPE
            </label>
            <div className="grid grid-cols-1 gap-2">
              {RESEARCH_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setResearchType(type.id)}
                  className={`px-4 py-3 rounded border font-mono text-xs tracking-wider text-left transition-all ${
                    researchType === type.id
                      ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                      : "border-border-dim text-text-secondary hover:border-accent-cyan/30"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="font-mono text-[10px] tracking-widest text-text-secondary block mb-3">
              DATA COLLECTION FREQUENCY
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FREQUENCIES.map((freq) => (
                <button
                  key={freq.id}
                  onClick={() => setFrequency(freq.id)}
                  className={`px-4 py-3 rounded border font-mono text-xs tracking-wider transition-all ${
                    frequency === freq.id
                      ? "border-accent-orange bg-accent-orange/10 text-accent-orange"
                      : "border-border-dim text-text-secondary hover:border-accent-orange/30"
                  }`}
                >
                  {freq.label}
                </button>
              ))}
            </div>
          </div>

          {/* Area Size */}
          <div>
            <label className="font-mono text-[10px] tracking-widest text-text-secondary block mb-3">
              COVERAGE AREA
            </label>
            <div className="grid grid-cols-1 gap-2">
              {AREA_SIZES.map((area) => (
                <button
                  key={area.id}
                  onClick={() => setAreaSize(area.id)}
                  className={`px-4 py-3 rounded border font-mono text-xs tracking-wider text-left transition-all ${
                    areaSize === area.id
                      ? "border-accent-green bg-accent-green/10 text-accent-green"
                      : "border-border-dim text-text-secondary hover:border-accent-green/30"
                  }`}
                >
                  {area.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sensors */}
          <div>
            <label className="font-mono text-[10px] tracking-widest text-text-secondary block mb-3">
              REQUIRED SENSORS
            </label>
            <div className="grid grid-cols-1 gap-2">
              {SENSORS.map((sensor) => {
                const isSelected = selectedSensors.has(sensor.id);
                const isRGB = sensor.id === "rgb";
                return (
                  <button
                    key={sensor.id}
                    onClick={() => toggleSensor(sensor.id)}
                    className={`flex items-center justify-between px-4 py-3 rounded border font-mono text-xs tracking-wider text-left transition-all ${
                      isSelected
                        ? "border-accent-cyan/50 bg-accent-cyan/5"
                        : "border-border-dim hover:border-accent-cyan/20"
                    } ${isRGB ? "opacity-80" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={isSelected ? "text-accent-cyan" : "text-text-secondary"}>
                        {isSelected ? "☑" : "☐"}
                      </span>
                      <span className={isSelected ? "text-foreground" : "text-text-secondary"}>
                        {sensor.label}
                      </span>
                      {isRGB && <span className="text-[9px] text-text-secondary">(included)</span>}
                    </div>
                    {sensor.equipmentCost > 0 && (
                      <span className="text-[10px] text-accent-orange">+${sensor.equipmentCost.toLocaleString()}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="font-mono text-[10px] tracking-widest text-text-secondary block mb-3">
              PROJECT DURATION (MONTHS)
            </label>
            <div className="grid grid-cols-5 gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`py-3 rounded border font-mono text-sm font-bold tracking-wider transition-all ${
                    duration === d
                      ? "border-accent-orange bg-accent-orange/10 text-accent-orange"
                      : "border-border-dim text-text-secondary hover:border-accent-orange/30"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Output */}
        <div>
          <motion.div
            key={`${estimate.totalMid}`}
            initial={{ scale: 0.98, opacity: 0.7 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="sticky top-24 space-y-6"
          >
            {/* Total Estimate */}
            <div className="border border-border-dim rounded-lg p-6 bg-surface/50">
              <div className="font-mono text-[10px] tracking-widest text-text-secondary mb-4">
                ESTIMATED TOTAL PROJECT COST
              </div>
              <div className="text-center py-4 border-b border-border-dim mb-4">
                <div className="font-mono text-3xl md:text-4xl font-bold text-accent-green">
                  ${estimate.totalLow.toLocaleString()} – ${estimate.totalHigh.toLocaleString()}
                </div>
                <div className="font-mono text-[10px] text-text-secondary mt-2">
                  {estimate.totalMissions} missions over {duration} months
                </div>
              </div>

              <div className="flex justify-between font-mono text-xs mb-2">
                <span className="text-text-secondary">Per-Mission Cost</span>
                <span className="text-accent-orange font-bold">${estimate.perMission.toLocaleString()}</span>
              </div>

              {/* Stacked Bar Chart */}
              <div className="mt-6">
                <div className="font-mono text-[10px] tracking-widest text-text-secondary mb-3">
                  COST BREAKDOWN
                </div>
                <div className="flex h-8 rounded overflow-hidden mb-3">
                  {breakdownEntries.map((entry) => {
                    const pct = (entry.value / breakdownTotal) * 100;
                    return (
                      <motion.div
                        key={entry.label}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5 }}
                        className={`${entry.color} relative group`}
                        title={`${entry.label}: $${entry.value.toLocaleString()}`}
                      >
                        {pct > 12 && (
                          <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] text-black font-bold">
                            {Math.round(pct)}%
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {breakdownEntries.map((entry) => (
                    <div key={entry.label} className="flex items-center gap-2 font-mono text-[10px]">
                      <div className={`w-2 h-2 rounded-sm ${entry.color}`} />
                      <span className="text-text-secondary">{entry.label}</span>
                      <span className="ml-auto">${entry.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Savings Callout */}
            {estimate.savings > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-accent-green/40 rounded-lg p-5 bg-accent-green/5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-accent-green text-lg">💰</span>
                  <span className="font-mono text-sm font-bold text-accent-green tracking-wider">
                    SAVE {estimate.savingsPercent}% vs TRADITIONAL
                  </span>
                </div>
                <div className="font-mono text-xs text-text-secondary space-y-1">
                  <div className="flex justify-between">
                    <span>Traditional methods</span>
                    <span className="line-through text-red-400">${estimate.traditionalTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Drone-based approach</span>
                    <span className="text-accent-green font-bold">~${estimate.totalMid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-accent-green/20">
                    <span className="font-bold">Projected savings</span>
                    <span className="text-accent-green font-bold">${estimate.savings.toLocaleString()}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* NSF Callout */}
            {estimate.nsfSupplemental && (
              <div className="border border-accent-cyan/30 rounded-lg p-4 bg-accent-cyan/5">
                <div className="font-mono text-xs text-accent-cyan font-bold tracking-wider mb-1">
                  ✅ NSF SUPPLEMENTAL ELIGIBLE
                </div>
                <p className="font-mono text-[11px] text-text-secondary">
                  This budget fits within a typical NSF supplemental funding request (&lt;$100K).
                  Suitable for REU supplements, EAGER grants, and MRI shared equipment proposals.
                </p>
              </div>
            )}

            {/* CTAs */}
            <div className="space-y-3">
              <Link
                href="/contact"
                className="btn-glitch block w-full text-center px-6 py-3 bg-accent-orange text-black font-mono text-xs tracking-widest font-bold rounded hover:bg-accent-orange/90 transition-colors"
              >
                ▶ GET A DETAILED QUOTE FOR YOUR GRANT
              </Link>
              <button
                onClick={handleDownloadPDF}
                className="block w-full text-center px-6 py-3 border border-accent-cyan text-accent-cyan font-mono text-xs tracking-widest font-bold rounded hover:bg-accent-cyan/10 transition-colors"
              >
                ⬇ DOWNLOAD BUDGET ESTIMATE (PDF)
              </button>
            </div>

            <p className="font-mono text-[10px] text-text-secondary">
              * Estimates for grant proposal budgeting only. Final pricing determined after consultation.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
