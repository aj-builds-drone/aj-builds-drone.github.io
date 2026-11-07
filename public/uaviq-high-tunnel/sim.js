// Side-view (x, z, pitch) quadrotor model, ported line for line from research/simulation/quad_sim.py
// in the drone_quote project so the live demo reproduces the report's numbers.
// Inertia, motor lag, drag and battery resistance are estimates: read results as a comparison.

export const G = 9.81;
const RHO = 1.2;
export const CANOPY = 0.6;
export const FLY_Z = 1.5;
export const AVIONICS_W = 40.0;
export const BLOWER_W = 60.0 / 0.92; // 60 W at 12 V through a ~92 % buck regulator
export const RESERVE = 0.2;
const SOC_PTS = [0.0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const OCV_PTS = [3.27, 3.61, 3.69, 3.73, 3.77, 3.79, 3.82, 3.87, 3.92, 3.98, 4.06, 4.2];

// Same PX4-style controller on every aircraft: attitude 8 rad/s, position 2 rad/s, altitude 2.5 rad/s
const KP_A = 64.0, KD_A = 12.8;
const KP_X = 4.0, KD_X = 3.6;
const KP_Z = 6.25, KD_Z = 4.5, KI_Z = 1.5;
const AXY_MAX = 6.0, AZ_UP = 4.0, AZ_DN = 3.0;
const TILT_MAX = (35 * Math.PI) / 180, XY_MARGIN = 0.3;
const CDA_Z = 0.15;

// Load tests: [thrust g, current A] per motor at the test voltage
const X500_TEST = [[210, 1.44], [259, 1.87], [309, 2.29], [373, 2.86], [447, 3.6], [536, 4.53], [628, 5.61],
  [729, 6.78], [814, 7.92], [906, 9.2], [993, 10.59], [1087, 12.11], [1191, 13.81], [1289, 15.68], [1332, 16.37]];
const X650_TEST = [[830, 3.6], [1150, 5.9], [1430, 7.8], [1690, 10.1], [1920, 11.9]];
const PROPOSED_TEST = [[950, 4.3], [1420, 7.0], [1750, 9.6], [2060, 12.5], [2390, 14.7], [2790, 19.1], [3020, 22.5]];

// Releaser loaded masses from the brief plus the assumed mount (150 g on the X500 trial rig, 200-300 g new)
const RELEASER_KG = { none: 0, "1L": 1.073, "2L": 1.847, "4L": 2.693 };
const MOUNT_KG = { none: 0, "1L": 0.2, "2L": 0.25, "4L": 0.3 };

export const SPECS = {
  x500: { key: "x500", name: "UCLA X500 (est.)", short: "X500", color: "#ff5a4f", baseKg: 2.187, testV: 16.0,
    test: X500_TEST, cells: 4, capAh: 5.0, rPack: 0.03, arm: 0.177, inertia: 0.038, motorTau: 0.035, cda: 0.07,
    propD: 0.254, mountKg: 0.15 },
  x650: { key: "x650", name: "Stock X650", short: "Stock X650", color: "#f5a524", baseKg: 3.934, testV: 22.2,
    test: X650_TEST, cells: 6, capAh: 10.0, rPack: 0.02, arm: 0.23, inertia: 0.1, motorTau: 0.055, cda: 0.1,
    propD: 0.381 },
  proposed: { key: "proposed", name: "Proposed (Option A)", short: "Proposed", color: "#2fe07a", baseKg: 4.023,
    testV: 22.2, test: PROPOSED_TEST, cells: 6, capAh: 10.0, rPack: 0.02, arm: 0.23, inertia: 0.105,
    motorTau: 0.065, cda: 0.1, propD: 0.406 },
};

export function payloadKg(spec, releaser) {
  if (releaser === "none") return 0;
  return RELEASER_KG[releaser] + (spec.mountKg ?? MOUNT_KG[releaser]);
}

const clamp = (v, lim) => Math.max(-lim, Math.min(lim, v));

function bisectLeft(xs, x) {
  let lo = 0, hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid + 1; else hi = mid;
  }
  return lo;
}

function bisectRight(xs, x) {
  let lo = 0, hi = xs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (x < xs[mid]) hi = mid; else lo = mid + 1;
  }
  return lo;
}

function interp(x, xs, ys) {
  const i = Math.min(Math.max(bisectLeft(xs, x), 1), xs.length - 1);
  return ys[i - 1] + ((ys[i] - ys[i - 1]) * (x - xs[i - 1])) / (xs[i] - xs[i - 1]);
}

export class Aircraft {
  constructor(spec, payload) {
    Object.assign(this, spec);
    this.payloadKg = payload;
    this.thrustG = spec.test.map((p) => p[0]);
    this.amps = spec.test.map((p) => p[1]);
  }

  get mass() {
    return this.baseKg + this.payloadKg;
  }

  motorMaxN(volts) {
    return (this.thrustG[this.thrustG.length - 1] / 1000) * G * (volts / this.testV) ** 2;
  }

  /** Electrical power of one motor at a thrust (log-log interpolation of the load test). */
  motorPowerW(thrustN) {
    const t = Math.max((thrustN / G) * 1000, 1.0);
    const xs = this.thrustG, ys = this.amps;
    const i = Math.min(Math.max(bisectLeft(xs, t), 1), xs.length - 1);
    const k = Math.log(ys[i] / ys[i - 1]) / Math.log(xs[i] / xs[i - 1]);
    return ys[i - 1] * (t / xs[i - 1]) ** k * this.testV;
  }

  ocv(soc) {
    return this.cells * interp(Math.min(Math.max(soc, 0), 1), SOC_PTS, OCV_PTS);
  }
}

/** One aircraft's state; step() is one integration step of quad_sim.simulate(). */
export class Flyer {
  constructor(ac, opts = {}) {
    this.ac = ac;
    this.reset(opts);
  }

  reset({ soc = 0.98, onGround = false, x = 0, z = FLY_Z, aux = AVIONICS_W } = {}) {
    const ac = this.ac;
    this.x = x;
    this.z = onGround ? 0 : z;
    this.vx = this.vz = this.th = this.q = this.iz = 0;
    this.f1 = this.f2 = onGround ? 0 : (ac.mass * G) / 2; // front and rear rotor pairs (N)
    this.soc = soc;
    this.amps = (4 * ac.motorPowerW(this.f1 / 2) + aux) / ac.ocv(soc);
    this.volts = ac.ocv(soc) - this.amps * ac.rPack;
    this.fmax = 2 * ac.motorMaxN(this.volts);
    this.sat = false;
    this.load = this.f1 / this.fmax;
    this.tw = (2 * this.fmax) / (ac.mass * G);
    this.thCmd = 0;
  }

  /** ref = [x, vx, z, vz]; tilt = pilot pitch command (rad) for altitude-hold mode, or null for position control. */
  step(dt, ref, tilt = null, wind = 0, aux = AVIONICS_W) {
    const ac = this.ac, m = ac.mass, inertia = ac.inertia, arm = ac.arm, tau = ac.motorTau;
    const [xr, vxr, zr, vzr] = ref;
    const volts = ac.ocv(this.soc) - this.amps * ac.rPack;
    const fmax = 2 * ac.motorMaxN(volts);
    const fmin = 0.05 * fmax;
    const tAvail = 2 * fmax;
    const axC = clamp(KP_X * (xr - this.x) + KD_X * (vxr - this.vx), AXY_MAX);
    const azC = Math.min(Math.max(KP_Z * (zr - this.z) + KD_Z * (vzr - this.vz) + KI_Z * this.iz, -AZ_DN), AZ_UP);
    let thD, thrust;
    if (tilt !== null) {
      thD = tilt;
      thrust = Math.min((m * (G + azC)) / Math.cos(thD), tAvail);
    } else { // vertical priority with a horizontal margin, as PX4 does
      let tz = Math.min(Math.max(m * (G + azC), 0.1 * m * G), tAvail);
      const txyLim = Math.max(Math.sqrt(Math.max(tAvail ** 2 - tz ** 2, 0)), XY_MARGIN * tAvail);
      tz = Math.min(tz, Math.sqrt(tAvail ** 2 - txyLim ** 2));
      const txy = clamp(m * axC, txyLim);
      thD = clamp(Math.atan2(txy, tz), TILT_MAX);
      thrust = Math.hypot(txy, tz);
    }
    const torque = inertia * (KP_A * (thD - this.th) - KD_A * this.q);
    let c1 = thrust / 2 + torque / (2 * arm);
    let c2 = thrust / 2 - torque / (2 * arm);
    const sat = Math.max(c1, c2) > fmax;
    if (sat) { // attitude-priority mixer: keep the torque, give up collective thrust
      const shift = Math.max(c1, c2) - fmax;
      c1 -= shift;
      c2 -= shift;
    }
    c1 = Math.min(Math.max(c1, fmin), fmax);
    c2 = Math.min(Math.max(c2, fmin), fmax);
    if (!sat && this.z > 0.05) this.iz += (zr - this.z) * dt;
    this.f1 += ((c1 - this.f1) * dt) / tau;
    this.f2 += ((c2 - this.f2) * dt) / tau;
    const rel = wind - this.vx;
    const ax = ((this.f1 + this.f2) * Math.sin(this.th) + 0.5 * RHO * ac.cda * rel * Math.abs(rel)) / m;
    const az = ((this.f1 + this.f2) * Math.cos(this.th) - 0.5 * RHO * CDA_Z * this.vz * Math.abs(this.vz)) / m - G;
    this.q += ((arm * (this.f1 - this.f2)) / inertia) * dt;
    this.th += this.q * dt;
    this.vx += ax * dt;
    this.x += this.vx * dt;
    this.vz += az * dt;
    this.z += this.vz * dt;
    if (this.z <= 0) {
      this.z = 0;
      this.vz = Math.max(this.vz, 0);
      this.vx = this.th = this.q = 0;
    }
    this.amps = (2 * ac.motorPowerW(this.f1 / 2) + 2 * ac.motorPowerW(this.f2 / 2) + aux) / volts;
    this.soc -= (this.amps * dt) / (3600 * ac.capAh);
    this.volts = volts;
    this.fmax = fmax;
    this.sat = sat;
    this.load = Math.max(this.f1, this.f2) / fmax;
    this.tw = tAvail / (m * G);
    this.thCmd = thD;
  }
}

const LOG_KEYS = ["t", "x", "z", "xr", "zr", "th", "load", "sat", "cellV", "amps", "soc", "tw"];

export function simulate(ac, tEnd, ref, { wind = () => 0, aux = () => AVIONICS_W, soc = 0.98, dt = 0.002,
  onGround = false, logDt = 0.02, tilt = null } = {}) {
  const [x0, , z0] = ref(0);
  const f = new Flyer(ac, { soc, onGround, x: x0, z: z0, aux: aux(0) });
  const log = Object.fromEntries(LOG_KEYS.map((k) => [k, []]));
  const every = Math.max(1, Math.round(logDt / dt));
  const n = Math.round(tEnd / dt);
  for (let i = 0; i <= n; i++) {
    const t = i * dt;
    const r = ref(t);
    f.step(dt, r, tilt ? tilt(t) : null, wind(t), aux(t));
    if (i % every === 0) {
      const row = [t, f.x, f.z, r[0], r[2], f.th, f.load, f.sat, f.volts / ac.cells, f.amps, f.soc, f.tw];
      LOG_KEYS.forEach((k, j) => log[k].push(row[j]));
    }
  }
  return log;
}

// --- scenario 1: two hard manual dodges in altitude-hold mode (stick doublets) ---
export const DODGE_TILT = (30 * Math.PI) / 180;
export const DODGES = [[1.0, 1], [4.0, -1]];
export const T_DODGE = 8.0;

/** Stick doublet: tilt 0.4 s one way, 0.8 s the other, 0.4 s back, ending near the start point. */
export function doubletTilt(t, t0, sign, tiltRad = DODGE_TILT) {
  if (t < t0 || t >= t0 + 1.6) return null;
  return sign * tiltRad * (t < t0 + 0.4 || t >= t0 + 1.2 ? 1 : -1);
}

export function dodgeTilt(t) {
  for (const [t0, sign] of DODGES) {
    const v = doubletTilt(t, t0, sign);
    if (v !== null) return v;
  }
  return 0;
}

export const holdRef = () => [0, 0, FLY_Z, 0];

export function correctionStats(log, t0 = 1.0) {
  const idx = log.t.map((t, i) => (t >= t0 ? i : -1)).filter((i) => i >= 0);
  return {
    dip: Math.min(...idx.map((i) => log.z[i] - log.zr[i])),
    sat: (100 * idx.filter((i) => log.sat[i]).length) / idx.length,
    tilt: (Math.max(...idx.map((i) => Math.abs(log.th[i]))) * 180) / Math.PI,
    cellV: Math.min(...idx.map((i) => log.cellV[i])),
    tw: Math.min(...idx.map((i) => log.tw[i])),
  };
}

// --- scenario 2: two-tunnel mission (x is along the route) ---
const MISSION_T = [0, 4, 8, 68, 82, 92, 152, 156, 160];
const MISSION_X = [0, 0, 0, 60, 80, 80, 140, 140, 140];
const MISSION_Z = [0, FLY_Z, FLY_Z, FLY_Z, FLY_Z, FLY_Z, FLY_Z, FLY_Z, 0];
export const MISSION_END = 160;
export const PHASES = [
  { name: "Tunnel 1", t0: 8, t1: 68, x0: 0, x1: 60 },
  { name: "Windy transit", t0: 68, t1: 82, x0: 60, x1: 80 },
  { name: "Reorient", t0: 82, t1: 92, x0: 80, x1: 80 },
  { name: "Tunnel 2, blower on", t0: 92, t1: 152, x0: 80, x1: 140 },
];

export function missionRef(t) {
  const i = Math.min(Math.max(bisectRight(MISSION_T, t), 1), MISSION_T.length - 1);
  const t0 = MISSION_T[i - 1], t1 = MISSION_T[i];
  const f = Math.min(Math.max((t - t0) / (t1 - t0), 0), 1);
  const vx = f < 1 ? (MISSION_X[i] - MISSION_X[i - 1]) / (t1 - t0) : 0;
  const vz = f < 1 ? (MISSION_Z[i] - MISSION_Z[i - 1]) / (t1 - t0) : 0;
  return [MISSION_X[i - 1] + f * (MISSION_X[i] - MISSION_X[i - 1]), vx,
    MISSION_Z[i - 1] + f * (MISSION_Z[i] - MISSION_Z[i - 1]), vz];
}

export function missionWind(t) {
  const outside = Math.min(Math.max((t - 66) / 2, 0), 1) * Math.min(Math.max((94 - t) / 2, 0), 1);
  const gusty = 3.0 + 1.5 * Math.sin((2 * Math.PI * t) / 7.0) + 1.0 * Math.sin((2 * Math.PI * t) / 2.3);
  return outside * gusty + 0.3 * Math.sin((2 * Math.PI * t) / 5.0);
}

export const missionAux = (t) => AVIONICS_W + (t >= 92 && t < 152 ? BLOWER_W : 0);

export function runMission(ac, logDt = 0.02, soc = 0.98) {
  const log = simulate(ac, MISSION_END, missionRef, { wind: missionWind, aux: missionAux, soc, dt: 0.004,
    onGround: true, logDt });
  const start = log.soc[0], end = log.soc[log.soc.length - 1];
  const air = log.t.map((t, i) => (t >= 8 && t <= 152 ? i : -1)).filter((i) => i >= 0);
  return {
    log,
    start,
    end,
    used: start - end,
    minCellV: Math.min(...log.cellV),
    minTw: Math.min(...air.map((i) => log.tw[i])),
    maxErr: Math.max(...air.map((i) => Math.abs(log.z[i] - log.zr[i]))),
    peakLoad: Math.min(1, Math.max(...log.load)),
  };
}

/**
 * Flies sorties back to back from 98 % until one would land below the reserve; `first` is the first sortie if
 * already flown, and `pause` runs between sorties (the page passes a timeout so the animation keeps running).
 */
export async function runSorties(ac, first = runMission(ac), pause = async () => {}) {
  const runs = [first];
  while (runs.at(-1).end >= RESERVE && runs.length < 30) {
    await pause();
    runs.push(runMission(ac, 0.02, runs.at(-1).end));
  }
  const full = runs.filter((r) => r.end >= RESERVE);
  const next = runs[full.length] ?? runs.at(-1);
  const last = full.at(-1) ?? first;
  return {
    sorties: full.length + (next.start - RESERVE) / (next.start - next.end),
    lastTw: last.minTw,
    lastLoad: last.peakLoad,
    maxErr: Math.max(...(full.length ? full : runs).map((r) => r.maxErr)),
  };
}
