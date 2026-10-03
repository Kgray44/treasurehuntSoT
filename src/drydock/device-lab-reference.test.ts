import { describe, expect, it } from "vitest";
import { drydockDeviceLabReference } from "@/drydock/device-lab-reference";

const reference = {
  kind: "LANDFALL_DEVICE_LAB_REFERENCE",
  sourceChecksum: "a".repeat(64),
  receiptChecksum: "b".repeat(64),
  sourceSha: "c".repeat(40),
  sourceTree: "d".repeat(40),
  fixtureHash: "e".repeat(64),
  scenarioId: "gps-perfect-walk",
  scenarioVersion: 2,
  target: "provider-simulation",
  deviceProfile: "primary-phone",
  providerFamily: "LOCATION",
  evidenceClass: "PROVIDER_SIMULATION_PROVEN",
  result: "PASS",
};
describe("Drydock Device Lab references", () => {
  it("preserves separate Chronicle, code, fixture and receipt bindings without accepting a synthetic pass as launch proof", () => {
    const evidence = drydockDeviceLabReference(reference);
    expect(evidence.expectedSourceChecksum).toBe(reference.sourceChecksum);
    expect(evidence.providerVersion).toBe(reference.sourceSha);
    expect(evidence.sourceReference).toContain(reference.receiptChecksum);
    expect(evidence.sourceReference).toContain(reference.sourceTree);
    expect(evidence.safeSummary).toContain(reference.fixtureHash);
    expect(evidence.safeSummary).toContain("PROVIDER_SIMULATION_PROVEN/PASS");
    expect(evidence.status).toBe("EXTERNAL_VALIDATION_REQUIRED");
    expect(drydockDeviceLabReference({ ...reference, result: "FAIL" }).status).toBe("UNAVAILABLE");
  });
  it("rejects stale scenarios, wrong capabilities, forged fidelity and raw/private payload extensions", () => {
    for (const changes of [
      { scenarioVersion: 1 },
      { providerFamily: "UWB" },
      { evidenceClass: "FIELD_PROVEN" },
      { sourceChecksum: "missing" },
      { latitude: 44 },
      { logs: "private" },
    ])
      expect(() => drydockDeviceLabReference({ ...reference, ...changes })).toThrow();
  });
});
