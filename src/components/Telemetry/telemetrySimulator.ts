/* ── Drone Telemetry Data Simulator ──
   Generates realistic MAVLink-style flight data
   using a state machine: IDLE → ARMED → TAKEOFF → MISSION → RTL → LAND */

export type FlightMode = "IDLE" | "ARMED" | "TAKEOFF" | "MISSION" | "RTL" | "LAND";

export interface TelemetryData {
  mode: FlightMode;
  armed: boolean;
  altitude: number;       // meters AGL
  altitudeTarget: number;
  speed: number;          // m/s ground speed
  verticalSpeed: number;  // m/s
  heading: number;        // degrees 0-360
  pitch: number;          // degrees -30 to 30
  roll: number;           // degrees -30 to 30
  battery: number;        // percentage 0-100
  voltage: number;        // volts
  current: number;        // amps
  gpsLat: number;
  gpsLon: number;
  gpsSats: number;
  gpsHdop: number;
  rssi: number;           // signal strength 0-100
  waypointIndex: number;
  waypointTotal: number;
  flightTime: number;     // seconds
  timestamp: number;
}

// Austin TX area waypoints (simulated mission)
const WAYPOINTS: [number, number, number][] = [
  [30.2672, -97.7431, 50],   // Austin downtown — launch
  [30.2690, -97.7400, 80],   // NE
  [30.2710, -97.7380, 100],  // East
  [30.2700, -97.7350, 80],   // SE
  [30.2680, -97.7370, 60],   // South
  [30.2660, -97.7410, 50],   // SW loop back
  [30.2672, -97.7431, 30],   // RTL
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(t, 1);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function createTelemetrySimulator() {
  let mode: FlightMode = "IDLE";
  let modeTimer = 0;
  let waypointIdx = 0;
  let waypointProgress = 0;
  let flightTime = 0;

  const state: TelemetryData = {
    mode: "IDLE",
    armed: false,
    altitude: 0,
    altitudeTarget: 0,
    speed: 0,
    verticalSpeed: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    battery: 98,
    voltage: 16.8,
    current: 0,
    gpsLat: WAYPOINTS[0][0],
    gpsLon: WAYPOINTS[0][1],
    gpsSats: 14,
    gpsHdop: 0.8,
    rssi: 95,
    waypointIndex: 0,
    waypointTotal: WAYPOINTS.length,
    flightTime: 0,
    timestamp: Date.now(),
  };

  function tick(dt: number): TelemetryData {
    modeTimer += dt;
    const noise = () => (Math.random() - 0.5) * 2;

    switch (mode) {
      case "IDLE":
        state.armed = false;
        state.current = 0.5;
        state.rssi = 95 + noise();
        if (modeTimer > 3) { mode = "ARMED"; modeTimer = 0; }
        break;

      case "ARMED":
        state.armed = true;
        state.current = 2;
        state.pitch = noise() * 0.5;
        state.roll = noise() * 0.5;
        if (modeTimer > 2) { mode = "TAKEOFF"; modeTimer = 0; }
        break;

      case "TAKEOFF":
        state.altitudeTarget = WAYPOINTS[0][2];
        state.altitude = lerp(state.altitude, state.altitudeTarget, dt * 0.3);
        state.verticalSpeed = lerp(state.verticalSpeed, 3, dt * 2);
        state.speed = lerp(state.speed, 1, dt);
        state.current = 25 + noise() * 2;
        state.pitch = -8 + noise();
        flightTime += dt;
        if (Math.abs(state.altitude - state.altitudeTarget) < 2) {
          mode = "MISSION"; modeTimer = 0; waypointIdx = 0; waypointProgress = 0;
        }
        break;

      case "MISSION": {
        const currentWP = WAYPOINTS[Math.min(waypointIdx, WAYPOINTS.length - 1)];
        const nextWP = WAYPOINTS[Math.min(waypointIdx + 1, WAYPOINTS.length - 1)];

        waypointProgress += dt * 0.15;
        if (waypointProgress >= 1) {
          waypointProgress = 0;
          waypointIdx++;
          if (waypointIdx >= WAYPOINTS.length - 2) {
            mode = "RTL"; modeTimer = 0;
          }
        }

        const t = waypointProgress;
        state.gpsLat = lerp(currentWP[0], nextWP[0], t);
        state.gpsLon = lerp(currentWP[1], nextWP[1], t);
        state.altitudeTarget = lerp(currentWP[2], nextWP[2], t);
        state.altitude = lerp(state.altitude, state.altitudeTarget, dt * 0.5);
        state.speed = lerp(state.speed, 8 + noise(), dt * 0.5);
        state.verticalSpeed = (state.altitudeTarget - state.altitude) * 0.3;
        state.current = 18 + noise() * 3;
        state.waypointIndex = waypointIdx + 1;

        // Calculate heading from movement
        const dLat = nextWP[0] - currentWP[0];
        const dLon = nextWP[1] - currentWP[1];
        const targetHeading = ((Math.atan2(dLon, dLat) * 180) / Math.PI + 360) % 360;
        state.heading = lerp(state.heading, targetHeading, dt * 0.5);

        // Bank into turns
        const headingDelta = targetHeading - state.heading;
        state.roll = clamp(headingDelta * 0.3, -25, 25) + noise();
        state.pitch = -3 + noise();

        flightTime += dt;
        break;
      }

      case "RTL": {
        const home = WAYPOINTS[WAYPOINTS.length - 1];
        state.gpsLat = lerp(state.gpsLat, home[0], dt * 0.2);
        state.gpsLon = lerp(state.gpsLon, home[1], dt * 0.2);
        state.altitudeTarget = home[2];
        state.altitude = lerp(state.altitude, state.altitudeTarget, dt * 0.3);
        state.speed = lerp(state.speed, 5 + noise(), dt * 0.3);
        state.verticalSpeed = lerp(state.verticalSpeed, -1, dt);
        state.current = 15 + noise() * 2;
        state.heading = lerp(state.heading, 180, dt * 0.2);
        state.pitch = 2 + noise();
        state.roll = noise() * 3;
        flightTime += dt;

        const distHome = Math.abs(state.gpsLat - home[0]) + Math.abs(state.gpsLon - home[1]);
        if (distHome < 0.0001) { mode = "LAND"; modeTimer = 0; }
        break;
      }

      case "LAND":
        state.altitude = lerp(state.altitude, 0, dt * 0.4);
        state.verticalSpeed = lerp(state.verticalSpeed, -1.5, dt * 2);
        state.speed = lerp(state.speed, 0, dt * 0.5);
        state.current = 10 + noise();
        state.pitch = noise() * 0.5;
        state.roll = noise() * 0.5;
        flightTime += dt;

        if (state.altitude < 0.5) {
          state.altitude = 0;
          state.verticalSpeed = 0;
          state.speed = 0;
          state.armed = false;
          // Reset cycle after pause
          if (modeTimer > 4) {
            mode = "IDLE"; modeTimer = 0; flightTime = 0;
            state.battery = 98;
            state.voltage = 16.8;
            waypointIdx = 0; waypointProgress = 0;
            state.gpsLat = WAYPOINTS[0][0];
            state.gpsLon = WAYPOINTS[0][1];
            state.waypointIndex = 0;
          }
        }
        break;
    }

    // Global updates
    state.mode = mode;
    state.battery = clamp(state.battery - dt * 0.15, 5, 100);
    state.voltage = 12.6 + (state.battery / 100) * 4.2;
    state.gpsSats = 14 + Math.round(noise());
    state.gpsHdop = clamp(0.8 + noise() * 0.1, 0.5, 2.0);
    state.rssi = clamp(95 - (state.altitude * 0.05) + noise() * 2, 40, 100);
    state.flightTime = flightTime;
    state.timestamp = Date.now();

    return { ...state };
  }

  return { tick };
}
