// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { expect, it } from "vitest";
import { createReachPhase1ScenarioPacks } from "./device-lab";
import { runDeviceLabScenario } from "@/device-lab/runner";
import { phase1ScenarioIds } from "./foundation-scenarios";
it("registers seven Phase 1 owner oracles, retains ten future scenarios and never promotes D0 to physical proof", async () => {
  const packs = createReachPhase1ScenarioPacks();
  expect(
    packs.status().filter((s) => s.scenarioId.startsWith("reach.") && s.state === "EXECUTABLE_REGISTERED"),
  ).toHaveLength(7);
  expect(() => packs.resolve("reach.rotation-and-constraints")).toThrow("NOT_IMPLEMENTED");
  for (const suffix of phase1ScenarioIds) {
    const entry = packs.resolve(`reach.${suffix}`);
    const receipt = await runDeviceLabScenario(packs, entry.definition.scenarioId, {
      source: {
        sourceSha: "a".repeat(40),
        sourceTree: "b".repeat(40),
        sourceFingerprint: "c".repeat(64),
        dirty: false,
      },
      baseSha: "d".repeat(40),
      tier: "D0",
      profile: "synthetic",
      hostOs: "test",
      runtimeVersion: "test",
      capabilitySnapshot: entry.declaration.requiredCapabilities,
    });
    expect(receipt.passFailDisposition).toBe("PASS");
    expect(JSON.stringify(receipt)).toContain("PROVIDER_SIMULATION_PROVEN");
    expect(JSON.stringify(receipt)).toContain("D4_LIVE_WEBCAM_AND_INDEPENDENT_CALIBRATION_REQUIRED");
  }
});
