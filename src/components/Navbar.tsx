"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggle from "./ThemeToggle";

const navLinks = [
  { href: "/", label: "HOME", code: "00" },
  { href: "/projects", label: "HANGAR", code: "01" },
  { href: "/services", label: "SERVICES", code: "02" },
  { href: "/contact", label: "RFQ", code: "03" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    const norm = (p: string) => p.replace(/\/+$/, "") || "/";
    const current = norm(pathname);
    if (href === "/") return current === "/";
    return current.startsWith(href);
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border-dim">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 border border-accent-green relative flex items-center justify-center">
              <div className="w-2 h-2 bg-accent-green pulse-green" />
              <div className="absolute inset-0 border border-accent-green/30 scale-125" />
            </div>
            <span className="font-mono text-sm tracking-widest text-accent-green">
              AJ//DRONE<span className="text-accent-orange">_SYS</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative px-4 py-2 font-mono text-xs tracking-wider transition-colors group ${
                    active
                      ? "text-accent-orange"
                      : "text-text-secondary hover:text-accent-orange"
                  }`}
                >
                  <span
                    className={`mr-1 ${
                      active
                      ? "text-accent-orange"
                        : "text-border-bright group-hover:text-accent-orange/50"
                    }`}
                  >
                    [{link.code}]
                  </span>
                  {link.label}
                  <span
                    className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-px bg-accent-orange transition-all ${
                      active ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                  />
                </Link>
              );
            })}
          </div>

          {/* Status Indicator + Theme Toggle */}
          <div className="hidden md:flex items-center gap-4 font-mono text-xs tracking-wider">
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent-green pulse-green" />
              <span className="text-accent-green">SYS ONLINE</span>
            </div>
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-text-secondary hover:text-accent-orange"
            aria-label="Toggle navigation"
          >
            <div className="w-5 h-4 flex flex-col justify-between">
              <span className={`block h-px bg-current transition-transform ${isOpen ? "rotate-45 translate-y-1.5" : ""}`} />
              <span className={`block h-px bg-current transition-opacity ${isOpen ? "opacity-0" : ""}`} />
              <span className={`block h-px bg-current transition-transform ${isOpen ? "-rotate-45 -translate-y-1.5" : ""}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border-dim bg-background/95 backdrop-blur-md overflow-hidden"
          >
            <div className="px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={`block px-4 py-3 font-mono text-xs tracking-wider rounded transition-colors ${
                    isActive(link.href)
                      ? "text-accent-orange bg-accent-orange/10 border-l-2 border-accent-orange"
                      : "text-text-secondary hover:text-accent-orange hover:bg-surface"
                  }`}
                >
                  <span className={isActive(link.href) ? "text-accent-orange mr-2" : "text-border-bright mr-2"}>[{link.code}]</span>
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
