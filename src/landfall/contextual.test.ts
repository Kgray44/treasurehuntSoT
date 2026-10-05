import { describe, expect, it } from "vitest";
import { ContextualLandfallEngine, contextualEvidenceSchema, type ContextualEvidence } from "@/landfall/contextual";
import { validateLandfallDefinition } from "@/landfall/definition";
import { landfallFixture, physicalCoordinate, physicalObservation } from "@/landfall/fixtures";
import { LandfallProviderRegistry, type LandfallObservation } from "@/landfall/observation";
import { LandfallRuntime } from "@/landfall/runtime";
import type { LandfallDefinition, LandfallRegion } from "@/landfall/schema";

const identity = { sessionId: "session-1", publishedVersionId: "version-1" };
const epoch = Date.UTC(2026, 9, 1, 12);
const at = (seconds: number) => new Date(epoch + seconds * 1000).toISOString();
const now = (seconds: number) => epoch + seconds * 1000;
function region(
  id: string,
  kind: LandfallRegion["kind"],
  radius: number,
  extra: Partial<LandfallRegion> = {},
): LandfallRegion {
  return {
    id,
    kind,
    worldspaceId: "town",
    mapId: "town-map",
    name: id,
    geometry: { type: "POINT_RADIUS", center: physicalCoordinate(44, -72), radius },
    privacyClassification: "APPROXIMATE_REAL_WORLD",
    hiddenUntilRevealed: false,
    ...extra,
  };
}
function fixture(): LandfallDefinition {
  const definition = structuredClone(landfallFixture);
  definition.worldspaces[0].observationPolicy.allowedSources.push("VISION_WAYPOINT");
  definition.waypoints[0].evidenceProfile.acceptedSources.push("VISION_WAYPOINT");
  definition.context = {
    regions: [
      region("site", "SITE", 300),
      region("building", "BUILDING", 100, { parentId: "site" }),
      region("gallery", "GALLERY", 35, { parentId: "building", level: "ground" }),
    ],
    landmarks: [],
  };
  definition.waypoints[0].regionId = "gallery";
  definition.waypoints[0].landmarkId = "anchor";
  definition.context.landmarks.push({
    id: "anchor",
    regionId: "gallery",
    waypointId: "town-arrival",
    name: "Synthetic anchor",
    guidance: "Look for the painted ring. If unavailable ask the Captain.",
    referenceAssetIds: ["reference-a", "reference-b"],
    negativeReferenceAssetIds: ["negative-a"],
    minimumFrames: 3,
    fallback: { mode: "PLAYER" },
    privacyClassification: "APPROXIMATE_REAL_WORLD",
  });
  return validateLandfallDefinition(definition);
}
function position(
  id: string,
  seconds: number,
  northMeters = 0,
  eastMeters = 0,
  accuracy = 2,
): Extract<LandfallObservation, { kind: "PHYSICAL_POSITION" }> {
  return physicalObservation(id, at(seconds), 44 + northMeters / 111195, -72 + eastMeters / 79987, accuracy) as Extract<
    LandfallObservation,
    { kind: "PHYSICAL_POSITION" }
  >;
}
function evidence(kind: ContextualEvidence["kind"], id: string, seconds: number, extra: Record<string, unknown> = {}) {
  return { ...identity, id, kind, worldspaceId: "town", observedAt: at(seconds), ...extra };
}
function landmark(id: string, seconds: number, result = "confirmed", frameCount = 3) {
  return evidence("LANDMARK", id, seconds, { landmarkId: "anchor", regionId: "gallery", result, frameCount });
}

describe("Landfall contextual definition and qualification", () => {
  it("uses the canonical waypoint fallback and declared Landfall vision source policies", () => {
    const fallbackMismatch = fixture();
    fallbackMismatch.context!.landmarks[0].fallback.mode = "CAPTAIN";
    expect(() => validateLandfallDefinition(fallbackMismatch)).toThrow(/canonical fallback/);
    const alternateMismatch = fixture();
    alternateMismatch.context!.landmarks[0].fallback.alternateWaypointId = "other-waypoint";
    expect(() => validateLandfallDefinition(alternateMismatch)).toThrow(/canonical fallback/);
    const waypointSource = fixture();
    waypointSource.waypoints[0].evidenceProfile.acceptedSources = ["BROWSER_GEOLOCATION"];
    expect(() => validateLandfallDefinition(waypointSource)).toThrow(/waypoint must accept VISION_WAYPOINT/);
    const worldSource = fixture();
    worldSource.worldspaces[0].observationPolicy.allowedSources = ["BROWSER_GEOLOCATION", "PLAYER_CONFIRMATION"];
    expect(() => validateLandfallDefinition(worldSource)).toThrow(/Worldspace must allow VISION_WAYPOINT/);
    expect(validateLandfallDefinition(landfallFixture).context).toBeUndefined();
  });
  it("preserves old definitions and validates bounded hierarchy, scope, floor levels, geometry and fallback", () => {
    expect(validateLandfallDefinition(landfallFixture).context).toBeUndefined();
    expect(fixture().context?.landmarks).toHaveLength(1);
    const bad = fixture();
    bad.context!.regions[0].parentId = "gallery";
    expect(() => validateLandfallDefinition(bad)).toThrow(/cycle/);
    const wrongMap = fixture();
    wrongMap.context!.regions[2].mapId = "isles-map";
    expect(() => validateLandfallDefinition(wrongMap)).toThrow();
    const floor = fixture();
    floor.context!.regions[2].kind = "FLOOR";
    delete floor.context!.regions[2].level;
    expect(() => validateLandfallDefinition(floor)).toThrow(/level/);
    const mapLevel = fixture();
    mapLevel.maps[0].level = "first";
    expect(() => validateLandfallDefinition(mapLevel)).toThrow(/level/);
    const invalidGeometry = fixture();
    invalidGeometry.context!.regions[2].geometry = {
      type: "POLYGON",
      rings: [
        [
          physicalCoordinate(44, -72),
          physicalCoordinate(44, -72),
          physicalCoordinate(44, -72),
          physicalCoordinate(44, -72),
        ],
      ],
    };
    expect(() => validateLandfallDefinition(invalidGeometry)).toThrow(/INVALID_GEOMETRY/);
    const fallback = fixture();
    fallback.context!.landmarks[0].fallback.mode = "NONE";
    expect(() => validateLandfallDefinition(fallback)).toThrow(/fallback/);
    const privacy = fixture();
    privacy.context!.regions[2].privacyClassification = "PUBLIC_REAL_WORLD";
    expect(() => validateLandfallDefinition(privacy)).toThrow(/privacy/);
    const duplicateAssets = fixture();
    duplicateAssets.context!.landmarks[0].negativeReferenceAssetIds = ["reference-a"];
    expect(() => validateLandfallDefinition(duplicateAssets)).toThrow(/assets/);
    const segments = fixture();
    segments.routes[0].segmentRegionIds = ["gallery", "building"];
    expect(() => validateLandfallDefinition(segments)).toThrow(/segment/);
  });
  it("rejects unbounded hints and raw frame payloads", () => {
    expect(
      contextualEvidenceSchema.safeParse(evidence("HEADING", "heading", 1, { degrees: NaN, accuracyDegrees: 5 }))
        .success,
    ).toBe(false);
    expect(contextualEvidenceSchema.safeParse({ ...landmark("frame", 1), frame: "private-raw-frame" }).success).toBe(
      false,
    );
    const bad = fixture();
    bad.context!.landmarks[0].minimumFrames = 1;
    expect(() => validateLandfallDefinition(bad)).toThrow();
  });
  it("GPS supports broad regions but never confirms floors, rooms or landmarks", () => {
    const engine = new ContextualLandfallEngine(fixture(), identity);
    expect(engine.ingestPosition(position("first", 1, 150), now(1)).state).toBe("KNOWN");
    engine.reset();
    const snapshot = engine.ingestPosition(position("inside", 1), now(1));
    expect(snapshot).toMatchObject({
      state: "INFERRED",
      regionId: "gallery",
      level: "ground",
      eligibleLandmarkIds: ["anchor"],
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/latitude|longitude|reference-a/);
    expect(engine.ingestEvidence(evidence("MOTION", "motion", 2, { moving: true }), now(2)).state).toBe("INFERRED");
    expect(engine.snapshot(now(3)).state).not.toBe("CONFIRMED");
  });
  it("does not guess floors with the same footprint and lets independent regional evidence resolve them", () => {
    const definition = fixture();
    definition.context!.regions.push(region("upper-gallery", "GALLERY", 35, { parentId: "building", level: "upper" }));
    const engine = new ContextualLandfallEngine(definition, identity);
    expect(engine.ingestPosition(position("floor-fix", 1), now(1))).toMatchObject({
      state: "UNCERTAIN",
      regionId: "building",
      level: null,
    });
    expect(
      engine.ingestEvidence(evidence("ELEVATION", "height", 2, { meters: 10, accuracyMeters: 1 }), now(2)).state,
    ).toBe("UNCERTAIN");
    expect(
      engine.ingestEvidence(evidence("OBSERVATION", "floor-sign", 3, { regionId: "upper-gallery" }), now(3)),
    ).toMatchObject({ state: "CONFIRMED", regionId: "upper-gallery", level: "upper" });
  });
  it("rejects wrong identity, old/future/duplicate/out-of-order evidence and impossible physical or elevation changes", () => {
    const engine = new ContextualLandfallEngine(fixture(), identity);
    expect(engine.ingestPosition(position("fix", 1), now(1)).rejection).toBeUndefined();
    expect(engine.ingestPosition(position("fix", 1), now(2)).rejection).toBe("DUPLICATE");
    expect(engine.ingestPosition(position("old", 0), now(2)).rejection).toBe("OUT_OF_ORDER");
    expect(engine.ingestPosition(position("jump", 2, 500), now(2)).rejection).toBe("IMPOSSIBLE_SPEED");
    expect(engine.ingestEvidence({ ...landmark("wrong", 2), sessionId: "other" }, now(2)).rejection).toBe(
      "WRONG_SESSION",
    );
    expect(
      engine.ingestEvidence({ ...landmark("wrong-edition", 2), publishedVersionId: "other" }, now(2)).rejection,
    ).toBe("WRONG_VERSION");
    expect(engine.ingestEvidence({ ...landmark("unknown", 2), landmarkId: "unknown" }, now(2)).rejection).toBe(
      "UNKNOWN_LANDMARK",
    );
    expect(engine.ingestEvidence(landmark("future", 10), now(2)).rejection).toBe("FUTURE");
    expect(engine.ingestEvidence(landmark("stale", 1), now(50)).rejection).toBe("STALE");
    engine.ingestEvidence(evidence("ELEVATION", "height", 2, { meters: 0, accuracyMeters: 1 }), now(2));
    expect(
      engine.ingestEvidence(evidence("ELEVATION", "jump-height", 3, { meters: 100, accuracyMeters: 1 }), now(3))
        .rejection,
    ).toBe("IMPOSSIBLE_ELEVATION");
  });
  it("requires plausible regional context and multiple landmark frames, and degrades without retaining raw streams", () => {
    const engine = new ContextualLandfallEngine(fixture(), identity);
    expect(engine.ingestEvidence(landmark("ungated", 1), now(1)).rejection).toBe("REGION_NOT_PLAUSIBLE");
    engine.ingestPosition(position("fix", 1), now(1));
    expect(engine.ingestEvidence(landmark("one-frame", 2, "confirmed", 1), now(2)).rejection).toBe(
      "INSUFFICIENT_FRAMES",
    );
    expect(engine.ingestEvidence(landmark("unavailable", 2, "unavailable", 0), now(2)).reasons.join(" ")).toMatch(
      /fallback/,
    );
    expect(engine.ingestEvidence(landmark("multi-frame", 3), now(3))).toMatchObject({
      state: "CONFIRMED",
      regionId: "gallery",
    });
    expect(engine.snapshot(now(17)).state).not.toBe("CONFIRMED");
    expect(engine.snapshot(now(35)).state).toBe("UNAVAILABLE");
    engine.reset();
    expect(engine.snapshot(now(4)).eligibleLandmarkIds).toEqual([]);
  });
  it("allows only a bounded continuity grace after GPS expiry", () => {
    const engine = new ContextualLandfallEngine(fixture(), identity);
    engine.ingestPosition(position("fix", 1), now(1));
    expect(engine.snapshot(now(17))).toMatchObject({
      state: "UNCERTAIN",
      evidenceCategories: [],
      eligibleLandmarkIds: [],
      routeMatch: null,
    });
    expect(engine.snapshot(now(27)).state).toBe("UNAVAILABLE");
  });
  it("requires all ancestor footprints for landmark eligibility and safely supports regional gates", () => {
    const definition = fixture();
    definition.context!.regions[1].geometry = {
      type: "POINT_RADIUS",
      center: physicalCoordinate(44.002, -72),
      radius: 20,
    };
    const engine = new ContextualLandfallEngine(definition, identity);
    expect(engine.ingestPosition(position("outside-parent", 1), now(1)).eligibleLandmarkIds).toEqual([]);
    const gate = fixture();
    gate.context!.regions[2].geometry = {
      type: "ENTRANCE_GATE",
      start: physicalCoordinate(43.9999, -72),
      end: physicalCoordinate(44.0001, -72),
      direction: "EITHER",
    };
    expect(new ContextualLandfallEngine(gate, identity).ingestPosition(position("gate", 1), now(1)).regionId).toBe(
      "gallery",
    );
  });
  it("discards revoked sensor hints while preserving current position guidance", () => {
    const engine = new ContextualLandfallEngine(fixture(), identity);
    engine.ingestPosition(position("position", 1), now(1));
    engine.ingestEvidence(evidence("HEADING", "heading", 2, { degrees: 90, accuracyDegrees: 5 }), now(2));
    engine.ingestEvidence(evidence("MOTION", "motion", 2, { moving: true }), now(2));
    const before = engine.snapshot(now(2));
    expect(before.evidenceCategories).toEqual(expect.arrayContaining(["POSITION", "HEADING", "MOTION"]));
    const after = engine.discardSensorHints(now(2));
    expect(after.evidenceCategories).toContain("POSITION");
    expect(after.evidenceCategories).not.toContain("HEADING");
    expect(after.evidenceCategories).not.toContain("MOTION");
  });
  it("normalizes optional GPS hints, ignores stationary course and keeps vertical movement uncertain", () => {
    const engine = new ContextualLandfallEngine(fixture(), identity);
    const first = {
      ...position("height-1", 1),
      headingDegrees: 90,
      speedMetersPerSecond: 0,
      altitudeMeters: 10,
      altitudeAccuracyMeters: 0.5,
    };
    const snapshot = engine.ingestPosition(first, now(1));
    expect(snapshot.evidenceCategories).toEqual(expect.arrayContaining(["POSITION", "MOTION", "ELEVATION"]));
    expect(snapshot.evidenceCategories).not.toContain("HEADING");
    expect(snapshot.state).toBe("INFERRED");
    const risen = engine.ingestPosition(
      {
        ...position("height-2", 3),
        headingDegrees: 0,
        speedMetersPerSecond: 2,
        altitudeMeters: 15,
        altitudeAccuracyMeters: 0.5,
      },
      now(3),
    );
    expect(risen).toMatchObject({ state: "UNCERTAIN", regionId: "building", level: null });
    expect(risen.reasons.join(" ")).toMatch(/level transition/);
    const unreliable = new ContextualLandfallEngine(fixture(), identity);
    unreliable.ingestPosition(
      { ...position("uncertain-height-1", 1), altitudeMeters: 0, altitudeAccuracyMeters: 30 },
      now(1),
    );
    expect(
      unreliable.ingestPosition(
        { ...position("uncertain-height-2", 3), altitudeMeters: 15, altitudeAccuracyMeters: 30 },
        now(3),
      ).state,
    ).toBe("INFERRED");
  });
  it("caps runtime fine GPS evidence while preserving outdoor confirmation and reset lifecycle", () => {
    const providers = new LandfallProviderRegistry();
    providers.register({
      id: "sim-physical",
      source: "BROWSER_GEOLOCATION",
      worldspaceKinds: ["PHYSICAL"],
      state: "AVAILABLE",
    });
    const runtime = new LandfallRuntime(fixture(), identity, providers);
    runtime.setActiveWaypoint("town-arrival");
    runtime.ingest(position("first", 1), now(1));
    expect(runtime.ingest(position("second", 3), now(3)).confidence).toBe("LIKELY_INSIDE");
    expect(runtime.diagnostics().pendingCount).toBe(0);
    expect(runtime.contextSnapshot(now(3)).regionId).toBe("gallery");
    runtime.pause();
    expect(runtime.contextSnapshot(now(4)).state).toBe("UNAVAILABLE");
    expect(runtime.ingestContext(evidence("MOTION", "paused", 4, { moving: true }), now(4)).rejection).toBe("PAUSED");
    const outdoor = new LandfallRuntime(landfallFixture, identity, providers);
    outdoor.setActiveWaypoint("town-arrival");
    outdoor.ingest(position("outdoor-1", 1), now(1));
    expect(outdoor.ingest(position("outdoor-2", 3), now(3)).confidence).toBe("CONFIRMED");
    const siteDefinition = fixture();
    siteDefinition.waypoints[0].regionId = "site";
    delete siteDefinition.waypoints[0].landmarkId;
    siteDefinition.context!.landmarks = [];
    const siteRuntime = new LandfallRuntime(siteDefinition, identity, providers);
    siteRuntime.setActiveWaypoint("town-arrival");
    siteRuntime.ingest(position("site-1", 1), now(1));
    expect(siteRuntime.ingest(position("site-2", 3), now(3)).confidence).toBe("CONFIRMED");
    siteRuntime.setPermission("DENIED");
    expect(
      siteRuntime.ingestContext(evidence("OBSERVATION", "fallback-region", 4, { regionId: "gallery" }), now(4)).state,
    ).toBe("CONFIRMED");
  });
});

describe("continuity-aware route segments", () => {
  function routed(points: [number, number][]): LandfallDefinition {
    const definition = fixture();
    definition.routes[0].geometry = {
      type: "ROUTE_LINE",
      points: points.map(([north, east]) => physicalCoordinate(44 + north / 111195, -72 + east / 79987)),
    };
    definition.routes[0].offRouteTolerance = 8;
    return validateLandfallDefinition(definition);
  }
  it("keeps the approached segment at a crossing and reports ambiguity", () => {
    const engine = new ContextualLandfallEngine(
      routed([
        [-50, -50],
        [50, 50],
        [-50, 50],
        [50, -50],
      ]),
      identity,
    );
    expect(engine.ingestPosition(position("approach", 1, -15, -15), now(1)).routeMatch?.segmentIndex).toBe(0);
    const crossing = engine.ingestPosition(position("crossing", 4), now(4)).routeMatch;
    expect(crossing).toMatchObject({ segmentIndex: 0, ambiguous: true, direction: "FORWARD" });
  });
  it("reports backtracking and stationary direction on a segment", () => {
    const engine = new ContextualLandfallEngine(
      routed([
        [-100, 0],
        [100, 0],
      ]),
      identity,
    );
    engine.ingestPosition(position("first", 1), now(1));
    expect(engine.ingestPosition(position("back", 3, -15), now(3)).routeMatch?.direction).toBe("BACKWARD");
    expect(engine.ingestPosition(position("still", 5, -15), now(5)).routeMatch?.direction).toBe("STATIONARY");
  });
  it("does not switch to a parallel return leg on noisy nearby positions", () => {
    const engine = new ContextualLandfallEngine(
      routed([
        [-60, 0],
        [60, 0],
        [60, 6],
        [-60, 6],
      ]),
      identity,
    );
    engine.ingestPosition(position("initial", 1, 0, 0, 4), now(1));
    expect(engine.ingestPosition(position("parallel-noise", 3, 10, 5, 4), now(3)).routeMatch).toMatchObject({
      segmentIndex: 0,
      ambiguous: true,
    });
  });
  it("follows adjacent loop segments and marks competing branches ambiguous", () => {
    const definition = routed([
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20],
      [0, 0],
    ]);
    const engine = new ContextualLandfallEngine(definition, identity);
    engine.ingestPosition(position("loop-start", 1, 15, 0), now(1));
    expect(engine.ingestPosition(position("loop-turn", 3, 20, 10), now(3)).routeMatch?.segmentIndex).toBe(1);
    const branch = structuredClone(definition.routes[0]);
    branch.id = "branch-route";
    definition.routes.push(branch);
    const branched = new ContextualLandfallEngine(definition, identity);
    expect(branched.ingestPosition(position("branch", 1, 15, 0), now(1)).routeMatch?.ambiguous).toBe(true);
  });
  it("preserves direction around a loop closing point and on the reverse crossing", () => {
    const definition = routed([
      [0, 0],
      [40, 0],
      [40, 40],
      [0, 40],
      [0, 0],
    ]);
    definition.routes[0].model = "LOOP";
    const engine = new ContextualLandfallEngine(definition, identity);
    engine.ingestPosition(position("before-wrap", 1, 0, 6), now(1));
    expect(engine.ingestPosition(position("after-wrap", 3, 8, 0), now(3)).routeMatch).toMatchObject({
      segmentIndex: 0,
      direction: "FORWARD",
      ambiguous: false,
    });
    expect(engine.ingestPosition(position("reverse-wrap", 5, 0, 8), now(5)).routeMatch).toMatchObject({
      segmentIndex: 3,
      direction: "BACKWARD",
      ambiguous: false,
    });
  });
  it("uses authored corridor width and narrows overlapping region footprints only after segment continuity", () => {
    const definition = routed([
      [-50, 0],
      [50, 0],
    ]);
    definition.context!.regions.push(region("upper-gallery", "GALLERY", 35, { parentId: "building", level: "upper" }));
    definition.routes[0].geometry = {
      type: "CORRIDOR",
      points: (definition.routes[0].geometry as { points: ReturnType<typeof physicalCoordinate>[] }).points,
      width: 30,
    };
    definition.routes[0].segmentRegionIds = ["gallery"];
    definition.routes[0].offRouteTolerance = 0;
    const engine = new ContextualLandfallEngine(validateLandfallDefinition(definition), identity);
    expect(engine.ingestPosition(position("initial", 1, 0, 12), now(1))).toMatchObject({
      state: "UNCERTAIN",
      regionId: "building",
    });
    expect(engine.ingestPosition(position("stationary", 2, 0, 12), now(2)).regionId).toBe("building");
    engine.ingestPosition(position("moving", 4, 15, 12), now(4));
    expect(engine.ingestPosition(position("continued", 6, 20, 12), now(6))).toMatchObject({
      state: "INFERRED",
      regionId: "gallery",
    });
    expect(engine.snapshot(now(6)).routeMatch).not.toBeNull();
  });
  it("requires coherent movement hints to promote a route inference and does not let impossible jumps advance it", () => {
    const engine = new ContextualLandfallEngine(
      routed([
        [-100, 0],
        [100, 0],
      ]),
      identity,
    );
    engine.ingestPosition(position("start", 1), now(1));
    engine.ingestEvidence(evidence("MOTION", "motion", 2, { moving: true }), now(2));
    engine.ingestEvidence(evidence("HEADING", "noisy-course", 2, { degrees: 0, accuracyDegrees: 90 }), now(2));
    expect(engine.ingestPosition(position("next", 3, 10), now(3)).state).toBe("INFERRED");
    expect(
      engine.ingestEvidence(evidence("HEADING", "wrong-course", 4, { degrees: 90, accuracyDegrees: 5 }), now(4)).state,
    ).toBe("INFERRED");
    engine.ingestEvidence(evidence("HEADING", "good-course", 5, { degrees: 0, accuracyDegrees: 5 }), now(5));
    expect(engine.snapshot(now(5)).state).toBe("LIKELY");
    const before = engine.snapshot(now(5)).routeMatch;
    expect(engine.ingestPosition(position("teleport", 6, 900), now(6)).rejection).toBe("IMPOSSIBLE_SPEED");
    expect(engine.snapshot(now(6)).routeMatch).toEqual(before);
  });
});
