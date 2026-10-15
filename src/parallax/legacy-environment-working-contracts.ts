import { z } from "zod";
import { canonicalChecksum } from "@/drydock/canonical";
import { environmentReferenceSchema, type EnvironmentReference } from "./environment-reference";
import {
  libraryCreationSchema,
  type EnvironmentReleaseRow,
  type LibrarySaveState,
} from "./library-lifecycle-contracts";
import {
  environmentContentSchema,
  environmentVersionSchema,
  type EnvironmentContent,
} from "./legacy-scene-environment-contracts";

/** Mutable v0 retains the schema-one content exactly. It has no immutable reference. */
export const legacyEnvironmentWorkingSchema = z
  .strictObject({
    format: z.literal("PARALLAX_LEGACY_ENVIRONMENT_WORKING_1"),
    id: environmentReferenceSchema.shape.environmentId,
    content: environmentContentSchema,
    source: environmentReferenceSchema.nullable(),
    creation: libraryCreationSchema,
    metadata: z.strictObject({
      tags: z.array(z.string().trim().min(1).max(60)).max(16).nullable(),
      collection: z.string().max(120).nullable(),
      favorite: z.boolean().nullable(),
    }),
  })
  .superRefine((document, context) => {
    if (document.id !== document.content.id)
      context.addIssue({ code: "custom", message: "Working Environment content must retain its definition identity." });
    if (document.creation.sourceDefinitionId !== (document.source?.environmentId ?? null))
      context.addIssue({ code: "custom", message: "Working Environment lineage must match its explicit source." });
  });
export type LegacyEnvironmentWorking = z.infer<typeof legacyEnvironmentWorkingSchema>;
/** Owner-scoped acknowledgement; its checksum binds the reviewed content for explicit release. */
export const legacyEnvironmentEditStateSchema = z.object({
  revision: z.number().int().nonnegative(),
  working: legacyEnvironmentWorkingSchema.nullable(),
  contentChecksum: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  saveState: z.enum(["WORKING", "SAVED", "LEGACY_REVIEW"]),
  archived: z.boolean(),
});
export type LegacyEnvironmentEditState = z.infer<typeof legacyEnvironmentEditStateSchema>;

export function createLegacyEnvironmentWorking(
  content: EnvironmentContent,
  source: EnvironmentReference | null,
  creation: z.infer<typeof libraryCreationSchema>,
): LegacyEnvironmentWorking {
  return legacyEnvironmentWorkingSchema.parse({
    format: "PARALLAX_LEGACY_ENVIRONMENT_WORKING_1",
    id: content.id,
    content,
    source,
    creation,
    // Historical organization preferences are unknown until the owner sets them.
    metadata: { tags: null, collection: null, favorite: null },
  });
}

export const legacyEnvironmentWorkingRowId = (definitionId: string) => `${definitionId}:working`;

export function checkedLegacyEnvironmentWorking(row: EnvironmentReleaseRow, definitionId: string) {
  const raw = JSON.parse(row.envelope);
  const document = legacyEnvironmentWorkingSchema.parse(raw);
  if (
    row.versionNumber !== 0 ||
    row.itemId !== definitionId ||
    row.id !== legacyEnvironmentWorkingRowId(definitionId) ||
    document.id !== definitionId ||
    canonicalChecksum(raw) !== row.checksum
  )
    throw new Error("Working Environment identity or integrity could not be verified.");
  return document;
}

/** Positive release ordinals are supplied independently of mutable CAS revisions. */
export function materializeLegacyEnvironmentVersion(
  raw: LegacyEnvironmentWorking,
  releaseOrdinal: number,
  versionId: string,
) {
  const document = legacyEnvironmentWorkingSchema.parse(raw);
  return environmentVersionSchema.parse({
    reference: {
      environmentId: document.id,
      versionId,
      revision: releaseOrdinal,
      checksum: canonicalChecksum(document.content),
    },
    content: document.content,
  });
}

/** Old ACTIVE/release history never proves an explicit Library membership choice. */
export function legacyEnvironmentMembership(status: string): LibrarySaveState {
  return status === "SAVED" ? "SAVED" : status === "WORKING" ? "WORKING" : "LEGACY_REVIEW";
}
