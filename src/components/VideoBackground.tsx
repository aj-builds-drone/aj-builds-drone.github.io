"use client";

/* ── Reusable Video Background ──
   Drop-in video background component for any section.
   Automatically hides if no video source is available.
   Uses poster image as fallback. */

interface VideoBackgroundProps {
  webm?: string;
  mp4?: string;
  poster?: string;
  opacity?: number;
  className?: string;
  preload?: "none" | "metadata" | "auto";
}

export default function VideoBackground({
  webm,
  mp4,
  poster,
  opacity = 0.15,
  className = "",
  preload = "none",
}: VideoBackgroundProps) {
  if (!webm && !mp4) return null;

  return (
    <video
      autoPlay
      muted
      loop
      playsInline
      preload={preload}
      aria-hidden="true"
      className={`absolute inset-0 w-full h-full object-cover z-0 ${className}`}
      style={{ opacity }}
      poster={poster}
    >
      {webm && <source src={webm} type="video/webm" />}
      {mp4 && <source src={mp4} type="video/mp4" />}
    </video>
  );
}
