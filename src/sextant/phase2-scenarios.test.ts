// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase2.web-context
import { it, expect } from "vitest";
import { createSextantPhase2ScenarioPacks, phase2ScenarioTiers } from "./phase2-scenarios";
import { runDeviceLabScenario } from "@/device-lab/runner";
import { loadDeviceLabRegistry } from "@/device-lab/registry";
for (const [suffix, tier] of Object.entries(phase2ScenarioTiers)) {
  it(`executes ${suffix} at ${tier}, with truthful evidence and owned cleanup`, async () => {
    const id = `sextant.${suffix}`,
      packs = createSextantPhase2ScenarioPacks();
    const context = {
      source: { sourceSha: "a".repeat(40), sourceTree: "b".repeat(40), sourceFingerprint: "c".repeat(64), dirty: true },
      baseSha: "d".repeat(40),
      tier,
      profile: tier === "D0" ? "synthetic" : "browser-api-emulation",
      hostOs: "test",
      runtimeVersion: process.version,
      capabilitySnapshot: loadDeviceLabRegistry().scenarios.find((e) => e.scenarioId === id)!.requiredCapabilities,
    };
    const receipt = await runDeviceLabScenario(packs, id, context);
    expect(receipt.passFailDisposition).toBe("PASS");
    expect(receipt.cleanupReceipt.result).toBe("PASS");
    expect(receipt.cleanupReceipt.remainingResources).toEqual([]);
    expect(receipt.evidenceClass).toBe(tier === "D0" ? "PROVIDER_SIMULATION_PROVEN" : "BROWSER_EMULATION_PROVEN");
    const forbidden = await runDeviceLabScenario(packs, id, { ...context, tier: "D4" });
    expect(forbidden.passFailDisposition).toBe("UNSUPPORTED");
  });
}
