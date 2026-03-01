"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProjectCard from "@/components/ProjectCard";
import type { Project } from "@/lib/getProjects";

const FILTERS = ["ALL", "OPERATIONAL", "IN DEVELOPMENT", "RESEARCH", "ACTIVE"];

export default function ProjectGrid({ projects }: { projects: Project[] }) {
  const [activeFilter, setActiveFilter] = useState("ALL");

  const filtered =
    activeFilter === "ALL"
      ? projects
      : projects.filter((p) => p.status === activeFilter);

  const uniqueStacks = [...new Set(projects.flatMap((p) => p.softwareStack))].length;

  return (
    <>
      {/* Filter Bar */}
      <div className="flex items-center gap-4 mb-8 pb-4 border-b border-border-dim overflow-x-auto">
        <span className="font-mono text-xs tracking-widest text-text-secondary shrink-0">
          FILTER:
        </span>
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`font-mono text-xs tracking-widest px-3 py-1.5 rounded border shrink-0 transition-colors cursor-pointer ${
              filter === activeFilter
                ? "border-accent-orange text-accent-orange bg-accent-orange/5"
                : "border-border-dim text-text-secondary hover:border-border-bright hover:text-foreground"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
        {[
          { label: "SHOWING", value: filtered.length.toString() },
          {
            label: "OPERATIONAL",
            value: projects.filter((p) => p.status === "OPERATIONAL").length.toString(),
          },
          {
            label: "IN DEVELOPMENT",
            value: projects.filter((p) => p.status === "IN DEVELOPMENT").length.toString(),
          },
          { label: "UNIQUE STACKS", value: uniqueStacks.toString() },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-surface border border-border-dim rounded px-4 py-3 text-center"
          >
            <span className="block font-mono text-xs text-text-secondary tracking-widest mb-1">
              {stat.label}
            </span>
            <span className="block font-mono text-xl text-accent-green">
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filtered.map((project, i) => (
            <motion.div
              key={project.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
            >
              <ProjectCard project={project} index={i} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="font-mono text-sm text-text-secondary tracking-wider">
            NO PLATFORMS MATCHING FILTER: <span className="text-accent-orange">{activeFilter}</span>
          </p>
        </div>
      )}
    </>
  );
}
