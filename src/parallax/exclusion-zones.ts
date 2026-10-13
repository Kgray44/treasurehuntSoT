import { roomEnvironmentSchema, type RoomEnvironment, type RoomFeature } from "./environment-contracts";
import { createGenericRoomFeature } from "./room-feature-construction";
import { discoverRoomSurfaces, syntheticRoomGeometry, type PlanarRectangle } from "./room-geometry";

const pairKey = (sourceFeatureId: string, surfaceId: string) => `${sourceFeatureId}|${surfaceId}`;
// Stable, bounded authoring identities. Collision checks below never silently replace another feature.
function zoneId(key: string) {
  let hash = 2166136261;
  for (const character of key) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return `exclusion-${hash.toString(16)}`;
}

/** Automatic envelopes follow modeled blockers on a specific support face.
 * Manual zones remain independent. Historical environments are untouched until enabled.
 * This consumes the same discovery projection as placement, not a second collision engine.
 */
export function reconcileRoomExclusions(input: RoomEnvironment): RoomEnvironment {
  if (!input.exclusionZonesEnabled) return input;
  const physical = input.features.filter((feature) => feature.classification !== "EXCLUSION_ZONE");
  const surfaces = new Set(
    physical.flatMap((feature) => feature.parts.filter((part) => part.surface).map((part) => part.id)),
  );
  const sources = new Map(physical.map((feature) => [feature.id, feature]));
  const suppressed = new Set(
    (input.suppressedExclusions ?? []).map((pair) => pairKey(pair.sourceFeatureId, pair.surfaceId)),
  );
  const previous = new Map(
    input.features
      .filter((feature) => feature.exclusion?.sourceFeatureId && feature.exclusion.surfaceId)
      .map((feature) => [pairKey(feature.exclusion!.sourceFeatureId!, feature.exclusion!.surfaceId!), feature]),
  );
  const features = input.features
    .filter((feature) => !feature.exclusion?.sourceFeatureId)
    .map((feature) => {
      if (feature.exclusion?.surfaceId && !surfaces.has(feature.exclusion.surfaceId)) {
        // A manually reserved area survives support deletion as a world-space volume.
        return { ...feature, exclusion: {} };
      }
      return feature;
    });
  const used = new Set(features.map((feature) => feature.id));
  const geometry = syntheticRoomGeometry({ ...input, features: physical, horizontal: true, vertical: true });
  for (const surface of discoverRoomSurfaces(
    geometry,
    { tracking: true, clutter: 0 },
    { includeObstructionIdentity: true },
  )) {
    const support = geometry.find((part) => part.id === surface.id)!;
    for (const obstruction of (surface.exclusions ?? []) as (PlanarRectangle & { featureId?: string })[]) {
      const source = sources.get(obstruction.featureId ?? "");
      if (
        !source ||
        ["FLOOR", "WALL", "CEILING"].includes(source.classification) ||
        source.id === support.featureId ||
        Math.abs(obstruction.x) >= (surface.widthMeters + obstruction.width) / 2 ||
        Math.abs(obstruction.y) >= (surface.depthMeters + obstruction.depth) / 2
      )
        continue;
      const key = pairKey(source.id, surface.id);
      if (suppressed.has(key)) continue;
      const before = previous.get(key),
        id = before?.id ?? zoneId(key);
      if (used.has(id))
        throw new Error(
          "Exclusion identity conflict. Rename the conflicting feature identity before regenerating zones.",
        );
      used.add(id);
      features.push(
        createGenericRoomFeature({
          id,
          classification: "EXCLUSION_ZONE",
          name: before?.name ?? `${source.name} exclusion`.slice(0, 120),
          position: source.position,
          dimensions: source.dimensions,
          yawDegrees: source.yawDegrees,
          exclusion: { sourceFeatureId: source.id, surfaceId: surface.id },
          // A conservative modeled envelope, never extra photographic or physical evidence.
          provenance: { ...source.provenance, basis: "INFERRED" },
        }),
      );
    }
  }
  return roomEnvironmentSchema.parse({ ...input, features });
}

export function enableRoomExclusions(input: RoomEnvironment) {
  return reconcileRoomExclusions({ ...input, exclusionZonesEnabled: true });
}

/** Editing an automatic envelope detaches it; regeneration must not overwrite the edit. */
export function detachRoomExclusion(input: RoomEnvironment, id: string): RoomEnvironment {
  const feature = input.features.find((feature) => feature.id === id);
  if (!feature?.exclusion?.sourceFeatureId || !feature.exclusion.surfaceId) return input;
  const suppressedExclusions = [...(input.suppressedExclusions ?? [])];
  const pair = { sourceFeatureId: feature.exclusion.sourceFeatureId, surfaceId: feature.exclusion.surfaceId };
  if (
    !suppressedExclusions.some(
      (entry) => pairKey(entry.sourceFeatureId, entry.surfaceId) === pairKey(pair.sourceFeatureId, pair.surfaceId),
    )
  )
    suppressedExclusions.push(pair);
  return roomEnvironmentSchema.parse({
    ...input,
    suppressedExclusions,
    features: input.features.map((entry) =>
      entry.id === id ? { ...entry, exclusion: { surfaceId: feature.exclusion!.surfaceId } } : entry,
    ),
  });
}

export function patchRoomExclusion(input: RoomEnvironment, id: string, change: Partial<RoomFeature>) {
  const detached = detachRoomExclusion(input, id);
  return reconcileRoomExclusions({
    ...detached,
    features: detached.features.map((feature) =>
      feature.id === id
        ? {
            ...feature,
            ...change,
            provenance: { ...feature.provenance, basis: "CREATOR_CONFIRMED" as const, confidence: 1 },
          }
        : feature,
    ),
  });
}
