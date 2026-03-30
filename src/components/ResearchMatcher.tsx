"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

/* ── Research Area Definitions ── */
interface ResearchArea {
  id: string;
  label: string;
  icon: string;
  capabilities: string[];
  collaborationFormats: string[];
  keywords: string[];
}

const RESEARCH_AREAS: ResearchArea[] = [
  {
    id: "computer-vision",
    label: "Computer Vision",
    icon: "◎",
    capabilities: [
      "Real-time object detection & tracking (YOLOv8, custom models)",
      "Stereo camera & depth sensor integration (OAK-D, RealSense)",
      "Visual-Inertial Odometry for GPS-denied navigation",
      "Point cloud processing & 3D reconstruction",
      "ROS2 perception pipeline development",
    ],
    collaborationFormats: ["data-collection", "custom-firmware", "grant-support"],
    keywords: ["detection", "tracking", "recognition", "segmentation", "depth"],
  },
  {
    id: "slam",
    label: "SLAM",
    icon: "⊡",
    capabilities: [
      "ORB-SLAM3, RTAB-Map, SLAM Toolbox implementations",
      "Visual-Inertial SLAM for indoor/GPS-denied environments",
      "LiDAR-based SLAM with loop closure",
      "Multi-sensor fusion for robust localization",
      "Real-time 3D map generation & export",
    ],
    collaborationFormats: ["data-collection", "custom-firmware", "grant-support"],
    keywords: ["mapping", "localization", "odometry", "navigation"],
  },
  {
    id: "path-planning",
    label: "Path Planning",
    icon: "◈",
    capabilities: [
      "Autonomous waypoint mission planning",
      "Obstacle avoidance with real-time replanning",
      "Coverage path planning for survey missions",
      "Multi-drone coordinated flight patterns",
      "PX4/ArduPilot mission integration & offboard control",
    ],
    collaborationFormats: ["custom-firmware", "grant-support", "simulation"],
    keywords: ["autonomous", "waypoint", "avoidance", "coverage", "trajectory"],
  },
  {
    id: "agricultural-sensing",
    label: "Agricultural Sensing",
    icon: "⬡",
    capabilities: [
      "Multispectral & NDVI crop health imaging",
      "Precision agriculture data collection pipelines",
      "Automated field survey with coverage planning",
      "Thermal stress detection for irrigation management",
      "Time-series analysis for crop growth monitoring",
    ],
    collaborationFormats: ["data-collection", "grant-support", "reporting"],
    keywords: ["crop", "ndvi", "irrigation", "precision", "multispectral"],
  },
  {
    id: "infrastructure-inspection",
    label: "Infrastructure Inspection",
    icon: "⬢",
    capabilities: [
      "Structural inspection with high-res & thermal imaging",
      "Bridge, tower, and rooftop automated flight patterns",
      "Crack detection & defect classification models",
      "3D reconstruction of structures for digital twin creation",
      "Regulatory-compliant inspection reporting",
    ],
    collaborationFormats: ["data-collection", "reporting", "grant-support"],
    keywords: ["bridge", "building", "structural", "defect", "tower"],
  },
  {
    id: "environmental-monitoring",
    label: "Environmental Monitoring",
    icon: "◉",
    capabilities: [
      "Aerial environmental survey & habitat mapping",
      "Water quality monitoring with custom sensor payloads",
      "Wildlife population estimation via thermal & RGB",
      "Vegetation index mapping over time",
      "Air quality & atmospheric sampling integration",
    ],
    collaborationFormats: ["data-collection", "grant-support", "custom-payload"],
    keywords: ["habitat", "wildlife", "water", "vegetation", "atmospheric"],
  },
  {
    id: "swarm-robotics",
    label: "Swarm Robotics",
    icon: "⬣",
    capabilities: [
      "Multi-agent coordination algorithms",
      "Decentralized swarm communication (mesh networking)",
      "Consensus-based task allocation",
      "Swarm simulation in Gazebo with PX4 SITL",
      "Formation flying & cooperative mapping",
    ],
    collaborationFormats: ["custom-firmware", "simulation", "grant-support"],
    keywords: ["multi-agent", "formation", "cooperative", "decentralized", "mesh"],
  },
  {
    id: "embedded-fpga",
    label: "Embedded / FPGA",
    icon: "⊞",
    capabilities: [
      "FPGA-accelerated onboard processing (Xilinx, Intel)",
      "Custom STM32 & NXP flight controller firmware",
      "Real-time sensor fusion on embedded platforms",
      "Low-latency image processing pipelines",
      "Custom PCB design for payload integration",
    ],
    collaborationFormats: ["custom-firmware", "grant-support", "hardware-design"],
    keywords: ["fpga", "stm32", "firmware", "embedded", "pcb", "nxp"],
  },
  {
    id: "sensor-fusion",
    label: "Sensor Fusion",
    icon: "⊕",
    capabilities: [
      "IMU + GPS + barometer Kalman filter implementations",
      "Camera + LiDAR + IMU tight coupling",
      "Custom EKF/UKF design for novel sensor configurations",
      "ROS2 sensor fusion node development",
      "Performance benchmarking & ground truth comparison",
    ],
    collaborationFormats: ["custom-firmware", "data-collection", "grant-support"],
    keywords: ["kalman", "imu", "fusion", "ekf", "multi-sensor"],
  },
  {
    id: "lidar-mapping",
    label: "LiDAR Mapping",
    icon: "◬",
    capabilities: [
      "Aerial LiDAR data collection & processing",
      "Point cloud classification & segmentation",
      "Digital Elevation Model (DEM) generation",
      "Forestry canopy analysis & biomass estimation",
      "Integration with photogrammetry for hybrid models",
    ],
    collaborationFormats: ["data-collection", "reporting", "grant-support"],
    keywords: ["lidar", "point-cloud", "dem", "canopy", "elevation"],
  },
];

const COLLABORATION_FORMATS: Record<string, { label: string; description: string; icon: string }> = {
  "data-collection": {
    label: "Aerial Data Collection",
    description: "Scheduled drone flights to collect research data with your specified parameters and sensors.",
    icon: "📡",
  },
  "custom-firmware": {
    label: "Custom Firmware & Software",
    description: "Bespoke flight controller firmware, ROS2 nodes, or onboard processing pipelines for your research needs.",
    icon: "⚙️",
  },
  "grant-support": {
    label: "Grant Proposal Support",
    description: "Technical writing, budget justification, and capability statements for NSF, USDA, DOE, and other funding agencies.",
    icon: "📋",
  },
  "simulation": {
    label: "Gazebo Simulation & Digital Twin",
    description: "High-fidelity simulation environments to validate algorithms before field deployment.",
    icon: "🖥️",
  },
  "reporting": {
    label: "Technical Reporting & Analysis",
    description: "Processed deliverables, maps, models, and written analysis for publication-ready results.",
    icon: "📊",
  },
  "custom-payload": {
    label: "Custom Payload Integration",
    description: "Mechanical and electrical integration of your research sensors onto drone platforms.",
    icon: "🔧",
  },
  "hardware-design": {
    label: "Custom Hardware Design",
    description: "PCB design, 3D-printed mounts, and embedded system development for novel platforms.",
    icon: "🛠️",
  },
};

export default function ResearchMatcher() {
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());

  function toggleArea(id: string) {
    setSelectedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Aggregate capabilities and collaboration formats from selected areas
  const matchedAreas = RESEARCH_AREAS.filter((a) => selectedAreas.has(a.id));
  const allFormats = [...new Set(matchedAreas.flatMap((a) => a.collaborationFormats))];

  return (
    <div className="space-y-12">
      {/* Research Area Selector */}
      <div>
        <div className="font-mono text-[10px] tracking-widest text-text-secondary mb-4">
          SELECT YOUR RESEARCH AREAS
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {RESEARCH_AREAS.map((area) => {
            const isSelected = selectedAreas.has(area.id);
            return (
              <motion.button
                key={area.id}
                onClick={() => toggleArea(area.id)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`relative p-4 rounded-lg border font-mono text-left transition-all duration-200 ${
                  isSelected
                    ? "border-accent-cyan bg-accent-cyan/10 shadow-[0_0_20px_rgba(0,255,255,0.1)]"
                    : "border-border-dim bg-surface/30 hover:border-accent-cyan/40"
                }`}
              >
                <div className={`text-2xl mb-2 ${isSelected ? "text-accent-cyan" : "text-text-secondary"}`}>
                  {area.icon}
                </div>
                <div className={`text-[11px] tracking-wider leading-tight ${isSelected ? "text-accent-cyan" : "text-text-secondary"}`}>
                  {area.label}
                </div>
                {isSelected && (
                  <motion.div
                    layoutId={`check-${area.id}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent-cyan/20 flex items-center justify-center"
                  >
                    <span className="text-accent-cyan text-xs">✓</span>
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {matchedAreas.length > 0 ? (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-10"
          >
            {/* Matching Capabilities */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="font-mono text-xs text-accent-green tracking-widest">[MATCH]</span>
                <div className="h-px flex-1 bg-gradient-to-r from-accent-green/50 to-transparent" />
              </div>
              <h3 className="font-mono text-lg font-bold tracking-wider mb-6">
                MATCHING CAPABILITIES
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matchedAreas.map((area) => (
                  <motion.div
                    key={area.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border border-border-dim rounded-lg p-5 bg-surface/30 hud-corners"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xl text-accent-cyan">{area.icon}</span>
                      <span className="font-mono text-sm font-bold tracking-wider text-accent-cyan">
                        {area.label}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {area.capabilities.map((cap, i) => (
                        <li key={i} className="flex items-start gap-2 font-mono text-xs text-text-secondary">
                          <span className="text-accent-green mt-0.5">▸</span>
                          <span>{cap}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Collaboration Formats */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="font-mono text-xs text-accent-orange tracking-widest">[COLLAB]</span>
                <div className="h-px flex-1 bg-gradient-to-r from-accent-orange/50 to-transparent" />
              </div>
              <h3 className="font-mono text-lg font-bold tracking-wider mb-6">
                SUGGESTED COLLABORATION FORMATS
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allFormats.map((fmtId) => {
                  const fmt = COLLABORATION_FORMATS[fmtId];
                  if (!fmt) return null;
                  return (
                    <motion.div
                      key={fmtId}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border border-border-dim rounded-lg p-5 bg-surface/30"
                    >
                      <div className="text-2xl mb-2">{fmt.icon}</div>
                      <div className="font-mono text-sm font-bold tracking-wider mb-2">{fmt.label}</div>
                      <p className="font-mono text-[11px] text-text-secondary leading-relaxed">
                        {fmt.description}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="border border-accent-cyan/30 rounded-lg p-8 bg-accent-cyan/5 text-center"
            >
              <div className="font-mono text-[10px] tracking-widest text-accent-cyan mb-3">
                READY TO COLLABORATE?
              </div>
              <p className="font-mono text-sm text-text-secondary mb-6 max-w-xl mx-auto">
                Selected {matchedAreas.length} research area{matchedAreas.length > 1 ? "s" : ""} with{" "}
                {matchedAreas.reduce((sum, a) => sum + a.capabilities.length, 0)} matching capabilities.
                Let&apos;s discuss how drone technology can accelerate your research.
              </p>
              <Link
                href="/contact"
                className="inline-block px-8 py-3 bg-accent-cyan text-black font-mono text-xs tracking-widest font-bold rounded hover:bg-accent-cyan/90 transition-colors"
              >
                ▶ LET&apos;S DISCUSS YOUR RESEARCH
              </Link>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 border border-dashed border-border-dim rounded-lg"
          >
            <div className="text-4xl mb-4 opacity-30">◎</div>
            <p className="font-mono text-sm text-text-secondary">
              Select one or more research areas above to see matching drone capabilities
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
