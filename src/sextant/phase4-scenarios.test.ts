// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase4.native-context
import { expect, it } from "vitest";
import { createSextantPhase4ScenarioPacks, phase4ScenarioIds } from "./phase4-scenarios";
import { runDeviceLabScenario } from "@/device-lab/runner";
import { loadDeviceLabRegistry } from "@/device-lab/registry";
for (const suffix of phase4ScenarioIds)
  it(`${suffix}: coherent input has truthful D0 receipt and retained physical gates`, async () => {
    const id = `sextant.${suffix}`,
      packs = createSextantPhase4ScenarioPacks();
    const context = {
      source: { sourceSha: "a".repeat(40), sourceTree: "b".repeat(40), sourceFingerprint: "c".repeat(64), dirty: true },
      baseSha: "d".repeat(40),
      tier: "D0" as const,
      profile: "synthetic",
      hostOs: "test",
      runtimeVersion: process.version,
      capabilitySnapshot: loadDeviceLabRegistry().scenarios.find((s) => s.scenarioId === id)!.requiredCapabilities,
    };
    const receipt = await runDeviceLabScenario(packs, id, context);
    expect(receipt.assertions, JSON.stringify(receipt)).toEqual([{ id: `sextant.phase4.${suffix}`, state: "PASS" }]);
    expect(receipt.passFailDisposition).toBe("PASS");
    expect(receipt.evidenceClass).toBe("PROVIDER_SIMULATION_PROVEN");
    expect(receipt.cleanupReceipt.remainingResources).toEqual([]);
    expect(receipt.requiredFutureGates).toContain("D4_CORE_NATIVE_BRINGUP_REQUIRED");
    for (const tier of ["D2", "D3", "D4", "D5"] as const)
      expect((await runDeviceLabScenario(packs, id, { ...context, tier })).passFailDisposition).toBe("UNSUPPORTED");
  });
