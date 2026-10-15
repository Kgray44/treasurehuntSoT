import { z } from "zod";
import {
  inverseQuaternion,
  normalizeQuaternion,
  rotateVector,
  type Quaternion,
  type Vector3,
} from "@/sextant/attitude";

const vector = z.strictObject({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() });
export const coordinatedTrajectorySchema = z.strictObject({
  seed: z.number().int().min(0).max(0xffffffff),
  durationMs: z.number().int().min(200).max(60000),
  intervalMs: z.number().int().min(16).max(5000),
  yawRateRadPerSecond: z.number().finite().min(-4).max(4),
  accelerationWorld: vector,
  initialVelocityWorld: vector,
  initialPositionWorld: vector,
  magneticWorldMicrotesla: vector,
  magneticDisturbancePerSecond: vector,
  seaLevelPressureHpa: z.number().finite().min(900).max(1100),
  noiseBound: z.number().finite().min(0).max(0.05),
});
export type CoordinatedTrajectory = z.infer<typeof coordinatedTrajectorySchema>;
export type CoordinatedSensorFrame = {
  at: number;
  sequence: number;
  attitudeDeviceToWorld: Quaternion;
  positionWorldMeters: Vector3;
  velocityWorldMetersPerSecond: Vector3;
  linearAccelerationDevice: Vector3;
  gravityDevice: Vector3;
  accelerationIncludingGravityDevice: Vector3;
  angularVelocityDevice: Vector3;
  magneticDeviceMicrotesla: Vector3;
  pressureHpa: number;
  positionUncertaintyMeters: number;
  lifecycle: "FOREGROUND" | "BACKGROUND" | "LOCKED" | "TERMINATED";
  permission: "GRANTED" | "DENIED";
  available: boolean;
  connected: boolean;
  thermal: "NORMAL" | "DEGRADED" | "CRITICAL";
  lowPower: boolean;
  calibration: "GOOD" | "CALIBRATING" | "DISTURBED";
  generation: number;
  captureAt: number;
  faults: SensorFaultKind[];
};
export const sensorFaultKinds = [
  "DROPOUT",
  "STALE",
  "CADENCE",
  "CLOCK_JUMP",
  "BIAS_DRIFT",
  "SPIKE",
  "CALIBRATION",
  "INTERFERENCE",
  "PRESSURE_DRIFT",
  "GPS_UNCERTAINTY",
  "DENIED",
  "UNSUPPORTED",
  "BACKGROUND",
  "SLEEP",
  "PROCESS_DEATH",
  "DISCONNECTED",
  "DUPLICATE",
  "OUT_OF_ORDER",
  "THERMAL",
  "LOW_POWER",
] as const;
export type SensorFaultKind = (typeof sensorFaultKinds)[number];
const faultSchema = z
  .strictObject({
    kind: z.enum(sensorFaultKinds),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
    magnitude: z.number().finite().min(0).max(1000).default(1),
  })
  .refine((f) => f.endMs > f.startMs, "DEVICE_LAB_FAULT_RANGE_INVALID");
export type SensorFault = z.input<typeof faultSchema>;
const add = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (v: Vector3, factor: number): Vector3 => ({ x: v.x * factor, y: v.y * factor, z: v.z * factor });

/** Shared deterministic Device Lab input. ENU world, physical portrait device;
 * q maps device to world, metres/seconds/radians/microtesla/hPa. Gravity is the
 * stationary accelerometer specific-force component (+up), not a trajectory
 * acceleration. Sensor noise is bounded independently after coherent transforms.
 * This fixture has no production provider, location authority or durable store. */
export function coordinatedSensorSeries(
  input: CoordinatedTrajectory,
  faultInputs: SensorFault[] = [],
): CoordinatedSensorFrame[] {
  const spec = coordinatedTrajectorySchema.parse(input);
  const faults = z.array(faultSchema).max(64).parse(faultInputs);
  let randomState = spec.seed;
  const noise = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return ((randomState / 0xffffffff) * 2 - 1) * spec.noiseBound;
  };
  const noisy = (v: Vector3) => ({ x: v.x + noise(), y: v.y + noise(), z: v.z + noise() });
  const frames: CoordinatedSensorFrame[] = [];
  let generation = 1,
    interrupted = false;
  for (let at = 0, sequence = 0; at <= spec.durationMs; at += spec.intervalMs, sequence++) {
    const t = at / 1000;
    const active = faults.filter((f) => at >= f.startMs && at < f.endMs);
    const has = (kind: SensorFaultKind) => active.some((f) => f.kind === kind);
    const strength = (kind: SensorFaultKind) =>
      active.filter((f) => f.kind === kind).reduce((sum, f) => sum + f.magnitude, 0);
    const lifecycle = has("PROCESS_DEATH")
      ? "TERMINATED"
      : has("SLEEP")
        ? "LOCKED"
        : has("BACKGROUND")
          ? "BACKGROUND"
          : "FOREGROUND";
    if (interrupted && lifecycle === "FOREGROUND") generation++;
    interrupted = lifecycle !== "FOREGROUND";
    const q = normalizeQuaternion({
      x: 0,
      y: 0,
      z: Math.sin((t * spec.yawRateRadPerSecond) / 2),
      w: Math.cos((t * spec.yawRateRadPerSecond) / 2),
    });
    const position = add(
      add(spec.initialPositionWorld, scale(spec.initialVelocityWorld, t)),
      scale(spec.accelerationWorld, (t * t) / 2),
    );
    const velocity = add(spec.initialVelocityWorld, scale(spec.accelerationWorld, t));
    const toDevice = (v: Vector3) => rotateVector(inverseQuaternion(q), v);
    const linear = noisy(toDevice(spec.accelerationWorld));
    const gravity = noisy(toDevice({ x: 0, y: 0, z: 9.80665 }));
    const interference = scale(spec.magneticWorldMicrotesla, strength("INTERFERENCE") / 50);
    const magnetic = noisy(
      toDevice(add(add(spec.magneticWorldMicrotesla, scale(spec.magneticDisturbancePerSecond, t)), interference)),
    );
    magnetic.x += strength("BIAS_DRIFT") * t + strength("SPIKE");
    if (has("CADENCE") && sequence % 3 !== 0) continue;
    const frame: CoordinatedSensorFrame = {
      at,
      captureAt: at - strength("STALE") * 2000 + strength("CLOCK_JUMP") * 5000,
      sequence,
      attitudeDeviceToWorld: q,
      positionWorldMeters: position,
      velocityWorldMetersPerSecond: velocity,
      linearAccelerationDevice: linear,
      gravityDevice: gravity,
      accelerationIncludingGravityDevice: add(linear, gravity),
      angularVelocityDevice: noisy({ x: 0, y: 0, z: spec.yawRateRadPerSecond }),
      magneticDeviceMicrotesla: magnetic,
      pressureHpa:
        spec.seaLevelPressureHpa * Math.pow(1 - position.z / 44330, 1 / 0.19029495) + strength("PRESSURE_DRIFT") * t,
      positionUncertaintyMeters: 3 + strength("GPS_UNCERTAINTY") * 10,
      lifecycle,
      permission: has("DENIED") ? "DENIED" : "GRANTED",
      available: !has("DROPOUT") && !has("UNSUPPORTED"),
      connected: !has("DISCONNECTED"),
      thermal: strength("THERMAL") >= 2 ? "CRITICAL" : has("THERMAL") ? "DEGRADED" : "NORMAL",
      lowPower: has("LOW_POWER"),
      calibration: has("CALIBRATION") ? "CALIBRATING" : has("INTERFERENCE") ? "DISTURBED" : "GOOD",
      generation,
      faults: active.map((f) => f.kind),
    };
    if (has("OUT_OF_ORDER") && frames.length) frame.sequence = Math.max(0, frames.at(-1)!.sequence - 1);
    frames.push(frame);
    if (has("DUPLICATE")) frames.push(structuredClone(frame));
  }
  return frames;
}

export const coordinatedSensorBaseline: CoordinatedTrajectory = {
  seed: 0x53455854,
  durationMs: 4000,
  intervalMs: 200,
  yawRateRadPerSecond: 0,
  accelerationWorld: { x: 0, y: 0, z: 0 },
  initialVelocityWorld: { x: 0, y: 0, z: 0 },
  initialPositionWorld: { x: 0, y: 0, z: 0 },
  magneticWorldMicrotesla: { x: 20, y: 0, z: -45 },
  magneticDisturbancePerSecond: { x: 0, y: 0, z: 0 },
  seaLevelPressureHpa: 1013.25,
  noiseBound: 0,
};
