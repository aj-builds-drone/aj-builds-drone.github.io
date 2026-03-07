"use client";

import dynamic from "next/dynamic";

const TerminalOverlay = dynamic(
  () => import("@/components/Terminal/TerminalOverlay"),
  { ssr: false }
);
const ParticleField = dynamic(
  () => import("@/components/Particles/ParticleField"),
  { ssr: false }
);
const ParallaxDrone = dynamic(
  () => import("@/components/ParallaxDrone"),
  { ssr: false }
);

export default function ClientOverlays() {
  return (
    <>
      <ParticleField />
      <ParallaxDrone />
      <TerminalOverlay />
    </>
  );
}
