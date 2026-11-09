"use client";

import { motion } from "framer-motion";
import Link from "next/link";

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
              UNIVERSITY PARTNERSHIPS
            </h1>
            <p className="text-text-secondary max-w-3xl text-lg">
              Built for university research labs: custom UAV platforms, automated data
              pipelines, and ongoing technical support, from grant proposal through
              publication.
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
