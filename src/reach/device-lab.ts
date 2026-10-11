import { DeviceLabScenarioPacks } from "@/device-lab/scenario-pack";
import { loadDeviceLabRegistry } from "@/device-lab/registry";
import { phase1ScenarioIds, runPhase1Oracle } from "./foundation-scenarios";
export function createReachPhase1ScenarioPacks() {
  const packs = new DeviceLabScenarioPacks(loadDeviceLabRegistry());
  packs.register({
    owner: "REACH",
    scenarios: phase1ScenarioIds.map((suffix) => ({
      definition: {
        scenarioId: `reach.${suffix}`,
        version: 1,
        owner: "REACH",
        description: `Phase 1 deterministic ${suffix}; no physical accuracy claim`,
        tiers: ["D0"],
        preferredProfiles: ["synthetic"],
        fixtures: ["reach-index-axis-v1"],
        protectedContracts: [`reach.phase1.${suffix}`],
        expectedArtifacts: [],
        timeoutMs: 5000,
        soundingLineTests: ["src/reach/foundation.test.ts", "src/reach/device-lab.test.ts"],
        requiredFutureGates: [
          "D1_BROWSER_RUNTIME_REQUIRED",
          "D4_LIVE_WEBCAM_AND_INDEPENDENT_CALIBRATION_REQUIRED",
          "D5_FIELD_QUALIFICATION_REQUIRED",
        ],
      },
      createAdapter: () => ({
        async execute({ signal }) {
          if (signal.aborted) throw new Error("REACH_D0_ABORTED");
          await runPhase1Oracle(suffix);
          return {
            assertions: [{ id: `reach.phase1.${suffix}`, state: "PASS" as const }],
            unsupportedCapabilities: [],
            artifacts: [],
          };
        },
        async cleanup() {
          return { result: "PASS" as const, ownedResources: [], remainingResources: [] };
        },
      }),
    })),
  });
  return packs;
}
