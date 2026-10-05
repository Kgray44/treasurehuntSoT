import { describe, expect, it } from "vitest";
import { landfallFixture, physicalCoordinate } from "@/landfall/fixtures";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import { projectLandfallMap, mapLibreFeatures } from "@/landfall/map-projection";
import { ReleasedChartLookupProvider, selectReleasedChartPlace } from "@/landfall/chart-search";
import { AuthoredGeocodingProvider } from "@/landfall/local-providers";

const bootstrap = () =>
  projectPlayerLandfallBootstrap(
    {
      sessionId: "synthetic-search",
      publishedVersionId: "search-pin",
      taleId: "fixture-tale",
      currentSequence: 0,
      definition: landfallFixture,
    },
    { chapterId: null, blockId: null, releasedAssets: [] },
  );

describe("released Chart lookup", () => {
  it("cannot search internal names, unreleased geometry or a different Worldspace", () => {
    const input = bootstrap();
    const evaluation = {
      ...input.runtimeDefinition,
      waypoints: input.runtimeDefinition.waypoints.map((waypoint) => ({ ...waypoint, name: "internal secret" })),
    };
    const hidden = {
      id: "broad-place",
      label: "Approximate place",
      kind: "POINT" as const,
      coordinates: [],
      hiddenCenter: true,
    };
    const scene = { ...input.scene, features: [...input.scene.features, hidden] };
    const foreign = projectLandfallMap(landfallFixture, {
      activeWorldspaceId: "isles",
      availableLocations: [{ id: "isle-region" }],
      activeRouteId: null,
    });
    const provider = new ReleasedChartLookupProvider({
      ...input,
      runtimeDefinition: evaluation,
      scene,
      availableMaps: [
        { id: scene.mapId, name: "Town Chart", scene, offlineMap: "PARTIAL" },
        { id: foreign.mapId, name: "Withheld Worldspace", scene: foreign, offlineMap: "UNAVAILABLE" },
      ],
    });
    expect(provider.forward("internal secret")).toEqual([]);
    expect(provider.forward("Secret Isle")).toEqual([]);
    expect(provider.forward("Ｔｏｗｎ")[0]).toMatchObject({ label: "Town arrival", mapId: "town-map" });
    expect(provider.forward("Approximate")).toEqual([
      {
        id: "broad-place",
        label: "Approximate place",
        kind: "POINT",
        mapId: "town-map",
        mapName: "Town Chart",
        precision: "WITHHELD",
      },
    ]);
    const selected = selectReleasedChartPlace(scene, hidden.id);
    expect(selected.camera).toBe(scene.camera);
    expect(mapLibreFeatures(selected).features.some((feature) => feature.properties?.id === hidden.id)).toBe(false);
    expect(provider.forward("x".repeat(241))).toEqual([]);
    expect(() => provider.forward("Town", 21)).toThrow("LIMIT_INVALID");
  });
  it("selects displayed physical and virtual geometry without creating observations or changing the pinned scene", () => {
    const physical = bootstrap().scene;
    const selected = selectReleasedChartPlace(physical, "town-arrival");
    expect(selected.camera.center).toEqual(physical.features[0].coordinates[0]);
    expect(selected.camera.zoom).toBe(physical.camera.zoom);
    expect(selected.currentPosition).toBeUndefined();
    expect(physical.selectedFeatureId).toBeUndefined();
    expect(
      mapLibreFeatures(selected).features.find((feature) => feature.properties?.id === "town-arrival")?.properties
        ?.selected,
    ).toBe(true);
    expect(selectReleasedChartPlace(physical, "unreleased")).toBe(physical);
    const virtual = projectLandfallMap(landfallFixture, {
      activeWorldspaceId: "isles",
      availableLocations: [{ id: "isle-region" }],
      activeRouteId: null,
    });
    const result = selectReleasedChartPlace(virtual, "isle-region");
    expect(result).toMatchObject({ selectedFeatureId: "isle-region", worldspaceKind: "VIRTUAL" });
    expect(result.camera).toBe(virtual.camera);
    expect(result.bounds).toBe(virtual.bounds);
  });
  it("the coordinate lookup honors public labels and never reverses withheld centers", () => {
    const domain = structuredClone(landfallFixture);
    domain.waypoints[0].name = "internal name";
    domain.waypoints[0].visibility.publicLabel = "Shown place";
    const exact = new AuthoredGeocodingProvider(domain);
    expect(exact.forward({ query: "internal", worldspaceId: "town" })).toEqual([]);
    expect(exact.forward({ query: "Shown", worldspaceId: "town" })).toHaveLength(1);
    domain.waypoints[0].geometry = {
      type: "APPROXIMATE_REGION",
      center: physicalCoordinate(44, -72),
      radius: 100,
      publicRadius: 1000,
    };
    const approximate = new AuthoredGeocodingProvider(domain);
    expect(approximate.forward({ query: "Shown", worldspaceId: "town" })).toEqual([]);
    expect(approximate.reverse(physicalCoordinate(44, -72), 1000)).toEqual([]);
  });
});
