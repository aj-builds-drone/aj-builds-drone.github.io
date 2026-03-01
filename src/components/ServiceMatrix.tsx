"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const services = [
  {
    code: "SVC-01",
    icon: "⚙",
    title: "Custom Hardware Integration",
    description:
      "End-to-end UAV builds from frame selection to maiden flight. Custom PCBs, STM32 controllers, ESC tuning, PID optimization, and flight-ready delivery.",
    capabilities: [
      "Frame & Propulsion Design",
      "Flight Controller Setup (PX4 / ArduPilot)",
      "Custom PCB Design (STM32, GPS, IMU)",
      "3D-Printed Mounts & Enclosures",
      "Vibration Isolation & EMI Shielding",
    ],
  },
  {
    code: "SVC-02",
    icon: "◎",
    title: "Computer Vision & SLAM",
    description:
      "Visual perception pipelines for autonomous navigation. Stereo depth, object detection, visual-inertial odometry, and real-time 3D mapping in GPS-denied environments.",
    capabilities: [
      "OAK-D / RealSense Integration",
      "Visual-Inertial Odometry (VIO)",
      "SLAM (ORB-SLAM3, RTAB-Map)",
      "Object Detection & Tracking (YOLO)",
      "Depth Processing & Point Clouds",
    ],
  },
  {
    code: "SVC-03",
    icon: "◇",
    title: "Digital Twin & Gazebo Simulation",
    description:
      "High-fidelity simulation environments for safe, repeatable testing. URDF/SDF modeling, sensor simulation, SITL/HITL integration, and CI pipeline deployment.",
    capabilities: [
      "Gazebo Harmonic World Building",
      "Custom URDF/SDF Vehicle Models",
      "PX4 SITL & HITL Integration",
      "Sensor Noise & Physics Modeling",
      "GitHub Actions CI/CD Pipeline",
    ],
  },
  {
    code: "SVC-04",
    icon: "▣",
    title: "FPGA & Embedded Systems",
    description:
      "Custom FPGA and embedded system design for real-time control and sensor fusion. 3+ years AMD/Xilinx experience — RTL, bare-metal, embedded Linux.",
    capabilities: [
      "RTL Design & Verification (SystemVerilog)",
      "High-speed Serial Protocols (PCIe, Ethernet)",
      "Bare-metal & Linux Driver Development",
      "FPGA Image Processing Pipelines",
      "Zynq UltraScale+ SoC Integration",
    ],
  },
  {
    code: "SVC-05",
    icon: "◉",
    title: "Aerial Photography & Videography",
    description:
      "FAA Part 107 certified aerial cinematography for real estate, events, construction, and creative productions. Multi-city portfolio across Austin, NYC, and Miami.",
    capabilities: [
      "4K Drone Photography & Video",
      "Real Estate & Construction Progress",
      "FAA Part 107 Compliant Operations",
      "Orthomosaic Mapping & 3D Terrain",
      "Post-production & Color Grading",
    ],
  },
];

export default function ServiceMatrix() {
  return (
    <section className="py-24 bg-surface/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-xs text-accent-orange tracking-widest">
              [SVC]
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-accent-orange/50 to-transparent" />
          </div>
          <h2 className="font-mono text-2xl md:text-3xl font-bold tracking-wider">
            SERVICE MATRIX
          </h2>
          <p className="mt-2 text-text-secondary text-base max-w-2xl">
            Five verticals. Modular engagement. Scale from a single
            consultation to a full platform build.
          </p>
        </motion.div>

        {/* Service Grid — flex wrap to center the last row's 2 items */}
        <div className="flex flex-wrap justify-center gap-6">
          {services.map((service, i) => (
            <motion.div
              key={service.code}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="osd-card rounded-lg overflow-hidden hud-corners flex flex-col w-full md:w-[calc(33.333%-1rem)]"
            >
              {/* Card Header */}
              <div className="px-5 py-3 border-b border-border-dim bg-elevated/50 flex items-center justify-between">
                <span className="font-mono text-xs tracking-widest text-text-secondary">
                  {service.code}
                </span>
                <span className="text-lg">{service.icon}</span>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-mono text-base font-bold tracking-wider text-foreground mb-3">
                  {service.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed mb-5">
                  {service.description}
                </p>

                {/* Capabilities */}
                <div className="mt-auto">
                  <h4 className="font-mono text-xs text-accent-orange tracking-widest mb-3">
                    // CAPABILITIES
                  </h4>
                  <ul className="space-y-1.5">
                    {service.capabilities.map((cap, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-2 font-mono text-xs text-text-secondary"
                      >
                        <span className="text-accent-green mt-0.5 shrink-0">▸</span>
                        {cap}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-5 py-3 border-t border-border-dim bg-elevated/30">
                <Link
                  href="/contact"
                  className="btn-glitch inline-flex items-center gap-2 font-mono text-[11px] tracking-widest text-accent-orange hover:text-foreground transition-colors"
                >
                  REQUEST QUOTE →
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
