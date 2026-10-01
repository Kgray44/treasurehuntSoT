import { describe, expect, it } from "vitest";
import {
  addLandfallWorldspace,
  applyLandfallPreset,
  coordinateAt,
  createLandfallWaypoint,
  createLandfallWorldspace,
  landfallAuthoringFindings,
} from "@/landfall/authoring";
import { validateLandfallDefinition } from "@/landfall/definition";
import type { LandfallDefinition } from "@/landfall/schema";

describe("Landfall Studio authoring model", () => {
  it("makes private layouts and unusable landmark references visible before publication", () => {
    const base = createLandfallWorldspace({ taleId: "synthetic-tale", name: "Synthetic museum", kind: "PHYSICAL" });
    const waypoint = createLandfallWaypoint(
      base.worldspaces[0],
      base.maps[0],
      base.maps[0].camera.center,
      "Synthetic exhibit",
    );
    const definition = validateLandfallDefinition({
      ...base,
      worldspaces: base.worldspaces.map((item) => ({
        ...item,
        observationPolicy: {
          ...item.observationPolicy,
          allowedSources: [...item.observationPolicy.allowedSources, "VISION_WAYPOINT"],
        },
      })),
      waypoints: [
        {
          ...waypoint,
          regionId: "private-room",
          landmarkId: "exhibit",
          evidenceProfile: {
            ...waypoint.evidenceProfile,
            acceptedSources: [...waypoint.evidenceProfile.acceptedSources, "VISION_WAYPOINT"],
          },
        },
      ],
      context: {
        regions: [
          {
            id: "private-room",
            worldspaceId: base.worldspaces[0].id,
            mapId: base.maps[0].id,
            name: "Synthetic private room",
            kind: "ROOM",
            geometry: waypoint.geometry,
            hiddenUntilRevealed: false,
            privacyClassification: "PRIVATE_REAL_WORLD",
          },
        ],
        landmarks: [
          {
            id: "exhibit",
            regionId: "private-room",
            waypointId: waypoint.id,
            name: "Synthetic exhibit",
            guidance: "Use the readable fallback.",
            referenceAssetIds: ["missing-image"],
            negativeReferenceAssetIds: [],
            minimumFrames: 2,
            fallback: waypoint.fallback,
            privacyClassification: "PRIVATE_REAL_WORLD",
          },
        ],
      },
    });
    const findings = landfallAuthoringFindings(definition, "PUBLIC", []);
    expect(findings.find((item) => item.code === "LANDFALL_PUBLIC_PRIVATE_CONTEXT")?.severity).toBe("blocker");
    expect(findings.find((item) => item.code === "LANDFALL_LANDMARK_REFERENCE_UNAVAILABLE")?.severity).toBe("blocker");
    expect(findings.map((item) => item.code)).toContain("LANDFALL_CONTEXT_LEVEL_UNSUPPORTED");
  });

  it("does not treat fallback configuration as a GPS precision guarantee", () => {
    const base = createLandfallWorldspace({ taleId: "synthetic-tale", name: "Synthetic park", kind: "PHYSICAL" });
    const waypoint = createLandfallWaypoint(
      base.worldspaces[0],
      base.maps[0],
      base.maps[0].camera.center,
      "Synthetic marker",
    );
    const definition: LandfallDefinition = {
      ...base,
      waypoints: [
        {
          ...waypoint,
          evidenceProfile: {
            ...waypoint.evidenceProfile,
            precisionProfile: "EXACT_OBJECT" as const,
            acceptedSources: ["BROWSER_GEOLOCATION" as const],
          },
        },
      ],
    };
    expect(
      landfallAuthoringFindings(definition, "PRIVATE").find(
        (item) => item.code === "LANDFALL_EXACT_TARGET_INDEPENDENT_EVIDENCE",
      )?.severity,
    ).toBe("blocker");
    // Independent text/confirmation/Captain observation blocks are checked by publication validation.
    definition.waypoints[0].evidenceProfile.acceptedSources.push("PLAYER_CONFIRMATION");
    expect(landfallAuthoringFindings(definition, "PRIVATE").map((item) => item.code)).not.toContain(
      "LANDFALL_EXACT_TARGET_INDEPENDENT_EVIDENCE",
    );
  });
  it("creates compatible real and virtual Worldspaces in one Chronicle without mixing coordinates", () => {
    const physical = createLandfallWorldspace({
      taleId: "synthetic-tale",
      name: "Public park",
      kind: "PHYSICAL",
      latitude: 40,
      longitude: -70,
    });
    const both = addLandfallWorldspace(physical, {
      taleId: "synthetic-tale",
      name: "Fictional sea",
      kind: "VIRTUAL",
    });
    expect(both.worldspaces.map((item) => item.kind)).toEqual(["PHYSICAL", "VIRTUAL"]);
    expect(both.maps.map((item) => item.source.type)).toEqual(["BUILTIN_RASTER", "AUTHORED_VECTOR"]);
    expect(both.maps[0].attribution[0]?.url).toBe("https://www.openstreetmap.org/copyright");
    expect(both.maps[0].camera.center).toMatchObject({ type: "WGS84", latitude: 40, longitude: -70 });
    expect(both.maps[1].camera.center).toMatchObject({ type: "LOCAL_CARTESIAN_2D", x: 500, y: 500 });
    expect(validateLandfallDefinition(both)).toEqual(both);
  });

  it("binds image-backed virtual maps to their Chronicle image asset", () => {
    const definition = createLandfallWorldspace({
      taleId: "synthetic-tale",
      name: "Fictional island",
      kind: "VIRTUAL",
      imageAssetId: "synthetic-image",
      imageWidth: 1200,
      imageHeight: 800,
    });
    expect(definition.worldspaces[0].coordinateReference).toMatchObject({
      type: "NORMALIZED_IMAGE_2D",
      imageAssetId: "synthetic-image",
      width: 1200,
      height: 800,
    });
    expect(definition.maps[0].source).toEqual({ type: "ASSET_IMAGE", assetId: "synthetic-image" });
  });

  it("keeps geometry stable on style changes and warns about unreliable physical radius", () => {
    const definition = createLandfallWorldspace({
      taleId: "synthetic-tale",
      name: "Public park",
      kind: "PHYSICAL",
      latitude: 40,
      longitude: -70,
    });
    const waypoint = createLandfallWaypoint(
      definition.worldspaces[0],
      definition.maps[0],
      coordinateAt(definition.worldspaces[0], -70, 40),
      "Park entrance",
    );
    const narrow = { ...waypoint, geometry: { ...waypoint.geometry, radius: 10 } };
    const authored = validateLandfallDefinition({ ...definition, waypoints: [narrow] });
    const themed = validateLandfallDefinition({
      ...authored,
      maps: [applyLandfallPreset(authored.maps[0], "NIGHT_HARBOR")],
    });
    expect(themed.waypoints).toEqual(authored.waypoints);
    expect(landfallAuthoringFindings(themed, "PRIVATE").map((item) => item.code)).toContain(
      "LANDFALL_RADIUS_BELOW_ACCURACY",
    );
  });
});
