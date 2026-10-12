import { describe, it, expect } from "vitest";
import { createSpatialDraft } from "./authoring";
import {
  enableAdaptiveAuthoring,
  interpretPlacementPhrase,
  syntheticEnvironmentEvidence,
  updateAdaptiveContent,
} from "./adaptive-authoring";
import {
  resolveAdaptiveScene,
  resolutionIdentity,
  AdaptiveDecisionCache,
  evaluateCandidate,
  revalidateAdaptiveScene,
  minimizedResolutionReceipt,
} from "./adaptive";
import { composeTransform } from "./transforms";
import { identityTransform } from "./contracts";
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
  it("orients the authored face and relative offsets on arbitrary wall normals", () => {
    const recipe = {
      ...draft().content.adaptive!.recipes[0],
      preferredSurfaces: ["WALL" as const],
      alternateSurfaces: [],
      relativePlacement: "RIGHT" as const,
    };
    const candidate = {
      ...syntheticEnvironmentEvidence(room).candidates[0],
      surface: "WALL" as const,
      normal: { x: 1, y: 0, z: 0 },
    };
    const result = evaluateCandidate(recipe, candidate, 0.25, true);
    expect(result.accepted).toBe(true);
    const face = composeTransform(
      { ...identityTransform(), rotation: result.transform.rotation },
      { ...identityTransform(), position: { x: 0, y: 0, z: 1 } },
    ).position;
    expect(face.x).toBeCloseTo(1);
    expect(face.y).toBeCloseTo(0);
    expect(face.z).toBeCloseTo(0);
    expect(result.transform.position.x).toBeCloseTo(candidate.position.x + 0.01);
    expect(result.transform.position.z).toBeLessThan(candidate.position.z);
  });
  it("requires an actual viewer context for player-facing placement", () => {
    const recipe = { ...draft().content.adaptive!.recipes[0], orientation: "PLAYER_FACING" as const };
    const candidate = syntheticEnvironmentEvidence(room).candidates[0];
    expect(evaluateCandidate(recipe, candidate, 0.25, true).constraints).toContain("VIEWER_CONTEXT_REQUIRED");
    expect(evaluateCandidate(recipe, candidate, 0.25, true, { x: 4, y: 1, z: 2 }).accepted).toBe(true);
  });
  it("revalidates retained decisions without rerolling on unsafe evidence or changed frames", () => {
    const content = draft().content,
      evidence = syntheticEnvironmentEvidence(room);
    const prior = resolveAdaptiveScene(content, evidence, "seed");
    const candidateId = Object.values(prior.placements)[0].candidateId;
    expect(
      revalidateAdaptiveScene(content, { ...evidence, candidates: [...evidence.candidates].reverse() }, prior),
    ).toEqual(prior);
    for (const patch of [
      { safe: false },
      { reachMeters: 100 },
      { confidence: 0.1 },
      { visibility: 0 },
      { position: { x: 9, y: 0.75, z: 9 } },
      { normal: { x: 0, y: 0, z: 1 } },
    ]) {
      expect(
        revalidateAdaptiveScene(
          content,
          { ...evidence, candidates: evidence.candidates.map((c) => (c.id === candidateId ? { ...c, ...patch } : c)) },
          prior,
        ),
      ).toBeNull();
    }
    expect(revalidateAdaptiveScene(content, { ...evidence, frameId: "other-frame" }, prior)).toBeNull();
    const receipt = JSON.stringify(minimizedResolutionReceipt(prior));
    expect(receipt).not.toMatch(/candidateId|position|rotation|frameId|"confidence":|"score":|table-left/);
    expect(receipt).toContain("confidenceBand");
    expect(receipt).toContain("scoreBand");
    expect(receipt).toContain("NOT_ESTABLISHED");
  });
  it("invalidates calibrated claims before parsing revised semantic placement", () => {
    const d = draft();
    d.content.placementPolicy = "CALIBRATED";
    d.content.adaptive!.calibration = {
      ...d.content.adaptive!.calibration,
      maturity: "CALIBRATED",
      reviewReceiptId: "receipt",
    };
    const adaptive = structuredClone(d.content.adaptive!);
    adaptive.recipes[0].relativePlacement = "RIGHT";
    const next = updateAdaptiveContent(d, adaptive);
    expect(next.content.placementPolicy).toBe("ADAPTIVE_STICKY");
    expect(next.content.adaptive!.calibration.maturity).toBe("SEMANTIC");
    expect(next.content.adaptive!.calibration.reviewReceiptId).toBeUndefined();
  });
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
    // A fixed reference desk exists in every room; use room-dependent tables for this variation assertion.
    content.adaptive!.recipes[0].preferredSurfaces = ["TABLE"];
    content.adaptive!.recipes[0].alternateSurfaces = [];
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
  it("retains only bounded numeric elapsed time and ignores backwards samples", () => {
    const policy = draft().content.adaptive!.discovery[0];
    const assistance = new DiscoveryAssistance(policy, 4);
    assistance.updateActivity(active, 1000);
    assistance.tick(2000);
    assistance.tick(0);
    assistance.tick(2000);
    expect(assistance.read().meaningfulSeconds).toBe(5);
    expect(new DiscoveryAssistance(policy, 999999).read().meaningfulSeconds).toBe(90);
    expect(new DiscoveryAssistance(policy, Number.NaN).read().meaningfulSeconds).toBe(0);
  });
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
