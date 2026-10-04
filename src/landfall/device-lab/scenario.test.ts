import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deviceLabScenarioSchema,
  validateDeviceLabFidelity,
  type DeviceLabReceipt,
} from "@/landfall/device-lab/scenario";
import { landfallDeviceScenario, landfallDeviceScenarios } from "@/landfall/device-lab/scenarios";
import { LandfallProviderScenarioExecutor } from "@/landfall/device-lab/provider-executor";

describe("canonical Device Lab scenarios", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));
  it("has a stable permanent corpus with assertions, bounds, no executable commands and explicit physical gates", () => {
    const scenarios = landfallDeviceScenarios();
    expect(scenarios.length).toBeGreaterThan(80);
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(scenarios.length);
    scenarios.forEach((scenario) => expect(deviceLabScenarioSchema.safeParse(scenario).success).toBe(true));
    const malicious = { ...scenarios[0], command: "rm -rf /" };
    expect(deviceLabScenarioSchema.safeParse(malicious).success).toBe(false);
    const reversed = structuredClone(scenarios[0]);
    reversed.timeline.reverse();
    expect(deviceLabScenarioSchema.safeParse(reversed).success).toBe(false);
    expect(landfallDeviceScenario("compound-chaos").physicalRequired).toContain("SUSPENSION");
  });
  it("uses two distinct nearby physical route points for fresh native fixes in versioned arrival scenarios", () => {
    for (const id of [
      "gps-perfect-walk",
      "offline-native-canonical-reconcile",
      "offline-lost-response-canonical-reconcile",
      "offline-restart-canonical-reconcile",
    ]) {
      const scenario = landfallDeviceScenario(id);
      const locations = scenario.timeline.map((step) => step.action).filter((action) => action.type === "LOCATION");
      expect(scenario.version).toBe(id === "offline-restart-canonical-reconcile" ? 3 : 2);
      expect(scenario.publishedFixture).toBe(
        id === "offline-restart-canonical-reconcile" ? "landfall-device-lab-restart-v2" : "landfall-device-lab-v1",
      );
      expect(locations).toHaveLength(2);
      expect(locations[0].coordinate).not.toEqual(locations[1].coordinate);
      expect(locations[0].coordinate.worldspaceId).toBe(locations[1].coordinate.worldspaceId);
    }
  });
  it("keeps OS geofence delivery separate from provider callbacks and progression", async () => {
    const scenario = landfallDeviceScenario("geofence-native-background-wake");
    expect(scenario.targets).toEqual(["android-emulator", "ios-simulator"]);
    expect(scenario.version).toBe(2);
    expect(scenario.canonicalAuthority).toBe("ONE_VOYAGE");
    expect(scenario.timing).toBe("WALL_CLOCK");
    expect(scenario.timeline.some((step) => step.action.type === "GEOFENCE")).toBe(false);
    expect(
      scenario.timeline.filter((step) => step.action.type === "NATIVE_GEOFENCE").map((step) => step.action),
    ).toEqual([
      { type: "NATIVE_GEOFENCE", operation: "REGISTER" },
      { type: "NATIVE_GEOFENCE", operation: "ENTER" },
      { type: "NATIVE_GEOFENCE", operation: "CLEAR" },
    ]);
    // A logical executor cannot manufacture success for an OS-only command.
    const simulated = await new LandfallProviderScenarioExecutor(scenario).run();
    expect(simulated.steps.some((step) => step.action === "NATIVE_GEOFENCE" && step.state === "UNSUPPORTED")).toBe(
      true,
    );
  });
  for (const id of [
    "gps-perfect-walk",
    "gps-5-minute-walk",
    "gps-30-minute-walk",
    "virtual-player-navigation",
    "watchglass-physical-match",
    "watchglass-virtual-match",
    "watchglass-physical-wrong-scope",
    "watchglass-virtual-circular",
    "watchglass-physical-not-configured",
    "gps-noisy-walk",
    "gps-stale",
    "gps-impossible-jump",
    "permission-revoked-mid-route",
    "background-geofence-arrival",
    "geofence-duplicate",
    "notification-revoked",
    "battery-low",
    "network-flapping",
    "provider-rate-limit",
    "qr-valid",
    "qr-tampered",
    "nfc-replay",
    "sensor-conflict",
    "uwb-unsupported",
    "ble-weak",
  ])
    it(`executes ${id} through production contracts under logical time`, async () => {
      const result = await new LandfallProviderScenarioExecutor(landfallDeviceScenario(id)).run();
      expect(result.steps.filter((step) => step.state !== "PASS")).toEqual([]);
      expect(result.canonicalProgressionEvents).toBeNull();
      expect(result.cleanup).toMatchObject({ result: "PASS", remainingResources: [] });
    });
  it("cannot promote provider proof to a native-device proof or invent canonical events", () => {
    const receipt: DeviceLabReceipt = {
      version: 1,
      scenarioId: "gps-perfect-walk",
      scenarioVersion: 1,
      seed: 1,
      sourceSha: "a".repeat(40),
      sourceTree: "b".repeat(40),
      sourceFingerprint: "c".repeat(64),
      dirty: false,
      target: "provider-simulation",
      hostPlatform: "win32",
      environment: "logical",
      deviceProfile: "synthetic",
      osVersion: "Windows",
      runtimeVersion: "node",
      providerVersions: {},
      publishedFixture: "landfall-device-lab-v1",
      fixtureHash: "d".repeat(64),
      timing: "LOGICAL",
      toleranceMs: 0,
      startedAt: "2026-10-03T12:00:00Z",
      endedAt: "2026-10-03T12:00:01Z",
      evidenceClass: "PROVIDER_SIMULATION_PROVEN",
      result: "PASS",
      steps: [{ index: 0, action: "ASSERT", state: "PASS" }],
      canonicalProgressionEvents: null,
      artifacts: [],
      externalRequirements: [],
      cleanup: { result: "PASS", ownedResources: [], remainingResources: [] },
    };
    expect(() => validateDeviceLabFidelity(receipt)).not.toThrow();
    expect(() => validateDeviceLabFidelity({ ...receipt, evidenceClass: "EXECUTION_FAILED" })).toThrow(
      "FIDELITY_INVALID",
    );
    expect(() => validateDeviceLabFidelity({ ...receipt, evidenceClass: "REAL_DEVICE_PROVEN" })).toThrow(
      "FIDELITY_INVALID",
    );
    expect(() => validateDeviceLabFidelity({ ...receipt, canonicalProgressionEvents: 1 })).toThrow("ONE_VOYAGE");
    const native = {
      ...receipt,
      target: "android-emulator" as const,
      evidenceClass: "EMULATOR_PROVEN" as const,
      deviceProfile: "primary-phone",
    };
    expect(() => validateDeviceLabFidelity(native)).toThrow("CONFIGURATION_UNBOUND");
    const configuration = {
      platform: "ANDROID" as const,
      virtual: true as const,
      api: 35,
      model: "Synthetic",
      memoryKiB: 3 * 1024 * 1024,
      widthPixels: 1080,
      heightPixels: 2400,
      densityDpi: 420,
    };
    expect(() => validateDeviceLabFidelity({ ...native, deviceConfiguration: configuration })).toThrow(
      "PROFILE_MISMATCH",
    );
    expect(() =>
      validateDeviceLabFidelity({
        ...native,
        deviceProfile: "compatibility-phone",
        deviceConfiguration: configuration,
      }),
    ).not.toThrow();
    expect(() =>
      validateDeviceLabFidelity({ ...receipt, steps: [{ index: 0, action: "LOCATION", state: "UNSUPPORTED" }] }),
    ).toThrow("FIDELITY_INVALID");
  });
});
