"use client";

import { useRef, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 500;
const SPREAD = 15;

function Particles() {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const mouse = useRef(new THREE.Vector2(0, 0));
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Pre-compute initial positions and velocities
  const particles = useMemo(() => {
    const data = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      data.push({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * SPREAD,
          (Math.random() - 0.5) * SPREAD,
          (Math.random() - 0.5) * SPREAD * 0.5
        ),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.003,
          (Math.random() - 0.5) * 0.003,
          (Math.random() - 0.5) * 0.001
        ),
        scale: Math.random() * 0.5 + 0.2,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return data;
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [handlePointerMove]);

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particles[i];

      // Drift
      p.position.add(p.velocity);

      // Gentle sine wave
      p.position.y += Math.sin(time * 0.3 + p.phase) * 0.0005;

      // Mouse repulsion
      const dx = p.position.x - mouse.current.x * 5;
      const dy = p.position.y - mouse.current.y * 5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 3) {
        const force = (3 - dist) * 0.0008;
        p.position.x += (dx / dist) * force;
        p.position.y += (dy / dist) * force;
      }

      // Wrap around boundaries
      if (p.position.x > SPREAD / 2) p.position.x = -SPREAD / 2;
      if (p.position.x < -SPREAD / 2) p.position.x = SPREAD / 2;
      if (p.position.y > SPREAD / 2) p.position.y = -SPREAD / 2;
      if (p.position.y < -SPREAD / 2) p.position.y = SPREAD / 2;

      dummy.position.copy(p.position);
      dummy.scale.setScalar(p.scale * (0.8 + Math.sin(time + p.phase) * 0.2));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
      <circleGeometry args={[0.02, 6]} />
      <meshBasicMaterial
        color="#00FF41"
        transparent
        opacity={0.15}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}

/* ── Connection lines between nearby particles ── */
function ConnectionLines() {
  const lineRef = useRef<THREE.LineSegments>(null!);
  const positionsRef = useRef(new Float32Array(PARTICLE_COUNT * 3));
  const lineGeom = useMemo(() => {
    const maxLines = 800;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(maxLines * 6), 3));
    geom.setDrawRange(0, 0);
    return geom;
  }, []);

  useFrame((state) => {
    if (!lineRef.current) return;

    // Read instanced mesh positions from sibling
    const parent = lineRef.current.parent;
    if (!parent) return;
    const mesh = parent.children.find((c) => c instanceof THREE.InstancedMesh) as THREE.InstancedMesh | undefined;
    if (!mesh) return;

    const tempMatrix = new THREE.Matrix4();
    const tempPos = new THREE.Vector3();
    const positions: THREE.Vector3[] = [];

    for (let i = 0; i < Math.min(PARTICLE_COUNT, 200); i++) {
      mesh.getMatrixAt(i, tempMatrix);
      tempPos.setFromMatrixPosition(tempMatrix);
      positions.push(tempPos.clone());
    }

    const attr = lineGeom.getAttribute("position") as THREE.BufferAttribute;
    let lineCount = 0;
    const maxDist = 1.5;

    for (let i = 0; i < positions.length && lineCount < 800; i++) {
      for (let j = i + 1; j < positions.length && lineCount < 800; j++) {
        const d = positions[i].distanceTo(positions[j]);
        if (d < maxDist) {
          const idx = lineCount * 6;
          attr.array[idx] = positions[i].x;
          attr.array[idx + 1] = positions[i].y;
          attr.array[idx + 2] = positions[i].z;
          attr.array[idx + 3] = positions[j].x;
          attr.array[idx + 4] = positions[j].y;
          attr.array[idx + 5] = positions[j].z;
          lineCount++;
        }
      }
    }

    lineGeom.setDrawRange(0, lineCount * 2);
    attr.needsUpdate = true;
  });

  return (
    <lineSegments ref={lineRef} geometry={lineGeom}>
      <lineBasicMaterial
        color="#00FF41"
        transparent
        opacity={0.04}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

export default function ParticleField() {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    >
      <Canvas
        dpr={1}
        camera={{ position: [0, 0, 8], fov: 50 }}
        gl={{ antialias: false, alpha: true }}
        style={{ background: "transparent" }}
        frameloop="always"
      >
        <Particles />
        <ConnectionLines />
      </Canvas>
    </div>
  );
}
