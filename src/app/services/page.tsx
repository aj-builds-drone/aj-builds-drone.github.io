import { SectionHeader } from "@/components/HUDElements";
import Link from "next/link";
import VideoBackground from "@/components/VideoBackground";
import PricingCalculator from "@/components/PricingCalculator";
import DataPipeline from "@/components/DataPipeline/DataPipeline";

export const metadata = {
  title: "Services — Drone, FPGA & Aerial Photography",
  description:
    "Professional drone services: custom UAV hardware integration, FPGA & embedded systems, computer vision & SLAM, Gazebo simulation, and FAA Part 107 aerial photography. Austin TX — global operations. Request a free quote.",
  alternates: {
    canonical: "https://aj-builds-drone.github.io/services/",
  },
  openGraph: {
    title: "Drone Engineering Services | AJ Builds Drone",
    description: "Custom UAV builds, FPGA systems, computer vision, Gazebo simulation, aerial photography. FAA Part 107 certified. Austin TX.",
    url: "https://aj-builds-drone.github.io/services/",
    siteName: "AJ Builds Drone",
    type: "website",
    images: [{ url: "/og-services.jpg", width: 1200, height: 630, alt: "AJ Builds Drone — Drone Engineering Services" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Drone Engineering Services | AJ Builds Drone",
    description: "Custom UAV builds, FPGA systems, CV & SLAM, Gazebo simulation, aerial photography. FAA Part 107 certified.",
    images: ["/og-services.jpg"],
  },
};

const coreServices = [
  {
    code: "SVC-01",
    icon: "⚙",
    title: "Custom Hardware Integration",
    tagline: "Concept to First Flight",
    description:
      "Complete UAV platform builds from component selection through maiden flight certification. From the STM32-based Return-to-Home drone to NXP HoverGames competition entries — every build is documented, tested, and tuned.",
    deliverables: [
      "Frame & propulsion system design and optimization",
      "Flight controller installation & firmware configuration (PX4 / ArduPilot)",
      "Custom PCB design — STM32, GPS, barometer, IMU integration",
      "Custom 3D-printed mounting solutions & vibration isolation",
      "ESC calibration, motor mapping & PID tuning",
      "Pre-flight certification & test flight documentation",
    ],
    tools: ["PX4", "ArduPilot", "QGroundControl", "STM32", "KiCad", "FreeCAD"],
  },
  {
    code: "SVC-02",
    icon: "◎",
    title: "Computer Vision & SLAM",
    tagline: "Perception for Autonomous Machines",
    description:
      "Visual perception pipelines that enable autonomous operation in complex, GPS-denied environments. From PX4 ROI Object Tracking simulations to real-time 3D mapping, delivering production-ready ROS2 nodes.",
    deliverables: [
      "Stereo camera & depth sensor integration (OAK-D, RealSense)",
      "Visual-Inertial Odometry (VIO) for GPS-denied navigation",
      "SLAM implementation (ORB-SLAM3, RTAB-Map, SLAM Toolbox)",
      "Real-time object detection & tracking (YOLOv8, custom models)",
      "Point cloud processing & 3D reconstruction",
      "ROS2 node development & integration testing",
    ],
    tools: ["ROS2", "OpenCV", "DepthAI", "SLAM Toolbox", "YOLO", "TensorRT"],
  },
  {
    code: "SVC-03",
    icon: "◇",
    title: "Digital Twin & Gazebo Simulation",
    tagline: "Test Before You Fly",
    description:
      "High-fidelity simulation environments for safe, repeatable testing of autonomous flight algorithms. Full physics simulation with realistic sensor models — proven in the Chemical Hazard Testing Ranger project for NXP HoverGames 3.0.",
    deliverables: [
      "Gazebo Harmonic world construction with realistic terrain",
      "Custom URDF/SDF vehicle models matching real hardware",
      "PX4 Software-in-the-Loop (SITL) & Hardware-in-the-Loop (HITL)",
      "Sensor noise models (LiDAR, camera, IMU, GPS multipath)",
      "Automated test scenarios & flight pattern validation",
      "GitHub Actions CI pipeline for continuous SITL testing",
    ],
    tools: ["Gazebo", "PX4-SITL", "ROS2", "RVIZ2", "URDF/SDF", "GitHub Actions"],
  },
  {
    code: "SVC-04",
    icon: "▣",
    title: "FPGA & Embedded Systems",
    tagline: "Hardware-Level Intelligence",
    description:
      "Custom FPGA and embedded system design for high-speed data processing, sensor fusion, and real-time control. Leveraging 3+ years of AMD/Xilinx experience across RTL design, bare-metal drivers, and embedded Linux — from silicon to sky.",
    deliverables: [
      "RTL design & verification for sensor interfaces (SPI, I2C, UART)",
      "High-speed serial protocol implementation (PCIe, Ethernet, LVDS)",
      "Bare-metal & embedded Linux driver development",
      "FPGA-based real-time image processing pipelines",
      "Signal integrity analysis & high-speed PCB review",
      "Custom SoC integration for autonomous flight controllers",
    ],
    tools: ["Vivado", "Vitis", "Petalinux", "Zynq UltraScale+", "SystemVerilog", "C/C++"],
  },
  {
    code: "SVC-05",
    icon: "◉",
    title: "Aerial Photography & Videography",
    tagline: "FAA Part 107 Certified",
    description:
      "Professional aerial cinematography for real estate, events, construction progress, and creative productions. FAA Part 107 certified with footage captured across Austin, NYC, Miami, and beyond. Also a private pilot student with 60+ hours of manned flight experience.",
    deliverables: [
      "4K aerial photography & cinematic video capture",
      "Real estate & construction progress documentation",
      "Event coverage (weddings, festivals, corporate)",
      "Orthomosaic mapping & 3D terrain modeling",
      "FAA Part 107 compliant flight planning & airspace authorization",
      "Post-production editing & color grading",
    ],
    tools: ["DJI", "Litchi", "DroneDeploy", "Pix4D", "DaVinci Resolve", "Lightroom"],
  },
];

const universityServices = [
  {
    code: "UNI-01",
    title: "Research Platform Prototyping",
    description:
      "Rapid prototyping of custom UAV platforms for university research labs. From grant proposal technical specs to a flight-ready vehicle with full documentation for lab technicians.",
    highlights: [
      "Grant-aligned technical specifications",
      "Documented build procedures for reproducibility",
      "Training workshops for lab personnel",
      "Ongoing maintenance & upgrade support",
    ],
  },
  {
    code: "UNI-02",
    title: "Curriculum Development Support",
    description:
      "Supporting aerospace and robotics programs with hands-on drone lab infrastructure. Provides complete teaching platforms with simulation environments and student-friendly toolchains.",
    highlights: [
      "Student-safe training platforms with geofencing",
      "Gazebo simulation labs requiring zero hardware",
      "Graded assignment frameworks (waypoint missions, etc.)",
      "TA training & safety protocol documentation",
    ],
  },
  {
    code: "UNI-03",
    title: "Competition Team Consulting",
    description:
      "Technical mentorship and builds for university drone competition teams (SUAS, IARC, etc.). Strategy, platform design, and software stack selection optimized for competition scoring.",
    highlights: [
      "Competition rule analysis & strategy",
      "Optimized platform builds within budget",
      "Autonomous mission software development",
      "Pre-competition testing & validation",
    ],
  },
];

export default function ServicesPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 relative overflow-hidden">
          <VideoBackground mp4="/videos/ag-survey.mp4" webm="/videos/ag-survey.webm" poster="/videos/posters/ag-survey.jpg" opacity={0.06} />
          <div className="font-mono text-xs tracking-[0.3em] text-accent-green mb-4">
            ▸ SERVICE MANIFEST LOADED
          </div>
          <SectionHeader
            code="SVC"
            title="SERVICE MATRIX"
            as="h1"
            subtitle="Five verticals with modular engagement — from single consultation to full platform development lifecycle. Austin TX based, operating globally."
          />
        </div>

        {/* Core Services */}
        <div className="space-y-8 mb-24">
          {coreServices.map((service) => (
            <div
              key={service.code}
              className="osd-card rounded-lg overflow-hidden hud-corners"
            >
              {/* Service Header */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-border-dim bg-elevated/50">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{service.icon}</span>
                  <span className="font-mono text-xs tracking-widest text-text-secondary">
                    {service.code}
                  </span>
                </div>
                <span className="font-mono text-xs tracking-widest text-accent-green">
                  AVAILABLE
                </span>
              </div>

              <div className="p-6 md:p-8">
                <div className="md:flex gap-8">
                  {/* Left Column */}
                  <div className="md:w-1/2 mb-6 md:mb-0">
                    <h2 className="font-mono text-xl font-bold tracking-wider mb-1">
                      {service.title}
                    </h2>
                    <p className="font-mono text-sm text-accent-orange tracking-wider mb-4">
                      {service.tagline}
                    </p>
                    <p className="text-text-secondary text-base leading-relaxed mb-6">
                      {service.description}
                    </p>

                    {/* Tools */}
                    <div>
                      <h3 className="font-mono text-xs text-accent-orange tracking-widest mb-2">
                        // TOOLS & FRAMEWORKS
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {service.tools.map((tool) => (
                          <span
                            key={tool}
                            className="px-2 py-0.5 bg-accent-green/5 border border-accent-green/20 rounded text-[11px] font-mono text-accent-green tracking-wider"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Deliverables */}
                  <div className="md:w-1/2">
                    <h3 className="font-mono text-xs text-accent-orange tracking-widest mb-3">
                      // DELIVERABLES
                    </h3>
                    <ul className="space-y-2">
                      {service.deliverables.map((item, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 text-sm text-text-secondary"
                        >
                          <span className="font-mono text-accent-green shrink-0 mt-0.5">
                            ▸
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* University Section */}
        <div className="mb-16 relative overflow-hidden">
          <VideoBackground mp4="/videos/mapping.mp4" webm="/videos/mapping.webm" poster="/videos/posters/mapping.jpg" opacity={0.05} />
          <SectionHeader
            code="UNI"
            title="UNIVERSITY & RESEARCH"
            subtitle="Specialized offerings for academic labs, robotics programs, and competition teams."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {universityServices.map((service) => (
              <div
                key={service.code}
                className="osd-card rounded-lg overflow-hidden hud-corners flex flex-col"
              >
                <div className="px-5 py-3 border-b border-border-dim bg-elevated/50">
                  <span className="font-mono text-xs tracking-widest text-text-secondary">
                    {service.code}
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="font-mono text-sm font-bold tracking-wider mb-3">
                    {service.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed mb-4">
                    {service.description}
                  </p>
                  <div className="mt-auto">
                    <h4 className="font-mono text-xs text-accent-orange tracking-widest mb-2">
                      // KEY OFFERINGS
                    </h4>
                    <ul className="space-y-1">
                      {service.highlights.map((h, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 font-mono text-[11px] text-text-secondary"
                        >
                          <span className="text-accent-green shrink-0">▸</span>
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Data Pipeline */}
        <DataPipeline />

        {/* Pricing Calculator */}
        <PricingCalculator />

        {/* Engagement CTA */}
        <div className="text-center py-12 border-t border-border-dim relative overflow-hidden">
          <VideoBackground mp4="/videos/tech-assembly.mp4" webm="/videos/tech-assembly.webm" poster="/videos/posters/tech-assembly.jpg" opacity={0.08} />
          <p className="font-mono text-xs text-text-secondary tracking-wider mb-6">
            ALL SERVICES AVAILABLE FOR REMOTE & ON-SITE ENGAGEMENT
          </p>
          <Link
            href="/contact"
            className="btn-glitch inline-flex items-center gap-2 px-10 py-4 bg-accent-orange text-black font-mono text-sm tracking-widest font-bold rounded hover:bg-accent-orange/90 transition-colors"
          >
            ▶ REQUEST FOR QUOTE
          </Link>
        </div>
      </div>
    </div>
  );
}
