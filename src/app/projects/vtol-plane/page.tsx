import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SectionHeader, StatBox } from "@/components/HUDElements";

const MEDIA = "/projects/vtol-plane";
const PAGE_URL = "https://aj-builds-drone.github.io/projects/vtol-plane/";
const SUMMARY =
  "A 3D-printed tilt-rotor tricopter VTOL: every part generated in Python, sliced from the command line, checked by a 123-check verification gate and flown in PX4 + Gazebo simulation.";

export const metadata: Metadata = {
  title: "Tilt-Rotor VTOL Plane — 3D-Printed, Designed in Python",
  description: `${SUMMARY} 1478 mm span, ~2 kg, PX4 on a Pixhawk 6C.`,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Tilt-Rotor VTOL Plane | AJ Builds Drone",
    description: SUMMARY,
    url: PAGE_URL,
    siteName: "AJ Builds Drone",
    type: "article",
    images: [{ url: `${MEDIA}/og.jpg`, width: 1200, height: 630, alt: "The 3D-printed tilt-rotor VTOL plane, motors up for hover" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tilt-Rotor VTOL Plane | AJ Builds Drone",
    description: SUMMARY,
    images: [`${MEDIA}/og.jpg`],
  },
};

const STATS = [
  { label: "Span", value: "1478", unit: "mm" },
  { label: "All-up weight", value: "~2.0", unit: "kg" },
  { label: "Cruise (est.)", value: "~18", unit: "m/s" },
  { label: "Hover (est.)", value: "~7", unit: "min" },
  { label: "Autopilot", value: "PX4", unit: "Pixhawk 6C" },
  { label: "Gate checks", value: "123", unit: "passing" },
];

const MOVES = [
  { name: "transition", title: "Hover → cruise", text: "The yokes swing the front motors from straight up to straight ahead." },
  { name: "burst", title: "Burst view", text: "Every part moves out along the way it goes together, electronics included." },
  { name: "battery", title: "Battery change", text: "One nylon screw holds the nose; the pack slides out through the coupler ring." },
  { name: "service", title: "Servicing", text: "Every control servo sits on a screwed hatch, and the yokes lift off their pods." },
];

const SIM_RESULTS = [
  { item: "Hover", result: "Front motors at 47 % of full thrust, rear at 34 %: what the mass balance predicted" },
  { item: "Front transition", result: "8.5 s, past 14 m/s at 7.6 s" },
  { item: "Cruise", result: "18.2 m/s on 10 % of full thrust" },
  { item: "Control", result: "Roll 1.9°, pitch 1.8° RMS in fixed-wing flight, turns included" },
  { item: "Back transition", result: "6.6 s from 18 m/s to a hover" },
  { item: "Landing", result: "0.0 m from home, on the pad" },
];

const PIPELINE = [
  { step: "params.py", text: "One parameter file holds every dimension." },
  { step: "Skins + structure", text: "LW-PLA vase-mode skins and PETG parts, generated in Python with build123d." },
  { step: "Print-ready", text: "Each part oriented on its printer's bed; the PETG laid out as seven plates." },
  { step: "Slicing", text: "The slicer's command line writes the G-code and a 3MF project per printer." },
  { step: "Mass balance", text: "Masses read back from the G-code: CG, static margin, hover thrust, PX4 settings." },
  { step: "Simulation model", text: "The Gazebo model and PX4 airframe are generated from the same design." },
  { step: "Verification gate", text: "123 checks run on every push before any filament is used." },
];

const GATE = [
  ["Fits", "every spigot, coupler, frame, ring and servo hatch, with its glue gap"],
  ["Finish", "every glued skin joint flush to 0.15 mm, no creases"],
  ["Paths", "spars, joiners, the tail boom and every wire route clear"],
  ["Mechanism", "the tilt sweep, prop clearances, motor screws with hex-key room"],
  ["Balance", "CG band, static margin, front motors at most 60 % of their thrust in hover"],
  ["Printability", "no part needs supports; every G-code file checked move by move"],
  ["Servicing", "the battery slides out through the nose; every servo comes out through its hatch"],
  ["Simulation", "the Gazebo model and PX4 airframe match the current design"],
];

const NEXT_STEPS = [
  "Test prints: LW-PLA flow, the spigot and servo-hatch fits, the closing wing tips and the wing webs.",
  "Thrust-test one SunnySky X2814 900KV for the 3S build: on 12 in props the front motors would hover at about half their thrust instead of ~59 %, for about 18 min of hover (modelled).",
  "Weigh the real parts, re-run the mass balance and balance at the design CG, then glide-test.",
  "Bench tests with the props off, the first hover, then transitions at altitude.",
];

const HARDWARE = [
  "Pixhawk 6C running PX4 (Generic Tiltrotor VTOL)",
  "3 × Emax ECOII 2807 1700KV, 7 × 4.5 props (3S plan: SunnySky X2814 900KV, 12 in)",
  "3 × 50 A DShot ESCs, 4S 5000 mAh LiPo",
  "2 direct-drive tilt servos, 4 aileron + 2 ruddervator servos",
  "M10 GPS + compass, digital airspeed sensor with pitot, ELRS receiver",
  "LW-PLA skins, PETG structure, carbon spars and 16 mm tail boom",
];

const STACK = ["Python", "build123d", "NumPy", "SciPy", "Anycubic Slicer Next", "PX4", "Gazebo Harmonic", "three.js", "GitHub Actions"];

function Animation({ name, alt, eager = false }: { name: string; alt: string; eager?: boolean }) {
  return (
    <picture>
      <source media="(prefers-reduced-motion: reduce)" srcSet={`${MEDIA}/${name}_still.webp`} />
      <img
        src={`${MEDIA}/${name}.webp`}
        alt={alt}
        width={800}
        height={500}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="block w-full h-auto"
      />
    </picture>
  );
}

function Figure({ children, caption }: { children: ReactNode; caption: ReactNode }) {
  return (
    <figure className="osd-card rounded-lg overflow-hidden">
      {children}
      <figcaption className="px-4 py-3 border-t border-border-dim text-sm text-text-secondary leading-relaxed">
        {caption}
      </figcaption>
    </figure>
  );
}

export default function VtolPlanePage() {
  return (
    <div className="pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/projects/"
          className="inline-block mb-8 font-mono text-xs tracking-widest text-text-secondary hover:text-accent-orange transition-colors"
        >
          ← THE HANGAR
        </Link>

        <SectionHeader
          code="VTL"
          title="TILT-ROTOR VTOL PLANE"
          as="h1"
          subtitle="A 3D-printed tilt-rotor tricopter: it takes off like a drone and flies like a plane. Every part is generated in Python, sliced from the command line and checked by an automated gate, and the whole mission is flown in PX4 simulation before the first print."
        />

        {/* Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
          <div className="lg:col-span-3 osd-card rounded-lg overflow-hidden hud-corners">
            <Animation name="turntable" alt="The VTOL plane turning on a turntable: a tilt-rotor tricopter with a V-tail, motors up for hover" eager />
          </div>
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono tracking-wider border bg-accent-orange/10 text-accent-orange border-accent-orange/30">
                <span className="w-1 h-1 rounded-full bg-current pulse-green" />
                IN DEVELOPMENT
              </span>
              <span className="font-mono text-[11px] tracking-wider text-text-secondary">
                v0.2 · flown in simulation · test prints next
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {STATS.map((s) => (
                <StatBox key={s.label} label={s.label} value={s.value} unit={s.unit} />
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-3xl space-y-4 text-text-secondary leading-relaxed mb-24">
          <p>
            Two motors on tilting yokes lift the aircraft in hover and swing forward for cruise; a third,
            fixed motor at the tail shares the hover load. In forward flight a Clark Y wing and a V-tail
            carry it, under PX4 on a Pixhawk 6C. Yaw in hover comes from tilting the front motors
            differentially.
          </p>
          <p>
            The airframe is a single-wall LW-PLA shell printed in vase mode, over PETG ribs and frames,
            carbon spars and a carbon tail boom. Nothing that may need replacing is glued in: the battery,
            servos, motors and boards all come out without cutting a joint.
          </p>
        </div>

        {/* Animations */}
        <section className="mb-24">
          <SectionHeader code="MOV" title="SEE IT MOVE" subtitle="Rendered from the same model the print files come from." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {MOVES.map((m) => (
              <Figure
                key={m.name}
                caption={
                  <>
                    <span className="font-mono text-xs tracking-wider text-accent-orange">{m.title.toUpperCase()}.</span>{" "}
                    {m.text}
                  </>
                }
              >
                <Animation name={m.name} alt={`${m.title}: ${m.text}`} />
              </Figure>
            ))}
          </div>
        </section>

        {/* Simulation */}
        <section className="mb-24">
          <SectionHeader
            code="SIM"
            title="FLOWN IN SIMULATION"
            subtitle="PX4 v1.17 software-in-the-loop with Gazebo Harmonic, on a model generated from the design and this airframe's own PX4 settings."
          />
          <Figure
            caption="The check flight (3 min 42 s, chase camera): vertical takeoff to 30 m, the front transition, a 950 × 400 m circuit at 40 m with four 50° banked turns, the back transition on a 450 m final and a vertical landing on the pad."
          >
            <video controls preload="none" playsInline poster={`${MEDIA}/sim_poster.webp`} className="block w-full h-auto bg-black">
              <source src={`${MEDIA}/sim_flight.mp4`} type="video/mp4" />
            </video>
          </Figure>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="space-y-6">
              <div className="border border-border-dim rounded-lg bg-surface p-5">
                <h3 className="font-mono text-xs tracking-widest text-accent-orange mb-3">{"// RESULTS"}</h3>
                <dl className="divide-y divide-border-dim">
                  {SIM_RESULTS.map((r) => (
                    <div key={r.item} className="grid grid-cols-3 gap-3 py-2 text-sm">
                      <dt className="font-mono text-xs tracking-wider text-text-secondary uppercase pt-0.5">{r.item}</dt>
                      <dd className="col-span-2 text-foreground">{r.result}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="text-text-secondary text-sm leading-relaxed space-y-3">
                <p>
                  <span className="text-foreground font-semibold">What it changed.</span> Held level through
                  the transition, the aircraft levelled off at 15.2 m/s and never reached the planned 18 m/s,
                  so PX4 gave up and flew home in hover. The transition now ends at 14 m/s and is flown
                  2° nose-down.
                </p>
                <p>
                  <span className="text-foreground font-semibold">Stress tests.</span> Versions 10 and 20 %
                  heavier on a near-empty pack, without the airspeed sensor, and with a wing that lifts more
                  than modelled all complete the mission, but the hover headroom shrinks from 46 % to 19 %.
                  So the planned 3S build&apos;s bigger motors go in before the first flight.
                </p>
              </div>
            </div>
            <Figure caption="What PX4 logged on the check flight: altitude, airspeed, motor and tilt commands, attitude.">
              <Image
                src={`${MEDIA}/sim_log.webp`}
                alt="PX4 flight log plots from the simulated check flight"
                width={1210}
                height={1210}
                className="block w-full h-auto bg-white"
              />
            </Figure>
          </div>
        </section>

        {/* Design as code */}
        <section className="mb-24">
          <SectionHeader
            code="CAD"
            title="DESIGNED AS CODE"
            subtitle="Change one number and a single command rebuilds every part, re-slices every print, regenerates the simulation model and re-runs the checks."
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ol className="space-y-3">
              {PIPELINE.map((p, i) => (
                <li key={p.step} className="flex gap-4 border border-border-dim rounded-lg bg-surface px-4 py-3">
                  <span className="font-mono text-xs text-accent-green pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <span className="block font-mono text-sm tracking-wider text-foreground">{p.step}</span>
                    <span className="block text-sm text-text-secondary">{p.text}</span>
                  </div>
                </li>
              ))}
            </ol>
            <div className="border border-border-dim rounded-lg bg-surface p-5 hud-corners">
              <h3 className="font-mono text-xs tracking-widest text-accent-orange mb-3">{"// WHAT THE GATE CHECKS"}</h3>
              <ul className="space-y-2">
                {GATE.map(([name, text]) => (
                  <li key={name} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="text-border-bright font-mono shrink-0">├─</span>
                    <span>
                      <span className="text-foreground font-semibold">{name}:</span> {text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Inside */}
        <section className="mb-24">
          <SectionHeader code="INS" title="INSIDE THE AIRFRAME" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Figure caption="Structure: PETG rings, ribs and frames, carbon wing spars on joiners through the fuselage, and the 16 mm tail boom.">
              <Image src={`${MEDIA}/xray_structure.webp`} alt="X-ray view of the airframe structure" width={1600} height={1000} className="block w-full h-auto" />
            </Figure>
            <Figure caption="Electronics bay: battery, flight controller, ESC block and cable runs, each checked to fit clear of the skin.">
              <Image src={`${MEDIA}/xray_equipment.webp`} alt="X-ray view of the electronics and cables inside the fuselage" width={1600} height={1000} className="block w-full h-auto" />
            </Figure>
            <Figure caption="Wing root cut: spanwise webs printed as part of the single vase wall stiffen the 0.5 mm skin.">
              <Image src={`${MEDIA}/wing_webs.webp`} alt="Cut through the wing root showing the internal webs and spars" width={1600} height={1000} className="block w-full h-auto" />
            </Figure>
          </div>
        </section>

        {/* Printing */}
        <section className="mb-24">
          <SectionHeader
            code="PRT"
            title="PRINT-READY"
            subtitle="One material per printer: a Kobra X prints every LW-PLA skin (about 49 h, one spool) and a Kobra S1 the PETG as seven plates (about 16 h). No part needs supports."
          />
          <Figure caption="The PETG plates as sliced, drawn from the G-code: walls, infill, bridges and brims.">
            <Image src={`${MEDIA}/sliced_petg.webp`} alt="The seven PETG plates as the slicer prints them" width={1600} height={706} className="block w-full h-auto" />
          </Figure>
        </section>

        {/* Status */}
        <section className="mb-16">
          <SectionHeader code="NXT" title="STATUS + NEXT STEPS" subtitle="Designed, sliced, verified and flown in simulation. Not flown for real yet." />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ol className="space-y-3">
              {NEXT_STEPS.map((s, i) => (
                <li key={s} className="flex gap-4 text-sm text-text-secondary leading-relaxed">
                  <span className="font-mono text-xs text-accent-green pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <div className="space-y-6">
              <div>
                <h3 className="font-mono text-xs tracking-widest text-accent-orange mb-2">{"// HARDWARE"}</h3>
                <ul className="space-y-1">
                  {HARDWARE.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-xs text-text-secondary font-mono">
                      <span className="text-border-bright mt-0.5 shrink-0">├─</span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-mono text-xs tracking-widest text-accent-orange mb-2">{"// SOFTWARE STACK"}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {STACK.map((t) => (
                    <span key={t} className="px-2 py-0.5 bg-accent-green/5 border border-accent-green/20 rounded text-[11px] font-mono text-accent-green tracking-wider">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="mt-16 border-t border-border-dim pt-16 text-center">
          <p className="font-mono text-xs tracking-[0.3em] text-accent-green mb-4">▸ NEED AN AIRFRAME LIKE THIS?</p>
          <h2 className="font-mono text-xl md:text-2xl font-bold tracking-wider mb-4">LET&apos;S BUILD YOUR NEXT DRONE</h2>
          <p className="text-text-secondary text-sm max-w-lg mx-auto mb-8">
            Custom VTOL, fixed-wing and multirotor platforms, from parametric CAD and simulation through maiden flight.
          </p>
          <Link
            href="/contact"
            className="btn-glitch inline-flex items-center gap-2 px-10 py-4 bg-accent-orange text-black font-mono text-sm tracking-widest font-bold rounded hover:bg-accent-orange/90 transition-colors"
          >
            ▶ REQUEST FOR QUOTE
          </Link>
        </div>
      </div>
    </div>
  );
}
