import { loadDeviceLabRegistry, type DeviceLabTier } from "@/device-lab/registry";
import { DeviceLabScenarioPacks, type DeviceLabAdapter } from "@/device-lab/scenario-pack";
export const crossdeckPhase2Scenarios = ["crossdeck.surface-handoff", "crossdeck.phone-disconnect"] as const;
export function createCrossdeckPhase2Packs(
  tier: Extract<DeviceLabTier, "D0" | "D1" | "D2">,
  adapter: (id: (typeof crossdeckPhase2Scenarios)[number]) => DeviceLabAdapter,
) {
  const packs = new DeviceLabScenarioPacks(loadDeviceLabRegistry());
  packs.register({
    owner: "CROSSDECK",
    scenarios: crossdeckPhase2Scenarios.map((id) => ({
      definition: {
        scenarioId: id,
        version: 1,
        owner: "CROSSDECK",
        description:
          "Manual handoff, acknowledgment, continuity and disconnect recovery through canonical owner service",
        tiers: [tier],
        preferredProfiles: [tier === "D0" ? "synthetic" : tier === "D1" ? "chromium-mobile" : "android-emulator"],
        fixtures: ["crossdeck-phase2-owned-v1"],
        protectedContracts: ["crossdeck.phase2.continuity"],
        expectedArtifacts: [],
        timeoutMs: 240000,
        soundingLineTests: ["src/crossdeck/sync-service.test.ts"],
        requiredFutureGates: ["D4_REAL_HARDWARE", "D5_COLOCATED_FIELD", "OWNER_WALKTHROUGH"],
      },
      createAdapter: () => {
        const actual = adapter(id);
        return {
          execute: (context) => {
            if (context.tier !== tier) throw new Error("CROSSDECK_LAB_TIER_MISMATCH");
            return actual.execute(context);
          },
          cleanup: () => actual.cleanup(),
        };
      },
    })),
  });
  return packs;
}
