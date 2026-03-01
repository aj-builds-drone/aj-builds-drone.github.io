"use client";

import { motion } from "framer-motion";
import type { Project } from "@/lib/getProjects";

interface ProjectCardProps {
  project: Project;
  index: number;
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    OPERATIONAL: "bg-accent-green/10 text-accent-green border-accent-green/30",
    "IN DEVELOPMENT": "bg-accent-orange/10 text-accent-orange border-accent-orange/30",
    ACTIVE: "bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30",
    RESEARCH: "bg-purple-500/10 text-purple-400 border-purple-400/30",
  };

  const colors = colorMap[status] || "bg-text-secondary/10 text-text-secondary border-text-secondary/30";

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono tracking-wider border ${colors}`}>
      <span className="w-1 h-1 rounded-full bg-current pulse-green" />
      {status}
    </span>
  );
}

export default function ProjectCard({ project, index }: ProjectCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="osd-card rounded-lg overflow-hidden hud-corners group"
    >
      {/* OSD Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-dim bg-elevated/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 border border-accent-green bg-accent-green/20" />
          <span className="font-mono text-[11px] tracking-widest text-text-secondary">
            UAV//{project.id.toUpperCase()}
          </span>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {/* Card Body */}
      <div className="p-5">
        {/* Title */}
        <h3 className="font-mono text-lg font-bold text-foreground tracking-wide mb-1 group-hover:text-accent-orange transition-colors">
          {project.title}
        </h3>
        <p className="font-mono text-xs text-accent-orange/80 tracking-wider mb-3">
          {project.subtitle}
        </p>

        {/* Description */}
        <p className="text-sm text-text-secondary leading-relaxed mb-4">
          {project.description}
        </p>

        {/* Specs Grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {Object.entries(project.specs).map(([key, value]) => (
            <div key={key} className="bg-background rounded px-3 py-2 border border-border-dim">
              <span className="block font-mono text-[11px] text-text-secondary tracking-wider uppercase">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </span>
              <span className="block font-mono text-xs text-accent-green mt-0.5">
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* BOM Section */}
        <div className="mb-4">
          <h4 className="font-mono text-xs tracking-widest text-accent-orange mb-2">
            // BILL OF MATERIALS
          </h4>
          <ul className="space-y-1">
            {project.bom.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-text-secondary font-mono">
                <span className="text-border-bright mt-0.5 shrink-0">├─</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Software Stack Tags */}
        <div>
          <h4 className="font-mono text-xs tracking-widest text-accent-orange mb-2">
            // SOFTWARE STACK
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {project.softwareStack.map((tech) => (
              <span
                key={tech}
                className="px-2 py-0.5 bg-accent-green/5 border border-accent-green/20 rounded text-[11px] font-mono text-accent-green tracking-wider"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* OSD Footer with Links */}
      <div className="px-4 py-2 border-t border-border-dim bg-elevated/30 flex justify-between items-center">
        {project.links && Object.keys(project.links).length > 0 ? (
          <div className="flex items-center gap-3">
            {Object.entries(project.links).map(([key, url]) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] tracking-wider text-text-secondary hover:text-accent-orange transition-colors uppercase"
              >
                {key === 'youtube' ? '▶ VIDEO' : key === 'hackster' ? '◈ HACKSTER' : key === 'grabcad' ? '⬡ CAD' : key === 'pitch' ? '▶ PITCH' : `▸ ${key.toUpperCase()}`}
              </a>
            ))}
          </div>
        ) : (
          <span className="font-mono text-[11px] text-text-secondary tracking-wider">
            DATALINK::ACTIVE
          </span>
        )}
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`w-1 ${i < 4 ? "h-2" : "h-3"} ${i < 3 ? "bg-accent-green" : i < 4 ? "bg-accent-orange" : "bg-accent-red/30"}`}
            />
          ))}
        </div>
      </div>
    </motion.article>
  );
}
