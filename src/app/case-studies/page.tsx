"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const caseStudies = [
  {
    id: "agricultural-research",
    tag: "AGR-001",
    title: "Multispectral Crop Analysis",
    category: "Agricultural Research",
    gradient: "from-green-900/60 via-emerald-800/40 to-black",
    pattern: "radial-gradient(circle at 30% 70%, rgba(34,197,94,0.15) 0%, transparent 50%)",
    client: "University agricultural research department",
    challenge:
      "The research team was conducting manual field surveys across 2,000+ acres — a process that consumed 3-4 weeks per survey cycle with limited spatial resolution. Graduate students spent more time walking rows than analyzing data, and coverage gaps meant unreliable datasets for their USDA-funded nitrogen uptake study.",
    solution:
      "We deployed a DJI Matrice 300 RTK equipped with a MicaSense RedEdge-P multispectral sensor, flying automated grid patterns at 120m AGL. Custom flight plans ensured 80% overlap for photogrammetric accuracy. A Python-based data pipeline handled orthomosaic stitching, NDVI/NDRE calculation, and integration with the lab's existing GIS workflow — all automated from SD card to publication-ready maps.",
    results: [
      { value: "10×", label: "Faster data collection" },
      { value: "<1cm", label: "Ground resolution" },
      { value: "$40K", label: "Saved vs. manual methods" },
      { value: "3hrs", label: "Per full survey cycle" },
    ],
    tech: [
      "DJI Matrice 300 RTK",
      "MicaSense RedEdge-P",
      "Custom Python Pipeline",
      "NDVI / NDRE Analysis",
      "Automated Flight Planning",
      "GIS Integration",
    ],
    quote:
      "The drone survey data gave us spatial resolution we never thought possible at this scale. It fundamentally changed our experimental design.",
    quoteAuthor: "— Principal Investigator, Plant Science Dept.",
  },
  {
    id: "infrastructure-inspection",
    tag: "INF-002",
    title: "Bridge Structural Health Monitoring",
    category: "Infrastructure Inspection",
    gradient: "from-blue-900/60 via-slate-800/40 to-black",
    pattern: "radial-gradient(circle at 70% 30%, rgba(59,130,246,0.15) 0%, transparent 50%)",
    client: "Civil engineering department",
    challenge:
      "Traditional scaffolding-based bridge inspections cost $150K+ per structure, required lane closures for weeks, and still left blind spots in hard-to-reach areas. The engineering team needed sub-millimeter crack detection across 12 aging concrete spans — safely and repeatedly.",
    solution:
      "We built a dual-sensor inspection platform combining a high-resolution RGB camera with a radiometric thermal sensor, mounted on a custom airframe with FPGA-accelerated onboard image processing. LiDAR scans generated 3D point cloud models, while our AI crack detection pipeline (trained on 50K+ labeled bridge defect images) flagged anomalies in real-time. Photogrammetric models enabled precise change detection between quarterly inspections.",
    results: [
      { value: "90%", label: "Cost reduction vs. scaffolding" },
      { value: "0.2mm", label: "Crack detection threshold" },
      { value: "12", label: "Spans inspected in 2 days" },
      { value: "3D", label: "Point cloud structural model" },
    ],
    tech: [
      "Custom FPGA Image Processing",
      "LiDAR Point Cloud",
      "Thermal + RGB Fusion",
      "AI Crack Detection",
      "Photogrammetry",
      "Change Detection Pipeline",
    ],
    quote:
      "We went from a $150K scaffolding quote to a complete digital twin of the bridge in 48 hours. The thermal data alone justified the entire project.",
    quoteAuthor: "— Dept. Chair, Civil Engineering",
  },
  {
    id: "environmental-monitoring",
    tag: "ENV-003",
    title: "Coastal Erosion Tracking",
    category: "Environmental Monitoring",
    gradient: "from-cyan-900/60 via-teal-800/40 to-black",
    pattern: "radial-gradient(circle at 50% 50%, rgba(20,184,166,0.15) 0%, transparent 50%)",
    client: "Environmental science lab",
    challenge:
      "Quarterly manual GPS surveys of a 4km coastline were too infrequent to capture rapid erosion events driven by storm surges. By the time the team had survey data, the coastline had already shifted. They needed high-frequency, high-accuracy monitoring without the budget for permanent ground stations.",
    solution:
      "We established monthly automated drone flights using RTK-GPS positioning for centimeter-level accuracy. A custom Python change detection pipeline compared successive orthomosaics, automatically calculating volumetric erosion rates and generating differential elevation models. The workflow was designed for graduate students to execute independently after initial training.",
    results: [
      { value: "Weekly", label: "Monitoring capability" },
      { value: "0.5cm", label: "Vertical accuracy" },
      { value: "Nature", label: "Published in Nature journal" },
      { value: "4km", label: "Coastline coverage per flight" },
    ],
    tech: [
      "RTK-GPS Positioning",
      "Photogrammetric DEMs",
      "Python Change Detection",
      "Volumetric Analysis",
      "Automated Flight Profiles",
      "Student Training Program",
    ],
    quote:
      "The weekly resolution transformed our understanding of erosion dynamics. We captured events we would have completely missed with quarterly surveys.",
    quoteAuthor: "— Lead Researcher, Environmental Science",
  },
];

export default function CaseStudiesPage() {
  return (
    <main className="min-h-screen pt-20">
      {/* Page Header */}
      <section className="py-16 border-b border-border-dim relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent-green/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-xs text-accent-green tracking-widest">
                [MISSION LOG]
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-accent-green/50 to-transparent" />
            </div>
            <h1 className="font-mono text-3xl md:text-4xl font-bold tracking-wider mb-4">
              CASE STUDIES
            </h1>
            <p className="text-text-secondary max-w-2xl text-base">
              Real missions. Real data. Real results. Each project below
              represents a complete engagement — from research question through
              deployment and published findings.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Case Studies */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">
        {caseStudies.map((cs, idx) => (
          <motion.article
            key={cs.id}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            className="osd-card rounded-xl overflow-hidden hud-corners"
          >
            {/* Hero Banner */}
            <div
              className={`relative h-48 md:h-64 bg-gradient-to-br ${cs.gradient} flex items-end p-6 md:p-8`}
              style={{ backgroundImage: cs.pattern }}
            >
              {/* Grid overlay */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              />
              {/* Scanline */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                  className="absolute left-0 right-0 h-px bg-accent-green/30"
                  animate={{ top: ["0%", "100%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <div className="relative z-10">
                <span className="font-mono text-xs text-accent-green/80 tracking-widest">
                  [{cs.tag}] {cs.category.toUpperCase()}
                </span>
                <h2 className="font-mono text-xl md:text-2xl font-bold tracking-wider text-white mt-1">
                  {cs.title}
                </h2>
                <p className="font-mono text-xs text-white/60 mt-1">
                  Client: {cs.client}
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 md:p-8 space-y-8">
              {/* Metrics Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {cs.results.map((r) => (
                  <div
                    key={r.label}
                    className="bg-background border border-border-dim rounded-lg px-4 py-3 text-center"
                  >
                    <span className="block font-mono text-2xl md:text-3xl font-bold text-accent-green">
                      {r.value}
                    </span>
                    <span className="block font-mono text-[10px] text-text-secondary tracking-widest mt-1 uppercase">
                      {r.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Problem / Solution / Results */}
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-mono text-xs tracking-widest text-red-400 mb-3">
                    ▸ THE CHALLENGE
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {cs.challenge}
                  </p>
                </div>
                <div>
                  <h3 className="font-mono text-xs tracking-widest text-accent-green mb-3">
                    ▸ OUR SOLUTION
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {cs.solution}
                  </p>
                </div>
              </div>

              {/* Tech Stack */}
              <div>
                <h3 className="font-mono text-xs tracking-widest text-accent-orange mb-3">
                  ▸ TECH STACK
                </h3>
                <div className="flex flex-wrap gap-2">
                  {cs.tech.map((t) => (
                    <span
                      key={t}
                      className="font-mono text-xs border border-border-dim rounded-full px-3 py-1 text-text-secondary hover:border-accent-green/50 hover:text-accent-green transition-colors"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Quote */}
              <div className="border-l-2 border-accent-green/40 pl-4 py-2">
                <p className="text-sm italic text-text-secondary">
                  &ldquo;{cs.quote}&rdquo;
                </p>
                <p className="font-mono text-xs text-accent-green/60 mt-2">
                  {cs.quoteAuthor}
                </p>
              </div>

              {/* CTA */}
              <div className="pt-4 border-t border-border-dim">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 font-mono text-sm text-accent-green hover:text-accent-green/80 transition-colors group"
                >
                  Start Your Research Project
                  <span className="group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </Link>
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      {/* Bottom CTA */}
      <section className="py-20 border-t border-border-dim">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-mono text-xl md:text-2xl font-bold tracking-wider mb-4">
            READY TO LAUNCH YOUR PROJECT?
          </h2>
          <p className="text-text-secondary mb-8">
            Every research mission starts with a conversation. Tell us about
            your data collection challenges and we&apos;ll design a solution.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-block bg-accent-green text-background font-mono text-sm tracking-wider px-8 py-3 rounded hover:bg-accent-green/90 transition-colors"
            >
              REQUEST FOR QUOTE →
            </Link>
            <Link
              href="/research-match"
              className="inline-block border border-accent-green text-accent-green font-mono text-sm tracking-wider px-8 py-3 rounded hover:bg-accent-green/10 transition-colors"
            >
              RESEARCH MATCHER →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
