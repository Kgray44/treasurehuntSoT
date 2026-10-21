// @sounding-line-registration owner=sounding-line suite=unit.device-lab contracts=device-lab.shared-infrastructure
import { describe, expect, it } from "vitest";
import { coordinatedSensorBaseline as base, coordinatedSensorSeries, sensorFaultKinds } from "./coordinated-sensors";

describe("coordinated Device Lab sensor inputs", () => {
  it("rotates a constant world field without changing magnetic strength or stationary gravity", () => {
    const series = coordinatedSensorSeries({ ...base, yawRateRadPerSecond: Math.PI / 2 });
    expect(series[5].magneticDeviceMicrotesla.x).toBeCloseTo(0);
    expect(series[5].magneticDeviceMicrotesla.y).toBeCloseTo(-20);
    expect(series[5].magneticDeviceMicrotesla.z).toBe(-45);
    for (const f of series) {
      expect(Math.hypot(...Object.values(f.magneticDeviceMicrotesla))).toBeCloseTo(Math.sqrt(2425));
      expect(f.gravityDevice.z).toBeCloseTo(9.80665);
      expect(f.accelerationIncludingGravityDevice).toEqual(f.gravityDevice);
    }
  });
  it("couples trajectory derivatives, device acceleration and pressure to the same climb", () => {
    const frames = coordinatedSensorSeries({
      ...base,
      accelerationWorld: { x: 2, y: 0, z: 1 },
      initialVelocityWorld: { x: 0, y: 0, z: 2 },
    });
    expect(frames[10].positionWorldMeters).toEqual({ x: 4, y: 0, z: 6 });
    expect(frames[10].velocityWorldMetersPerSecond).toEqual({ x: 4, y: 0, z: 4 });
    expect(frames[10].linearAccelerationDevice).toEqual({ x: 2, y: 0, z: 1 });
    expect(frames[10].pressureHpa).toBeCloseTo(1012.52945, 3);
    for (let i = 1; i < frames.length - 1; i++) {
      const dt = 0.2;
      expect((frames[i + 1].positionWorldMeters.z - frames[i - 1].positionWorldMeters.z) / (2 * dt)).toBeCloseTo(
        frames[i].velocityWorldMetersPerSecond.z,
      );
    }
  });
  it("replays seeds exactly and keeps independent measurement noise bounded", () => {
    const spec = { ...base, noiseBound: 0.01 };
    expect(coordinatedSensorSeries(spec)).toEqual(coordinatedSensorSeries(spec));
    expect(coordinatedSensorSeries(spec)).not.toEqual(coordinatedSensorSeries({ ...spec, seed: 2 }));
    for (const f of coordinatedSensorSeries(spec)) {
      expect(Math.abs(f.gravityDevice.z - 9.80665)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(f.magneticDeviceMicrotesla.x - 20)).toBeLessThanOrEqual(0.01);
    }
  });
  it.each(sensorFaultKinds)("bounds %s fault to its interval and preserves deterministic recovery", (kind) => {
    const faults = [{ kind, startMs: 1000, endMs: 2000, magnitude: 2 }];
    const frames = coordinatedSensorSeries(base, faults);
    expect(frames).toEqual(coordinatedSensorSeries(base, faults));
    expect(frames.some((f) => f.faults.includes(kind))).toBe(true);
    expect(frames.filter((f) => f.at < 1000 || f.at >= 2000).every((f) => f.faults.length === 0)).toBe(true);
    const bad = frames.find((f) => f.at === 1200)!;
    if (kind === "DROPOUT" || kind === "UNSUPPORTED") expect(bad.available).toBe(false);
    if (kind === "STALE") expect(bad.captureAt).toBe(-2800);
    if (kind === "DENIED") expect(bad.permission).toBe("DENIED");
    if (kind === "THERMAL") expect(bad.thermal).toBe("CRITICAL");
    if (["SLEEP", "BACKGROUND", "PROCESS_DEATH"].includes(kind)) expect(frames.at(-1)!.generation).toBe(2);
    if (kind === "DUPLICATE") expect(frames.length).toBe(26);
  });
  it("rejects unbounded inputs and faults rather than creating misleading fixtures", () => {
    expect(() => coordinatedSensorSeries({ ...base, durationMs: 1000000 })).toThrow();
    expect(() => coordinatedSensorSeries(base, [{ kind: "SPIKE", startMs: 5, endMs: 4 }])).toThrow();
  });
});
