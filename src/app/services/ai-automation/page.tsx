import { SectionHeader } from "@/components/HUDElements";
import Link from "next/link";
import VideoBackground from "@/components/VideoBackground";

export const metadata = {
  title: "AI Automation Services — Research UAV Data Pipelines",
  description:
    "AI-powered research automation: custom UAV data pipelines, automated flight planning, computer vision integration, and grant proposal support. Custom quotes starting at $2,500.",
  alternates: {
    canonical: "https://aj-builds-drone.github.io/services/ai-automation/",
  },
  openGraph: {
    title: "AI Automation Services | AJ Builds Drone",
    description:
      "From data collection to analysis — custom UAV platforms with AI-powered pipelines for academic research and industrial inspection.",
    url: "https://aj-builds-drone.github.io/services/ai-automation/",
    siteName: "AJ Builds Drone",
    type: "website",
  },
};

const services = [
  {
    icon: "⬡",
    code: "PIPE",
    title: "Custom UAV Data Pipelines",
    desc: "End-to-end data flow from onboard sensors to cloud storage and automated analysis. Multispectral, LiDAR, thermal, and RGB payloads supported.",
    details: [
      "Sensor → Edge Processing → Cloud Ingest",
      "Automated QA/QC and georeferencing",
      "Integration with GIS platforms (QGIS, ArcGIS)",
      "Real-time telemetry streaming dashboards",
    ],
  },
  {
    icon: "◈",
    code: "PLAN",
    title: "Automated Flight Planning",
    desc: "Mission planning software for systematic survey and mapping operations. Optimized coverage patterns with terrain-following and obstacle avoidance.",
    details: [
      "Survey grid & crosshatch pattern generation",
      "Terrain-following with DEM integration",
      "Multi-battery mission segmentation",
      "Compliance with airspace restrictions (LAANC)",
    ],
  },
  {
    icon: "◉",
    code: "VISN",
    title: "Computer Vision Integration",
    desc: "Deploy trained ML models on aerial data for crop health analysis, infrastructure defect detection, environmental monitoring, and more.",
    details: [
      "Crop stress & NDVI analysis from multispectral data",
      "Infrastructure crack/corrosion detection",
      "Wildlife population counting & tracking",
      "Change detection across temporal datasets",
    ],
  },
  {
    icon: "▣",
    code: "GRNT",
    title: "Research Proposal Support",
    desc: "Equipment specifications, budget justifications, and technical narratives for NSF, DOE, USDA, and other grant applications.",
    details: [
      "Detailed BOM with vendor quotes",
      "Performance specs & flight envelope data",
      "Regulatory compliance documentation",
      "Letters of capability & support",
    ],
  },
];

export default function AIAutomationPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden grid-bg">
        <VideoBackground
          mp4="/videos/inspection.mp4"
          webm="/videos/inspection.webm"
          poster="/videos/posters/inspection.jpg"
          opacity={0.08}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background z-[1]" />
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-2 h-2 bg-accent-green pulse-green" />
            <span className="font-mono text-[11px] tracking-[0.3em] text-accent-green">
              AI AUTOMATION DIVISION
            </span>
          </div>
          <h1 className="font-mono text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-6">
            <span className="text-foreground">AI-Powered Research Automation</span>
            <br />
            <span className="text-accent-orange">From Data Collection</span>
            <br />
            <span className="text-accent-green">to Analysis.</span>
          </h1>
          <p className="text-text-secondary max-w-2xl text-lg leading-relaxed mb-8">
            Purpose-built UAV platforms with integrated AI pipelines for academic
            research labs and industrial inspection teams. We handle the full
            stack — hardware, software, cloud, and compliance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#quote"
              className="btn-glitch inline-flex items-center justify-center gap-2 px-8 py-4 bg-accent-orange text-black font-mono text-sm tracking-widest font-bold rounded hover:bg-accent-orange/90 transition-colors"
            >
              ▶ REQUEST A QUOTE
            </a>
            <Link
              href="/projects"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-accent-green text-accent-green font-mono text-sm tracking-widest rounded hover:bg-accent-green/10 transition-colors"
            >
              ◈ VIEW PLATFORMS
            </Link>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader code="SVC" title="AUTOMATION SERVICES" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            {services.map((svc) => (
              <div
                key={svc.code}
                className="border border-border-dim rounded-lg p-8 hover:border-accent-orange/50 transition-colors bg-background/50"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl text-accent-orange">{svc.icon}</span>
                  <span className="font-mono text-[10px] tracking-[0.3em] text-accent-green">
                    [{svc.code}]
                  </span>
                </div>
                <h3 className="font-mono text-lg font-bold tracking-wider mb-3">
                  {svc.title}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed mb-4">
                  {svc.desc}
                </p>
                <ul className="space-y-2">
                  {svc.details.map((d, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs font-mono text-text-secondary"
                    >
                      <span className="text-accent-green mt-0.5">▸</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 border-t border-border-dim">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <span className="font-mono text-[10px] tracking-[0.3em] text-accent-orange">
            PRICING
          </span>
          <h2 className="font-mono text-2xl md:text-3xl font-bold tracking-wider mt-2 mb-4">
            CUSTOM RESEARCH PLATFORMS
          </h2>
          <p className="text-text-secondary text-lg mb-8">
            Custom quotes starting at{" "}
            <span className="text-accent-orange font-bold">$2,500</span> for
            research platforms. Every project is scoped to your specific data
            collection and analysis requirements.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            <div className="border border-border-dim rounded-lg p-6">
              <div className="font-mono text-xs text-accent-green mb-2">TIER 1</div>
              <div className="font-mono text-xl font-bold mb-2">$2,500+</div>
              <div className="text-sm text-text-secondary">
                Flight planning & data pipeline setup for existing platforms
              </div>
            </div>
            <div className="border border-accent-orange/50 rounded-lg p-6 relative">
              <div className="absolute -top-3 left-4 bg-accent-orange text-black font-mono text-[10px] tracking-widest px-3 py-1 rounded">
                POPULAR
              </div>
              <div className="font-mono text-xs text-accent-green mb-2">TIER 2</div>
              <div className="font-mono text-xl font-bold mb-2">$7,500+</div>
              <div className="text-sm text-text-secondary">
                Custom platform build + sensor integration + data pipeline
              </div>
            </div>
            <div className="border border-border-dim rounded-lg p-6">
              <div className="font-mono text-xs text-accent-green mb-2">TIER 3</div>
              <div className="font-mono text-xl font-bold mb-2">$15,000+</div>
              <div className="text-sm text-text-secondary">
                Full research platform with CV models, cloud pipeline & ongoing support
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Form */}
      <section id="quote" className="py-24 grid-bg relative">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
        <div className="relative z-10 max-w-2xl mx-auto px-4">
          <SectionHeader code="RFQ" title="REQUEST A QUOTE" />
          <p className="text-text-secondary mt-4 mb-8 text-center">
            Tell us about your research project. We&apos;ll respond within 48
            hours with a detailed scope and estimate.
          </p>
          <form
            action="https://formspree.io/f/xpwzgvok"
            method="POST"
            className="space-y-6"
          >
            <input type="hidden" name="_subject" value="AI Automation Quote Request" />
            <div>
              <label className="block font-mono text-xs tracking-widest text-text-secondary mb-2">
                UNIVERSITY / ORGANIZATION *
              </label>
              <input
                type="text"
                name="organization"
                required
                className="w-full bg-background border border-border-dim rounded px-4 py-3 font-mono text-sm focus:border-accent-orange focus:outline-none transition-colors"
                placeholder="e.g. MIT Lincoln Laboratory"
              />
            </div>
            <div>
              <label className="block font-mono text-xs tracking-widest text-text-secondary mb-2">
                PROJECT TYPE *
              </label>
              <select
                name="project_type"
                required
                className="w-full bg-background border border-border-dim rounded px-4 py-3 font-mono text-sm focus:border-accent-orange focus:outline-none transition-colors"
              >
                <option value="">Select project type...</option>
                <option value="data-pipeline">UAV Data Pipeline</option>
                <option value="flight-planning">Automated Flight Planning</option>
                <option value="computer-vision">Computer Vision Integration</option>
                <option value="grant-support">Research Proposal Support</option>
                <option value="full-platform">Full Research Platform Build</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block font-mono text-xs tracking-widest text-text-secondary mb-2">
                  TIMELINE
                </label>
                <select
                  name="timeline"
                  className="w-full bg-background border border-border-dim rounded px-4 py-3 font-mono text-sm focus:border-accent-orange focus:outline-none transition-colors"
                >
                  <option value="">Select timeline...</option>
                  <option value="1-month">1 month</option>
                  <option value="1-3-months">1–3 months</option>
                  <option value="3-6-months">3–6 months</option>
                  <option value="6-plus-months">6+ months</option>
                </select>
              </div>
              <div>
                <label className="block font-mono text-xs tracking-widest text-text-secondary mb-2">
                  BUDGET RANGE
                </label>
                <select
                  name="budget"
                  className="w-full bg-background border border-border-dim rounded px-4 py-3 font-mono text-sm focus:border-accent-orange focus:outline-none transition-colors"
                >
                  <option value="">Select range...</option>
                  <option value="2500-5000">$2,500 – $5,000</option>
                  <option value="5000-10000">$5,000 – $10,000</option>
                  <option value="10000-25000">$10,000 – $25,000</option>
                  <option value="25000-plus">$25,000+</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block font-mono text-xs tracking-widest text-text-secondary mb-2">
                NAME *
              </label>
              <input
                type="text"
                name="name"
                required
                className="w-full bg-background border border-border-dim rounded px-4 py-3 font-mono text-sm focus:border-accent-orange focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block font-mono text-xs tracking-widest text-text-secondary mb-2">
                EMAIL *
              </label>
              <input
                type="email"
                name="email"
                required
                className="w-full bg-background border border-border-dim rounded px-4 py-3 font-mono text-sm focus:border-accent-orange focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block font-mono text-xs tracking-widest text-text-secondary mb-2">
                PROJECT DETAILS
              </label>
              <textarea
                name="details"
                rows={4}
                className="w-full bg-background border border-border-dim rounded px-4 py-3 font-mono text-sm focus:border-accent-orange focus:outline-none transition-colors resize-y"
                placeholder="Describe your data collection needs, target environment, analysis goals..."
              />
            </div>
            <button
              type="submit"
              className="btn-glitch w-full py-4 bg-accent-orange text-black font-mono text-sm tracking-widest font-bold rounded hover:bg-accent-orange/90 transition-colors"
            >
              ▶ SUBMIT QUOTE REQUEST
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
