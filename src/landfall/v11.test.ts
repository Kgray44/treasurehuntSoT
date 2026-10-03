import { createHash } from "node:crypto";
import { playerLandfallEvidenceSchema } from "@/landfall/player-evidence-contract";
import { landfallAuthoringFindings } from "@/landfall/authoring";
import { describe, expect, it, vi } from "vitest";
import { landfallFixture, physicalObservation, virtualCoordinate, virtualObservation } from "@/landfall/fixtures";
import { validateLandfallDefinition } from "@/landfall/definition";
import { LandfallProviderRegistry, type LandfallObservation } from "@/landfall/observation";
import { LandfallRuntime } from "@/landfall/runtime";
import { ContextualLandfallEngine } from "@/landfall/contextual";
import { projectLandfallJourney } from "@/landfall/journey-projection";
import { qualifyPlayerLandfallEvidence, type PlayerLandfallEvidence } from "@/landfall/server-evidence";
import { landmarkDefinitionHash } from "@/landfall/landmark-receipt";
import {
  readWatchglassHandoff,
  type WatchglassEvidenceProvider,
  type WatchglassTarget,
} from "@/landfall/watchglass-handoff";

const identity = { sessionId: "session-1", publishedVersionId: "version-1" };
const base = Date.parse("2026-10-01T10:00:00Z");
const at = (seconds: number) => new Date(base + seconds * 1000).toISOString();
function definition() {
  const d = structuredClone(landfallFixture);
  d.worldspaces = [d.worldspaces[1]];
  d.maps = [d.maps[1]];
  d.waypoints = [d.waypoints[1]];
  d.routes = [d.routes[1]];
  d.transitions = [];
  d.worldspaces[0].observationPolicy.allowedSources = ["PLAYER_CONFIRMATION", "WATCHGLASS", "STORY_PROGRESSION"];
  d.waypoints[0].visibility.hiddenUntilRevealed = false;
  d.waypoints[0].evidenceProfile.acceptedSources = ["PLAYER_CONFIRMATION", "WATCHGLASS", "STORY_PROGRESSION"];
  d.waypoints[0].regionId = "island";
  d.context = {
    regions: [
      {
        id: "island",
        worldspaceId: "isles",
        mapId: d.maps[0].id,
        name: "Fictional island",
        kind: "SITE",
        geometry: { type: "POINT_RADIUS", center: virtualCoordinate(0.5, 0.5), radius: 0.3 },
        privacyClassification: "FICTIONAL",
        hiddenUntilRevealed: false,
      },
    ],
    landmarks: [],
  };
  d.routes[0].semantics = "NAVIGATIONAL";
  d.routes[0].offRouteTolerance = 0.02;
  return validateLandfallDefinition(d);
}
function registry() {
  const r = new LandfallProviderRegistry();
  for (const [id, source] of [
    ["sim-virtual", "PLAYER_CONFIRMATION"],
    ["certified-test", "WATCHGLASS"],
    ["story", "STORY_PROGRESSION"],
  ] as const)
    r.register({ id, source, worldspaceKinds: ["VIRTUAL"], state: "AVAILABLE" });
  return r;
}
function runtime(d = definition()) {
  const r = new LandfallRuntime(d, identity, registry());
  r.setActiveWaypoint("isle-region");
  return r;
}
function position(seconds: number, x = 0.5): Extract<LandfallObservation, { kind: "VIRTUAL_POSITION" }> {
  return {
    schemaVersion: 1,
    id: `virtual-${seconds}`,
    ...identity,
    worldspaceId: "isles",
    providerId: "sim-virtual",
    source: "PLAYER_CONFIRMATION",
    kind: "VIRTUAL_POSITION",
    coordinate: virtualCoordinate(x, x),
    uncertaintyUnits: 0.005,
    confidence: 0.99,
    observedAt: at(seconds),
  };
}
function target(d = definition()): WatchglassTarget {
  return {
    ...identity,
    playerProfileId: "player-1",
    expectedSequence: 4,
    worldspaceId: "isles",
    worldspaceVersion: 1,
    waypointId: "isle-region",
    definitionHash: landmarkDefinitionHash(d),
  };
}
function receipt(d = definition()) {
  return {
    ...target(d),
    id: "visual-receipt",
    packageId: "test-package",
    packageVersion: "version-1",
    certificationRef: "test-certificate",
    observedAt: at(2),
    expiresAt: at(20),
    result: "match" as const,
    confidence: 0.99,
    independentEvidenceRef: "visual-root",
    contextEvidenceRefs: ["story-context"],
    supportingObservations: [
      { id: "visual-view-1", observedAt: at(1) },
      { id: "visual-view-2", observedAt: at(2) },
    ],
  };
}
function provider(value: unknown): WatchglassEvidenceProvider {
  return {
    id: "certified-test",
    state: "AVAILABLE",
    packageId: "test-package",
    packageVersion: "version-1",
    certificationRef: "test-certificate",
    worldspaceKinds: ["PHYSICAL", "VIRTUAL"],
    verifyReceipt: vi.fn(() => value),
  };
}
function request(): PlayerLandfallEvidence {
  return {
    schemaVersion: 1,
    ...identity,
    expectedSequence: 4,
    worldspaceId: "isles",
    waypointId: "isle-region",
    evidenceId: "visual-evidence",
    idempotencyKey: "visual-idempotency",
    method: "WATCHGLASS",
    watchglassReceipt: "opaque-synthetic-receipt",
  };
}

describe("Landfall v1.1 contextual and evidence contracts", () => {
  it("feeds normalized virtual positions into region/route guidance using authored units", () => {
    const r = runtime();
    r.setActiveRoute("isle-route");
    r.ingest(position(1, 0.3), base + 1000);
    r.ingest(position(2, 0.4), base + 2000);
    expect(r.contextSnapshot(base + 2000)).toMatchObject({ regionId: "island", routeMatch: { direction: "FORWARD" } });
    expect(r.contextSnapshot(base + 90_000)).toMatchObject({ state: "UNAVAILABLE", regionId: null });
  });
  it("keeps local-cartesian geometry and uncertainty separate from physical meters", () => {
    const d = definition();
    const coordinate = (x: number, y: number) => ({
      type: "LOCAL_CARTESIAN_2D" as const,
      worldspaceId: "isles",
      referenceId: "isles-image",
      referenceVersion: 1,
      x,
      y,
    });
    d.worldspaces[0].coordinateReference = {
      type: "LOCAL_CARTESIAN_2D",
      id: "isles-image",
      version: 1,
      bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
      unit: "map units",
      axis: "X_RIGHT_Y_DOWN",
      origin: { x: 0, y: 0 },
    };
    d.maps[0].camera.center = coordinate(500, 500);
    d.context!.regions[0].geometry = { type: "POINT_RADIUS", center: coordinate(500, 500), radius: 300 };
    d.waypoints[0].geometry = { type: "POINT_RADIUS", center: coordinate(500, 500), radius: 300 };
    d.routes[0].geometry = { type: "ROUTE_LINE", points: [coordinate(100, 100), coordinate(500, 500)] };
    d.routes[0].offRouteTolerance = 20;
    const engine = new ContextualLandfallEngine(validateLandfallDefinition(d), identity);
    expect(
      engine.ingestPosition({ ...position(1), coordinate: coordinate(500, 500), uncertaintyUnits: 5 }, base + 1000)
        .regionId,
    ).toBe("island");
  });
  it("never uses device heading or weak virtual positions as virtual spatial truth", () => {
    const engine = new ContextualLandfallEngine(definition(), identity);
    expect(engine.ingestPosition({ ...position(1), confidence: 0.3 }, base + 1000).state).toBe("UNAVAILABLE");
    expect(
      engine.ingestEvidence(
        {
          id: "device-heading",
          ...identity,
          worldspaceId: "isles",
          kind: "HEADING",
          degrees: 20,
          accuracyDegrees: 5,
          observedAt: at(2),
        },
        base + 2000,
      ).rejection,
    ).toBe("PHYSICAL_HINT_IN_VIRTUAL_WORLDSPACE");
  });
  it("uses story progress as coarse named context without invented position or completion", () => {
    const r = runtime();
    const outcome = r.ingest(
      { ...virtualObservation("story-context", at(1)), source: "STORY_PROGRESSION", providerId: "story" },
      base + 1000,
    );
    expect(outcome.sync).toBeNull();
    expect(r.contextSnapshot(base + 1000)).toMatchObject({ state: "KNOWN", regionId: "island" });
    expect(r.currentPosition(base + 1000)).toBeNull();
    expect(() => r.completionRequest("story-context", 4, "attempt")).toThrow();
  });
  it("requires independent sources, rejects circular roots and preserves conflict uncertainty", () => {
    const d = definition();
    d.waypoints[0].evidenceProfile.fusionPolicy = { version: 1, minimumIndependentSources: 2 };
    const r = runtime(d);
    expect(r.ingest(virtualObservation("human-1", at(1)), base + 1000).sync).toBeNull();
    expect(r.ingest(virtualObservation("human-2", at(2)), base + 2000).sync).toBeNull();
    const visual = {
      ...virtualObservation("visual-1", at(3)),
      source: "WATCHGLASS" as const,
      providerId: "certified-test",
    };
    expect(
      r.ingest(
        { ...visual, provenance: { independentEvidenceRef: "human-root", contextEvidenceRefs: ["human-root"] } },
        base + 3000,
      ).sync,
    ).toBeNull();
    expect(
      r.ingest(
        {
          ...visual,
          id: "visual-2",
          observedAt: at(4),
          provenance: { independentEvidenceRef: "actual-frame", contextEvidenceRefs: ["human-root"] },
        },
        base + 4000,
      ).confidence,
    ).toBe("CONFIRMED");
    expect(
      r.ingest({ ...virtualObservation("human-no", at(5), "isle-region", "ABSENT"), confidence: 0.99 }, base + 5000)
        .confidence,
    ).toBe("WEAK");
    expect(r.contextSnapshot(base + 5000).state).toBe("UNCERTAIN");
    expect(() => r.completionRequest("visual-2", 4, "superseded")).toThrow();
    expect(
      r.ingest({ ...visual, id: "wrong-session", sessionId: "another-session", observedAt: at(6) }, base + 6000)
        .confidence,
    ).toBe("UNAVAILABLE");
  });
  it("drops expired corroboration and invalidates an unsubmitted local completion", () => {
    const d = definition();
    d.waypoints[0].evidenceProfile.fusionPolicy = { version: 1, minimumIndependentSources: 2 };
    const r = runtime(d);
    r.ingest(virtualObservation("human", at(1)), base + 1000);
    expect(
      r.ingest(
        {
          ...virtualObservation("visual", at(2)),
          source: "WATCHGLASS",
          providerId: "certified-test",
          expiresAt: at(3),
        },
        base + 2000,
      ).confidence,
    ).toBe("CONFIRMED");
    expect(r.ingest(virtualObservation("human-again", at(4)), base + 4000).confidence).toBe("LIKELY_INSIDE");
    expect(() => r.completionRequest("visual", 4, "expired-support")).toThrow();
  });
  it("expires pending corroboration when delivery is requested without any new observation", () => {
    const d = definition();
    d.waypoints[0].evidenceProfile.fusionPolicy = { version: 1, minimumIndependentSources: 2 };
    const r = runtime(d);
    r.ingest(virtualObservation("human", at(1)), base + 1000);
    expect(
      r.ingest(
        {
          ...virtualObservation("visual", at(2)),
          source: "WATCHGLASS",
          providerId: "certified-test",
          expiresAt: at(3),
        },
        base + 2000,
      ).confidence,
    ).toBe("CONFIRMED");
    expect(r.completionRequest("visual", 4, "fresh", base + 2500)).toHaveProperty("outcome", "CONFIRMED");
    expect(() => r.completionRequest("visual", 4, "expired", base + 3000)).toThrow("LANDFALL_EVIDENCE_STALE");
    expect(() => r.completionRequest("visual", 4, "retry", base + 2500)).toThrow("LANDFALL_EVIDENCE_UNAVAILABLE");
  });
  it("keeps normalized entrance proximity in authored units", () => {
    const d = definition();
    d.context!.regions[0].geometry = {
      type: "ENTRANCE_GATE",
      start: virtualCoordinate(0.1, 0.1),
      end: virtualCoordinate(0.2, 0.1),
      direction: "EITHER",
    };
    const engine = new ContextualLandfallEngine(d, identity);
    expect(engine.ingestPosition(position(1, 0.8), base + 1000).regionId).toBeNull();
  });
  it("rejects impossible independent-source policies while old definitions remain readable", () => {
    const d = definition();
    d.waypoints[0].evidenceProfile.fusionPolicy = { version: 1, minimumIndependentSources: 4 };
    expect(() => validateLandfallDefinition(d)).toThrow();
    expect(validateLandfallDefinition(landfallFixture)).toEqual(landfallFixture);
  });
  it("requires canonical reconciliation and never treats local context as progress", () => {
    const r = runtime();
    r.ingest(virtualObservation("local", at(1)), base + 1000);
    expect(r.projection("PLAYER", base + 1000).visitedLocationIds).toEqual([]);
    expect(r.completionRequest("local", 4, "repeatable", base + 1000)).toMatchObject({
      expectedSequence: 4,
      publishedVersionId: "version-1",
      idempotencyKey: "repeatable",
    });
    r.pause();
    expect(r.contextSnapshot(base + 2000).state).toBe("UNAVAILABLE");
  });
});

describe("conditional certified Watchglass handoff", () => {
  it("is not configured by default and never invokes unavailable providers", () => {
    expect(readWatchglassHandoff(undefined, "forged", target(), "VIRTUAL", base + 3000)).toEqual({
      state: "NOT_CONFIGURED",
    });
    const p = provider(receipt());
    p.state = "UNAVAILABLE";
    expect(readWatchglassHandoff(p, "opaque", target(), "VIRTUAL", base + 3000)).toEqual({ state: "UNAVAILABLE" });
    expect(p.verifyReceipt).not.toHaveBeenCalled();
  });
  it("preserves abstention/negative results instead of converting them to success", () => {
    for (const [result, assertion] of [
      ["uncertain", "UNCERTAIN"],
      ["notMatch", "ABSENT"],
    ] as const) {
      const h = readWatchglassHandoff(provider({ ...receipt(), result }), "opaque", target(), "VIRTUAL", base + 3000);
      expect(h.state === "AVAILABLE" && h.observation.kind === "SEMANTIC_LOCATION" && h.observation.assertion).toBe(
        assertion,
      );
    }
  });
  it.each([
    "playerProfileId",
    "sessionId",
    "publishedVersionId",
    "expectedSequence",
    "worldspaceId",
    "worldspaceVersion",
    "waypointId",
    "definitionHash",
    "packageId",
    "packageVersion",
    "certificationRef",
  ] as const)("rejects wrong %s binding", (field) => {
    const value = receipt()[field];
    expect(() =>
      readWatchglassHandoff(
        provider({ ...receipt(), [field]: typeof value === "number" ? value + 1 : "wrong-binding" }),
        "opaque",
        target(),
        "VIRTUAL",
        base + 3000,
      ),
    ).toThrow();
  });
  it("rejects expired, duplicated supporting and circular evidence", () => {
    for (const value of [
      { ...receipt(), expiresAt: at(1) },
      { ...receipt(), contextEvidenceRefs: ["visual-root"] },
      {
        ...receipt(),
        supportingObservations: [
          { id: "same", observedAt: at(1) },
          { id: "same", observedAt: at(2) },
        ],
      },
    ])
      expect(() => readWatchglassHandoff(provider(value), "opaque", target(), "VIRTUAL", base + 3000)).toThrow();
  });
  it("server-qualifies synthetic certified virtual evidence and emits only safe categories", () => {
    const d = definition();
    const q = qualifyPlayerLandfallEvidence({
      definition: d,
      request: request(),
      journey: projectLandfallJourney(d, []),
      now: base + 3000,
      playerProfileId: "player-1",
      watchglassProvider: provider(receipt(d)),
    });
    expect(q).toMatchObject({
      method: "WATCHGLASS",
      outcome: "CONFIRMED",
      contextualSummary: { regionId: "island", evidenceCategories: ["WATCHGLASS"] },
    });
    expect(JSON.stringify(q)).not.toMatch(/visual-root|test-certificate|opaque|coordinate/);
  });
  it("uses the same certified handoff for physical Worldspaces", () => {
    const d = structuredClone(landfallFixture);
    d.worldspaces[0].observationPolicy.allowedSources.push("WATCHGLASS");
    d.waypoints[0].evidenceProfile.acceptedSources.push("WATCHGLASS");
    d.waypoints[0].evidenceProfile.dwellSeconds = 0;
    const binding = { ...target(d), worldspaceId: "town", waypointId: "town-arrival" };
    const value = { ...receipt(d), ...binding };
    const q = qualifyPlayerLandfallEvidence({
      definition: d,
      request: { ...request(), worldspaceId: "town", waypointId: "town-arrival" },
      journey: projectLandfallJourney(d, []),
      now: base + 3000,
      playerProfileId: "player-1",
      watchglassProvider: provider(value),
    });
    expect(q).toMatchObject({ method: "WATCHGLASS", outcome: "CONFIRMED", worldspaceId: "town" });
  });
  it("enforces the waypoint freshness limit against server time and rejects inverted validity", () => {
    const d = definition();
    d.waypoints[0].evidenceProfile.maximumAgeSeconds = 1;
    expect(() =>
      qualifyPlayerLandfallEvidence({
        definition: d,
        request: request(),
        journey: projectLandfallJourney(d, []),
        now: base + 3000,
        playerProfileId: "player-1",
        watchglassProvider: provider(receipt(d)),
      }),
    ).toThrow("LANDFALL_WATCHGLASS_STALE");
    expect(() =>
      readWatchglassHandoff(provider({ ...receipt(), expiresAt: at(1.5) }), "opaque", target(), "VIRTUAL", base + 1000),
    ).toThrow("LANDFALL_WATCHGLASS_STALE");
  });
  it("enforces authored visual support and richer policy without counting a contextual prior", () => {
    const d = definition();
    d.waypoints[0].landmarkId = "virtual-arch";
    d.context!.landmarks = [
      {
        id: "virtual-arch",
        regionId: "island",
        waypointId: "isle-region",
        name: "Virtual arch",
        privacyClassification: "FICTIONAL",
        guidance: "Use the authored fallback if unavailable.",
        minimumFrames: 3,
        referenceAssetIds: ["synthetic-reference"],
        negativeReferenceAssetIds: [],
        fallback: d.waypoints[0].fallback,
      },
    ];
    const input = {
      definition: d,
      request: request(),
      journey: projectLandfallJourney(d, []),
      now: base + 3000,
      playerProfileId: "player-1",
    };
    expect(() => qualifyPlayerLandfallEvidence({ ...input, watchglassProvider: provider(receipt(d)) })).toThrow(
      "LANDFALL_WATCHGLASS_SUPPORT_REQUIRED",
    );
    d.context!.landmarks[0].minimumFrames = 2;
    d.waypoints[0].evidenceProfile.fusionPolicy = { version: 1, minimumIndependentSources: 2 };
    expect(() => qualifyPlayerLandfallEvidence({ ...input, watchglassProvider: provider(receipt(d)) })).toThrow(
      "LANDFALL_WATCHGLASS_NOT_QUALIFIED",
    );
    expect(() =>
      qualifyPlayerLandfallEvidence({
        ...input,
        request: { ...request(), method: "LANDMARK", watchglassReceipt: undefined },
      }),
    ).toThrow("LANDFALL_INDEPENDENT_EVIDENCE_REQUIRED");
  });
  it("rejects client visual claims, abstention and unavailable recognition; manual fallback survives", () => {
    const d = definition(),
      journey = projectLandfallJourney(d, []);
    const input = { definition: d, journey, now: base + 3000, playerProfileId: "player-1", request: request() };
    expect(() => qualifyPlayerLandfallEvidence(input)).toThrow("LANDFALL_WATCHGLASS_UNAVAILABLE");
    expect(() =>
      qualifyPlayerLandfallEvidence({ ...input, watchglassProvider: provider({ ...receipt(d), result: "uncertain" }) }),
    ).toThrow("LANDFALL_WATCHGLASS_NOT_QUALIFIED");
    expect(() =>
      qualifyPlayerLandfallEvidence({
        ...input,
        request: { ...request(), observations: [virtualObservation("forged", at(1))] },
      }),
    ).toThrow("LANDFALL_WATCHGLASS_UNTRUSTED_INPUT");
    expect(
      qualifyPlayerLandfallEvidence({
        ...input,
        request: { ...request(), method: "PLAYER_FALLBACK", watchglassReceipt: undefined },
      }).method,
    ).toBe("PLAYER_CONFIRMATION");
  });
});

describe("canonical independently qualified evidence bundles", () => {
  function setup(minimum = 2) {
    const d = definition();
    d.waypoints[0].evidenceProfile.fusionPolicy = { version: 1, minimumIndependentSources: minimum };
    const input = {
      definition: d,
      journey: projectLandfallJourney(d, []),
      now: base + 3000,
      playerProfileId: "player-1",
      watchglassProvider: provider(receipt(d)),
    };
    const human = { method: "PLAYER_FALLBACK" as const, evidenceId: "deliberate-human" };
    const visual = { method: "WATCHGLASS" as const, evidenceId: "visual", watchglassReceipt: "opaque" };
    const submit = (sources: NonNullable<PlayerLandfallEvidence["sources"]>, overrides = {}) =>
      qualifyPlayerLandfallEvidence({
        ...input,
        ...overrides,
        request: { ...request(), method: "EVIDENCE_BUNDLE", watchglassReceipt: undefined, sources },
      });
    return { d, input, human, visual, submit };
  }
  it("supports one fresh source and safely rejects stale or conflicting evidence", () => {
    const { d, human, visual, submit } = setup(1);
    expect(submit([visual])).toMatchObject({ method: "FUSED", outcome: "CONFIRMED" });
    expect(() => submit([visual], { watchglassProvider: provider({ ...receipt(d), expiresAt: at(3) }) })).toThrow(
      "LANDFALL_INDEPENDENT_EVIDENCE_REQUIRED",
    );
    expect(() =>
      submit([human, visual], { watchglassProvider: provider({ ...receipt(d), result: "notMatch" }) }),
    ).toThrow("LANDFALL_EVIDENCE_CONFLICT");
  });
  it("does not count a source twice, or story/context priors as another source", () => {
    const { human, visual, submit } = setup();
    for (const packets of [
      [human],
      [human, { ...human, evidenceId: "repeat" }],
      [visual],
      [visual, { ...visual, evidenceId: "copy" }],
    ])
      expect(() => submit(packets)).toThrow("LANDFALL_INDEPENDENT_EVIDENCE_REQUIRED");
    expect(
      playerLandfallEvidenceSchema.safeParse({
        ...request(),
        method: "EVIDENCE_BUNDLE",
        watchglassReceipt: undefined,
        sources: [human, { method: "STORY_PROGRESSION", evidenceId: "story" }],
      }).success,
    ).toBe(false);
  });
  it("makes two actual independent server-qualified sources operational and sanitizes their result", () => {
    const { human, visual, submit } = setup();
    const q = submit([human, visual]);
    expect(q).toMatchObject({
      method: "FUSED",
      outcome: "CONFIRMED",
      evidenceCategories: ["PLAYER_CONFIRMATION", "WATCHGLASS"],
      fallbackUsed: true,
    });
    expect(JSON.stringify(q)).not.toMatch(/opaque|test-certificate|visual-root|provenance|coordinate|package/);
  });
  it("rejects shared/correlated provenance, and removes expired support", () => {
    const { d, human, visual, submit } = setup();
    const root = createHash("sha256")
      .update("PLAYER_CONFIRMATION:player-1:session-1:version-1:4:isle-region")
      .digest("hex");
    expect(() =>
      submit([human, visual], { watchglassProvider: provider({ ...receipt(d), independentEvidenceRef: root }) }),
    ).toThrow("LANDFALL_INDEPENDENT_EVIDENCE_REQUIRED");
    expect(() =>
      submit([human, visual], { watchglassProvider: provider({ ...receipt(d), contextEvidenceRefs: [root] }) }),
    ).toThrow("LANDFALL_INDEPENDENT_EVIDENCE_REQUIRED");
    expect(() =>
      submit([human, visual], { watchglassProvider: provider({ ...receipt(d), expiresAt: at(3) }) }),
    ).toThrow("LANDFALL_INDEPENDENT_EVIDENCE_REQUIRED");
  });
  it("keeps trusted absence a conflict and unavailable providers unavailable", () => {
    const { d, human, visual, submit } = setup();
    expect(() =>
      submit([human, visual], { watchglassProvider: provider({ ...receipt(d), result: "notMatch" }) }),
    ).toThrow("LANDFALL_EVIDENCE_CONFLICT");
    expect(() => submit([human, visual], { watchglassProvider: undefined })).toThrow(
      "LANDFALL_INDEPENDENT_EVIDENCE_REQUIRED",
    );
  });
  it("rejects circular trusted provenance across packets", () => {
    const { d, visual, submit } = setup();
    const p = provider(receipt(d));
    p.verifyReceipt = (token) => ({
      ...receipt(d),
      independentEvidenceRef: token,
      contextEvidenceRefs: [token === "root-a" ? "root-b" : "root-a"],
    });
    expect(() =>
      submit(
        [
          { ...visual, watchglassReceipt: "root-a" },
          { ...visual, evidenceId: "visual-b", watchglassReceipt: "root-b" },
        ],
        { watchglassProvider: p },
      ),
    ).toThrow("LANDFALL_CIRCULAR_EVIDENCE");
  });
  it("warns or blocks unsupported three/four-source policies rather than inventing providers", () => {
    const d = definition();
    d.waypoints[0].evidenceProfile.acceptedSources.push("GAME_INTEGRATION", "CREATOR_LOGIC");
    d.worldspaces[0].observationPolicy.allowedSources.push("GAME_INTEGRATION", "CREATOR_LOGIC");
    for (const minimum of [3, 4]) {
      d.waypoints[0].evidenceProfile.fusionPolicy = { version: 1, minimumIndependentSources: minimum };
      expect(landfallAuthoringFindings(validateLandfallDefinition(d), "PRIVATE")).toContainEqual(
        expect.objectContaining({ code: "LANDFALL_FUSION_PROVIDER_UNAVAILABLE", severity: "warning" }),
      );
      const noFallback = structuredClone(d);
      noFallback.waypoints[0].fallback = { mode: "NONE" };
      noFallback.waypoints[0].evidenceProfile.allowManualFallback = false;
      expect(landfallAuthoringFindings(noFallback, "PRIVATE")).toContainEqual(
        expect.objectContaining({ code: "LANDFALL_FUSION_PROVIDER_UNAVAILABLE", severity: "blocker" }),
      );
    }
  });
});

describe("physical canonical multi-source qualification", () => {
  it("qualifies fresh GPS plus a human, while preserving freshness, conflict and source scope", () => {
    const d = structuredClone(landfallFixture);
    const waypoint = d.waypoints[0];
    waypoint.evidenceProfile.dwellSeconds = 0;
    waypoint.evidenceProfile.acceptedSources.push("PLAYER_CONFIRMATION");
    waypoint.evidenceProfile.fusionPolicy = { version: 1, minimumIndependentSources: 2 };
    const human = { method: "PLAYER_FALLBACK" as const, evidenceId: "human" };
    const gps = {
      method: "FOREGROUND_LOCATION" as const,
      evidenceId: "gps-2",
      observations: [physicalObservation("gps-1", at(1)), physicalObservation("gps-2", at(2))].map((item) => ({
        ...item,
        providerId: "browser-geolocation",
      })),
    };
    const input = {
      definition: d,
      journey: projectLandfallJourney(d, []),
      now: base + 3000,
      playerProfileId: "player-1",
      request: {
        ...request(),
        worldspaceId: "town",
        waypointId: waypoint.id,
        method: "EVIDENCE_BUNDLE" as const,
        watchglassReceipt: undefined,
        sources: [gps, human],
      },
    };
    expect(qualifyPlayerLandfallEvidence(input)).toMatchObject({
      method: "FUSED",
      outcome: "CONFIRMED",
      evidenceCategories: ["BROWSER_GEOLOCATION", "PLAYER_CONFIRMATION"],
    });
    expect(() => qualifyPlayerLandfallEvidence({ ...input, now: base + 1000000 })).toThrow(
      "LANDFALL_INDEPENDENT_EVIDENCE_REQUIRED",
    );
    const wrongScope = structuredClone(input);
    wrongScope.request.sources[0] = {
      ...gps,
      observations: gps.observations.map((item) => ({ ...item, sessionId: "another-session" })),
    };
    expect(() => qualifyPlayerLandfallEvidence(wrongScope)).toThrow("LANDFALL_EVIDENCE_IDENTITY_MISMATCH");
    const conflicting = structuredClone(input);
    conflicting.request.sources[0] = {
      ...gps,
      observations: gps.observations.map((item) => ({
        ...item,
        kind: "PHYSICAL_POSITION" as const,
        coordinate: {
          type: "WGS84" as const,
          worldspaceId: "town",
          referenceId: "town-wgs84",
          referenceVersion: 1,
          latitude: 45,
          longitude: -72,
        },
        accuracyMeters: 2,
      })),
    };
    expect(() => qualifyPlayerLandfallEvidence(conflicting)).toThrow("LANDFALL_EVIDENCE_CONFLICT");
  });
});
