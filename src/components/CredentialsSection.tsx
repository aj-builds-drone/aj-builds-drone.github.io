"use client";

import { motion } from "framer-motion";

const credentials = [
  {
    icon: "🛩",
    title: "FAA Part 107",
    subtitle: "Certified Remote Pilot",
    detail: "Commercial drone operations certification",
  },
  {
    icon: "✈",
    title: "Private Pilot Student",
    subtitle: "60+ Flight Hours",
    detail: "Cessna 150 — Initial solo completed",
  },
  {
    icon: "🎓",
    title: "M.S. ECE",
    subtitle: "Mississippi State University",
    detail: "Electrical & Computer Engineering",
  },
  {
    icon: "⚡",
    title: "Sr. FPGA Systems Engineer",
    subtitle: "AMD / Xilinx",
    detail: "Silicon-level hardware expertise",
  },
];

const stats = [
  { value: "60+", label: "FLIGHT HOURS" },
  { value: "8+", label: "UAV BUILDS" },
  { value: "9.5K+", label: "HACKSTER VIEWS" },
  { value: "2", label: "COMPETITION ENTRIES" },
  { value: "107", label: "FAA CERT" },
  { value: "11+", label: "PUBLISHED PROJECTS" },
];

export default function CredentialsSection() {
  return (
    <section className="py-24 bg-surface/30 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-xs text-accent-orange tracking-widest">
              [PILOT]
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-accent-orange/50 to-transparent" />
          </div>
          <h2 className="font-mono text-2xl md:text-3xl font-bold tracking-wider">
            OPERATOR CREDENTIALS
          </h2>
          <p className="mt-2 text-text-secondary text-base max-w-3xl">
            Not just a drone guy — an engineer who understands the silicon, the
            firmware, the flight dynamics, and the airspace. From bare-metal
            STM32 code to 3,000ft AGL in a Cessna.
          </p>
        </motion.div>

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {credentials.map((cred, i) => (
            <motion.div
              key={cred.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="osd-card rounded-lg p-5 hud-corners text-center"
            >
              <div className="text-3xl mb-3">{cred.icon}</div>
              <h3 className="font-mono text-sm font-bold tracking-wider text-foreground mb-1">
                {cred.title}
              </h3>
              <p className="font-mono text-xs text-accent-orange tracking-wider mb-2">
                {cred.subtitle}
              </p>
              <p className="text-sm text-text-secondary">{cred.detail}</p>
            </motion.div>
          ))}
        </div>

        {/* Stats Ticker */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bg-background border border-border-dim rounded px-3 py-4 text-center"
            >
              <span className="block font-mono text-2xl text-accent-green font-bold">
                {stat.value}
              </span>
              <span className="block font-mono text-[11px] text-text-secondary tracking-widest mt-1">
                {stat.label}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Background narrative */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-16 osd-card rounded-lg p-6 md:p-8 hud-corners"
        >
          <h3 className="font-mono text-xs tracking-widest text-accent-orange mb-4">
            // ORIGIN STORY
          </h3>
          <div className="md:columns-2 gap-8 text-sm text-text-secondary leading-relaxed space-y-4">
            <p>
              I started building drones by hand-soldering a custom PCB flight
              controller onto an STM32 Blue Pill — not because I had to, but
              because I wanted to understand every electron between the
              gyroscope and the motor. That project hit 9,500+ views on
              Hackster.io and taught me more about control systems than any
              textbook.
            </p>
            <p>
              From there it was NXP HoverGames competitions (twice), a
              3D-printed Shark Aero fixed-wing, PX4 SITL simulations, and
              eventually strapping real sensors to real airframes for real
              missions. Along the way, I earned my FAA Part 107 and started
              training for my Private Pilot certificate — because the best way to
              understand flight is to do it yourself at 3,000 feet.
            </p>
            <p>
              My day job at AMD/Xilinx gave me something most drone contractors
              don&apos;t have: an understanding of hardware at the silicon level.
              FPGA design, high-speed serial protocols, signal integrity,
              embedded Linux — I&apos;ve debugged it all. That translates directly
              to building drone systems that are reliable, optimized, and
              actually production-ready.
            </p>
            <p>
              Today I combine all of it — custom hardware, firmware development,
              computer vision, Gazebo simulation, and real flight experience — into
              a one-stop drone engineering service for universities, research labs,
              and aerospace companies worldwide. Based in Austin, TX. Available globally.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
