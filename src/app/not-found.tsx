import Link from "next/link";
import VideoBackground from "@/components/VideoBackground";

export const metadata = {
  title: "404 — Signal Lost",
  description:
    "The requested page was not found. Navigate back to AJ Builds Drone for custom UAV builds, aerial cinematography, and drone engineering services in Austin TX.",
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center grid-bg relative">
      <VideoBackground mp4="/videos/drone-loop.mp4" webm="/videos/drone-loop.webm" poster="/videos/posters/drone-loop.jpg" opacity={0.12} />
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
      <div className="relative z-10 text-center px-4">
        {/* Error Code */}
        <div className="font-mono text-[10px] tracking-[0.3em] text-accent-red mb-6">
          ▸ ERROR // SIGNAL_LOST
        </div>

        <h1 className="font-mono text-6xl sm:text-8xl font-bold text-accent-orange mb-4 tracking-wider">
          404
        </h1>

        <div className="max-w-md mx-auto mb-2">
          <div className="font-mono text-lg font-bold tracking-wider mb-3">
            WAYPOINT NOT FOUND
          </div>
          <p className="text-text-secondary text-sm leading-relaxed">
            The requested flight path doesn&apos;t exist in the navigation database.
            The drone has initiated return-to-home protocol.
          </p>
        </div>

        {/* Telemetry Box */}
        <div className="inline-block bg-surface border border-border-dim rounded-lg px-6 py-4 my-8 font-mono text-xs text-text-secondary">
          <div className="flex items-center gap-4">
            <span>STATUS: <span className="text-accent-red">LOST LINK</span></span>
            <span className="text-border-bright">|</span>
            <span>MODE: <span className="text-accent-orange">RTH</span></span>
            <span className="text-border-bright">|</span>
            <span>GPS: <span className="text-accent-green">LOCKED</span></span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="btn-glitch inline-flex items-center gap-2 px-8 py-3 bg-accent-orange text-black font-mono text-sm tracking-widest font-bold rounded hover:bg-accent-orange/90 transition-colors"
          >
            ▶ RETURN TO BASE
          </Link>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-8 py-3 border border-border-dim text-text-secondary font-mono text-sm tracking-widest rounded hover:border-accent-orange hover:text-accent-orange transition-colors"
          >
            ◈ VIEW HANGAR
          </Link>
        </div>
      </div>
    </div>
  );
}
