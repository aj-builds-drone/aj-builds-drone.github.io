"use client";

import { motion } from "framer-motion";
import Link from "next/link";

interface Lab {
  name: string;
  university: string;
  department: string;
  focus: string;
  status: "active" | "target" | "completed";
  description: string;
  icon: string;
}

const labs: Lab[] = [
  {
    name: "Autonomous Systems Lab",
    university: "Carnegie Mellon University",
    department: "Robotics Institute",
    focus: "Autonomous UAV Navigation & SLAM",
    status: "target",
    description: "Pioneering work in visual-inertial odometry and autonomous exploration. Strong alignment with our FPGA-accelerated perception pipelines.",
    icon: "🤖",
  },
  {
    name: "Environmental Sensing Lab",
    university: "UC Davis",
    department: "Land, Air & Water Resources",
    focus: "Agricultural Remote Sensing",
    status: "target",
    description: "Multispectral and hyperspectral crop analysis at scale. Our automated flight planning and NDVI pipelines directly support their methodology.",
    icon: "🌾",
  },
  {
    name: "Structural Health Monitoring Lab",
    university: "University of Texas at Austin",
    department: "Civil Engineering",
    focus: "Infrastructure Inspection via UAV",
    status: "target",
    description: "AI-driven crack detection and 3D photogrammetric modeling for bridge and building assessment. Local to Austin — ideal for rapid deployment.",
    icon: "🏗️",
  },
  {
    name: "Ecological Robotics Group",
    university: "Oregon State University",
    department: "College of Forestry",
    focus: "Forest Canopy & Wildlife Monitoring",
    status: "target",
    description: "LiDAR-based canopy structure analysis and thermal wildlife surveys in Pacific Northwest old-growth forests.",
    icon: "🌲",
  },
  {
    name: "Geospatial Intelligence Lab",
    university: "Penn State",
    department: "Geography",
    focus: "Photogrammetry & Terrain Modeling",
    status: "target",
    description: "High-accuracy DEM generation and change detection for geological research. Our RTK-enabled platforms deliver sub-centimeter precision.",
    icon: "🗺️",
  },
  {
    name: "Precision Agriculture Lab",
    university: "Purdue University",
    department: "Agricultural & Biological Engineering",
    focus: "Crop Phenotyping & Yield Prediction",
    status: "target",
    description: "Large-scale phenotyping trials using drone-based multispectral imagery. Our automated pipeline integrates directly with their ML models.",
    icon: "🧬",
  },
  {
    name: "Coastal Dynamics Lab",
    university: "University of Miami",
    department: "Marine & Atmospheric Science",
    focus: "Coastal Erosion & Storm Damage Assessment",
    status: "target",
    description: "Post-hurricane damage assessment and shoreline change monitoring using photogrammetry and thermal imaging.",
    icon: "🌊",
  },
  {
    name: "Smart Infrastructure Lab",
    university: "Georgia Tech",
    department: "Civil & Environmental Engineering",
    focus: "Smart City & Infrastructure Monitoring",
    status: "target",
    description: "IoT-integrated UAV inspection systems for urban infrastructure. Our FPGA edge processing enables real-time defect detection during flight.",
    icon: "🏙️",
  },
];

const capabilities = [
  {
    title: "Grant Proposal Support",
    description: "We provide detailed equipment specifications, BOMs, and budget justifications formatted for NSF, DOE, USDA, and NASA proposals.",
    icon: "📋",
  },
  {
    title: "Custom Platform Design",
    description: "Purpose-built UAV platforms with sensor payloads tailored to your specific research methodology and data requirements.",
    icon: "🛠️",
  },
  {
    title: "Data Pipeline Integration",
    description: "Automated workflows from sensor capture through processing to analysis-ready datasets compatible with your existing tools.",
    icon: "🔄",
  },
  {
    title: "Training & Knowledge Transfer",
    description: "Hands-on training for graduate students and lab techs on UAV operations, maintenance, and data processing.",
    icon: "🎓",
  },
  {
    title: "Ongoing Technical Support",
    description: "Dedicated support for firmware updates, sensor calibration, and mission planning throughout your research timeline.",
    icon: "🔧",
  },
  {
    title: "Publication Collaboration",
    description: "Co-authorship opportunities on methodology papers. We bring UAV engineering expertise to complement your domain knowledge.",
    icon: "📝",
  },
];

export default function UniversityPartnersPage() {
  return (
    <main className="min-h-screen pt-24 pb-16">
      {/* Hero */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-xs text-accent-green tracking-widest">[UNI]</span>
              <div className="h-px flex-1 bg-gradient-to-r from-accent-green/50 to-transparent" />
            </div>
            <h1 className="font-mono text-3xl md:text-4xl font-bold tracking-wider mb-4">
              UNIVERSITY PARTNERS
            </h1>
            <p className="text-text-secondary max-w-3xl text-lg">
              We partner with university research labs to provide custom UAV platforms, 
              automated data pipelines, and ongoing technical support — from grant proposal 
              through publication.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Why Partner With Us */}
      <section className="py-16 border-t border-border-dim">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-mono text-xl md:text-2xl font-bold tracking-wider mb-8">
            WHAT WE BRING TO YOUR LAB
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((cap, i) => (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="border border-border-dim rounded-lg p-6 hover:border-accent-green/50 transition-colors"
              >
                <span className="text-2xl">{cap.icon}</span>
                <h3 className="font-mono text-sm font-bold tracking-wider mt-3 mb-2">{cap.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{cap.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Research Labs */}
      <section className="py-16 border-t border-border-dim">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-xs text-accent-orange tracking-widest">[LABS]</span>
            <div className="h-px flex-1 bg-gradient-to-r from-accent-orange/50 to-transparent" />
          </div>
          <h2 className="font-mono text-xl md:text-2xl font-bold tracking-wider mb-4">
            TARGET RESEARCH LABS
          </h2>
          <p className="text-text-secondary mb-8 max-w-2xl">
            Labs whose research aligns with our UAV platform capabilities. We&apos;re actively 
            reaching out to explore collaboration opportunities.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {labs.map((lab, i) => (
              <motion.div
                key={lab.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="osd-card rounded-lg p-6 hud-corners hover:border-accent-orange/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{lab.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-mono text-sm font-bold tracking-wider">{lab.name}</h3>
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded ${
                        lab.status === "active" ? "bg-accent-green/20 text-accent-green" :
                        lab.status === "completed" ? "bg-blue-500/20 text-blue-400" :
                        "bg-accent-orange/20 text-accent-orange"
                      }`}>
                        {lab.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-accent-green mb-1">{lab.university}</p>
                    <p className="font-mono text-[11px] text-text-secondary mb-2">
                      {lab.department} · {lab.focus}
                    </p>
                    <p className="text-sm text-text-secondary leading-relaxed">{lab.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Partnership Process */}
      <section className="py-16 border-t border-border-dim">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-mono text-xl md:text-2xl font-bold tracking-wider mb-8">
            PARTNERSHIP PROCESS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Discovery Call", desc: "We learn about your research goals, data requirements, and timeline." },
              { step: "02", title: "Platform Design", desc: "Custom UAV spec with sensor payload, flight parameters, and data pipeline architecture." },
              { step: "03", title: "Grant Support", desc: "Equipment budgets, specs, and justification text for your funding proposal." },
              { step: "04", title: "Deploy & Support", desc: "Build, test, train your team, and provide ongoing technical support." },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="font-mono text-4xl text-accent-green font-bold mb-3">{item.step}</div>
                <h3 className="font-mono text-sm font-bold tracking-wider mb-2">{item.title}</h3>
                <p className="text-text-secondary text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 border-t border-border-dim">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="font-mono text-2xl font-bold tracking-wider mb-4">
            LET&apos;S COLLABORATE
          </h2>
          <p className="text-text-secondary mb-8">
            Whether you&apos;re writing a grant proposal or ready to deploy, we&apos;d love to 
            hear about your research. Free consultation for university labs.
          </p>
          <Link
            href="/contact"
            className="btn-glitch inline-flex items-center gap-2 px-10 py-4 bg-accent-green text-black font-mono text-sm tracking-widest font-bold rounded hover:bg-accent-green/90 transition-colors"
          >
            ▶ SCHEDULE A CALL
          </Link>
        </div>
      </section>
    </main>
  );
}
