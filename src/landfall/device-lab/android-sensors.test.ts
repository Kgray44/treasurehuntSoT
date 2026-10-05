import { describe, expect, it } from "vitest";
import { androidSensorControl, matchesAndroidSensorContext, readAndroidSensorValues } from "./android-sensors";

describe("Android sensor translation fidelity", () => {
  it("uses gravity and magnetic inputs for the fused heading path and never substitutes an unsupported fault", () => {
    const control = androidSensorControl({ type: "SENSOR", kind: "HEADING", values: [90, 10] })!;
    expect(control.drivingInputs?.find((input) => input.sensor === "acceleration")?.values).toEqual([0, 0, 9.80665]);
    const magnetic = control.drivingInputs?.find((input) => input.sensor === "magnetic-field")?.values;
    expect(magnetic?.[0]).toBeCloseTo(-50);
    expect(magnetic?.[1]).toBeCloseTo(0);
    expect(androidSensorControl({ type: "SENSOR", kind: "MISSING", values: [] })).toBeNull();
    expect(androidSensorControl({ type: "SENSOR", kind: "CONFLICT", values: [0, 180] })).toBeNull();
    expect(androidSensorControl({ type: "SENSOR", kind: "BAROMETER", values: [200] })).toBeNull();
    expect(androidSensorControl({ type: "SENSOR", kind: "ORIENTATION", values: [0, 45, 0] })).toBeNull();
  });
  it("cannot accept a mismatched native frame or invent precision beyond the declared heading uncertainty", () => {
    const control = androidSensorControl({ type: "SENSOR", kind: "HEADING", values: [90, 10] })!;
    const frame = { id: "frame", observedAt: 1000, kind: "ORIENTATION", values: [60, 0, 0], accuracy: 45 };
    const evidence = {
      id: "frame",
      observedAt: "2026-10-03T00:00:00Z",
      kind: "HEADING" as const,
      degrees: 60,
      accuracyDegrees: 45,
      sessionId: "session",
      publishedVersionId: "pin",
      worldspaceId: "town",
    };
    expect(matchesAndroidSensorContext(control, frame, evidence)).toBe(true);
    expect(matchesAndroidSensorContext(control, { ...frame, accuracy: 5 }, evidence)).toBe(false);
    expect(matchesAndroidSensorContext(control, { ...frame, values: [0, 0, 0] }, evidence)).toBe(false);
    expect(matchesAndroidSensorContext(control, frame, { ...evidence, id: "foreign" })).toBe(false);
  });
  it("requires bounded exact readback before changing or restoring an OS fixture", () => {
    expect(readAndroidSensorValues("pressure", "pressure = 1013.25\r\nOK")).toEqual([1013.25]);
    expect(readAndroidSensorValues("magnetic-field", "magnetic-field = -50:3.06e-15:-45\nOK")).toEqual([
      -50, 3.06e-15, -45,
    ]);
    for (const output of [
      "pressure = NaN",
      "pressure = 1:2",
      "pressure = 1; command",
      "pressure = 100001",
      "pressure = 1e999",
    ])
      expect(() => readAndroidSensorValues("pressure", output)).toThrow("READBACK_INVALID");
  });
});
