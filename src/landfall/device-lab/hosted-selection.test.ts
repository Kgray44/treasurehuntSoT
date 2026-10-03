import { describe, expect, it } from "vitest";
import { hostedDeviceLabProfiles, hostedDeviceLabScenarios } from "@/landfall/device-lab/hosted-selection";

describe("hosted Device Lab impact selection", () => {
  it("selects only affected profiles inside their governed tier", () => {
    expect(hostedDeviceLabProfiles("android", "closure", "tablet,low-resource")).toEqual(["low-resource", "tablet"]);
    expect(hostedDeviceLabProfiles("ios", "closure")).toEqual(["primary-phone", "compatibility-phone", "tablet"]);
    expect(hostedDeviceLabProfiles("android", "candidate")).toEqual(["primary-phone", "compatibility-phone"]);
    for (const selection of ["", "tablet,tablet", "tablet;echo", "unknown", "x".repeat(129)])
      expect(() => hostedDeviceLabProfiles("android", "closure", selection)).toThrow();
    expect(() => hostedDeviceLabProfiles("android", "development", "tablet")).toThrow();
    expect(() => hostedDeviceLabProfiles("ios", "closure", "low-resource")).toThrow();
  });
  it("retains the wider platform defaults and supports a focused canonical subset", () => {
    expect(hostedDeviceLabScenarios("android")).toContain("heading-turn");
    expect(hostedDeviceLabScenarios("ios")).toContain("offline-restart-canonical-reconcile");
    expect(hostedDeviceLabScenarios("provider")).toBe("all");
    expect(hostedDeviceLabScenarios("ios", "gps-perfect-walk")).toBe("gps-perfect-walk");
  });
  it("rejects shell text, unknown IDs, duplicates, oversized input and unsupported targets", () => {
    for (const value of [
      "",
      "gps-perfect-walk;echo",
      "$(secret)",
      "unknown",
      "gps-perfect-walk,gps-perfect-walk",
      "x".repeat(4097),
    ])
      expect(() => hostedDeviceLabScenarios("ios", value)).toThrow();
    expect(() => hostedDeviceLabScenarios("ios", "watchglass-physical-match")).toThrow(
      "LANDFALL_HOSTED_SCENARIO_TARGET_UNSUPPORTED",
    );
  });
});
