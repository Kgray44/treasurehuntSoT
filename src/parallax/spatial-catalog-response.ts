import { z } from "zod";

const kind = z.enum(["ASSETS", "ENVIRONMENTS", "SCENES", "EFFECTS", "COMPOSITIONS"]);
const origin = z.enum(["BUILT_IN", "MY_CREATIONS", "RECONSTRUCTED", "INSTALLED"]);
const count = z.number().int().nonnegative();
const finite = z.number().finite();
const optionalText = z.string().nullable().optional();

/** Client-safe wire contract: compact pages never carry full Scene or Environment records. */
export const compactSpatialCatalogPageSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        kind,
        origin,
        name: z.string(),
        description: z.string(),
        family: z.string(),
        searchText: z.string(),
        thumbnail: z.string().optional(),
        preset: z.string().optional(),
        blocked: z.string().optional(),
        environmentName: z.string().optional(),
        environmentId: optionalText,
        objectCount: count.optional(),
        includedElements: z.array(z.string()).optional(),
        revision: count.nullable().optional(),
        releaseCount: count.optional(),
        saveState: optionalText,
        archived: z.boolean().optional(),
        favorite: z.boolean().nullable().optional(),
        collection: optionalText,
        usageCount: count.optional(),
        updatedAt: optionalText,
        lastUsedAt: optionalText,
        dimensions: z.tuple([finite, finite, finite]).optional(),
        support: z.enum(["FLOOR", "TABLE", "WALL"]).optional(),
        readOnly: z.boolean().optional(),
        previewMarks: z
          .array(
            z.strictObject({
              id: z.string(),
              kind: z.string(),
              x: finite,
              z: finite,
              width: finite.optional(),
              depth: finite.optional(),
            }),
          )
          .optional(),
        community: z
          .strictObject({
            listingId: z.string(),
            releaseId: z.string(),
            semanticVersion: z.string(),
            license: z.strictObject({
              key: z.string(),
              version: z.number().int().positive(),
              requiresAttribution: z.boolean(),
            }),
            attribution: z.array(z.strictObject({ displayName: z.string(), contributionType: z.string() })),
          })
          .optional(),
      }),
    )
    .max(100),
  total: count,
  nextCursor: z.string().nullable(),
  availableKinds: z.array(kind).max(5),
  availableOrigins: z.array(origin).max(4),
  availableCollections: z.array(z.string().max(120)),
});
