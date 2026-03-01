"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface VideoEntry {
  id: string;
  title: string;
  category: string;
  youtubeId: string;
  description: string;
}

const videos: VideoEntry[] = [
  {
    id: "stm32-drone",
    title: "STM32 Custom Drone — Full Build Video",
    category: "BUILD",
    youtubeId: "x70c3RrDk2c",
    description:
      "Complete build walkthrough of a custom PCB flight controller drone using STM32 Blue Pill. 3K+ views.",
  },
  {
    id: "px4-roi",
    title: "PX4 QGC ROI Object Tracking Simulation",
    category: "SIMULATION",
    youtubeId: "-4iIzqeIK_s",
    description:
      "Region-of-interest tracking using PX4 autopilot in SITL with QGroundControl.",
  },
  {
    id: "hovergames3",
    title: "Chemical Hazard Testing Ranger — HoverGames 3.0",
    category: "COMPETITION",
    youtubeId: "Ba8dZ647reI",
    description:
      "NXP HoverGames 3.0 competition entry for autonomous chemical hazard detection.",
  },
  {
    id: "hovergames2",
    title: "NXP HoverGames Challenge 2",
    category: "COMPETITION",
    youtubeId: "gxKfjFzo7fg",
    description:
      "Second HoverGames entry using NXP FMUK66 flight controller for social good.",
  },
  {
    id: "s500-build",
    title: "S500 Quadcopter Build",
    category: "BUILD",
    youtubeId: "yG9O7N9spW8",
    description:
      "Building and testing an S500-class research quadcopter platform.",
  },
  {
    id: "shark-aero",
    title: "Shark Aero — 3D Printed RC Plane Build",
    category: "BUILD",
    youtubeId: "zGE-E661loY",
    description:
      "End-to-end build of a fully 3D-printed fixed-wing RC aircraft.",
  },
];

const categories = ["ALL", "BUILD", "SIMULATION", "COMPETITION"];

/** YouTube facade — shows thumbnail, loads iframe only on click */
function VideoFacade({ video }: { video: VideoEntry }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="relative w-full pt-[56.25%] bg-background">
        <iframe
          src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className="relative w-full pt-[56.25%] bg-background group/play cursor-pointer"
      aria-label={`Play ${video.title}`}
    >
      {/* YouTube thumbnail */}
      <img
        src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`}
        alt={video.title}
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40 group-hover/play:bg-black/20 transition-colors" />
      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-accent-orange/90 flex items-center justify-center group-hover/play:scale-110 transition-transform shadow-lg shadow-accent-orange/30">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-black ml-0.5">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </button>
  );
}

export default function FlightLog() {
  const [activeCategory, setActiveCategory] = useState("ALL");

  const filtered =
    activeCategory === "ALL"
      ? videos
      : videos.filter((v) => v.category === activeCategory);

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-xs text-accent-orange tracking-widest">
              [LOG]
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-accent-orange/50 to-transparent" />
          </div>
          <h2 className="font-mono text-2xl md:text-3xl font-bold tracking-wider">
            FLIGHT LOG & MEDIA REEL
          </h2>
          <p className="mt-2 text-text-secondary text-base max-w-2xl">
            Custom PCB drone builds, PX4 simulation demos, and NXP HoverGames competition entries.
            All real. All engineered.
          </p>
        </motion.div>

        {/* Interactive Category Filters */}
        <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`font-mono text-xs tracking-widest px-3 py-1.5 rounded border shrink-0 transition-colors cursor-pointer ${
                cat === activeCategory
                  ? "border-accent-orange text-accent-orange bg-accent-orange/5"
                  : "border-border-dim text-text-secondary hover:border-border-bright hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
          <span className="ml-auto font-mono text-xs text-text-secondary tracking-wider shrink-0">
            {filtered.length}/{videos.length} ENTRIES
          </span>
        </div>

        {/* Video Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filtered.map((video, i) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="osd-card rounded-lg overflow-hidden hud-corners group"
              >
                {/* Category Header */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-border-dim bg-elevated/50">
                  <span className="font-mono text-xs tracking-widest text-text-secondary">
                    {video.category}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-green pulse-green" />
                </div>

                {/* YouTube Facade (loads iframe on click) */}
                <VideoFacade video={video} />

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-mono text-sm font-bold tracking-wider text-foreground mb-2 group-hover:text-accent-orange transition-colors">
                    {video.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {video.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* YouTube CTA */}
        <div className="mt-12 text-center">
          <a
            href="https://www.youtube.com/@ajayadahal6160"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-glitch inline-flex items-center gap-2 px-8 py-3 border border-accent-orange text-accent-orange font-mono text-xs tracking-widest rounded hover:bg-accent-orange/10 transition-colors"
          >
            ▶ VIEW ALL ON YOUTUBE →
          </a>
        </div>
      </div>
    </section>
  );
}
