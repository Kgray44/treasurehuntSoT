import { z } from "zod";
import { roomEnvironmentSchema, type RoomEnvironment } from "./environment-contracts";

const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
export const spatialLibraryTypes = ["SCENE", "ASSET", "ASSEMBLY", "TEMPLATE", "ENVIRONMENT"] as const;
export type SpatialLibraryType = (typeof spatialLibraryTypes)[number];
export type LibrarySaveState = "WORKING" | "SAVED" | "LEGACY_REVIEW";
export const libraryCreationSchema = z.strictObject({
  operationId: id,
  sourceDefinitionId: id.nullable(),
  sourceRevision: z.number().int().nonnegative(),
  requestDigest: z.string().regex(/^[a-f0-9]{64}$/),
});
export const sceneLibraryMetadataSchema = z.strictObject({
  type: z.enum(["SCENE", "ASSET", "ASSEMBLY", "TEMPLATE"]),
  description: z.string().max(1000).default(""),
  creation: libraryCreationSchema.optional(),
});
export const environmentDraftSchema = z
  .strictObject({
    format: z.literal("PARALLAX_ENVIRONMENT_DRAFT_1"),
    id,
    name: z.string().trim().min(1).max(120),
    description: z.string().max(1000),
    category: z.enum(["ROOM", "OUTDOOR", "RECONSTRUCTED", "OTHER"]),
    room: roomEnvironmentSchema.nullable(),
    tags: z.array(z.string().trim().min(1).max(60)).max(16),
    collection: z.string().max(120),
    favorite: z.boolean(),
    lineage: z.strictObject({ definitionId: id, versionId: id.nullable() }).nullable(),
    creation: libraryCreationSchema.optional(),
  })
  .refine((document) => !document.room || document.room.id === document.id, {
    message: "Environment room identity must match its definition",
    path: ["room", "id"],
  });
export type EnvironmentDraft = z.infer<typeof environmentDraftSchema>;
export const environmentVersionSchema = z.strictObject({
  format: z.literal("PARALLAX_ENVIRONMENT_VERSION_1"),
  id: z.string().min(1).max(160),
  definitionId: id,
  number: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  notes: z.string().max(1000),
  content: environmentDraftSchema,
});
export type EnvironmentVersion = z.infer<typeof environmentVersionSchema> & { checksum: string; usageCount: number };
export type EnvironmentLibraryRecord = {
  id: string;
  revision: number;
  draft: EnvironmentDraft;
  saveState: LibrarySaveState;
  archived: boolean;
  updatedAt: string;
  lastUsedAt: string | null;
  usageCount: number;
  releases: EnvironmentVersion[];
};
export function createEnvironmentDraft(id: string, room: RoomEnvironment | null = null): EnvironmentDraft {
  return environmentDraftSchema.parse({
    format: "PARALLAX_ENVIRONMENT_DRAFT_1",
    id,
    name: room?.name ?? "New environment",
    description: "",
    category:
      room?.origin === "PHOTO_RECONSTRUCTION"
        ? "RECONSTRUCTED"
        : room?.construction?.kind === "OUTDOOR"
          ? "OUTDOOR"
          : "ROOM",
    room: room ? { ...structuredClone(room), id } : null,
    tags: [],
    collection: "",
    favorite: false,
    lineage: null,
  });
}
/** ACTIVE predates explicit membership. Never guess that an unreleased legacy draft was intentionally saved. */
export function librarySaveState(status: string, released = false): LibrarySaveState {
  return status === "SAVED" || (status === "ACTIVE" && released)
    ? "SAVED"
    : status === "WORKING"
      ? "WORKING"
      : "LEGACY_REVIEW";
}
