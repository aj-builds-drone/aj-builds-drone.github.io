"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import componentsDb from "@/data/components-db.json";
import {
  calculateMetrics,
  type BuildSelection,
  type FramePart,
  type FCPart,
  type MotorPart,
  type BatteryPart,
  type CameraPart,
} from "./ThrustCalculator";

/* ──────────── Types ──────────── */
type Step = "frame" | "fc" | "motor" | "battery" | "camera" | "summary";
type AnyPart = FramePart | FCPart | MotorPart | BatteryPart | CameraPart;

const STEPS: { key: Step; label: string; data: AnyPart[] }[] = [
  { key: "frame", label: "FRAME", data: componentsDb.frames as unknown as AnyPart[] },
  { key: "fc", label: "FLIGHT CTRL", data: componentsDb.flightControllers as unknown as AnyPart[] },
  { key: "motor", label: "MOTORS", data: componentsDb.motors as unknown as AnyPart[] },
  { key: "battery", label: "BATTERY", data: componentsDb.batteries as unknown as AnyPart[] },
  { key: "camera", label: "CAMERA", data: componentsDb.cameras as unknown as AnyPart[] },
];

/* ──────────── Main Component ──────────── */
export default function DroneBuilder() {
  const [currentStep, setCurrentStep] = useState(0);
  const [build, setBuild] = useState<BuildSelection>({
    frame: null,
    fc: null,
    motor: null,
    battery: null,
    camera: null,
  });

  const stepInfo = STEPS[currentStep] as (typeof STEPS)[number] | undefined;
  const isSummary = currentStep >= STEPS.length;

  const metrics = useMemo(() => calculateMetrics(build), [build]);

  function selectPart(part: AnyPart) {
    const key = STEPS[currentStep].key as keyof BuildSelection;
    setBuild((prev) => ({ ...prev, [key]: part }));
    setCurrentStep((s) => s + 1);
  }

  function goBack() {
    if (currentStep > 0) {
      const prevKey = STEPS[currentStep - 1]?.key as keyof BuildSelection | undefined;
      if (prevKey) setBuild((prev) => ({ ...prev, [prevKey]: null }));
      setCurrentStep((s) => s - 1);
    }
  }

  function reset() {
    setBuild({ frame: null, fc: null, motor: null, battery: null, camera: null });
    setCurrentStep(0);
  }

  // Running weight total
  const runningWeight =
    (build.frame?.weight ?? 0) +
    (build.fc?.weight ?? 0) +
    (build.motor ? build.motor.weight * (build.frame?.motorMounts ?? 4) : 0) +
    (build.battery?.weight ?? 0) +
    (build.camera?.weight ?? 0);

  return (
    <section id="drone-builder" className="py-24 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <span className="font-mono text-xs text-accent-green tracking-widest">[BLD]</span>
          <div className="h-px flex-1 bg-gradient-to-r from-accent-green/50 to-transparent" />
        </div>
        <h2 className="font-mono text-2xl md:text-3xl font-bold tracking-wider mb-2">
          DRONE BUILDER
        </h2>
        <p className="text-text-secondary text-sm mb-8">
          Select components and see real-time thrust-to-weight, flight time, and BOM calculations.
        </p>

        {/* Step Progress Bar */}
        <div className="flex items-center gap-1 mb-8">
          {STEPS.map((s, i) => {
            const selected = build[s.key as keyof BuildSelection];
            const isActive = i === currentStep;
            return (
              <button
                key={s.key}
                onClick={() => i < currentStep && setCurrentStep(i)}
                disabled={i > currentStep}
                className={`
                  flex-1 py-2 font-mono text-[10px] md:text-xs tracking-widest border-b-2 transition-all
                  ${isActive ? "border-accent-green text-accent-green" : ""}
                  ${selected && !isActive ? "border-accent-orange text-accent-orange" : ""}
                  ${!selected && !isActive ? "border-border-dim text-text-secondary/40" : ""}
                  ${i <= currentStep ? "cursor-pointer hover:text-foreground" : "cursor-default"}
                `}
              >
                {s.label}
              </button>
            );
          })}
          <div
            className={`flex-1 py-2 font-mono text-[10px] md:text-xs tracking-widest border-b-2 text-center transition-all ${
              isSummary ? "border-accent-green text-accent-green" : "border-border-dim text-text-secondary/40"
            }`}
          >
            SUMMARY
          </div>
        </div>

        {/* Running stats bar */}
        <div className="flex flex-wrap gap-4 mb-6 font-mono text-xs text-text-secondary">
          <span>
            WEIGHT: <span className="text-foreground">{runningWeight}g</span>
          </span>
          {metrics && (
            <>
              <span>
                TWR:{" "}
                <span
                  className={
                    metrics.thrustToWeight >= 2.5
                      ? "text-accent-green"
                      : metrics.thrustToWeight >= 1.5
                        ? "text-accent-orange"
                        : "text-red-500"
                  }
                >
                  {metrics.thrustToWeight}:1
                </span>
              </span>
              <span>
                FLIGHT:{" "}
                <span className="text-foreground">{metrics.estimatedFlightTime} min</span>
              </span>
            </>
          )}
        </div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          {!isSummary && stepInfo ? (
            <motion.div
              key={stepInfo.key}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <ComponentPicker
                parts={stepInfo.data}
                selectedId={build[stepInfo.key as keyof BuildSelection]?.id}
                onSelect={selectPart}
              />
            </motion.div>
          ) : (
            <motion.div
              key="summary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <BuildSummary build={build} metrics={metrics} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={goBack}
            disabled={currentStep === 0}
            className="font-mono text-xs tracking-widest px-6 py-2 border border-border-dim rounded
                       hover:border-accent-orange hover:text-accent-orange transition-colors
                       disabled:opacity-30 disabled:cursor-default disabled:hover:border-border-dim disabled:hover:text-current"
          >
            ← BACK
          </button>
          {isSummary && (
            <button
              onClick={reset}
              className="font-mono text-xs tracking-widest px-6 py-2 border border-accent-orange text-accent-orange rounded
                         hover:bg-accent-orange/10 transition-colors"
            >
              ↺ NEW BUILD
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ──────────── Component Picker ──────────── */
function ComponentPicker({
  parts,
  selectedId,
  onSelect,
}: {
  parts: AnyPart[];
  selectedId?: string;
  onSelect: (p: AnyPart) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {parts.map((part) => (
        <button
          key={part.id}
          onClick={() => onSelect(part)}
          className={`
            text-left p-5 rounded border transition-all group
            ${
              selectedId === part.id
                ? "border-accent-green bg-accent-green/5"
                : "border-border-dim hover:border-accent-orange/50 bg-background/50"
            }
          `}
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-mono text-sm font-bold tracking-wide group-hover:text-accent-orange transition-colors">
              {part.name}
            </h3>
            <span className="font-mono text-xs text-accent-orange">${part.price}</span>
          </div>
          <p className="text-text-secondary text-xs mb-3">{(part as FramePart).description ?? ""}</p>
          <div className="flex flex-wrap gap-3 font-mono text-[10px] text-text-secondary">
            <span className="px-2 py-0.5 bg-surface-card/60 rounded">{part.weight}g</span>
            {Object.entries((part as FramePart).specs ?? {}).map(([key, val]) => (
              <span key={key} className="px-2 py-0.5 bg-surface-card/60 rounded">
                {key}: {String(val)}
              </span>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}

/* ──────────── Build Summary ──────────── */
function BuildSummary({
  build,
  metrics,
}: {
  build: BuildSelection;
  metrics: ReturnType<typeof calculateMetrics>;
}) {
  if (!metrics) return null;

  const ratingColor = {
    EXCELLENT: "text-accent-green",
    GOOD: "text-cyan-400",
    MARGINAL: "text-accent-orange",
    UNSAFE: "text-red-500",
  }[metrics.rating];

  const ratingBg = {
    EXCELLENT: "border-accent-green/30 bg-accent-green/5",
    GOOD: "border-cyan-400/30 bg-cyan-400/5",
    MARGINAL: "border-accent-orange/30 bg-accent-orange/5",
    UNSAFE: "border-red-500/30 bg-red-500/5",
  }[metrics.rating];

  const parts = [
    { label: "Frame", part: build.frame },
    { label: "Flight Controller", part: build.fc },
    { label: `Motors × ${metrics.motorCount}`, part: build.motor },
    { label: "Battery", part: build.battery },
    { label: "Camera", part: build.camera },
  ];

  return (
    <div className="space-y-6">
      {/* Rating Card */}
      <div className={`p-6 rounded border ${ratingBg} text-center`}>
        <div className={`font-mono text-3xl font-bold tracking-widest ${ratingColor}`}>
          {metrics.rating}
        </div>
        <div className="font-mono text-xs text-text-secondary mt-1">BUILD ASSESSMENT</div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricBox label="AUW" value={`${metrics.totalWeight}g`} sub={`${(metrics.totalWeight / 1000).toFixed(2)} kg`} />
        <MetricBox
          label="THRUST:WEIGHT"
          value={`${metrics.thrustToWeight}:1`}
          sub={`${metrics.maxThrust}g thrust`}
          color={metrics.thrustToWeight >= 2.5 ? "green" : metrics.thrustToWeight >= 1.5 ? "orange" : "red"}
        />
        <MetricBox label="FLIGHT TIME" value={`${metrics.estimatedFlightTime} min`} sub="estimated cruise" />
        <MetricBox label="MAX SPEED" value={`${metrics.maxSpeed} km/h`} sub="estimated" />
      </div>

      {/* BOM */}
      <div className="border border-border-dim rounded overflow-hidden">
        <div className="bg-surface-card/50 px-4 py-2 font-mono text-xs tracking-widest text-text-secondary border-b border-border-dim">
          BILL OF MATERIALS
        </div>
        {parts.map(({ label, part }) =>
          part ? (
            <div
              key={label}
              className="flex items-center justify-between px-4 py-3 border-b border-border-dim/50 last:border-0"
            >
              <div>
                <span className="font-mono text-xs text-text-secondary">{label}</span>
                <div className="font-mono text-sm text-foreground">{part.name}</div>
              </div>
              <div className="text-right font-mono text-xs">
                <div className="text-accent-orange">
                  ${label.startsWith("Motors") ? part.price * metrics.motorCount : part.price}
                </div>
                <div className="text-text-secondary">
                  {label.startsWith("Motors") ? part.weight * metrics.motorCount : part.weight}g
                </div>
              </div>
            </div>
          ) : null,
        )}
        <div className="flex items-center justify-between px-4 py-3 bg-surface-card/30 font-mono text-sm font-bold">
          <span>TOTAL</span>
          <span className="text-accent-orange">${metrics.totalCost}</span>
        </div>
      </div>

      {/* Warnings */}
      {metrics.warnings.length > 0 && (
        <div className="space-y-2">
          {metrics.warnings.map((w) => (
            <div key={w} className="flex items-start gap-2 font-mono text-xs text-accent-orange">
              <span className="mt-0.5">⚠</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────── Metric Box ──────────── */
function MetricBox({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "green" | "orange" | "red";
}) {
  const colorClass =
    color === "green"
      ? "text-accent-green"
      : color === "orange"
        ? "text-accent-orange"
        : color === "red"
          ? "text-red-500"
          : "text-foreground";

  return (
    <div className="border border-border-dim rounded p-4 bg-background/50">
      <div className="font-mono text-[10px] tracking-widest text-text-secondary mb-1">{label}</div>
      <div className={`font-mono text-lg font-bold ${colorClass}`}>{value}</div>
      {sub && <div className="font-mono text-[10px] text-text-secondary">{sub}</div>}
    </div>
  );
}
