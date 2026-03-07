/* ── Thrust / Flight-Time Calculator ──
   Real engineering calculations for drone builds. */

export interface BuildSelection {
  frame: FramePart | null;
  fc: FCPart | null;
  motor: MotorPart | null;
  battery: BatteryPart | null;
  camera: CameraPart | null;
}

export interface FramePart {
  id: string;
  name: string;
  weight: number;      // grams
  price: number;
  description: string;
  motorMounts: number;
  specs: { material: string; wheelbase: number; armThickness: number };
}

export interface FCPart {
  id: string;
  name: string;
  weight: number;
  price: number;
  description: string;
  specs: { processor: string; gyro: string; uarts: number; firmware: string };
}

export interface MotorPart {
  id: string;
  name: string;
  weight: number;
  price: number;
  description: string;
  specs: { kv: number; stator: string; maxThrust: number; propSize: string };
}

export interface BatteryPart {
  id: string;
  name: string;
  weight: number;
  price: number;
  description: string;
  specs: { cells: number; voltage: number; capacity: number; cRating: number; wh: number };
}

export interface CameraPart {
  id: string;
  name: string;
  weight: number;
  price: number;
  description: string;
  specs: { type: string; resolution: string; latency: string; fov: number | string };
}

export interface BuildMetrics {
  totalWeight: number;         // grams
  dryWeight: number;           // grams (without battery)
  totalCost: number;           // USD
  motorCount: number;
  maxThrust: number;           // grams total from all motors
  thrustToWeight: number;      // ratio
  estimatedFlightTime: number; // minutes
  maxSpeed: number;            // km/h estimate
  rating: "EXCELLENT" | "GOOD" | "MARGINAL" | "UNSAFE";
  warnings: string[];
}

const MISC_WEIGHT = 30; // wiring, screws, standoffs, zip ties, etc.
const EFFICIENCY_FACTOR = 0.55; // average flight uses ~55% of max throttle
const WH_PER_MIN_PER_KG = 3.2; // empirical Wh consumption rate per kg AUW per minute at cruise

export function calculateMetrics(build: BuildSelection): BuildMetrics | null {
  if (!build.frame || !build.fc || !build.motor || !build.battery || !build.camera) {
    return null;
  }

  const motorCount = build.frame.motorMounts;
  const motorsTotalWeight = build.motor.weight * motorCount;

  const dryWeight =
    build.frame.weight +
    build.fc.weight +
    motorsTotalWeight +
    build.camera.weight +
    MISC_WEIGHT;

  const totalWeight = dryWeight + build.battery.weight;

  const totalCost =
    build.frame.price +
    build.fc.price +
    build.motor.price * motorCount +
    build.battery.price +
    build.camera.price;

  const maxThrust = build.motor.specs.maxThrust * motorCount;
  const thrustToWeight = maxThrust / totalWeight;

  // Flight time: Wh / (consumption rate * AUW in kg)
  const auwKg = totalWeight / 1000;
  const consumptionPerMin = WH_PER_MIN_PER_KG * auwKg * EFFICIENCY_FACTOR;
  const estimatedFlightTime = consumptionPerMin > 0
    ? Math.round(build.battery.specs.wh / consumptionPerMin)
    : 0;

  // Rough max speed estimate based on TWR and size
  const maxSpeed = Math.round(thrustToWeight * 45);

  // Rate the build
  const warnings: string[] = [];
  let rating: BuildMetrics["rating"];

  if (thrustToWeight >= 4) {
    rating = "EXCELLENT";
  } else if (thrustToWeight >= 2.5) {
    rating = "GOOD";
  } else if (thrustToWeight >= 1.5) {
    rating = "MARGINAL";
    warnings.push("Low thrust margin — reduce weight or upgrade motors");
  } else {
    rating = "UNSAFE";
    warnings.push("Thrust-to-weight below safe minimum (1.5:1)");
  }

  if (thrustToWeight < 2) {
    warnings.push("Cannot maintain stable hover in wind");
  }

  if (estimatedFlightTime < 3) {
    warnings.push("Very short flight time — consider larger battery");
  }

  if (build.camera.weight > totalWeight * 0.3) {
    warnings.push("Camera payload exceeds 30% of AUW");
  }

  return {
    totalWeight,
    dryWeight,
    totalCost,
    motorCount,
    maxThrust,
    thrustToWeight: Math.round(thrustToWeight * 100) / 100,
    estimatedFlightTime,
    maxSpeed,
    rating,
    warnings,
  };
}
