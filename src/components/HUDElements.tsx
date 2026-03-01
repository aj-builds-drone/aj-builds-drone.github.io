"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface SectionHeaderProps {
  code: string;
  title: string;
  subtitle?: string;
  /** Render as h1 on top-level page headers, defaults to h2 for sections */
  as?: "h1" | "h2";
}

export function SectionHeader({ code, title, subtitle, as: Tag = "h2" }: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="mb-12"
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="font-mono text-xs text-accent-orange tracking-widest">
          [{code}]
        </span>
        <div className="h-px flex-1 bg-gradient-to-r from-accent-orange/50 to-transparent" />
      </div>
      <Tag className="font-mono text-2xl md:text-3xl font-bold tracking-wider">
        {title}
      </Tag>
      {subtitle && (
        <p className="mt-2 text-text-secondary text-base max-w-2xl">
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}

interface HUDPanelProps {
  children: ReactNode;
  className?: string;
}

export function HUDPanel({ children, className = "" }: HUDPanelProps) {
  return (
    <div className={`relative border border-border-dim bg-surface rounded-lg p-6 hud-corners ${className}`}>
      {children}
    </div>
  );
}

export function StatBox({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="bg-background border border-border-dim rounded px-4 py-3 text-center">
      <span className="block font-mono text-xs text-text-secondary tracking-widest uppercase mb-1">
        {label}
      </span>
      <span className="block font-mono text-xl text-accent-green">
        {value}
        {unit && <span className="text-xs text-text-secondary ml-1">{unit}</span>}
      </span>
    </div>
  );
}
