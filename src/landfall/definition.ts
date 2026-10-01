import { parseLandfallDefinition, type LandfallDefinition } from "@/landfall/schema";
import { validateGeometry } from "@/landfall/geometry";

/** Strict complete validation before persistence, publishing, or simulation. */
export function validateLandfallDefinition(input: unknown): LandfallDefinition {
  const definition = parseLandfallDefinition(input);
  const worldspaces = new Map(definition.worldspaces.map((worldspace) => [worldspace.id, worldspace]));
  for (const waypoint of definition.waypoints)
    validateGeometry(waypoint.geometry, worldspaces.get(waypoint.worldspaceId)!);
  for (const route of definition.routes)
    if (route.geometry) validateGeometry(route.geometry, worldspaces.get(route.worldspaceId)!);
  for (const region of definition.context?.regions ?? [])
    validateGeometry(region.geometry, worldspaces.get(region.worldspaceId)!);
  return definition;
}

export function parseStoredLandfallDefinition(raw: string | null | undefined): LandfallDefinition | null {
  if (!raw) return null;
  if (Buffer.byteLength(raw, "utf8") > 1024 * 1024) throw new Error("LANDFALL_DEFINITION_TOO_LARGE");
  return validateLandfallDefinition(JSON.parse(raw));
}
