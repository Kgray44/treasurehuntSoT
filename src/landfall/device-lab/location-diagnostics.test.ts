import { describe, expect, it } from "vitest";
import {
  DeviceLabLocationDiagnostics,
  deviceLabLocationDiagnosticSchema,
} from "@/landfall/device-lab/location-diagnostics";
import { landfallDeviceScenario } from "@/landfall/device-lab/scenarios";
import type { DeviceLabAction } from "@/landfall/device-lab/scenario";

describe("redacted native location diagnostics", () => {
  it("retains bounded Core Location pause and delivery categories without raw fix data", () => {
    const action = landfallDeviceScenario("gps-perfect-walk").timeline[0].action as Extract<
      DeviceLabAction,
      { type: "LOCATION" }
    >;
    const diagnostics = new DeviceLabLocationDiagnostics(action);
    const acquisition = {
      provider: "core-location",
      registered: true,
      enabled: true,
      permission: "GRANTED",
      nativeCallbacks: 12,
      forwardedCallbacks: 1,
      foreground: true,
      paused: true,
      intervalMs: 15000,
      failure: "NONE",
    };
    diagnostics.observeAcquisition(acquisition);
    expect(diagnostics.snapshot(0).acquisition).toEqual(acquisition);
    const empty = new DeviceLabLocationDiagnostics(action);
    for (const unsafe of [
      { ...acquisition, latitude: 44 },
      { ...acquisition, intervalMs: 0 },
      { ...acquisition, forwardedCallbacks: -1 },
      { ...acquisition, failure: "private error body" },
    ])
      empty.observeAcquisition(unsafe);
    expect(empty.snapshot(0).acquisition).toBeUndefined();
    expect(JSON.stringify(diagnostics.snapshot(0))).not.toMatch(/latitude|longitude|timestamp|private/);
  });
  it("distinguishes delivery, malformed fixes, stale clocks, wrong bounds and accuracy without retaining locations", () => {
    const action = landfallDeviceScenario("gps-perfect-walk").timeline[0].action as Extract<
      DeviceLabAction,
      { type: "LOCATION" }
    >;
    let elapsed = 50;
    const diagnostics = new DeviceLabLocationDiagnostics(
      action,
      () => 100000,
      () => elapsed,
    );
    const fix = { id: "private-id", timestamp: 100000, latitude: 44, longitude: -72, accuracyMeters: 8 };
    diagnostics.observe({ ...fix, latitude: NaN });
    diagnostics.observe({ ...fix, timestamp: 0 });
    diagnostics.observe({ ...fix, timestamp: 102000 });
    diagnostics.observe({ ...fix, latitude: 45 });
    diagnostics.observe({ ...fix, accuracyMeters: 9 });
    expect(diagnostics.snapshot(0).firstQualifiedFixElapsedMs).toBeNull();
    elapsed = 150;
    diagnostics.observe(fix);
    elapsed = 250;
    diagnostics.observe(fix);
    expect(diagnostics.snapshot(1)).toEqual({
      received: 7,
      invalid: 1,
      stale: 1,
      future: 1,
      outOfBounds: 1,
      insufficientAccuracy: 1,
      withinRequestedBounds: 2,
      canonicalObservations: 1,
      firstQualifiedFixElapsedMs: 100,
    });
    expect(JSON.stringify(diagnostics.snapshot(1))).not.toMatch(/private-id|latitude|longitude|timestamp/);
  });
  it("rejects raw extensions and negative or unbounded counters", () => {
    const empty = {
      received: 0,
      invalid: 0,
      stale: 0,
      future: 0,
      outOfBounds: 0,
      insufficientAccuracy: 0,
      withinRequestedBounds: 0,
      canonicalObservations: 0,
      firstQualifiedFixElapsedMs: null,
    };
    expect(() => deviceLabLocationDiagnosticSchema.parse({ ...empty, latitude: 44 })).toThrow();
    expect(() => deviceLabLocationDiagnosticSchema.parse({ ...empty, received: -1 })).toThrow();
    expect(() => deviceLabLocationDiagnosticSchema.parse({ ...empty, received: 100001 })).toThrow();
  });
  it("keeps only bounded native acquisition categories and ignores unsupported or raw replies", () => {
    const action = landfallDeviceScenario("gps-perfect-walk").timeline[0].action as Extract<
      DeviceLabAction,
      { type: "LOCATION" }
    >;
    const diagnostics = new DeviceLabLocationDiagnostics(action);
    diagnostics.observeAcquisition({ state: "UNSUPPORTED" });
    expect(diagnostics.snapshot(0).acquisition).toBeUndefined();
    diagnostics.observeAcquisition({
      provider: "gps",
      registered: true,
      enabled: true,
      permission: "GRANTED",
      latitude: 44,
    });
    expect(diagnostics.snapshot(0).acquisition).toBeUndefined();
    const acquisition = {
      provider: "network",
      registered: true,
      enabled: false,
      permission: "APPROXIMATE",
      nativeCallbacks: 2,
    };
    diagnostics.observeAcquisition(acquisition);
    expect(diagnostics.snapshot(0).acquisition).toEqual(acquisition);
  });
});
