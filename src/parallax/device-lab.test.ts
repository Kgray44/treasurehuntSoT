import { it, expect } from "vitest";
import { createParallaxPhase1ScenarioPacks, parallaxPhase1ScenarioIds } from "./device-lab";
import { runDeviceLabScenario } from "@/device-lab/runner";
for (const suffix of parallaxPhase1ScenarioIds)
  it(`registers and executes ${suffix} through the shared D0 runner`, async () => {
    const receipt = await runDeviceLabScenario(createParallaxPhase1ScenarioPacks(), `parallax.${suffix}`, {
      source: { sourceSha: "a".repeat(40), sourceTree: "b".repeat(40), sourceFingerprint: "c".repeat(64), dirty: true },
      baseSha: "d".repeat(40),
      tier: "D0",
      profile: "synthetic",
      hostOs: "test",
      runtimeVersion: "node",
      capabilitySnapshot: ["spatial.entity", "spatial.anchor"],
    });
    expect(receipt.passFailDisposition).toBe("PASS");
    expect(JSON.stringify(receipt)).toContain("PROVIDER_SIMULATION_PROVEN");
  });
