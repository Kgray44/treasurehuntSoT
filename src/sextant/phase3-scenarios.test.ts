// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase3.field-context
import { it, expect } from "vitest";
import { createSextantPhase3ScenarioPacks, phase3ScenarioTiers } from "./phase3-scenarios";
import { runDeviceLabScenario } from "@/device-lab/runner";
import { loadDeviceLabRegistry } from "@/device-lab/registry";
for (const [suffix, tier] of Object.entries(phase3ScenarioTiers))
  it(`${suffix} produces ${tier} proof with clean cleanup and retained physical gates`, async () => {
    const id = `sextant.${suffix}`,
      packs = createSextantPhase3ScenarioPacks();
    const context = {
      source: { sourceSha: "a".repeat(40), sourceTree: "b".repeat(40), sourceFingerprint: "c".repeat(64), dirty: true },
      baseSha: "d".repeat(40),
      tier,
      profile: tier === "D0" ? "synthetic" : "browser-api-emulation",
      hostOs: "test",
      runtimeVersion: process.version,
      capabilitySnapshot: loadDeviceLabRegistry().scenarios.find((s) => s.scenarioId === id)!.requiredCapabilities,
    };
    const receipt = await runDeviceLabScenario(packs, id, context);
    expect(receipt.passFailDisposition).toBe("PASS");
    expect(receipt.cleanupReceipt.remainingResources).toEqual([]);
    expect(receipt.evidenceClass).toBe(tier === "D0" ? "PROVIDER_SIMULATION_PROVEN" : "BROWSER_EMULATION_PROVEN");
    for (const forbidden of ["D2", "D4", "D5"] as const)
      expect((await runDeviceLabScenario(packs, id, { ...context, tier: forbidden })).passFailDisposition).toBe(
        "UNSUPPORTED",
      );
  });
