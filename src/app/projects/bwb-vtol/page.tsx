import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SectionHeader, StatBox } from "@/components/HUDElements";

const MEDIA = "/projects/bwb-vtol";
const PAGE_URL = "https://aj-builds-drone.github.io/projects/bwb-vtol/";
const SUMMARY =
  "A 3D-printed blended-wing delivery drone with two props and nothing that tilts. It stands on its tail, climbs like a rocket, pitches over and flies as a flying wing, then hovers to drop a 250 g parcel. Designed in Python, checked by a 23-point gate and a premortem, flown through a full delivery in PX4 + Gazebo simulation, and sliced for two printers: printing next.";

export const metadata: Metadata = {
  title: "Blended-Wing Tailsitter: Takes Off Like a Rocket, Flies Like a Plane",
  description: `${SUMMARY} 900 mm span, 1.72 kg with the parcel, PX4.`,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Blended-Wing Tailsitter | AJ Builds Drone",
    description: SUMMARY,
    url: PAGE_URL,
    siteName: "AJ Builds Drone",
    type: "article",
    images: [{ url: `${MEDIA}/og.jpg`, width: 1200, height: 630, alt: "The blended-wing tailsitter: a flying wing with two props ahead of its leading edge" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blended-Wing Tailsitter | AJ Builds Drone",
    description: SUMMARY,
    images: [`${MEDIA}/og.jpg`],
  },
};

const STATS = [
  { label: "Span", value: "900", unit: "mm" },
  { label: "All-up weight", value: "1.72", unit: "kg" },
  { label: "Parcel", value: "250", unit: "g" },
  { label: "Cruise (est.)", value: "17", unit: "m/s" },
  { label: "Props", value: "2", unit: "nothing tilts" },
  { label: "Gate checks", value: "23", unit: "passing" },
];

const FLIGHT = [
  ["Stands on its tail", "four PETG feet on the fin tips, nose up, belly toward where it will fly"],
  ["Climbs like a rocket", "both props pull it straight up; PX4 steers the hover with differential thrust and the elevons in the slipstream"],
  ["Pitches over", "in 2.5 s it tips onto its belly and is flying on the wing at 12 m/s or more"],
  ["Flies like a plane", "a reflexed, swept flying wing at 17 m/s; the elevons pitch and roll it, the fins keep it straight"],
  ["Zooms up and hovers", "it slows on the wing, then pitches up holding 85 % thrust, climbing off its speed into the hover"],
  ["Drops the parcel", "the bay door lets go and the parcel slides down a 45° ramp and out of the belly"],
  ["Lands on its feet", "it zooms into the hover again near home and comes straight down, slowing to 0.4 m/s, back on its tail"],
];

const MOVES = [
  { name: "transition", title: "Rocket to plane", text: "Standing on its tail, it pitches over onto its belly and flies on the wing." },
  { name: "drop", title: "Hover delivery", text: "It lifts into the hover, the door swings open, and the parcel slides down the ramp to the ground." },
  { name: "burst", title: "Burst view", text: "44 printed parts, the carbon tubes and the equipment inside." },
  { name: "battery", title: "Battery change", text: "The nose cap comes off and the pack slides out through the nose ring." },
];

const SIM_RESULTS = [
  { item: "Take-off", result: "Straight up to 30 m on both props, the nose within a degree of vertical" },
  { item: "Pitch-over", result: "Onto the wing in 2.5 s" },
  { item: "Cruise", result: "17 m/s at 40 m on 47 % throttle, elevons 3.4° up, nose 7° above the horizon; banks to 49°" },
  { item: "Zoom into hover", result: "From 14 m/s to a slow, nose-up hover in 2.0–2.9 s, about 17 m higher" },
  { item: "Delivery", result: "Parcel released 0.0 m from the target, 8 m up; the hover thrust fell 13.2 % (the parcel is 14.5 % of the weight)" },
  { item: "Landing", result: "Touched down at 0.4 m/s, 0.1 m from home, standing on its tail" },
];

const PROCESS = [
  { step: "Premortem", text: "We assume the first build crashed and work back through every way it could have, with numbers from the design files. Every finding gets a fix and, where it can, a check in the gate." },
  { step: "Design gate", text: "23 automated checks on every change: fit, balance, thrust, hover control, loads and the PX4 setup. Nothing is printed until all of them pass." },
  { step: "Simulation", text: "The whole mission in PX4 and Gazebo, on a physics model generated from the design, on an end-of-flight pack and a full one. Problems show up as log plots, not as wreckage." },
  { step: "Measure, then fly", text: "Weighed parts, a thrust stand and a tethered hover replace the estimates before the first free flight." },
];

const AREAS = ["Pitch stability", "Thrust and battery", "Hover control", "Structure", "Servo torque", "Tipping over", "Compass and wiring", "Battery heat", "Flight software"];

const NUMBERS = [
  { item: "Static margin (worst case)", value: "8.1 % (4.2 %)" },
  { item: "Thrust reserve at 20 % charge", value: "1.64×" },
  { item: "Hover wind, face on / edge on", value: "4.7 / 13.4 m/s" },
  { item: "Back transition to a slow hover", value: "2.0–2.9 s" },
  { item: "Elevon servo torque margin", value: "2.3" },
  { item: "Tips over when standing past", value: "20°" },
  { item: "Compass to power wiring", value: "204 mm" },
];

const PIPELINE = [
  { step: "params.py", text: "One parameter file holds every dimension." },
  { step: "Vortex lattice", text: "Lift slope, neutral point, trim and stall, computed from the planform." },
  { step: "Parts", text: "44 watertight solids: LW-PLA vase skins, PETG structure and feet, and bores that stay open in the slicer." },
  { step: "Mass balance", text: "CG, static margin, hover thrust and PX4 airspeeds. The battery slides to the CG the wing needs; weighed parts replace the estimates." },
  { step: "Propulsion", text: "Blade-element props, DC motors and a Li-ion pack: the thrust the battery can really pay for." },
  { step: "Simulation model", text: "A Gazebo plugin with the same motors, full-envelope wing strips and slipstream, and both PX4 parameter sets, all from the same geometry and masses." },
  { step: "Gate", text: "23 checks run before any filament is used." },
  { step: "Slicing", text: "Three slicer projects for the two printers. Each part is sliced alone to choose its supports and brim, and every plate is audited down to its G-code." },
];

const GATE = [
  ["Printability", "every part fits its printer's bed, and no vase skin overhangs past 45°"],
  ["Fit", "no two parts or pieces of equipment overlap, and the carbon tubes run clear"],
  ["Standing", "nothing but the feet within 5 mm of the ground; it falls over only past 18°"],
  ["Balance", "static margin of 4–10 %, and at least 3 % with the props and mass-estimate errors"],
  ["Power", "1.6× the hover thrust at 20 % charge, a motor flat out inside its rating, a front transition that loses at most 5 m"],
  ["Hover control", "the elevons hold the hover face on to 4.5 m/s of wind, more than PX4's hover speed limit"],
  ["Loads", "joiners, spars, booms, fin rods and fin skins; servo torque in hand"],
  ["PX4", "every parameter the files set exists in PX4 v1.17 or the patch"],
  ["Simulation model", "every link's inertia is one Gazebo accepts"],
  ["Freshness", "the viewer and the simulation files match the current design"],
];

const NEXT_STEPS = [
  "Print, starting with the flow-test skin (LW-PLA 01), then a wing panel with its PETG pod rib and spigot bands, weighed against the estimate.",
  "Thrust-stand a motor with its prop on this pack, and put the measured throttles into the PX4 parameter file.",
  "Weigh every part into measured.json, rebuild, and balance the finished aircraft on the CG it gives. Bond the tubes, then a 3 g sandbag test and a drop test onto the feet.",
  "Build PX4 v1.17 with the patch, load the parameters, test every output with the props off, then a tethered hover.",
];

const PRINT_JOBS = [
  ["Kobra X · LW-PLA skins", "15 plates, one vase-mode skin each: 167 g, about 29½ hours"],
  ["Kobra X · LW-PLA fins", "one plate, both fins with two walls: 55 g, about 11 hours"],
  ["Kobra S1 · PETG", "6 plates, one per assembly group: 396 g with 88 g of support, about 18½ hours"],
  ["Audited", "supports only under the 17 parts that need them and none inside a carbon tube's bore, brims clear of the next part, and every plate re-sliced from its project and compared"],
];

const HARDWARE = [
  "Pixhawk 6C Mini running PX4 v1.17 (Duo Tailsitter) with a back-transition patch",
  "2 × 2814 900 KV on 11 × 6 props, ahead of the leading edge",
  "2 × 40 A ESCs in the nacelles, 6 V servo BEC, 4S1P Molicel P50B 21700 pack (72 Wh)",
  "2 metal-gear elevon servos (6 kg·cm), a bay-latch servo",
  "M10 GPS + compass, digital airspeed sensor with pitot, ELRS",
  "LW-PLA vase skins, PETG structure and feet, carbon spars, booms and fin rods",
];

const STACK = ["Python", "manifold3d", "NumPy", "SciPy", "PX4", "Gazebo Harmonic", "C++", "three.js"];

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

function Bullets({ items, end = "." }: { items: string[][]; end?: string }) {
  return (
    <ul className="space-y-3">
      {items.map(([name, text]) => (
        <li key={name} className="flex items-start gap-2 text-sm text-text-secondary">
          <span className="text-border-bright font-mono shrink-0">├─</span>
          <span>
            <span className="text-foreground font-semibold">{name}:</span> {text}
            {end}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function BwbVtolPage() {
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
          code="BWB"
          title="BLENDED-WING TAILSITTER"
          as="h1"
          subtitle="Takes off like a rocket, flies like a plane. A 3D-printed flying wing with two props and nothing that tilts, built to fly a 250 g parcel out, drop it from a hover and come home."
        />

        {/* Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
          <div className="lg:col-span-3 osd-card rounded-lg overflow-hidden hud-corners">
            <Animation name="turntable" alt="The blended-wing tailsitter turning on a turntable: a flying wing with two props ahead of its leading edge and fins through its wing tips" eager />
          </div>
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono tracking-wider border bg-accent-orange/10 text-accent-orange border-accent-orange/30">
                <span className="w-1 h-1 rounded-full bg-current pulse-green" />
                IN DEVELOPMENT
              </span>
              <span className="font-mono text-[11px] tracking-wider text-text-secondary">
                v1 · flown in simulation · sliced · printing next
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
            Two motors on carbon booms sit ahead of a blended wing body. There are no tilting nacelles or
            third motor: the whole aircraft turns between hover and cruise. It stands on its tail, climbs
            straight up on the two props, pitches over onto its belly and flies as a reflexed, swept flying
            wing under PX4. To deliver it hovers again, and the parcel slides out of a bay that sits on the
            centre of gravity.
          </p>
          <p>
            The skin is printed in LW-PLA in vase mode, over PETG rings, ribs, nacelles and feet and carbon
            spars. Every part, the mass balance, the Gazebo model and the PX4 parameters come from one
            parameter file. A gate checks fits, balance, thrust, hover control and loads before anything is
            printed, and a premortem worked through every way the first build could fail.
          </p>
        </div>

        {/* How it flies */}
        <section className="mb-24">
          <SectionHeader
            code="FLY"
            title="HOW IT FLIES"
            subtitle="A tailsitter: the props lift it in the hover and pull it along in cruise. The elevons sit in their slipstream, so they steer the hover too."
          />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <ol className="lg:col-span-2 space-y-3">
              {FLIGHT.map(([name, text], i) => (
                <li key={name} className="flex gap-4 border border-border-dim rounded-lg bg-surface px-4 py-3">
                  <span className="font-mono text-xs text-accent-green pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-sm text-text-secondary">
                    <span className="text-foreground font-semibold">{name}:</span> {text}.
                  </span>
                </li>
              ))}
            </ol>
            <div className="lg:col-span-3">
              <Figure caption="Standing on its tail, ready to climb; the hover drop, door open and parcel on the ground; the four feet; a nacelle with its motor; a fin and its foot; the elevons.">
                <Image
                  src={`${MEDIA}/tailsitter.webp`}
                  alt="Six renders of the tailsitter: standing on its tail, dropping the parcel in the hover, its feet, a nacelle, a fin and the elevons"
                  width={1600}
                  height={667}
                  className="block w-full h-auto"
                />
              </Figure>
            </div>
          </div>
        </section>

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
            title="A DELIVERY, IN SIMULATION"
            subtitle="PX4 v1.17 software-in-the-loop with Gazebo Harmonic, flying a model generated from the design with this airframe's own PX4 settings."
          />
          <Figure caption="The whole delivery, filmed by a chase camera in Gazebo: real time for the take-off, the transitions, the drop and the touchdown, sped up for the hover descents and the circuit. Every check passes, on the end-of-flight pack and on a full one.">
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
                  <span className="text-foreground font-semibold">A model built for a tailsitter.</span> Gazebo&apos;s
                  stock wing and motor models stall into nothing at high angles and have no slipstream, so the
                  aircraft gets its own plugin. The motors are DC machines on a sagging Li-ion pack, driving
                  props from the blade-element model. The wing is cut into strips that keep the vortex
                  lattice&apos;s neutral point and blend into a flat plate past the stall. Every strip behind a
                  prop feels its slipstream, which is how the elevons steer the hover.
                </p>
                <p>
                  <span className="text-foreground font-semibold">The patch.</span> The simulation found that
                  stock PX4 cannot bring this wing out of cruise into the hover. A small change to its
                  tailsitter code adds one parameter: it holds the thrust through the pitch-up, so the aircraft
                  zooms into the hover. Stock behaviour stays the default.
                </p>
              </div>
            </div>
            <Figure caption="What PX4 logged on the delivery flight: altitude, airspeed, motors, nose angle and the elevons. The orange line is the parcel release.">
              <Image
                src={`${MEDIA}/sim_log.webp`}
                alt="PX4 flight log plots from the simulated delivery flight"
                width={1210}
                height={1210}
                className="block w-full h-auto bg-white"
              />
            </Figure>
          </div>
        </section>

        {/* Process */}
        <section className="mb-24">
          <SectionHeader
            code="ENG"
            title="ENGINEERED BEFORE IT'S BUILT"
            subtitle="Every airframe goes through the same steps before any filament is used: we try to crash it on paper and in simulation first."
          />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 border border-border-dim rounded-lg bg-surface p-5 hud-corners">
              <h3 className="font-mono text-xs tracking-widest text-accent-orange mb-4">{"// THE PROCESS"}</h3>
              <ol className="space-y-4">
                {PROCESS.map((p, i) => (
                  <li key={p.step} className="flex gap-4">
                    <span className="font-mono text-xs text-accent-green pt-0.5">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <span className="block font-mono text-sm tracking-wider text-foreground">{p.step}</span>
                      <span className="block text-sm text-text-secondary">{p.text}</span>
                    </div>
                  </li>
                ))}
              </ol>
              <h3 className="font-mono text-xs tracking-widest text-accent-orange mt-6 mb-3">{"// WHAT THE PREMORTEM COVERS"}</h3>
              <ul className="flex flex-wrap gap-1.5">
                {AREAS.map((a) => (
                  <li key={a} className="px-2 py-0.5 bg-accent-green/5 border border-accent-green/20 rounded text-[11px] font-mono text-accent-green tracking-wider">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-2 space-y-4">
              <div className="border border-border-dim rounded-lg bg-surface p-5">
                <h3 className="font-mono text-xs tracking-widest text-accent-orange mb-3">{"// KEY MARGINS"}</h3>
                <dl className="divide-y divide-border-dim">
                  {NUMBERS.map((r) => (
                    <div key={r.item} className="grid grid-cols-5 gap-3 py-2 text-sm">
                      <dt className="col-span-3 text-text-secondary">{r.item}</dt>
                      <dd className="col-span-2 font-mono text-foreground text-right">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <p className="text-text-secondary text-sm leading-relaxed">
                The numbers come from the design files, a blade-element model of the props with a DC model of
                each motor and a Li-ion pack, and the simulation&apos;s own aerodynamics. The ones that must hold
                are checks in the gate.
              </p>
            </div>
          </div>
        </section>

        {/* Design as code */}
        <section className="mb-24">
          <SectionHeader
            code="CAD"
            title="DESIGNED AS CODE"
            subtitle="Change one number and a single command rebuilds every part, the balance, the viewer and the simulation model, then re-runs the checks."
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
              <Bullets items={GATE} end="" />
            </div>
          </div>
        </section>

        {/* Inside */}
        <section className="mb-24">
          <SectionHeader code="INS" title="INSIDE THE AIRFRAME" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Figure caption="Structure: PETG rings, ribs and keel, carbon spars on joiners across the body, the booms in their pod ribs, and the fin rods.">
              <Image src={`${MEDIA}/xray_structure.webp`} alt="X-ray view of the airframe structure" width={1600} height={1000} className="block w-full h-auto" />
            </Figure>
            <Figure caption="Equipment: the battery in the nose with the power module and servo BEC beside it, the avionics above the parcel bay, the GPS behind it, the ESCs in the nacelles.">
              <Image src={`${MEDIA}/xray_equipment.webp`} alt="X-ray view of the battery, avionics, ESCs and servos inside the airframe" width={1600} height={1000} className="block w-full h-auto" />
            </Figure>
            <Figure caption="Cut through the bay: the parcel between the bay ribs with the door under it, the avionics above, and a main spar on either side.">
              <Image src={`${MEDIA}/cut_bay.webp`} alt="Cross-section through the parcel bay" width={1600} height={1000} className="block w-full h-auto" />
            </Figure>
          </div>
        </section>

        {/* Printing */}
        <section className="mb-24">
          <SectionHeader
            code="PRT"
            title="PRINT-READY"
            subtitle="Sliced: three slicer projects, one plate per print, each named for its filament. A Kobra X prints the 17 LW-PLA skins and a Kobra S1 the 27 PETG parts. Every part fits its bed and no skin overhangs more than 32°."
          />
          <Figure caption="The 27 PETG parts in the orientation they print in.">
            <Image src={`${MEDIA}/print_petg.webp`} alt="The PETG parts laid out in their print orientation" width={1600} height={1000} className="block w-full h-auto" />
          </Figure>
          <div className="mt-6 max-w-3xl">
            <Bullets items={PRINT_JOBS} />
          </div>
        </section>

        {/* Status */}
        <section className="mb-16">
          <SectionHeader code="NXT" title="STATUS + NEXT STEPS" subtitle="Designed, put through a premortem, flown in simulation and sliced. Printing next." />
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
          <p className="font-mono text-xs tracking-[0.3em] text-accent-green mb-4">▸ HAVE A VTOL IDEA THAT NEEDS TO FLY?</p>
          <h2 className="font-mono text-xl md:text-2xl font-bold tracking-wider mb-4">LET&apos;S MAKE IT FLY</h2>
          <p className="text-text-secondary text-sm max-w-lg mx-auto mb-8">
            Custom VTOL and fixed-wing airframes, from parametric CAD and simulation through the first flight.
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
