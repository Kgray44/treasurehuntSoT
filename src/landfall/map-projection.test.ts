import { describe, expect, it } from "vitest";
import { landfallFixture, physicalCoordinate } from "@/landfall/fixtures";
import { mapLibreFeatures, projectLandfallMap } from "@/landfall/map-projection";

describe("Landfall map projection", () => {
  it("requires explicit released region IDs and rejects public access even to authorized private geometry", () => {
    const definition = structuredClone(landfallFixture);
    const region = {
      id: "gallery",
      worldspaceId: "town",
      mapId: definition.maps[0].id,
      name: "Gallery",
      kind: "GALLERY" as const,
      geometry: definition.waypoints[0].geometry,
      privacyClassification: "PUBLIC_REAL_WORLD" as const,
      hiddenUntilRevealed: false,
    };
    definition.context = {
      regions: [region, { ...region, id: "private", privacyClassification: "PRIVATE_REAL_WORLD" }],
      landmarks: [],
    };
    const chart = {
      audience: "PLAYER" as const,
      activeWorldspaceId: "town",
      availableLocations: [],
      activeRouteId: null,
    };
    expect(projectLandfallMap(definition, chart).features).toEqual([]);
    expect(
      projectLandfallMap(definition, { ...chart, availableRegionIds: ["gallery", "private"] }).features.map(
        (item) => item.id,
      ),
    ).toEqual(["gallery", "private"]);
    expect(() =>
      projectLandfallMap(definition, { ...chart, audience: "PUBLIC", availableRegionIds: ["private"] }),
    ).toThrow("LANDFALL_PUBLIC_MAP_NOT_AVAILABLE_PHASE_1");
  });
  it("builds physical MapLibre geography only from visible locations", () => {
    const scene = projectLandfallMap(landfallFixture, {
      activeWorldspaceId: "town",
      availableLocations: [{ id: "town-arrival" }],
      activeRouteId: "town-route",
    });
    expect(scene.renderer).toBe("MAPLIBRE_STYLE");
    expect(mapLibreFeatures(scene).features.map((item) => item.properties?.id)).toEqual(["town-arrival", "town-route"]);
    expect(mapLibreFeatures(scene).features[0].geometry).toMatchObject({ type: "Point", coordinates: [-72, 44] });
    expect(
      mapLibreFeatures({
        ...scene,
        currentPosition: { coordinates: [-72, 44], accuracyMeters: 8, confidence: "NEARBY", observedAt: 1000 },
      }).features.at(-1),
    ).toMatchObject({
      properties: { kind: "CURRENT_POSITION", accuracyMeters: 8, confidence: "NEARBY" },
      geometry: { type: "Point", coordinates: [-72, 44] },
    });
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
  it("withholds a hidden route until a canonical reveal and limits the next leg", () => {
    const definition = structuredClone(landfallFixture);
    const route = definition.routes.find((item) => item.id === "town-route")!;
    route.presentation = { visibility: "HIDDEN", revealOnSelection: false, deviationResponse: "NONE" };
    const chart = {
      activeWorldspaceId: "town",
      availableLocations: [{ id: "town-arrival" }],
      activeRouteId: "town-route",
      activeWaypointId: "town-arrival",
    };
    expect(projectLandfallMap(definition, chart).features.map((item) => item.id)).toEqual(["town-arrival"]);
    expect(
      projectLandfallMap(definition, { ...chart, revealedRouteIds: ["town-route"] }).features.map((item) => item.id),
    ).toEqual(["town-arrival", "town-route"]);
    route.presentation.visibility = "NEXT_SEGMENT";
    const segment = projectLandfallMap(definition, chart).features.find((item) => item.id === "town-route");
    expect(segment?.kind).toBe("LINE");
    expect(segment?.coordinates.length).toBeGreaterThanOrEqual(2);
    route.presentation.visibility = "ROUGH_BEARING";
    expect(projectLandfallMap(definition, chart).features.map((item) => item.id)).toEqual(["town-arrival"]);
  });
});
