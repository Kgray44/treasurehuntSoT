// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase1.foundation
import { describe, it, expect } from "vitest";
import { createSextantPhase1ScenarioPacks, phase1ScenarioIds } from "./foundation-scenarios";
import { runDeviceLabScenario } from "@/device-lab/runner";
import { loadDeviceLabRegistry } from "@/device-lab/registry";
describe("Sextant Phase 1 real D0 executable contracts", () => {
  for (const suffix of phase1ScenarioIds)
    it(suffix, async () => {
      const id = `sextant.${suffix}`,
        declaration = loadDeviceLabRegistry().scenarios.find((s) => s.scenarioId === id)!;
      const receipt = await runDeviceLabScenario(createSextantPhase1ScenarioPacks(), id, {
        source: {
          sourceSha: "a".repeat(40),
          sourceTree: "b".repeat(40),
          sourceFingerprint: "c".repeat(64),
          dirty: false,
        },
        baseSha: "d".repeat(40),
        tier: "D0",
        profile: "synthetic",
        hostOs: "vitest",
        runtimeVersion: "node",
        capabilitySnapshot: declaration.requiredCapabilities,
      });
      expect(receipt.passFailDisposition).toBe("PASS");
      expect(receipt.evidenceClass).toBe("PROVIDER_SIMULATION_PROVEN");
      expect(receipt.cleanupReceipt.remainingResources).toEqual([]);
    });
  it("registers only the nine Phase 1 hooks; later magnetic/gesture scenarios remain declarations", () => {
    const packs = createSextantPhase1ScenarioPacks();
    expect(packs.status().filter((s) => s.state === "EXECUTABLE_REGISTERED")).toHaveLength(9);
    expect(() => packs.resolve("sextant.magnetic-hidden-object")).toThrow("DEVICE_LAB_NOT_IMPLEMENTED");
  });
});
