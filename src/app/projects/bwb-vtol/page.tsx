import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SectionHeader, StatBox } from "@/components/HUDElements";

const MEDIA = "/projects/bwb-vtol";
const PAGE_URL = "https://aj-builds-drone.github.io/projects/bwb-vtol/";
const SUMMARY =
  "A 3D-printed blended-wing-body delivery VTOL. An audit showed the original design could not fly. The redesign is generated in Python, checked by a 12-point gate and flies a full parcel delivery in PX4 + Gazebo simulation.";

export const metadata: Metadata = {
  title: "Blended-Wing Delivery VTOL: Audited, Redesigned, Flown in Simulation",
  description: `${SUMMARY} 900 mm span, 1.6 kg with a 250 g parcel, PX4.`,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Blended-Wing Delivery VTOL | AJ Builds Drone",
    description: SUMMARY,
    url: PAGE_URL,
    siteName: "AJ Builds Drone",
    type: "article",
    images: [{ url: `${MEDIA}/og.jpg`, width: 1200, height: 630, alt: "The blended-wing-body delivery VTOL, front rotors up for hover" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blended-Wing Delivery VTOL | AJ Builds Drone",
    description: SUMMARY,
    images: [`${MEDIA}/og.jpg`],
  },
};

const STATS = [
  { label: "Span", value: "900", unit: "mm" },
  { label: "All-up weight", value: "1.61", unit: "kg" },
  { label: "Parcel", value: "250", unit: "g" },
  { label: "Cruise (est.)", value: "17", unit: "m/s" },
  { label: "Static margin", value: "4.7", unit: "% MAC" },
  { label: "Gate checks", value: "12", unit: "passing" },
];

const AUDIT = [
  ["It could not hover", "with both rotors on one tilt axis, PX4 has nothing left to control hover pitch with"],
  ["The wing flew backwards", "with the nacelles tilted forward, the trailing edge led"],
  ["PX4 could not load it", "6 parameter names that do not exist, the wrong airframe type, no outputs connected"],
  ["The model was not the aircraft", "12 of its 22 parts were missing from the Gazebo model, and the elevons were drawn beyond the wing tips"],
  ["The holes would print solid", "once a slicer united the overlapping shells, 31 of 33 bolt holes and spar bores filled in"],
  ["The simulation was a replay", "a scripted profile that passed all of its gates with the wing deleted"],
];

const MOVES = [
  { name: "transition", title: "Hover → cruise", text: "The yokes swing the front rotors from straight up to straight ahead." },
  { name: "burst", title: "Burst view", text: "40 printed parts, the carbon tubes and the equipment inside." },
  { name: "drop", title: "Delivery", text: "The parcel bay sits on the centre of gravity, so dropping the parcel leaves the balance alone." },
  { name: "battery", title: "Battery change", text: "The nose cap comes off and the pack slides out through the nose ring." },
];

const SIM_RESULTS = [
  { item: "Hover", result: "15.9 N of thrust for 15.8 N of weight, about a third of each motor's full thrust, as the mass balance predicted" },
  { item: "Transitions", result: "Front: 10.6 s and 10.0 s. Back: 4.6 s and 6.2 s, climbing at most 4.3 m" },
  { item: "Cruise", result: "17.4 m/s on 8 % of full thrust; elevons 2.7° up, where the model trims at 2.4°" },
  { item: "Delivery", result: "Released over the target at 8 m. Hover thrust fell 16.4 %; the parcel is 15.6 % of the weight" },
  { item: "Control", result: "Roll 0.3° and pitch 1.1° RMS in hover; 1.9° and 1.4° in fixed-wing flight, 50° turns included" },
  { item: "Landing", result: "0.1 m from home, on the pad" },
];

const PIPELINE = [
  { step: "params.py", text: "One parameter file holds every dimension." },
  { step: "Vortex lattice", text: "Lift slope, neutral point, trim and stall, computed from the planform." },
  { step: "Parts", text: "40 watertight solids: LW-PLA vase skins, PETG structure, and bores that stay open in the slicer." },
  { step: "Mass balance", text: "CG, static margin, hover thrust and PX4 airspeeds. The battery slides to the CG the wing needs." },
  { step: "Simulation model", text: "The Gazebo model and PX4 airframe come from the same geometry and masses." },
  { step: "Gate", text: "12 checks run before any filament is used." },
];

const GATE = [
  ["Printability", "every part fits its printer's bed, and no vase panel overhangs past 45°"],
  ["Fit", "no two parts overlap, and the carbon tubes and every piece of equipment run clear"],
  ["Inside", "everything that belongs inside the skin is inside it"],
  ["Mechanism", "yokes and props clear the airframe from −10° to 90° of tilt"],
  ["Balance", "static margin of 4–10 %, with and without the parcel"],
  ["Power", "every motor under 60 % of its thrust in hover on a nearly empty pack"],
  ["Freshness", "the viewer and the simulation files match the current design"],
];

const NEXT_STEPS = [
  "Test prints: an LW-PLA wing panel with its PETG pod rib and spigot bands, weighed against the estimate.",
  "Thrust-stand the 2216 1100 KV on a 10 × 4.5 and the 2212 on an 8 × 4.5 to replace the book thrust figures.",
  "Raise the static margin from 4.7 % toward 6.5 %, with a longer battery bay or more outer-panel sweep, and re-run the gate.",
  "Build, balance on the marked CG, bench-test with the props off, then a tethered hover.",
];

const HARDWARE = [
  "Pixhawk 6C Mini running PX4 (tiltrotor VTOL)",
  "2 × 2216 1100 KV on 10 × 4.5 (tilting), 2212 1400 KV on 8 × 4.5 (rear lift)",
  "3 × 30 A ESCs, 4S1P Molicel P42A 21700 pack (60 Wh)",
  "2 direct-drive tilt servos, 2 elevon servos, a bay-latch servo",
  "M10 GPS + compass, digital airspeed sensor with pitot, ELRS",
  "LW-PLA vase skins, PETG structure, carbon spars and pod booms",
];

const STACK = ["Python", "manifold3d", "NumPy", "SciPy", "PX4", "Gazebo Harmonic", "three.js"];

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
          title="BLENDED-WING DELIVERY VTOL"
          as="h1"
          subtitle="It began as an audit of a design that could not fly. The redesign is a 3D-printed flying wing that takes off vertically, flies a delivery, drops a 250 g parcel on target and lands back at home in PX4 simulation."
        />

        {/* Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
          <div className="lg:col-span-3 osd-card rounded-lg overflow-hidden hud-corners">
            <Animation name="turntable" alt="The blended-wing-body VTOL turning on a turntable: two tilting front rotors, a rear lift rotor and winglets" eager />
          </div>
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono tracking-wider border bg-accent-orange/10 text-accent-orange border-accent-orange/30">
                <span className="w-1 h-1 rounded-full bg-current pulse-green" />
                IN DEVELOPMENT
              </span>
              <span className="font-mono text-[11px] tracking-wider text-text-secondary">
                v2 · flown in simulation · test prints next
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
            Two front rotors on tilting yokes lift the aircraft in hover and swing forward for cruise. A
            third, fixed rotor behind the wing shares the hover load and stops in cruise. In forward flight
            a reflexed, swept flying wing with winglets carries it, under PX4. The parcel rides in a belly
            bay on the centre of gravity and drops through a door.
          </p>
          <p>
            The skin is printed in LW-PLA in vase mode, over PETG rings, ribs and pods and carbon spars.
            Every part, the mass balance, the Gazebo model and the PX4 airframe come from one parameter
            file, and a gate checks fits, clearances and balance before anything is printed.
          </p>
        </div>

        {/* Audit */}
        <section className="mb-24">
          <SectionHeader
            code="AUD"
            title="THE AUDIT"
            subtitle="The design this started from was described as audit-fixed and passing all of its tests. Checking it against PX4, Gazebo and a slicer found otherwise."
          />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 border border-border-dim rounded-lg bg-surface p-5 hud-corners">
              <h3 className="font-mono text-xs tracking-widest text-accent-orange mb-3">{"// WHAT IT FOUND"}</h3>
              <ul className="space-y-3">
                {AUDIT.map(([name, text]) => (
                  <li key={name} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="text-border-bright font-mono shrink-0">├─</span>
                    <span>
                      <span className="text-foreground font-semibold">{name}:</span> {text}.
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-3">
              <Figure caption="Top: the original, as its own Gazebo model placed it. The outboard wings and winglets are missing, the elevons float beyond the tips, and at 90° the prop discs (red) cut through the wing. Bottom: the redesign.">
                <Image
                  src={`${MEDIA}/original_vs_v2.webp`}
                  alt="Six renders: the original design as its Gazebo model placed it, and the redesign, in hover, cruise and from above"
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
            subtitle="PX4 v1.17 software-in-the-loop with Gazebo Harmonic, flying a model generated from the design and this airframe's own PX4 settings."
          />
          <Figure caption="The delivery flight (2 min 42 s, chase camera; the hover legs and the circuit are sped up): vertical takeoff to 30 m, the front transition, cruise north at 17 m/s, the back transition over the drop zone, the parcel released 8 m above the target, the climb-out and a second transition, a 3 km circuit at 40 m, and a vertical landing on the pad.">
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
                  <span className="text-foreground font-semibold">An honest model.</span> The wing is a
                  vortex-lattice solution cut into lift strips that keep its neutral point and pitching moment,
                  so the simulated aircraft trims where the design says it should. The masses are the mass
                  balance&apos;s, and the motors are the ones on the parts list.
                </p>
                <p>
                  <span className="text-foreground font-semibold">What it caught.</span> PX4&apos;s VTOL
                  defaults hold the heading in hover, so the mission could not line up for the front
                  transition after the drop, and PX4 kept the previous mission&apos;s position on an upload.
                  Both are fixed in the airframe and the test script.
                </p>
              </div>
            </div>
            <Figure caption="What PX4 logged on the delivery flight: altitude, airspeed, motor and tilt commands, attitude against setpoint. The orange line is the parcel release.">
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
            <Figure caption="Structure: PETG rings, ribs and keel, carbon spars on joiners across the body, the pod booms and the rear motor mast.">
              <Image src={`${MEDIA}/xray_structure.webp`} alt="X-ray view of the airframe structure" width={1600} height={1000} className="block w-full h-auto" />
            </Figure>
            <Figure caption="Equipment: the battery in the nose, avionics above the parcel bay, ESCs in the wings and the servos in the pods and outer wings.">
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
            subtitle="One material per printer: a Kobra X prints the 17 LW-PLA skins in vase mode and a Kobra S1 the 23 PETG parts. Every part fits its bed and no skin overhangs more than 30°."
          />
          <Figure caption="The PETG parts in their print orientation.">
            <Image src={`${MEDIA}/print_petg.webp`} alt="The PETG parts laid out in their print orientation" width={1600} height={1000} className="block w-full h-auto" />
          </Figure>
        </section>

        {/* Status */}
        <section className="mb-16">
          <SectionHeader code="NXT" title="STATUS + NEXT STEPS" subtitle="Designed, verified and flown in simulation. Not built yet." />
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
          <p className="font-mono text-xs tracking-[0.3em] text-accent-green mb-4">▸ HAVE A DESIGN THAT NEEDS A SECOND LOOK?</p>
          <h2 className="font-mono text-xl md:text-2xl font-bold tracking-wider mb-4">LET&apos;S MAKE IT FLY</h2>
          <p className="text-text-secondary text-sm max-w-lg mx-auto mb-8">
            Design audits, custom VTOL and fixed-wing airframes, from parametric CAD and simulation through the first flight.
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
