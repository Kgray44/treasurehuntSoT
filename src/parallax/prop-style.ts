import type { SpatialEntity } from "./contracts";

/** A label can change without changing a prop's authored visual identity. */
export function spatialPropStyle(entity: Pick<SpatialEntity, "kind" | "name" | "propStyle">) {
  return (
    entity.propStyle ??
    (entity.kind === "MARKER"
      ? /footprint/i.test(entity.name)
        ? "FOOTPRINT"
        : "COMPASS"
      : entity.kind === "PARCHMENT"
        ? /letter|note/i.test(entity.name)
          ? "LETTER"
          : "MAP"
        : "TEXT")
  );
}

/** Legacy preset IDs infer their side once; copies persist it before remapping. */
export function spatialFootprintSide(entity: Pick<SpatialEntity, "id" | "footprintSide">): "LEFT" | "RIGHT" {
  return entity.footprintSide ?? (Number(entity.id.match(/:entity-(\d+)$/)?.[1] ?? 0) % 2 ? "RIGHT" : "LEFT");
}
