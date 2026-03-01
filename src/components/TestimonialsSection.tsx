"use client";

import { motion } from "framer-motion";

const testimonials = [
  {
    initials: "NP",
    name: "Nitish Patil",
    role: "PhD Candidate in ECE",
    org: "Mississippi State University",
    date: "December 2021",
    tag: "UAVs & Image Processing",
    quote:
      "Ajaya is a multi-talented person with the level of knowledge you would expect from a PhD candidate. He has quite the problem solving capabilities and would be considered an expert in the field of Electrical and Computer Engineering. I had the pleasure of working with him on the software side of UAVs and image processing where he shows excellent leadership qualities.",
  },
  {
    initials: "AG",
    name: "Alexis Grey",
    role: "Embedded Software Engineer",
    org: "AMD (Manager)",
    date: "February 2024",
    tag: "FPGA Design & High-Speed Protocols",
    quote:
      "AJ is the real deal — Fantastic engineer who learns at an unbelievable pace, and enjoys the process. I had the opportunity to have him on my team at AMD where we solved challenging problems together across a broad range of topics. AJ was a sponge, soaking up everything we threw at him, from high-speed serial protocols and signal integrity, FPGA design and configuration, bare-metal software, and embedded Linux.",
  },
  {
    initials: "JL",
    name: "John Linn",
    role: "Strategic Application Engineer",
    org: "AMD / Xilinx",
    date: "December 2024",
    tag: "RTL to Linux Drivers",
    quote:
      "He is a very motivated sharp embedded engineer. He pushes through hard problems to get to a solution with both embedded hardware and software. He has the ability to learn new technology as he covers a lot of varied embedded subjects from RTL to Linux drivers to bare metal drivers. He is a great asset wherever he is working.",
  },
  {
    initials: "DS",
    name: "Daniel Sill",
    role: "SMTS Systems Design Engineer",
    org: "AMD",
    date: "January 2025",
    tag: "Hardware & Software Debug",
    quote:
      "I mentored AJ through the AMD Mentor Program. I found him to be both very eager to learn and easy to work with. In his current role at AMD, he debugs both hardware and software issues reported by networking customers. These multidisciplinary skills have made him a very valuable asset to AMD.",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-24 bg-surface/30">
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
              [REC]
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-accent-orange/50 to-transparent" />
          </div>
          <h2 className="font-mono text-2xl md:text-3xl font-bold tracking-wider">
            SIGNAL INTERCEPTS
          </h2>
          <p className="mt-2 text-text-secondary text-base max-w-2xl">
            What colleagues, managers, and research collaborators say about working with AJ.
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="osd-card rounded-lg overflow-hidden hud-corners"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border-dim bg-elevated/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-accent-orange/10 border border-accent-orange/30 flex items-center justify-center font-mono text-xs text-accent-orange font-bold">
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-mono text-xs font-bold text-foreground">
                      {t.name}
                    </p>
                    <p className="font-mono text-[11px] text-text-secondary">
                      {t.role} • {t.org}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-text-secondary tracking-wider">
                  {t.date}
                </span>
              </div>

              {/* Quote */}
              <div className="p-5">
                <p className="text-sm text-text-secondary leading-relaxed italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-accent-green text-xs">▸</span>
                  <span className="font-mono text-xs text-accent-green tracking-wider">
                    {t.tag}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* LinkedIn CTA */}
        <div className="mt-8 text-center">
          <a
            href="https://www.linkedin.com/in/ajaya-dahal-137b94108/details/recommendations/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-mono text-xs tracking-widest text-accent-orange hover:text-foreground transition-colors"
          >
            VIEW ALL ON LINKEDIN →
          </a>
        </div>
      </div>
    </section>
  );
}
