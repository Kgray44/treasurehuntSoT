import { it, expect } from "vitest";
import { runDeviceLabScenario } from "@/device-lab/runner";
import { createParallaxPhase3ScenarioPacks, parallaxPhase3ScenarioIds } from "./phase3-device-lab";
import { loadDeviceLabRegistry } from "@/device-lab/registry";
for (const suffix of parallaxPhase3ScenarioIds)
  it(`executes Phase 3 ${suffix} under shared Device Lab authority`, async () => {
    const receipt = await runDeviceLabScenario(createParallaxPhase3ScenarioPacks(), `parallax.${suffix}`, {
      source: { sourceSha: "a".repeat(40), sourceTree: "b".repeat(40), sourceFingerprint: "c".repeat(64), dirty: true },
      baseSha: "d".repeat(40),
      tier: "D0",
      profile: "synthetic",
      hostOs: "test",
      runtimeVersion: "node",
      capabilitySnapshot: loadDeviceLabRegistry().scenarios.find((s) => s.scenarioId === `parallax.${suffix}`)!
        .requiredCapabilities,
    });
    expect(receipt.passFailDisposition).toBe("PASS");
    expect(JSON.stringify(receipt)).toContain("PROVIDER_SIMULATION_PROVEN");
  });
