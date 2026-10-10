import { DeviceLabScenarioPacks } from "@/device-lab/scenario-pack";
import { loadDeviceLabRegistry } from "@/device-lab/registry";
import { syntheticSpatialMoment, syntheticBinding, guidedContext } from "./fixtures";
import { ParallaxLensRuntime } from "./runtime";
import { SyntheticSpatialAdapter } from "./synthetic";
import { identityTransform } from "./contracts";
import { materializeSpatialVersion, validateSpatialMoment } from "./publication";
import { evaluateSpatialEvidence } from "./evidence";
export const parallaxPhase1ScenarioIds = [
  "local-frame",
  "surface-placement",
  "fixed-worldspace-fallback",
  "tracking-recovery",
  "guided-fallback",
  "receipt-isolation",
  "version-pin",
  "native-unavailable",
] as const;
export function createParallaxPhase1ScenarioPacks() {
  const packs = new DeviceLabScenarioPacks(loadDeviceLabRegistry());
  packs.register({
    owner: "PARALLAX",
    scenarios: parallaxPhase1ScenarioIds.map((suffix) => ({
      definition: {
        scenarioId: `parallax.${suffix}`,
        version: 1,
        owner: "PARALLAX",
        description: `Phase 1 ${suffix} deterministic owner contract`,
        tiers: ["D0"],
        preferredProfiles: ["synthetic"],
        fixtures: ["parallax-phase1-published-moment-v1"],
        protectedContracts: [`parallax.phase1.${suffix}`],
        expectedArtifacts: [],
        timeoutMs: 5000,
        soundingLineTests: ["src/parallax/device-lab.test.ts"],
        requiredFutureGates: [
          "D3_NATIVE_IOS_BUILD_REQUIRED",
          "D4_REAL_HARDWARE_AR_REQUIRED",
          "OWNER_DEVICE_WALKTHROUGH_REQUIRED",
        ],
      },
      createAdapter: () => {
        const moment = syntheticSpatialMoment();
        const adapter = new SyntheticSpatialAdapter();
        let runtime: ParallaxLensRuntime | null = null;
        const check = (condition: boolean) => {
          if (!condition) throw new Error("PARALLAX_D0_ASSERTION_FAILED");
        };
        return {
          async execute({ signal }) {
            if (signal.aborted) throw new Error("PARALLAX_D0_ABORTED");
            if (suffix === "surface-placement" || suffix === "fixed-worldspace-fallback") {
              const { checksum: _checksum, ...v } = moment.version;
              void _checksum;
              v.anchors =
                suffix === "surface-placement"
                  ? [
                      {
                        id: "desk-anchor",
                        kind: "SURFACE_RELATIVE",
                        alignment: "HORIZONTAL",
                        frameId: "desk-frame",
                        transform: identityTransform(),
                      },
                    ]
                  : [
                      {
                        id: "desk-anchor",
                        kind: "FIXED_WORLDSPACE",
                        frameId: "town-frame",
                        worldspaceId: "town-world",
                        transform: identityTransform(),
                      },
                    ];
              v.entities[0].coordinateSpace = suffix === "surface-placement" ? "SURFACE_RELATIVE" : "WORLDSPACE";
              moment.version = materializeSpatialVersion(v);
              moment.attachment.versionChecksum = moment.version.checksum;
            }
            runtime = new ParallaxLensRuntime(moment, syntheticBinding, {
              ...guidedContext(),
              environment: "DEVICE_LAB",
            });
            await runtime.open(
              ["guided-fallback", "receipt-isolation", "native-unavailable"].includes(suffix) ? undefined : adapter,
            );
            if (suffix === "local-frame") check(runtime.read().anchors["desk-anchor"].transform.position.z === -1);
            if (suffix === "surface-placement")
              check((await runtime.interact("captains-note", "PLACE", "place-1")).anchorVersion === 2);
            if (["fixed-worldspace-fallback", "guided-fallback", "native-unavailable"].includes(suffix))
              check(runtime.read().mode === "GUIDED" && !adapter.active);
            if (suffix === "tracking-recovery") {
              const anchors = runtime.read().anchors;
              adapter.push({ type: "TRACKING", state: "LOST" });
              check(runtime.read().state === "DEGRADED");
              for (let i = 0; i < 3; i++) adapter.push({ type: "TRACKING", state: "NORMAL" });
              check(
                runtime.read().state === "READY" && JSON.stringify(anchors) === JSON.stringify(runtime.read().anchors),
              );
            }
            if (suffix === "receipt-isolation") {
              const r = await runtime.interact("captains-note", "INSPECT", "inspect-1");
              check(!evaluateSpatialEvidence(r, moment, syntheticBinding, new Date()).progressionChanged);
              let rejected = false;
              try {
                evaluateSpatialEvidence({ ...r, sessionId: "other" }, moment, syntheticBinding, new Date());
              } catch {
                rejected = true;
              }
              check(rejected);
            }
            if (suffix === "version-pin") {
              moment.version.entities[0].content = "Changed";
              let rejected = false;
              try {
                validateSpatialMoment(moment);
              } catch {
                rejected = true;
              }
              check(rejected);
            }
            return {
              assertions: [{ id: `parallax.phase1.${suffix}`, state: "PASS" as const }],
              unsupportedCapabilities: [],
              artifacts: [],
            };
          },
          async cleanup() {
            await runtime?.close();
            return {
              result: adapter.active ? ("FAIL" as const) : ("PASS" as const),
              ownedResources: ["parallax-synthetic-session"],
              remainingResources: adapter.active ? ["parallax-synthetic-session"] : [],
            };
          },
        };
      },
    })),
  });
  return packs;
}
