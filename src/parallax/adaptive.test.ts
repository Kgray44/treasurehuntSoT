import { describe, it, expect } from "vitest";
import { createSpatialDraft } from "./authoring";
import { enableAdaptiveAuthoring, interpretPlacementPhrase, syntheticEnvironmentEvidence } from "./adaptive-authoring";
import { resolveAdaptiveScene, resolutionIdentity, AdaptiveDecisionCache } from "./adaptive";
import { simulationEnvironments } from "./studio-validation";
import { DiscoveryAssistance, type SearchActivity } from "./discovery";
import { versionContentSchema } from "./contracts";

const room = simulationEnvironments[0];
const draft = () => enableAdaptiveAuthoring(createSpatialDraft("adaptive-note"));
const scope = {
  definitionId: "d",
  versionId: "v1",
  versionChecksum: "a".repeat(64),
  crewId: "crew",
  runId: "run",
  actorId: "p",
  lifecycleId: "lifetime",
  variant: 0,
};
describe("adaptive semantic staging", () => {
  it("keeps all candidate permutations deterministic and rejects unsafe candidates first", () => {
    const content = draft().content,
      evidence = syntheticEnvironmentEvidence(room);
    const expected = resolveAdaptiveScene(content, evidence, "seed");
    expect(expected.status).toBe("RESOLVED");
    for (let i = 0; i < evidence.candidates.length; i++) {
      const candidates = [...evidence.candidates.slice(i), ...evidence.candidates.slice(0, i)].reverse();
      expect(resolveAdaptiveScene(content, { ...evidence, candidates }, "seed")).toEqual(expected);
    }
    expect(
      expected.diagnostics.some((d) => d.candidateId === "unsafe-walkway" && d.constraints.includes("UNSAFE_REGION")),
    ).toBe(true);
    expect(Object.values(expected.placements).every((p) => p.candidateId !== "unsafe-walkway")).toBe(true);
  });
  it("fails closed for absent, unsafe, unreachable and uncertain geometry", () => {
    const content = draft().content,
      evidence = syntheticEnvironmentEvidence(room);
    for (const candidates of [
      [],
      evidence.candidates.map((c) => ({ ...c, safe: false })),
      evidence.candidates.map((c) => ({ ...c, reachMeters: 10 })),
      evidence.candidates.map((c) => ({ ...c, confidence: 0.2 })),
    ]) {
      const result = resolveAdaptiveScene(content, { ...evidence, candidates }, "seed");
      expect(result.status).toBe("GUIDED_FALLBACK");
      expect(result.placements).toEqual({});
    }
  });
  it("varies among valid candidates across seeds and preserves scoped decisions", () => {
    const content = draft().content;
    content.adaptive!.variation = "VALID_ALTERNATIVES";
    const evidence = syntheticEnvironmentEvidence(room);
    const choices = new Set(
      Array.from(
        { length: 32 },
        (_, i) => Object.values(resolveAdaptiveScene(content, evidence, `seed-${i}`).placements)[0].candidateId,
      ),
    );
    expect(choices.size).toBeGreaterThan(1);
    const cache = new AdaptiveDecisionCache(),
      identity = resolutionIdentity("ADAPTIVE_PER_CREW", scope);
    const first = cache.resolve(identity.logicalIdentity, () => resolveAdaptiveScene(content, evidence, identity.seed));
    expect(
      cache.resolve(identity.logicalIdentity, () => {
        throw new Error("must not reroll");
      }),
    ).toEqual(first);
    expect(resolutionIdentity("ADAPTIVE_PER_CREW", { ...scope, actorId: "other", runId: "other" })).toEqual(identity);
    expect(resolutionIdentity("ADAPTIVE_PER_RUN", { ...scope, runId: "next" }).seed).not.toBe(
      resolutionIdentity("ADAPTIVE_PER_RUN", scope).seed,
    );
    expect(resolutionIdentity("ADAPTIVE_VARIANT", { ...scope, variant: 1 }).seed).not.toBe(
      resolutionIdentity("ADAPTIVE_VARIANT", scope).seed,
    );
  });
  it("changes geometry across rooms without fabricating physical qualification", () => {
    const content = draft().content;
    const results = simulationEnvironments.map((r) =>
      resolveAdaptiveScene(content, syntheticEnvironmentEvidence(r), "same"),
    );
    expect(results[0].placements).not.toEqual(results[1].placements);
    expect(results.some((r) => r.status === "GUIDED_FALLBACK")).toBe(true);
    expect(results.every((r) => r.physicalQualification === "NOT_ESTABLISHED")).toBe(true);
  });
  it("reports complete-scene relationship conflicts and honors hard search budgets", () => {
    const d = draft(),
      entity = structuredClone(d.content.entities[0]);
    entity.id = "journal";
    entity.anchorId = "journal-anchor";
    d.content.entities.push(entity);
    d.content.anchors.push({ ...d.content.anchors[0], id: entity.anchorId });
    const a = d.content.adaptive!;
    a.recipes.push({ ...a.recipes[0], entityId: entity.id });
    a.discovery.push({ ...a.discovery[0], entityId: entity.id });
    a.relationships.push({
      entityId: entity.id,
      otherEntityId: d.content.entities[0].id,
      minimumSeparationMeters: 10,
      maximumSeparationMeters: 20,
      sameSurface: false,
      sightlineRequired: true,
      visibility: "SIMULTANEOUS",
    });
    const result = resolveAdaptiveScene(d.content, syntheticEnvironmentEvidence(room), "seed");
    expect(result.status).toBe("GUIDED_FALLBACK");
    expect(result.diagnostics.some((d) => d.constraints.includes("SEPARATION_CONFLICT"))).toBe(true);
    expect(result.nodesVisited).toBeLessThanOrEqual(a.budget.maximumNodes);
  });
  it("rejects broken policy, discovery and maturity declarations", () => {
    const d = draft();
    d.content.placementPolicy = "ADAPTIVE_PER_RUN";
    expect(versionContentSchema.safeParse(d.content).success).toBe(false);
    d.content.placementPolicy = "ADAPTIVE_STICKY";
    d.content.adaptive!.discovery[0].maximumUnguidedSeconds = 0;
    expect(versionContentSchema.safeParse(d.content).success).toBe(false);
    d.content.adaptive!.discovery[0].maximumUnguidedSeconds = 90;
    d.content.adaptive!.calibration.maturity = "VERIFIED";
    expect(versionContentSchema.safeParse(d.content).success).toBe(false);
  });
  it("supports an honest reviewable phrase grammar and rejects unsupported interpretation", () => {
    const result = interpretPlacementPhrase(
      "Place a pirate map on the floor near furniture away from the walkway",
      "map",
    );
    expect(result.status).toBe("PROPOSED");
    if (result.status === "PROPOSED") {
      expect(result.recipe.preferredSurfaces).toEqual(["FLOOR"]);
      expect(result.recipe.forbiddenContext).toContain("WALKWAY");
    }
    expect(interpretPlacementPhrase("Make this spooky with invisible dragons", "map").status).toBe("UNSUPPORTED");
  });
});
describe("meaningful discovery time and terminal recovery", () => {
  const active: SearchActivity = {
    foreground: true,
    unlocked: true,
    tracking: true,
    permission: true,
    lensOpen: true,
    storyReading: false,
    inSearchRegion: true,
  };
  it.each(["foreground", "unlocked", "tracking", "permission", "lensOpen", "inSearchRegion"] as const)(
    "excludes %s interruption",
    (key) => {
      const assistance = new DiscoveryAssistance(draft().content.adaptive!.discovery[0]);
      assistance.updateActivity(active, 0);
      assistance.tick(1000);
      assistance.updateActivity({ [key]: false }, 1000);
      for (let t = 2000; t <= 60000; t += 1000) assistance.tick(t);
      expect(assistance.read().meaningfulSeconds).toBe(1);
      assistance.updateActivity({ [key]: true }, 60000);
      assistance.tick(61000);
      expect(assistance.read().meaningfulSeconds).toBe(2);
    },
  );
  it("excludes unrelated reading and escalates to exact recovery", () => {
    const assistance = new DiscoveryAssistance(draft().content.adaptive!.discovery[0]);
    assistance.updateActivity(active, 0);
    assistance.updateActivity({ storyReading: true }, 0);
    assistance.tick(30000);
    expect(assistance.read().meaningfulSeconds).toBe(0);
    assistance.updateActivity({ storyReading: false }, 30000);
    for (let t = 31000; t <= 150000; t += 1000) assistance.tick(t);
    expect(assistance.read()).toMatchObject({
      meaningfulSeconds: 90,
      stage: 3,
      exactRevealAvailable: true,
      recovery: "GUIDED",
    });
  });
  it("recognizes low-confidence prolonged search as possible system failure", () => {
    const assistance = new DiscoveryAssistance(draft().content.adaptive!.discovery[0]);
    assistance.updateActivity(active, 0);
    assistance.setConfidence(0.2);
    for (let t = 1000; t <= 30000; t += 1000) assistance.tick(t);
    expect(assistance.read()).toMatchObject({ systemFailure: true, recovery: "GUIDED" });
  });
});
