import { describe, expect, it } from "vitest";
import { landfallFixture, physicalCoordinate } from "@/landfall/fixtures";
import { mapLibreFeatures, projectLandfallMap } from "@/landfall/map-projection";

describe("Landfall map projection", () => {
  it("builds physical MapLibre geography only from visible locations", () => {
    const scene = projectLandfallMap(landfallFixture, {
      activeWorldspaceId: "town",
      availableLocations: [{ id: "town-arrival" }],
      activeRouteId: "town-route",
    });
    expect(scene.renderer).toBe("MAPLIBRE_STYLE");
    expect(mapLibreFeatures(scene).features.map((item) => item.properties?.id)).toEqual(["town-arrival", "town-route"]);
    expect(mapLibreFeatures(scene).features[0].geometry).toMatchObject({ type: "Point", coordinates: [-72, 44] });
  });
  it("keeps unrevealed virtual regions out of image map data", () => {
    const hidden = projectLandfallMap(landfallFixture, {
      activeWorldspaceId: "isles",
      availableLocations: [],
      activeRouteId: null,
    });
    expect(hidden.features).toEqual([]);
    expect(hidden.imageAssetId).toBe("synthetic-chart");
    const revealed = projectLandfallMap(landfallFixture, {
      activeWorldspaceId: "isles",
      availableLocations: [{ id: "isle-region" }],
      activeRouteId: "isle-route",
    });
    expect(revealed.features.map((item) => item.id)).toEqual(["isle-region", "isle-route"]);
    expect(() => mapLibreFeatures(revealed)).toThrow("LANDFALL_MAPLIBRE_REQUIRES_PHYSICAL_WORLDSPACE");
  });
  it("does not serialize a private approximate center into the client map scene", () => {
    const definition = structuredClone(landfallFixture);
    definition.waypoints[0].geometry = {
      type: "APPROXIMATE_REGION",
      center: physicalCoordinate(45, -73),
      radius: 50,
      publicRadius: 500,
    };
    const scene = projectLandfallMap(definition, {
      activeWorldspaceId: "town",
      availableLocations: [{ id: "town-arrival" }],
      activeRouteId: null,
    });
    expect(scene.features[0]).toMatchObject({ coordinates: [], hiddenCenter: true });
    expect(JSON.stringify(scene.features)).not.toContain("-73");
    expect(mapLibreFeatures(scene).features).toEqual([]);
  });
  it("retains polygon holes and all polygons in the physical GeoJSON", () => {
    const definition = structuredClone(landfallFixture);
    const square = (latitude: number, longitude: number) => [
      physicalCoordinate(latitude, longitude),
      physicalCoordinate(latitude, longitude + 0.01),
      physicalCoordinate(latitude + 0.01, longitude + 0.01),
      physicalCoordinate(latitude + 0.01, longitude),
      physicalCoordinate(latitude, longitude),
    ];
    definition.waypoints[0].geometry = {
      type: "MULTIPOLYGON",
      polygons: [[square(44, -72), square(44.002, -71.998)], [square(44.02, -72.02)]],
    };
    const scene = projectLandfallMap(definition, {
      activeWorldspaceId: "town",
      availableLocations: [{ id: "town-arrival" }],
      activeRouteId: null,
    });
    const geometry = mapLibreFeatures(scene).features[0].geometry;
    expect(geometry.type).toBe("MultiPolygon");
    if (geometry.type === "MultiPolygon") expect(geometry.coordinates.map((polygon) => polygon.length)).toEqual([2, 1]);
  });
});
