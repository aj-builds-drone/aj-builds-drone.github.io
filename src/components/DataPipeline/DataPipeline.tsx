"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

/* ─── Pipeline Data ─── */
interface PipelineNode {
  id: string;
  label: string;
  items: { name: string; detail: string; time: string }[];
}

const STAGES: PipelineNode[] = [
  {
    id: "raw",
    label: "Raw Drone Data",
    items: [
      { name: "Photos / Video", detail: "High-res RGB, multispectral, and thermal imagery captured at 2-5 cm/px GSD.", time: "0 min" },
      { name: "LiDAR Points", detail: "Dense point clouds at 240+ pts/m² from sensors like the Zenmuse L2.", time: "0 min" },
      { name: "Sensor Data", detail: "IMU, GPS/RTK, barometer, magnetometer logs for post-processing.", time: "0 min" },
    ],
  },
  {
    id: "pre",
    label: "Pre-Processing",
    items: [
      { name: "Orthomosaic", detail: "Georeferenced stitched imagery with sub-cm accuracy via PPK/RTK.", time: "~20 min/100 ac" },
      { name: "Point Cloud", detail: "Classified 3D point cloud with ground, vegetation, and structure layers.", time: "~30 min/100 ac" },
      { name: "Calibration", detail: "Radiometric, geometric, and thermal calibration against ground control.", time: "~5 min" },
    ],
  },
  {
    id: "analysis",
    label: "Analysis",
    items: [
      { name: "NDVI / Thermal", detail: "Vegetation health indices, thermal anomaly detection, and stress mapping.", time: "~10 min/100 ac" },
      { name: "3D Model", detail: "Photogrammetric mesh and digital twin for volumetric analysis.", time: "~45 min/100 ac" },
      { name: "AI Detection", detail: "Object detection, change detection, and classification via custom ML models.", time: "~15 min/100 ac" },
    ],
  },
  {
    id: "deliver",
    label: "Deliverables",
    items: [
      { name: "Report", detail: "Formatted PDF/HTML report with maps, statistics, and recommendations.", time: "Included" },
      { name: "Dataset", detail: "GeoTIFF, LAS/LAZ, shapefile, and KML exports for your GIS stack.", time: "Included" },
      { name: "API", detail: "RESTful API endpoint for programmatic access to processed data layers.", time: "Optional" },
    ],
  },
];

/* ─── Component ─── */
export default function DataPipeline() {
  const [activeNode, setActiveNode] = useState<{ stageIdx: number; itemIdx: number } | null>(null);

  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="mb-14"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-xs text-accent-orange tracking-widest">[DATA-PIPE]</span>
            <div className="h-px flex-1 bg-gradient-to-r from-accent-orange/50 to-transparent" />
          </div>
          <h2 className="font-mono text-2xl md:text-3xl font-bold tracking-wider">DATA PROCESSING PIPELINE</h2>
          <p className="text-zinc-400 mt-2 max-w-2xl">
            From raw sensor data to actionable deliverables — every dataset flows through our full-stack processing pipeline.
          </p>
        </motion.div>

        {/* Pipeline Flow */}
        <div className="relative">
          {/* Connecting line (desktop) */}
          <div className="hidden lg:block absolute top-[52px] left-0 right-0 h-0.5 z-0">
            <div className="h-full bg-gradient-to-r from-accent-orange/40 via-blue-500/40 to-accent-orange/40 relative overflow-hidden">
              <motion.div
                className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-accent-orange/80 to-transparent"
                animate={{ x: ["-80px", "calc(100vw)"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
            {STAGES.map((stage, si) => (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: si * 0.12 }}
              >
                {/* Stage header */}
                <div className="relative mb-4">
                  <div className="flex items-center gap-2">
                    {/* Arrow between stages on desktop */}
                    {si > 0 && (
                      <span className="hidden lg:block text-accent-orange/50 font-mono text-xs absolute -left-5">›</span>
                    )}
                    {/* Pulse dot */}
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-orange/60" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-accent-orange" />
                    </span>
                    <span className="font-mono text-sm font-bold text-zinc-200 tracking-wider">{stage.label}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  {stage.items.map((item, ii) => {
                    const isActive = activeNode?.stageIdx === si && activeNode?.itemIdx === ii;
                    return (
                      <motion.button
                        key={item.name}
                        onClick={() => setActiveNode(isActive ? null : { stageIdx: si, itemIdx: ii })}
                        whileHover={{ scale: 1.02 }}
                        className={`w-full text-left p-3 rounded-lg border transition-all font-mono text-xs ${
                          isActive
                            ? "border-accent-orange/60 bg-accent-orange/10 text-accent-orange"
                            : "border-zinc-800 bg-black/40 text-zinc-300 hover:border-zinc-600"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>{item.name}</span>
                          <span className="text-zinc-600 text-[10px]">{item.time}</span>
                        </div>
                        <AnimatePresence>
                          {isActive && (
                            <motion.p
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="text-zinc-400 mt-2 text-[11px] leading-relaxed overflow-hidden"
                            >
                              {item.detail}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <Link
            href="/services"
            className="inline-flex items-center gap-2 font-mono text-sm text-accent-orange hover:text-amber-400 transition"
          >
            See Our Capabilities <span aria-hidden>→</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
