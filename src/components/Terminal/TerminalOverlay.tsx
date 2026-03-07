"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TerminalLine {
  type: "input" | "output" | "error" | "system";
  text: string;
}

const BOOT_SEQUENCE: TerminalLine[] = [
  { type: "system", text: "AJ-DRONE-GCS v2.4.1 — Ground Control Terminal" },
  { type: "system", text: "Type 'help' for available commands." },
  { type: "system", text: "" },
];

const COMMANDS: Record<string, () => TerminalLine[]> = {
  help: () => [
    { type: "output", text: "Available commands:" },
    { type: "output", text: "  status     — System status overview" },
    { type: "output", text: "  projects   — List active builds" },
    { type: "output", text: "  skills     — Technical capabilities" },
    { type: "output", text: "  contact    — Communication channel" },
    { type: "output", text: "  whoami     — Operator identity" },
    { type: "output", text: "  launch     — 🚀" },
    { type: "output", text: "  neofetch   — System info" },
    { type: "output", text: "  clear      — Clear terminal" },
    { type: "output", text: "  exit       — Close terminal" },
  ],
  status: () => [
    { type: "output", text: "┌─────────────────────────────────┐" },
    { type: "output", text: "│  SYSTEM STATUS       ALL GREEN  │" },
    { type: "output", text: "├─────────────────────────────────┤" },
    { type: "output", text: "│  PX4 Autopilot ........ ONLINE  │" },
    { type: "output", text: "│  ROS2 Humble .......... ACTIVE  │" },
    { type: "output", text: "│  Gazebo Sim ........... READY   │" },
    { type: "output", text: "│  Computer Vision ...... LINKED  │" },
    { type: "output", text: "│  SLAM NAV ............. OPER    │" },
    { type: "output", text: "│  OAK-D Depth AI ....... SYNCED  │" },
    { type: "output", text: "│  FAA Part 107 ......... VALID   │" },
    { type: "output", text: "│  Uptime ............... 99.9%   │" },
    { type: "output", text: "└─────────────────────────────────┘" },
  ],
  projects: () => [
    { type: "output", text: "ACTIVE BUILDS:" },
    { type: "output", text: "  [01] STM32 Custom FC Drone ......... COMPLETE" },
    { type: "output", text: "  [02] PX4 ROI Tracking .............. COMPLETE" },
    { type: "output", text: "  [03] HoverGames 3 — NXP ........... COMPLETE" },
    { type: "output", text: "  [04] S500 Platform Upgrade ......... COMPLETE" },
    { type: "output", text: "  [05] HoverGames 2 — Gazebo ........ COMPLETE" },
    { type: "output", text: "  [06] Shark Aero Fixed Wing ........ IN PROGRESS" },
    { type: "output", text: "  [07] Anti-Collision System ......... TESTING" },
    { type: "output", text: "  [08] Aerial Cinematography Reel .... ACTIVE" },
    { type: "output", text: "" },
    { type: "system", text: "Navigate to /projects for full details." },
  ],
  skills: () => [
    { type: "output", text: "TECHNICAL CAPABILITIES:" },
    { type: "output", text: "  ╔═══════════════════════════════════════╗" },
    { type: "output", text: "  ║ Firmware:  PX4  ArduPilot  STM32     ║" },
    { type: "output", text: "  ║ Software:  ROS2  Gazebo  OpenCV      ║" },
    { type: "output", text: "  ║ Hardware:  FPGA  PCB  SystemVerilog  ║" },
    { type: "output", text: "  ║ Vision:    SLAM  OAK-D  YOLO         ║" },
    { type: "output", text: "  ║ Frontend:  React  Three.js  Next.js  ║" },
    { type: "output", text: "  ║ Deploy:    Docker  CI/CD  AWS        ║" },
    { type: "output", text: "  ╚═══════════════════════════════════════╝" },
  ],
  contact: () => [
    { type: "output", text: "COMMUNICATION CHANNELS:" },
    { type: "output", text: "  Email .... ajayadesign@gmail.com" },
    { type: "output", text: "  Web ...... /contact" },
    { type: "output", text: "  GitHub ... github.com/ajayadahal" },
    { type: "output", text: "  LinkedIn . linkedin.com/in/ajaya-dahal-137b94108" },
    { type: "output", text: "" },
    { type: "system", text: "Redirecting to /contact in 3s..." },
  ],
  whoami: () => [
    { type: "output", text: "Ajaya Dahal" },
    { type: "output", text: "UAV Systems Contractor & Sr. FPGA Engineer" },
    { type: "output", text: "FAA Part 107 Certified Remote Pilot" },
    { type: "output", text: "M.S. Electrical & Computer Engineering — MSU" },
    { type: "output", text: "Austin, TX — Operating Globally" },
  ],
  launch: () => [
    { type: "system", text: "INITIATING LAUNCH SEQUENCE..." },
    { type: "output", text: "  Pre-flight check ......... ✓" },
    { type: "output", text: "  GPS lock ................. ✓" },
    { type: "output", text: "  Battery 98% .............. ✓" },
    { type: "output", text: "  Motors armed ............. ✓" },
    { type: "output", text: "  Airspace clear ........... ✓" },
    { type: "output", text: "" },
    { type: "system", text: "🚀 LIFTOFF! Altitude climbing..." },
    { type: "system", text: "  50m ... 100m ... 200m ... 400m AGL" },
    { type: "system", text: "  Mission waypoint 1 acquired." },
  ],
  neofetch: () => [
    { type: "output", text: "     ___       __" },
    { type: "output", text: "    /   |     / /" },
    { type: "output", text: "   / /| |    / /    AJ Builds Drone" },
    { type: "output", text: "  / ___ | __/ /     ─────────────────" },
    { type: "output", text: " /_/  |_|/___/      OS: Next.js 16 + React 19" },
    { type: "output", text: "                    Shell: TypeScript 5 (strict)" },
    { type: "output", text: "    ╳──────╳        WM: Tailwind CSS 4" },
    { type: "output", text: "   ╱ \\    ╱ \\       Renderer: Three.js r172" },
    { type: "output", text: "  ╱   \\  ╱   \\      Animation: Framer Motion 12" },
    { type: "output", text: "  ╲   ╱  ╲   ╱      Testing: Playwright + Axe" },
    { type: "output", text: "   ╲ ╱    ╲ ╱       Uptime: 99.9%" },
    { type: "output", text: "    ╳──────╳        Theme: Ground Control HUD" },
  ],
};

export default function TerminalOverlay() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<TerminalLine[]>([...BOOT_SEQUENCE]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Toggle on backtick key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "`") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const executeCommand = useCallback(
    (cmd: string) => {
      const trimmed = cmd.trim().toLowerCase();
      const newLines: TerminalLine[] = [
        ...lines,
        { type: "input", text: `operator@gcs:~$ ${cmd}` },
      ];

      if (trimmed === "clear") {
        setLines([...BOOT_SEQUENCE]);
        return;
      }
      if (trimmed === "exit") {
        setOpen(false);
        return;
      }

      const handler = COMMANDS[trimmed];
      if (handler) {
        newLines.push(...handler());

        // Special: contact command navigates after delay
        if (trimmed === "contact") {
          setTimeout(() => {
            window.location.href = "/contact";
          }, 3000);
        }
      } else if (trimmed === "") {
        // Empty command, just show prompt
      } else {
        newLines.push({
          type: "error",
          text: `Command not found: '${trimmed}'. Type 'help' for available commands.`,
        });
      }

      setLines(newLines);
      setHistory((prev) => [cmd, ...prev]);
      setHistIdx(-1);
    },
    [lines]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      executeCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (histIdx < history.length - 1) {
        const idx = histIdx + 1;
        setHistIdx(idx);
        setInput(history[idx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx > 0) {
        const idx = histIdx - 1;
        setHistIdx(idx);
        setInput(history[idx]);
      } else {
        setHistIdx(-1);
        setInput("");
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const getLineColor = (type: TerminalLine["type"]) => {
    switch (type) {
      case "input": return "text-accent-orange";
      case "error": return "text-accent-red";
      case "system": return "text-accent-green";
      default: return "text-text-secondary";
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-x-0 top-0 z-[9998] flex justify-center pt-16 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-3xl bg-[#0a0a0a]/95 backdrop-blur-md border border-accent-green/30 rounded-lg shadow-2xl shadow-accent-green/5 overflow-hidden">
            {/* Title bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#111]/80 border-b border-accent-green/20">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent-green pulse-green" />
                <span className="font-mono text-[11px] tracking-widest text-accent-green">
                  GCS TERMINAL
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-text-secondary">
                  Press ` or ESC to close
                </span>
                <button
                  onClick={() => setOpen(false)}
                  className="text-text-secondary hover:text-accent-red transition-colors font-mono text-sm"
                  aria-label="Close terminal"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Terminal body */}
            <div
              ref={scrollRef}
              className="p-4 h-[50vh] max-h-[400px] overflow-y-auto font-mono text-sm leading-relaxed"
            >
              {lines.map((line, i) => (
                <div key={i} className={getLineColor(line.type)}>
                  {line.text || "\u00A0"}
                </div>
              ))}
              {/* Input line */}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-accent-orange shrink-0">operator@gcs:~$</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent outline-none text-foreground caret-accent-green font-mono text-sm"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Terminal input"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
