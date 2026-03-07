"use client";

import { useState, useEffect, useCallback } from "react";

type Theme = "night" | "day";

const DAY_VARS: Record<string, string> = {
  "--bg-base": "#F5F3EF",
  "--bg-surface": "#FFFFFF",
  "--bg-elevated": "#EDEAE4",
  "--border-dim": "#D5D0C8",
  "--border-bright": "#8A8578",
  "--text-primary": "#1A1A1A",
  "--text-secondary": "#5A5650",
  "--accent-orange": "#D94F00",
  "--accent-green": "#008A22",
  "--accent-green-dim": "#006A1A",
  "--accent-red": "#CC2222",
  "--accent-cyan": "#007AAD",
  "--scanline-opacity": "0.015",
};

const NIGHT_VARS: Record<string, string> = {
  "--bg-base": "#0A0A0A",
  "--bg-surface": "#111111",
  "--bg-elevated": "#1A1A1A",
  "--border-dim": "#222222",
  "--border-bright": "#7B7B7B",
  "--text-primary": "#F0F0F0",
  "--text-secondary": "#B0B0B0",
  "--accent-orange": "#FF5F1F",
  "--accent-green": "#00FF41",
  "--accent-green-dim": "#00CC34",
  "--accent-red": "#FF3333",
  "--accent-cyan": "#00D4FF",
  "--scanline-opacity": "0.03",
};

function applyTheme(theme: Theme) {
  const vars = theme === "day" ? DAY_VARS : NIGHT_VARS;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  root.classList.toggle("dark", theme === "night");
  root.classList.toggle("light", theme === "day");
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("night");

  useEffect(() => {
    const stored = localStorage.getItem("aj-theme") as Theme | null;
    if (stored === "day" || stored === "night") {
      setTheme(stored);
      applyTheme(stored);
    }
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = theme === "night" ? "day" : "night";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem("aj-theme", next);
  }, [theme]);

  const isDay = theme === "day";

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-text-secondary hover:text-accent-orange transition-colors"
      aria-label={`Switch to ${isDay ? "night" : "day"} flight mode`}
      title={isDay ? "NIGHT FLIGHT" : "DAY FLIGHT"}
    >
      <span className="relative w-8 h-4 rounded-full border border-border-dim bg-elevated transition-colors">
        <span
          className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300 ${
            isDay
              ? "left-[calc(100%-14px)] bg-accent-orange"
              : "left-0.5 bg-accent-green"
          }`}
        />
      </span>
      <span className="hidden sm:inline">{isDay ? "DAY" : "NIT"}</span>
    </button>
  );
}
