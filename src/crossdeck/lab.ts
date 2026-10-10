import { loadDeviceLabRegistry, type DeviceLabTier } from "@/device-lab/registry";
import { DeviceLabScenarioPacks, type DeviceLabAdapter } from "@/device-lab/scenario-pack";
export const crossdeckPhase1Scenarios = ["crossdeck.desktop-phone-pair", "crossdeck.phone-disconnect"] as const;
export type CrossdeckPhase1Scenario = (typeof crossdeckPhase1Scenarios)[number];
/** Shared Device Lab owns execution and receipts. Each adapter must exercise the real owner seam for its tier. */
export function createCrossdeckPhase1Packs(
  tier: Extract<DeviceLabTier, "D0" | "D1">,
  adapter: (id: CrossdeckPhase1Scenario) => DeviceLabAdapter,
) {
  const packs = new DeviceLabScenarioPacks(loadDeviceLabRegistry());
  packs.register({
    owner: "CROSSDECK",
    scenarios: crossdeckPhase1Scenarios.map((id) => ({
      definition: {
        scenarioId: id,
        version: 1,
        owner: "CROSSDECK",
        description: `Phase 1 ${id}: identity, secure pairing and presence only`,
        tiers: [tier],
        preferredProfiles: [tier === "D0" ? "synthetic" : "chromium-mobile"],
        fixtures: ["crossdeck-phase1-owned-v1"],
        protectedContracts: ["crossdeck.phase1.participation"],
        expectedArtifacts: [],
        timeoutMs: tier === "D0" ? 120_000 : 180_000,
        soundingLineTests: ["src/crossdeck/service.test.ts"],
        requiredFutureGates: ["D4_REAL_DEVICE_PAIRING", "D5_COLOCATED_FIELD_TRIAL", "PHASE2_SYNC_AND_HANDOFF"],
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
