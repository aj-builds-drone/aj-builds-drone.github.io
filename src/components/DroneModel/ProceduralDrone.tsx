"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ── Procedural quadcopter built entirely from Three.js primitives ──
   No external .glb needed — proves geometry + shader skills.
   Structure: center body, 4 arms, 4 motor pods, 4 spinning rotors,
   LED lights, landing gear, camera gimbal. */

function Rotor({ position, direction = 1 }: { position: [number, number, number]; direction?: number }) {
  const ref = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    ref.current.rotation.y += delta * 25 * direction;
  });

  return (
    <group position={position} ref={ref}>
      {/* Two-blade propeller */}
      {[0, Math.PI].map((rot, i) => (
        <mesh key={i} rotation={[0, rot, 0]}>
          <boxGeometry args={[0.6, 0.008, 0.06]} />
          <meshStandardMaterial
            color="#888888"
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {/* Center hub */}
      <mesh>
        <cylinderGeometry args={[0.03, 0.03, 0.03, 8]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

function MotorPod({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Motor bell */}
      <mesh>
        <cylinderGeometry args={[0.06, 0.05, 0.06, 12]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Motor base ring */}
      <mesh position={[0, -0.035, 0]}>
        <torusGeometry args={[0.055, 0.008, 8, 16]} />
        <meshStandardMaterial color="#FF5F1F" metalness={0.6} roughness={0.4} emissive="#FF5F1F" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function Arm({ rotation, length = 0.55 }: { rotation: number; length?: number }) {
  const x = Math.cos(rotation) * length * 0.5;
  const z = Math.sin(rotation) * length * 0.5;
  return (
    <mesh position={[x, 0, z]} rotation={[0, -rotation, 0]}>
      <boxGeometry args={[length, 0.025, 0.04]} />
      <meshStandardMaterial color="#222222" metalness={0.7} roughness={0.3} />
    </mesh>
  );
}

function LED({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.015, 8, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2}
        toneMapped={false}
      />
    </mesh>
  );
}

function CameraGimbal() {
  return (
    <group position={[0, -0.1, 0.05]}>
      {/* Gimbal mount */}
      <mesh>
        <boxGeometry args={[0.06, 0.03, 0.06]} />
        <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Camera lens */}
      <mesh position={[0, -0.02, 0.025]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.015, 0.02, 12]} />
        <meshStandardMaterial color="#000000" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Lens glass */}
      <mesh position={[0, -0.02, 0.038]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.014, 12]} />
        <meshStandardMaterial color="#1a3a5a" metalness={0.3} roughness={0.1} emissive="#00D4FF" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

export default function ProceduralDrone() {
  const groupRef = useRef<THREE.Group>(null!);
  const timeRef = useRef(0);

  // Arm angles at 45° offsets (X-configuration)
  const armAngles = useMemo(() => [
    Math.PI / 4,
    (3 * Math.PI) / 4,
    (5 * Math.PI) / 4,
    (7 * Math.PI) / 4,
  ], []);

  const armLength = 0.55;

  useFrame((state, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    // Gentle hovering bob
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 1.5) * 0.04;
      // Subtle idle sway
      groupRef.current.rotation.x = Math.sin(t * 0.8) * 0.02;
      groupRef.current.rotation.z = Math.cos(t * 0.6) * 0.015;
    }
  });

  return (
    <group ref={groupRef}>
      {/* ── Center Body (top plate + bottom plate + standoffs) ── */}
      {/* Top plate */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.22, 0.015, 0.22]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Bottom plate */}
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[0.2, 0.012, 0.18]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Flight controller board (visible between plates) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.08, 0.008, 0.08]} />
        <meshStandardMaterial color="#0d3320" emissive="#00FF41" emissiveIntensity={0.15} />
      </mesh>
      {/* Battery (on top) */}
      <mesh position={[0, 0.045, 0]}>
        <boxGeometry args={[0.12, 0.03, 0.06]} />
        <meshStandardMaterial color="#333333" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Battery label stripe */}
      <mesh position={[0, 0.061, 0]}>
        <boxGeometry args={[0.1, 0.001, 0.04]} />
        <meshStandardMaterial color="#FF5F1F" emissive="#FF5F1F" emissiveIntensity={0.4} />
      </mesh>

      {/* ── Arms ── */}
      {armAngles.map((angle, i) => (
        <Arm key={`arm-${i}`} rotation={angle} length={armLength} />
      ))}

      {/* ── Motor Pods + Rotors ── */}
      {armAngles.map((angle, i) => {
        const x = Math.cos(angle) * armLength;
        const z = Math.sin(angle) * armLength;
        return (
          <group key={`motor-${i}`}>
            <MotorPod position={[x, 0.035, z]} />
            <Rotor position={[x, 0.07, z]} direction={i % 2 === 0 ? 1 : -1} />
          </group>
        );
      })}

      {/* ── LEDs (front green, rear red — aviation standard) ── */}
      <LED position={[armLength * Math.cos(armAngles[0]), -0.01, armLength * Math.sin(armAngles[0])]} color="#00FF41" />
      <LED position={[armLength * Math.cos(armAngles[1]), -0.01, armLength * Math.sin(armAngles[1])]} color="#00FF41" />
      <LED position={[armLength * Math.cos(armAngles[2]), -0.01, armLength * Math.sin(armAngles[2])]} color="#FF3333" />
      <LED position={[armLength * Math.cos(armAngles[3]), -0.01, armLength * Math.sin(armAngles[3])]} color="#FF3333" />

      {/* ── Landing Gear ── */}
      {[-0.08, 0.08].map((xOff) => (
        <group key={`leg-${xOff}`}>
          <mesh position={[xOff, -0.06, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.07, 6]} />
            <meshStandardMaterial color="#333333" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[xOff, -0.095, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.005, 0.005, 0.12, 6]} />
            <meshStandardMaterial color="#333333" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* ── Camera Gimbal ── */}
      <CameraGimbal />

      {/* ── GPS Mast ── */}
      <mesh position={[0, 0.08, -0.04]}>
        <cylinderGeometry args={[0.008, 0.008, 0.04, 6]} />
        <meshStandardMaterial color="#444444" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.105, -0.04]}>
        <cylinderGeometry args={[0.025, 0.025, 0.01, 12]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}
