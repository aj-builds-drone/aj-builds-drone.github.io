"use client";

/* ── Parallax Scroll Drone ──
   A drone silhouette SVG that tracks scroll position,
   rising and descending as the user scrolls through the page.
   Uses requestAnimationFrame for smooth 60fps updates. */

import { useRef, useEffect, useState } from "react";

export default function ParallaxDrone() {
  const [scrollY, setScrollY] = useState(0);
  const [docHeight, setDocHeight] = useState(1);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let ticking = false;

    function updateScroll() {
      setScrollY(window.scrollY);
      setDocHeight(document.documentElement.scrollHeight - window.innerHeight);
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        rafRef.current = requestAnimationFrame(updateScroll);
        ticking = true;
      }
    }

    // Initial
    updateScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const progress = docHeight > 0 ? scrollY / docHeight : 0;
  // Drone moves from top-right area down as you scroll
  const yPos = 10 + progress * 75; // 10vh to 85vh
  const tilt = Math.sin(progress * Math.PI * 4) * 8; // Gentle banking
  const bob = Math.sin(Date.now() / 800) * 2;

  return (
    <div
      className="fixed right-4 md:right-8 z-[1] pointer-events-none opacity-[0.07] hidden lg:block"
      style={{
        top: `${yPos}vh`,
        transform: `rotate(${tilt}deg) translateY(${bob}px)`,
        transition: "top 0.3s ease-out",
      }}
      aria-hidden="true"
    >
      {/* Minimal drone silhouette SVG */}
      <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Arms */}
        <line x1="20" y1="20" x2="80" y2="80" stroke="#00FF41" strokeWidth="3" />
        <line x1="80" y1="20" x2="20" y2="80" stroke="#00FF41" strokeWidth="3" />
        {/* Center body */}
        <rect x="38" y="38" width="24" height="24" rx="4" fill="#00FF41" />
        {/* Rotor circles */}
        <circle cx="20" cy="20" r="12" stroke="#00FF41" strokeWidth="1.5" fill="none" />
        <circle cx="80" cy="20" r="12" stroke="#00FF41" strokeWidth="1.5" fill="none" />
        <circle cx="20" cy="80" r="12" stroke="#00FF41" strokeWidth="1.5" fill="none" />
        <circle cx="80" cy="80" r="12" stroke="#00FF41" strokeWidth="1.5" fill="none" />
        {/* Center dot */}
        <circle cx="50" cy="50" r="4" fill="#FF5F1F" />
      </svg>
    </div>
  );
}
