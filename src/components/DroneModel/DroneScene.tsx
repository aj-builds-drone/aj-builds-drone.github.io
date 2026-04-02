"use client";

import { Suspense, useRef, useCallback, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Environment } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import ProceduralDrone from "./ProceduralDrone";

/* ── Mouse-follow rig: tilts the drone toward the cursor ── */
function MouseTracker({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null!);
  const mouse = useRef({ x: 0, y: 0 });
  const { size } = useThree();

  const handlePointerMove = useCallback(
    (e: { clientX: number; clientY: number }) => {
      mouse.current.x = (e.clientX / size.width) * 2 - 1;
      mouse.current.y = -(e.clientY / size.height) * 2 + 1;
    },
    [size]
  );

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [handlePointerMove]);

  useFrame(() => {
    if (!groupRef.current) return;
    // Lerp rotation toward mouse position
    const targetRotX = mouse.current.y * 0.15;
    const targetRotY = mouse.current.x * 0.25;
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.05);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.05);
  });

  return <group ref={groupRef}>{children}</group>;
}

/* ── Loading fallback shown in the canvas ── */
function LoadingFallback() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, delta) => {
    ref.current.rotation.y += delta * 2;
  });
  return (
    <mesh ref={ref}>
      <octahedronGeometry args={[0.15, 0]} />
      <meshStandardMaterial color="#FF5F1F" wireframe />
    </mesh>
  );
}

/* ── Main scene exported as dynamic (no SSR) ── */
export default function DroneScene() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* ── Mobile: lightweight SVG drone instead of full WebGL ── */
  if (isMobile) {
    return (
      <div
        className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 200 200"
          className="w-48 h-48 opacity-20 animate-float-gentle"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Center body */}
          <rect x="85" y="90" width="30" height="20" rx="4" fill="#333" stroke="#555" strokeWidth="1" />
          {/* Arms */}
          <line x1="100" y1="95" x2="45" y2="50" stroke="#444" strokeWidth="3" strokeLinecap="round" />
          <line x1="100" y1="95" x2="155" y2="50" stroke="#444" strokeWidth="3" strokeLinecap="round" />
          <line x1="100" y1="105" x2="45" y2="150" stroke="#444" strokeWidth="3" strokeLinecap="round" />
          <line x1="100" y1="105" x2="155" y2="150" stroke="#444" strokeWidth="3" strokeLinecap="round" />
          {/* Motor pods */}
          <circle cx="45" cy="50" r="8" fill="#222" stroke="#555" strokeWidth="1" />
          <circle cx="155" cy="50" r="8" fill="#222" stroke="#555" strokeWidth="1" />
          <circle cx="45" cy="150" r="8" fill="#222" stroke="#555" strokeWidth="1" />
          <circle cx="155" cy="150" r="8" fill="#222" stroke="#555" strokeWidth="1" />
          {/* Spinning rotors */}
          <ellipse cx="45" cy="50" rx="18" ry="4" fill="#FF5F1F" opacity="0.3">
            <animateTransform attributeName="transform" type="rotate" from="0 45 50" to="360 45 50" dur="0.8s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="155" cy="50" rx="18" ry="4" fill="#00FF41" opacity="0.3">
            <animateTransform attributeName="transform" type="rotate" from="360 155 50" to="0 155 50" dur="0.8s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="45" cy="150" rx="18" ry="4" fill="#00FF41" opacity="0.3">
            <animateTransform attributeName="transform" type="rotate" from="360 45 150" to="0 45 150" dur="0.8s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="155" cy="150" rx="18" ry="4" fill="#FF5F1F" opacity="0.3">
            <animateTransform attributeName="transform" type="rotate" from="0 155 150" to="360 155 150" dur="0.8s" repeatCount="indefinite" />
          </ellipse>
          {/* LEDs */}
          <circle cx="45" cy="50" r="2" fill="#FF3333" opacity="0.8">
            <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1s" repeatCount="indefinite" />
          </circle>
          <circle cx="155" cy="50" r="2" fill="#00FF41" opacity="0.8">
            <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1s" repeatCount="indefinite" />
          </circle>
          {/* Camera */}
          <circle cx="100" cy="115" r="3" fill="#00D4FF" opacity="0.6" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 z-0"
      aria-hidden="true"
      style={{ pointerEvents: "none" }}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.3, 1.8], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent", pointerEvents: "none" }}
      >
        <Suspense fallback={<LoadingFallback />}>
          {/* Lighting */}
          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 5, 5]} intensity={1} color="#ffffff" />
          <directionalLight position={[-3, 2, -4]} intensity={0.4} color="#00D4FF" />
          <pointLight position={[0, -1, 0]} intensity={0.3} color="#FF5F1F" />

          {/* Environment for reflections */}
          <Environment preset="night" />

          {/* Drone with float + mouse tracking */}
          <MouseTracker>
            <Float
              speed={2}
              rotationIntensity={0.1}
              floatIntensity={0.3}
              floatingRange={[-0.02, 0.02]}
            >
              <ProceduralDrone />
            </Float>
          </MouseTracker>

          {/* Post-processing: bloom on emissive LEDs */}
          <EffectComposer>
            <Bloom
              luminanceThreshold={0.8}
              luminanceSmoothing={0.3}
              intensity={0.8}
              mipmapBlur
            />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
