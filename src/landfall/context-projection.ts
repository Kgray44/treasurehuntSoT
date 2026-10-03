import { distance, toWgs84 } from "@/landfall/geometry";
import type { LandfallDefinition, LandfallWorldspace, LandfallGeometry } from "@/landfall/schema";

type Region = NonNullable<LandfallDefinition["context"]>["regions"][number];
export const approximateContextKinds = new Set<Region["kind"]>(["SITE", "OUTDOOR_COMPACT"]);
export function defaultContextPrivacy(worldspace: LandfallWorldspace): Region["privacyClassification"] {
  return worldspace.kind === "PHYSICAL" &&
    ["APPROXIMATE_REAL_WORLD", "GENERIC"].includes(worldspace.privacyPolicy.classification)
    ? "PRIVATE_REAL_WORLD"
    : worldspace.privacyPolicy.classification;
}
/** Authored private geometry is Chronicle-authorized data, not live Player location.
 * Public/Community never receives private geometry. Approximate broad regions have
 * one deterministic, reduced-precision evaluation shape; canonical geometry is untouched. */
export function projectContextRegion(
  region: Region,
  worldspace: LandfallWorldspace,
  audience: "PLAYER" | "CAPTAIN" | "REPLAY" | "PUBLIC" | "CREATOR_TEST",
): Region | null {
  if (audience === "CREATOR_TEST") return region;
  if (audience === "PUBLIC" && region.privacyClassification === "PRIVATE_REAL_WORLD") return null;
  if (worldspace.kind !== "PHYSICAL" || !["APPROXIMATE_REAL_WORLD", "GENERIC"].includes(region.privacyClassification))
    return region;
  if (!approximateContextKinds.has(region.kind)) return null;
  if (worldspace.coordinateReference.type !== "WGS84") return null;
  const g: LandfallGeometry = region.geometry;
  const points =
    g.type === "POINT_RADIUS" || g.type === "APPROXIMATE_REGION"
      ? [g.center]
      : g.type === "POLYGON"
        ? g.rings.flat()
        : g.type === "MULTIPOLYGON"
          ? g.polygons.flat(2)
          : g.type === "ENTRANCE_GATE"
            ? [g.start, g.end]
            : g.points;
  const first = toWgs84(points[0], worldspace);
  const center = {
    type: "WGS84" as const,
    worldspaceId: worldspace.id,
    referenceId: worldspace.coordinateReference.id,
    referenceVersion: worldspace.coordinateReference.version,
    latitude: Math.round(first.latitude * 1000) / 1000,
    longitude: Math.round(first.longitude * 1000) / 1000,
  };
  const padding =
    g.type === "POINT_RADIUS"
      ? g.radius
      : g.type === "APPROXIMATE_REGION"
        ? g.publicRadius
        : g.type === "CORRIDOR"
          ? g.width / 2
          : 0;
  const radius = Math.max(
    500,
    Math.ceil((Math.max(...points.map((p) => distance(center, p, worldspace))) + padding) / 100) * 100,
  );
  if (radius > 100000) return null;
  return { ...region, geometry: { type: "APPROXIMATE_REGION", center, radius, publicRadius: radius } };
}
