import { DeviceLabScenarioPacks } from "@/device-lab/scenario-pack";
import { loadDeviceLabRegistry } from "@/device-lab/registry";
import { createSpatialDraft } from "./authoring";
import { enableAdaptiveAuthoring, interpretPlacementPhrase, syntheticEnvironmentEvidence } from "./adaptive-authoring";
import { resolveAdaptiveScene, resolutionIdentity, AdaptiveDecisionCache } from "./adaptive";
import { simulationEnvironments } from "./studio-validation";
import { DiscoveryAssistance } from "./discovery";
import { automaticCalibrationImageEligibility, fieldContributionSchema } from "./field-contracts";
import { materializeLibraryMoment } from "./library-service";
import { ParallaxLensRuntime } from "./runtime";
import { SyntheticSpatialAdapter } from "./synthetic";
import { syntheticBinding, guidedContext } from "./fixtures";
import { validateSpatialMoment } from "./publication";
export const parallaxPhase3ScenarioIds = [
  "adaptive-floor-map",
  "adaptive-per-run-variation",
  "phase3-image-upload-disabled",
  "discovery-hint-escalation",
  "phase3-determinism",
  "phase3-scoped-stability",
  "phase3-multi-room",
  "phase3-no-surface",
  "phase3-unsafe-candidate",
  "phase3-scene-conflict",
  "phase3-low-confidence",
  "phase3-tracking-interruption",
  "phase3-permission-denial",
  "phase3-background-resume",
  "phase3-long-search",
  "phase3-accessible-direct",
  "phase3-consent-decline",
  "phase3-stale-version",
] as const;
export function createParallaxPhase3ScenarioPacks() {
  const packs = new DeviceLabScenarioPacks(loadDeviceLabRegistry());
  packs.register({
    owner: "PARALLAX",
    scenarios: parallaxPhase3ScenarioIds.map((suffix) => ({
      definition: {
        scenarioId: `parallax.${suffix}`,
        version: 1,
        owner: "PARALLAX",
        description: `Phase 3 executable ${suffix} contract; synthetic evidence only`,
        tiers: ["D0"],
        preferredProfiles: ["synthetic"],
        fixtures: ["parallax-phase3-portable-room-v1"],
        protectedContracts: [`parallax.phase3.${suffix}`],
        expectedArtifacts: [],
        timeoutMs: 5000,
        soundingLineTests: ["src/parallax/phase3-device-lab.test.ts"],
        requiredFutureGates: [
          "D4_REAL_HARDWARE_AR_REQUIRED",
          "D5_PHYSICAL_FIELD_REQUIRED",
          "OWNER_VISUAL_ACCEPTANCE_REQUIRED",
        ],
      },
      createAdapter: () => {
        let runtime: ParallaxLensRuntime | null = null;
        const adapter = new SyntheticSpatialAdapter(undefined, syntheticEnvironmentEvidence(simulationEnvironments[0]));
        const check = (value: unknown) => {
          if (!value) throw new Error(`PARALLAX_PHASE3_D0_${suffix}_FAILED`);
        };
        return {
          async execute({ signal }) {
            if (signal.aborted) throw new Error("PARALLAX_D0_ABORTED");
            const draft = enableAdaptiveAuthoring(createSpatialDraft("portable-room"));
            const a = draft.content.adaptive!,
              evidence = syntheticEnvironmentEvidence(simulationEnvironments[0]);
            const resolve = (env = evidence, seed = "stable") => resolveAdaptiveScene(draft.content, env, seed);
            if (suffix === "adaptive-floor-map") {
              const p = interpretPlacementPhrase(
                "Place a map on the floor near furniture away from the walkway",
                a.recipes[0].entityId,
              );
              check(p.status === "PROPOSED");
              if (p.status === "PROPOSED") a.recipes[0] = p.recipe;
              check(Object.values(resolve().placements)[0]?.surface === "FLOOR");
            } else if (suffix === "adaptive-per-run-variation") {
              a.variation = "VALID_ALTERNATIVES";
              check(
                new Set(
                  Array.from(
                    { length: 32 },
                    (_, i) => Object.values(resolve(evidence, `run-${i}`).placements)[0]?.candidateId,
                  ),
                ).size > 1,
              );
            } else if (suffix === "phase3-determinism") {
              check(
                JSON.stringify(resolve()) ===
                  JSON.stringify(resolve({ ...evidence, candidates: [...evidence.candidates].reverse() })),
              );
            } else if (suffix === "phase3-scoped-stability") {
              const cache = new AdaptiveDecisionCache();
              const scope = {
                definitionId: "d",
                versionId: "v",
                versionChecksum: "a".repeat(64),
                crewId: "crew",
                actorId: "p",
                runId: "r",
                lifecycleId: "l",
                variant: 0,
              };
              const key = resolutionIdentity("ADAPTIVE_PER_CREW", scope).logicalIdentity;
              const first = cache.resolve(key, () => resolve());
              check(
                JSON.stringify(first) ===
                  JSON.stringify(
                    cache.resolve(key, () => {
                      throw new Error("REROLL");
                    }),
                  ),
              );
              check(key === resolutionIdentity("ADAPTIVE_PER_CREW", { ...scope, actorId: "other" }).logicalIdentity);
            } else if (suffix === "phase3-multi-room") {
              check(
                JSON.stringify(resolve().placements) !==
                  JSON.stringify(resolve(syntheticEnvironmentEvidence(simulationEnvironments[1])).placements),
              );
            } else if (["phase3-no-surface", "phase3-unsafe-candidate", "phase3-low-confidence"].includes(suffix)) {
              check(
                resolve({
                  ...evidence,
                  candidates:
                    suffix === "phase3-no-surface"
                      ? []
                      : evidence.candidates.map((c) => ({
                          ...c,
                          ...(suffix === "phase3-unsafe-candidate" ? { safe: false } : { confidence: 0.2 }),
                        })),
                }).status === "GUIDED_FALLBACK",
              );
            } else if (suffix === "phase3-scene-conflict") {
              const e = { ...draft.content.entities[0], id: "journal", anchorId: "journal-anchor" };
              draft.content.entities.push(e);
              a.recipes.push({ ...a.recipes[0], entityId: e.id });
              a.relationships.push({
                entityId: e.id,
                otherEntityId: draft.content.entities[0].id,
                minimumSeparationMeters: 10,
                maximumSeparationMeters: 20,
                sameSurface: false,
                sightlineRequired: true,
                visibility: "SIMULTANEOUS",
              });
              check(resolve().status === "GUIDED_FALLBACK");
            } else if (suffix === "phase3-image-upload-disabled") {
              for (const person of ["PRESENT", "UNKNOWN", "ABSENT"] as const)
                check(
                  automaticCalibrationImageEligibility({ person, face: "ABSENT", consent: true }).transferBytes === 0,
                );
            } else if (suffix === "phase3-consent-decline") {
              check(!fieldContributionSchema.safeParse({ consent: false }).success);
            } else if (
              ["discovery-hint-escalation", "phase3-background-resume", "phase3-long-search"].includes(suffix)
            ) {
              const timer = new DiscoveryAssistance(a.discovery[0]);
              timer.updateActivity(
                {
                  foreground: true,
                  unlocked: true,
                  tracking: true,
                  permission: true,
                  lensOpen: true,
                  inSearchRegion: true,
                },
                0,
              );
              if (suffix === "phase3-background-resume") {
                timer.tick(1000);
                timer.updateActivity({ foreground: false }, 1000);
                timer.tick(60000);
                check(timer.read().meaningfulSeconds === 1);
                timer.updateActivity({ foreground: true }, 60000);
                timer.tick(61000);
                check(timer.read().meaningfulSeconds === 2);
              } else {
                for (let t = 1000; t <= 90000; t += 1000) timer.tick(t);
                check(timer.read().stage === 3 && timer.read().recovery === "GUIDED");
              }
            } else {
              const moment = materializeLibraryMoment(draft, "creator", 1);
              moment.attachment.storyMomentId = syntheticBinding.blockId;
              if (suffix === "phase3-stale-version") {
                moment.version.entities[0].content = "tampered";
                let rejected = false;
                try {
                  validateSpatialMoment(moment);
                } catch {
                  rejected = true;
                }
                check(rejected);
              } else {
                runtime = new ParallaxLensRuntime(moment, syntheticBinding, {
                  ...guidedContext(),
                  environment: "DEVICE_LAB",
                });
                await runtime.open(suffix === "phase3-permission-denial" ? undefined : adapter);
                if (suffix === "phase3-tracking-interruption") {
                  const decision = runtime.read().resolution?.seed;
                  adapter.push({ type: "TRACKING", state: "LOST" });
                  for (let turn = 0; turn < 20 && runtime.read().state !== "GUIDED_FALLBACK"; turn++)
                    await Promise.resolve();
                  check(runtime.read().state === "GUIDED_FALLBACK");
                  check(runtime.read().resolution?.seed === decision);
                } else {
                  await runtime.reveal();
                  check(runtime.read().mode === "GUIDED");
                  check(runtime.read().visibleEntityIds.length > 0);
                }
              }
            }
            return {
              assertions: [{ id: `parallax.phase3.${suffix}`, state: "PASS" as const }],
              unsupportedCapabilities: [],
              artifacts: [],
            };
          },
          async cleanup() {
            await runtime?.close();
            await adapter.stop();
            return {
              result: "PASS" as const,
              ownedResources: ["parallax-phase3-synthetic-runtime"],
              remainingResources: [],
            };
          },
        };
      },
    })),
  });
  return packs;
}
