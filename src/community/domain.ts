import { createHash } from "node:crypto";
import { z } from "zod";

export const communityItemTypes = {
  CHRONICLE: { release: true, installable: true, remixable: true, searchable: true },
  CHRONICLE_TEMPLATE: { release: true, installable: true, remixable: true, searchable: true },
  STORY_BLOCK_PRESET: { release: true, installable: true, remixable: true, searchable: true },
  ARTIFACT_2D: { release: true, installable: true, remixable: true, searchable: true },
  ARTIFACT_3D: { release: true, installable: true, remixable: true, searchable: true },
  ARTIFACT_COLLECTION: { release: true, installable: true, remixable: true, searchable: true },
  MAP_PACK: { release: true, installable: true, remixable: true, searchable: true },
  LOCATION_PACK: { release: true, installable: true, remixable: false, searchable: true },
  AUDIO_PACK: { release: true, installable: true, remixable: true, searchable: true },
  REVEAL_PRESET: { release: true, installable: true, remixable: true, searchable: true },
  INVITATION_STYLE: { release: true, installable: true, remixable: true, searchable: true },
  COMPLETION_STYLE: { release: true, installable: true, remixable: true, searchable: true },
  GUIDE: { release: true, installable: false, remixable: true, searchable: true },
  VOYAGE_LOG: { release: false, installable: false, remixable: false, searchable: false },
} as const;

export type CommunityItemType = keyof typeof communityItemTypes;
export const communityVisibility = ["PRIVATE", "CREW_ONLY", "UNLISTED", "COMMUNITY", "FEATURED"] as const;
export const publicationStatuses = [
  "DRAFT",
  "VALIDATING",
  "READY_FOR_REVIEW",
  "IN_REVIEW",
  "PUBLISHED",
  "UPDATE_PENDING",
  "QUARANTINED",
  "REJECTED",
  "ARCHIVED",
  "REMOVED",
] as const;
export const spoilerLevels = [
  "NONE",
  "PREVIEW_SAFE",
  "MINOR",
  "CHAPTER",
  "FINALE",
  "CREATOR_ONLY",
  "CAPTAIN_ONLY",
  "PARTICIPANT_PRIVATE",
] as const;
export const locationClasses = [
  "FICTIONAL",
  "GENERIC",
  "PUBLIC_REAL_WORLD",
  "APPROXIMATE_REAL_WORLD",
  "PRIVATE_REAL_WORLD",
] as const;
export const communityRoles = [
  "VISITOR",
  "AUTHENTICATED_USER",
  "CREATOR",
  "VERIFIED_CREATOR",
  "MODERATOR",
  "ADMIN",
] as const;
export type CommunityRole = (typeof communityRoles)[number];

export const handleSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/i, "Use letters, digits, and interior hyphens only.")
  .refine(
    (value) => !/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\ufeff]/u.test(value),
    "Handle contains invisible characters.",
  );
export const reservedHandles = new Set([
  "admin",
  "administrator",
  "support",
  "moderator",
  "official",
  "forever",
  "treasure",
  "harborlight",
]);
export function normalizeHandle(handle: string) {
  const normalized = handle.normalize("NFKC").toLowerCase();
  handleSchema.parse(normalized);
  if (reservedHandles.has(normalized))
    throw new CommunityError("COMMUNITY_HANDLE_RESERVED", "That handle is reserved.");
  return normalized;
}

export const listingInputSchema = z
  .object({
    itemType: z.enum(Object.keys(communityItemTypes) as [CommunityItemType, ...CommunityItemType[]]),
    slug: z
      .string()
      .min(3)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().trim().min(1).max(140),
    shortDescription: z.string().trim().max(280).optional(),
    longDescription: z.string().trim().max(8000).optional(),
    visibility: z.enum(communityVisibility),
    spoilerLevel: z.enum(spoilerLevels),
    locationClass: z.enum(locationClasses),
    tags: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(32)
          .regex(/^[a-z0-9-]+$/i),
      )
      .max(12)
      .default([]),
  })
  .strict();

export class CommunityError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const transitions: Record<(typeof publicationStatuses)[number], readonly (typeof publicationStatuses)[number][]> = {
  DRAFT: ["VALIDATING"],
  VALIDATING: ["DRAFT", "READY_FOR_REVIEW"],
  READY_FOR_REVIEW: ["IN_REVIEW"],
  IN_REVIEW: ["PUBLISHED", "REJECTED"],
  PUBLISHED: ["UPDATE_PENDING", "QUARANTINED", "ARCHIVED", "REMOVED"],
  UPDATE_PENDING: ["PUBLISHED", "QUARANTINED", "ARCHIVED", "REMOVED"],
  QUARANTINED: ["PUBLISHED", "REMOVED"],
  REJECTED: ["DRAFT", "REMOVED"],
  ARCHIVED: ["PUBLISHED", "REMOVED"],
  REMOVED: [],
};
export function assertTransition(from: (typeof publicationStatuses)[number], to: (typeof publicationStatuses)[number]) {
  if (!transitions[from].includes(to))
    throw new CommunityError("COMMUNITY_INVALID_TRANSITION", `${from} cannot transition to ${to}.`);
}
export function canView(
  input: {
    visibility: (typeof communityVisibility)[number];
    publicationStatus: (typeof publicationStatuses)[number];
    ownerProfileId: string;
  },
  actor?: { profileId?: string; role?: CommunityRole },
) {
  if (actor?.role === "ADMIN" || actor?.role === "MODERATOR" || actor?.profileId === input.ownerProfileId) return true;
  return (
    input.publicationStatus === "PUBLISHED" && (input.visibility === "COMMUNITY" || input.visibility === "FEATURED")
  );
}
export function assertPublishingAllowed(
  flags: { enabled: boolean; publicPublishingEnabled: boolean },
  actor: { role: CommunityRole; suspended?: boolean },
) {
  if (!flags.enabled) throw new CommunityError("COMMUNITY_NOT_ENABLED", "Community Harbor is disabled.");
  if (actor.suspended) throw new CommunityError("COMMUNITY_ACCESS_DENIED", "Suspended accounts cannot publish.");
  if (!flags.publicPublishingEnabled && actor.role !== "ADMIN")
    throw new CommunityError("COMMUNITY_PUBLICATION_DISABLED", "Public publishing is disabled.");
}

export type PublicCommunityListing = {
  slug: string;
  itemType: CommunityItemType;
  title: string;
  shortDescription?: string;
  tags: string[];
  spoilerLevel: "NONE" | "PREVIEW_SAFE";
  creator: { handle: string; displayName: string };
};
export function toPublicListing(input: {
  slug: string;
  itemType: CommunityItemType;
  title: string;
  shortDescription?: string | null;
  tags: string[];
  spoilerLevel: (typeof spoilerLevels)[number];
  visibility: (typeof communityVisibility)[number];
  publicationStatus: (typeof publicationStatuses)[number];
  locationClass: (typeof locationClasses)[number];
  owner: { handle: string; displayName: string; email?: string; passwordHash?: string };
  privateSnapshot?: unknown;
}): PublicCommunityListing | null {
  if (!canView({ ...input, ownerProfileId: "" })) return null;
  if (input.locationClass === "PRIVATE_REAL_WORLD") return null;
  return {
    slug: input.slug,
    itemType: input.itemType,
    title: input.title,
    ...(input.shortDescription ? { shortDescription: input.shortDescription } : {}),
    tags: input.tags,
    spoilerLevel: input.spoilerLevel === "NONE" ? "NONE" : "PREVIEW_SAFE",
    creator: { handle: input.owner.handle, displayName: input.owner.displayName },
  };
}

export const releaseManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    listingId: z.string().min(1),
    semanticVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
    sourcePublishedTaleVersionId: z.string().min(1),
    publicMetadata: z
      .object({
        title: z.string().max(140),
        shortDescription: z.string().max(280).optional(),
        spoilerLevel: z.enum(spoilerLevels),
      })
      .strict(),
    license: z.object({ key: z.string(), version: z.number().int().positive() }).strict(),
    attribution: z.array(z.object({ displayName: z.string(), contributionType: z.string() }).strict()),
  })
  .strict();
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function manifestChecksum(manifest: z.infer<typeof releaseManifestSchema>) {
  return createHash("sha256")
    .update(stableJson(releaseManifestSchema.parse(manifest)))
    .digest("hex");
}
export function sanitizeChronicleMetadata(snapshot: Record<string, unknown>) {
  const allowed = ["title", "shortDescription", "theme", "contentWarnings"] as const;
  return Object.fromEntries(allowed.flatMap((key) => (key in snapshot ? [[key, snapshot[key]]] : [])));
}
