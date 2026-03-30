import HeroSection from "@/components/HeroSection";
import ServiceMatrix from "@/components/ServiceMatrix";
import CredentialsSection from "@/components/CredentialsSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import FlightLog from "@/components/FlightLog";
import TelemetryDashboard from "@/components/Telemetry/TelemetryDashboard";
import GitHubActivity from "@/components/GitHubActivity";
import DroneBuilder from "@/components/DroneBuilder/DroneBuilder";
import ServiceAreaMap from "@/components/ServiceAreaMap";
import VideoBackground from "@/components/VideoBackground";
import { getProjects } from "@/lib/getProjects";
import ProjectCard from "@/components/ProjectCard";
import Link from "next/link";

export default async function Home() {
  const projects = await getProjects();
  const featured = projects.slice(0, 3);

  return (
    <>
      {/* Hero */}
      <HeroSection />

      {/* Operator Credentials & Stats */}
      <CredentialsSection />

      {/* For Researchers */}
      <section className="py-24 border-t border-border-dim">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-xs text-accent-green tracking-widest">[RSR]</span>
            <div className="h-px flex-1 bg-gradient-to-r from-accent-green/50 to-transparent" />
          </div>
          <h2 className="font-mono text-2xl md:text-3xl font-bold tracking-wider mb-4">FOR RESEARCHERS</h2>
          <p className="text-text-secondary max-w-2xl mb-8">
            Purpose-built UAV platforms designed for academic research labs. We support you from grant proposal through deployment.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: "▣", title: "Grant Proposal Support", desc: "Equipment specs, BOMs, and budget justifications for NSF, DOE, USDA applications" },
              { icon: "⬡", title: "Custom Data Pipelines", desc: "Sensor → cloud → analysis workflows tailored to your research methodology" },
              { icon: "◈", title: "Automated Missions", desc: "Repeatable survey patterns with terrain-following for longitudinal studies" },
              { icon: "◉", title: "CV & ML Integration", desc: "Deploy trained models on aerial data — crop health, defect detection, wildlife counting" },
            ].map((item) => (
              <div key={item.title} className="border border-border-dim rounded-lg p-6 hover:border-accent-green/50 transition-colors">
                <span className="text-2xl text-accent-green">{item.icon}</span>
                <h3 className="font-mono text-sm font-bold tracking-wider mt-3 mb-2">{item.title}</h3>
                <p className="text-text-secondary text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link href="/services/ai-automation" className="btn-glitch inline-flex items-center gap-2 px-8 py-3 border border-accent-green text-accent-green font-mono text-xs tracking-widest rounded hover:bg-accent-green/10 transition-colors">
              ▶ AI AUTOMATION SERVICES
            </Link>
          </div>
        </div>
      </section>

      {/* Research Areas */}
      <section className="py-16 border-t border-border-dim">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-xs text-accent-orange tracking-widest">[OPS]</span>
            <div className="h-px flex-1 bg-gradient-to-r from-accent-orange/50 to-transparent" />
          </div>
          <h2 className="font-mono text-2xl md:text-3xl font-bold tracking-wider mb-8">RESEARCH AREAS</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { icon: "🌿", label: "Environmental Monitoring", desc: "Air quality, water sampling, ecosystem mapping" },
              { icon: "🌾", label: "Agricultural Survey", desc: "Crop health, NDVI analysis, precision agriculture" },
              { icon: "🏗️", label: "Infrastructure Inspection", desc: "Bridges, towers, pipelines, solar farms" },
              { icon: "🔍", label: "Search & Rescue", desc: "Thermal imaging, autonomous search patterns" },
              { icon: "🗺️", label: "Geological Mapping", desc: "Photogrammetry, LiDAR, terrain modeling" },
            ].map((area) => (
              <div key={area.label} className="border border-border-dim rounded-lg p-5 text-center hover:border-accent-orange/50 transition-colors">
                <div className="text-2xl mb-2">{area.icon}</div>
                <h3 className="font-mono text-xs font-bold tracking-wider mb-1">{area.label}</h3>
                <p className="text-text-secondary text-[10px] leading-relaxed">{area.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Projects Preview */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-xs text-accent-orange tracking-widest">
              [HGR]
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-accent-orange/50 to-transparent" />
          </div>
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="font-mono text-2xl md:text-3xl font-bold tracking-wider">
                RECENT BUILDS
              </h2>
              <p className="mt-2 text-text-secondary text-sm">
                Select platforms from the active fleet.
              </p>
            </div>
            <Link
              href="/projects"
              className="hidden sm:inline-flex items-center gap-2 font-mono text-xs tracking-widest text-accent-orange hover:text-foreground transition-colors"
            >
              VIEW ALL →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((project, i) => (
              <ProjectCard key={project.id} project={project} index={i} />
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link
              href="/projects"
              className="btn-glitch inline-flex items-center gap-2 px-6 py-3 border border-accent-orange text-accent-orange font-mono text-xs tracking-widest rounded hover:bg-accent-orange/10 transition-colors"
            >
              VIEW ALL BUILDS →
            </Link>
          </div>
        </div>
      </section>

      {/* Service Area Map */}
      <ServiceAreaMap />

      {/* Flight Log — Embedded YouTube reel */}
      <FlightLog />

      {/* Live Telemetry Dashboard */}
      <section className="relative overflow-hidden">
        <VideoBackground mp4="/videos/search-rescue.mp4" webm="/videos/search-rescue.webm" poster="/videos/posters/search-rescue.jpg" opacity={0.06} />
        <TelemetryDashboard />
      </section>

      {/* Service Matrix */}
      <ServiceMatrix />

      {/* GitHub Activity */}
      <GitHubActivity />

      {/* Interactive Drone Builder */}
      <section className="relative overflow-hidden">
        <VideoBackground mp4="/videos/inspection.mp4" webm="/videos/inspection.webm" poster="/videos/posters/inspection.jpg" opacity={0.05} />
        <DroneBuilder />
      </section>

      {/* Testimonials — Signal Intercepts */}
      <TestimonialsSection />

      {/* CTA Section */}
      <section className="py-24 grid-bg relative">
        <VideoBackground mp4="/videos/night-ops.mp4" webm="/videos/night-ops.webm" poster="/videos/posters/night-ops.jpg" opacity={0.1} />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
          <div className="font-mono text-[10px] tracking-[0.3em] text-accent-green mb-6">
            ▸ TRANSMISSION OPEN
          </div>
          <h2 className="font-mono text-2xl md:text-3xl font-bold tracking-wider mb-4">
            READY TO BUILD?
          </h2>
          <p className="text-text-secondary mb-8 max-w-xl mx-auto">
            Whether you need a full autonomous platform, aerial cinematography, FPGA
            integration, or a targeted consultation on flight controller firmware —
            let&apos;s scope it out.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/contact"
              className="btn-glitch inline-flex items-center gap-2 px-10 py-4 bg-accent-orange text-black font-mono text-sm tracking-widest font-bold rounded hover:bg-accent-orange/90 transition-colors"
            >
              ▶ INITIATE CONTACT
            </Link>
            <a
              href="https://www.youtube.com/@ajayadahal6160"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 border border-border-dim text-text-secondary font-mono text-sm tracking-widest rounded hover:border-accent-orange hover:text-accent-orange transition-colors"
            >
              ▶ YOUTUBE CHANNEL
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
