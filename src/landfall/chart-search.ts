import type { PlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import type { LandfallMapFeature, LandfallMapScene } from "@/landfall/map-projection";

export type ReleasedChartPlace = Readonly<{
  id: string;
  label: string;
  mapId: string;
  mapName: string;
  kind: LandfallMapFeature["kind"];
  precision: "WITHHELD" | "DISPLAYED_GEOMETRY";
}>;

const normalized = (value: string) => value.trim().normalize("NFKC").toLowerCase();

/** Local semantic lookup indexes only released presentation, never evaluation geometry. */
export class ReleasedChartLookupProvider {
  private readonly places: ReleasedChartPlace[];
  constructor(bootstrap: PlayerLandfallBootstrap) {
    const maps = bootstrap.availableMaps ?? [];
    const scenes = maps.some((map) => map.id === bootstrap.scene.mapId)
      ? maps
      : [...maps, { id: bootstrap.scene.mapId, name: bootstrap.worldspaceName, scene: bootstrap.scene }];
    const seen = new Set<string>();
    this.places = scenes.flatMap((map) => {
      if (map.scene.worldspaceId !== bootstrap.scene.worldspaceId || map.id !== map.scene.mapId) return [];
      return map.scene.features.flatMap((feature) => {
        const key = JSON.stringify([map.id, feature.id]);
        if (seen.has(key)) return [];
        seen.add(key);
        return [
          {
            id: feature.id,
            label: feature.label,
            mapId: map.id,
            mapName: map.name,
            kind: feature.kind,
            precision:
              feature.hiddenCenter || !feature.coordinates.length
                ? ("WITHHELD" as const)
                : ("DISPLAYED_GEOMETRY" as const),
          },
        ];
      });
    });
  }
  forward(query: string, limit = 10): ReleasedChartPlace[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("LANDFALL_LOOKUP_LIMIT_INVALID");
    if (query.length > 240 || !normalized(query)) return [];
    const term = normalized(query);
    return this.places
      .filter((place) => normalized(place.label).includes(term))
      .sort((a, b) => a.label.localeCompare(b.label) || a.mapId.localeCompare(b.mapId) || a.id.localeCompare(b.id))
      .slice(0, limit)
      .map((place) => ({ ...place }));
  }
}

/** A selection is view state, never a device position, observation or waypoint confirmation. */
export function selectReleasedChartPlace(scene: LandfallMapScene, featureId: string): LandfallMapScene {
  const feature = scene.features.find((item) => item.id === featureId);
  if (!feature) return scene;
  const point = !feature.hiddenCenter && feature.kind === "POINT" ? feature.coordinates[0] : undefined;
  return {
    ...scene,
    selectedFeatureId: feature.id,
    ...(scene.worldspaceKind === "PHYSICAL" && point ? { camera: { ...scene.camera, center: point } } : {}),
  };
}
