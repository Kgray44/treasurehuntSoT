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

describe("Landfall Studio authoring model", () => {
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
