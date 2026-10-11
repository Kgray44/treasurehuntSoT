import { DeviceLabScenarioPacks } from "@/device-lab/scenario-pack";
import { loadDeviceLabRegistry } from "@/device-lab/registry";

export const parallaxFieldScenarioIds = [
  "phase3-field-calibration",
  "phase3-concurrent-review",
  "person-free-calibration",
  "phase3-consent-withdrawal",
  "phase3-field-stale-version",
  "phase3-field-retry",
] as const;
export type ParallaxFieldScenario = (typeof parallaxFieldScenarioIds)[number];

/** D0 drivers exercise the real service with the test-owned persistence provider.
 * Browser journeys separately prove HTTP/SQLite behavior; neither certifies AR. */
export function createParallaxFieldScenarioPacks(
  exercises: Partial<Record<ParallaxFieldScenario, () => Promise<void> | void>>,
) {
  const packs = new DeviceLabScenarioPacks(loadDeviceLabRegistry());
  packs.register({
    owner: "PARALLAX",
    scenarios: parallaxFieldScenarioIds.flatMap((suffix) => {
      const exercise = exercises[suffix];
      if (!exercise) return [];
      return [
        {
          definition: {
            scenarioId: `parallax.${suffix}`,
            version: 1,
            owner: "PARALLAX",
            description: `Executable ${suffix} service/privacy contract with synthetic persistence; no physical certification`,
            tiers: ["D0"],
            preferredProfiles: ["synthetic-field-service"],
            fixtures: ["parallax-consented-metadata-v1"],
            protectedContracts: [`parallax.${suffix}`],
            expectedArtifacts: [],
            timeoutMs: 5000,
            soundingLineTests: ["src/parallax/field-service.test.ts"],
            requiredFutureGates: ["D4_REAL_HARDWARE_AR_REQUIRED", "D5_PHYSICAL_FIELD_REQUIRED"],
          },
          createAdapter: () => ({
            async execute({ signal }) {
              if (signal.aborted) throw new Error("PARALLAX_FIELD_D0_ABORTED");
              await exercise();
              return {
                assertions: [{ id: `parallax.${suffix}`, state: "PASS" as const }],
                unsupportedCapabilities: [],
                artifacts: [],
              };
            },
            async cleanup() {
              return {
                result: "PASS" as const,
                ownedResources: ["test-owned-field-service-provider"],
                remainingResources: [],
              };
            },
          }),
        },
      ];
    }),
  });
  return packs;
}
