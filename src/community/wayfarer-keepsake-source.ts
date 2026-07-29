import { createHash } from "node:crypto";

import { CommunityError, stableJson } from "@/community/domain";

/**
 * Narrow integration boundary for the unmerged Wayfarer Phase 3 candidate.
 * It deliberately cannot return Passport history, private notes, raw events,
 * account/invitation identifiers, storage keys, or unapproved identities.
 */
export type HarborlightKeepsakeSourceProjection = Readonly<{
  sourceKeepsakeId: string;
  sourceWatermark: string;
  sourceProjectionChecksum: string;
  publishedVersionId: string;
  publishedVersionChecksum: string;
  completedAt: string;
  title: string;
  selectedSafeCandidates: readonly Readonly<{ kind: "MOMENT" | "ARTIFACT" | "MEDIA"; label: string }>[];
}>;

export type HarborlightSharingCandidateProjection = Readonly<{
  sourceKeepsakeId: string;
  candidates: readonly Readonly<{ kind: "MOMENT" | "ARTIFACT" | "MEDIA"; label: string }>[];
}>;

export type HarborlightSourceVerification = Readonly<{
  sourceKeepsakeId: string;
  valid: boolean;
  sourceWatermark: string;
  sourceProjectionChecksum: string;
}>;

export interface HarborlightKeepsakeSource {
  getEligiblePrivateKeepsake(
    input: Readonly<{ ownerAccountId: string; sourceKeepsakeId: string }>,
  ): Promise<HarborlightKeepsakeSourceProjection | null>;
  getPublicSharingCandidates(
    input: Readonly<{ ownerAccountId: string; sourceKeepsakeId: string }>,
  ): Promise<HarborlightSharingCandidateProjection | null>;
  verifySourceWatermark(
    input: Readonly<{
      ownerAccountId: string;
      sourceKeepsakeId: string;
      sourceWatermark: string;
      sourceProjectionChecksum: string;
    }>,
  ): Promise<HarborlightSourceVerification>;
}

export type HarborlightSharingPreparation = Readonly<{
  ownerAccountId: string;
  sourceKeepsakeId: string;
  sourceWatermark: string;
  sourceProjectionChecksum: string;
  publishedVersionId: string;
  safeSnapshot: string;
  representationChecksum: string;
}>;

export type HarborlightSharingPreparationRecord = Readonly<{
  id: string;
  ownerAccountId: string;
  wayfarerKeepsakeId: string | null;
  sourceWatermark: string | null;
  sourceProjectionChecksum: string | null;
  preparationState: string;
  safeSnapshot: string;
  representationChecksum: string | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export interface HarborlightSharingPreparationStore {
  createIfMissing(input: HarborlightSharingPreparation): Promise<{
    record: HarborlightSharingPreparationRecord;
    created: boolean;
  }>;
}

function text(value: string, field: string, maximum = 191) {
  const normalized = value.normalize("NFKC").trim();
  if (!normalized || normalized.length > maximum || /[\u0000-\u001f\u007f-\u009f]/u.test(normalized))
    throw new CommunityError("COMMUNITY_INVALID_KEEPSAKE_SOURCE", `${field} is invalid.`);
  return normalized;
}

export function prepareWayfarerVoyageLogDraft(
  source: HarborlightKeepsakeSourceProjection,
): HarborlightSharingPreparation {
  const safeSnapshot = Object.freeze({
    schemaVersion: 1 as const,
    source: "WAYFARER_PRIVATE_KEEPSAKE" as const,
    title: text(source.title, "Title", 140),
    publishedVersionChecksum: text(source.publishedVersionChecksum, "Published version checksum"),
    completedAt: text(source.completedAt, "Completion time"),
    selectedSafeCandidates: source.selectedSafeCandidates.map((candidate) => ({
      kind: candidate.kind,
      label: text(candidate.label, "Candidate label", 140),
    })),
  });
  const serialized = stableJson(safeSnapshot);
  return Object.freeze({
    ownerAccountId: "",
    sourceKeepsakeId: text(source.sourceKeepsakeId, "Wayfarer Keepsake ID"),
    sourceWatermark: text(source.sourceWatermark, "Source watermark"),
    sourceProjectionChecksum: text(source.sourceProjectionChecksum, "Source projection checksum"),
    publishedVersionId: text(source.publishedVersionId, "Published version ID"),
    safeSnapshot: serialized,
    representationChecksum: createHash("sha256").update(serialized).digest("hex"),
  });
}

export async function createVoyageLogDraftFromWayfarer(
  source: HarborlightKeepsakeSource,
  store: HarborlightSharingPreparationStore,
  input: Readonly<{ ownerAccountId: string; sourceKeepsakeId: string }>,
) {
  const ownerAccountId = text(input.ownerAccountId, "Owner account ID");
  const sourceKeepsakeId = text(input.sourceKeepsakeId, "Wayfarer Keepsake ID");
  const projection = await source.getEligiblePrivateKeepsake({ ownerAccountId, sourceKeepsakeId });
  if (!projection)
    throw new CommunityError("COMMUNITY_KEEPSAKE_NOT_AVAILABLE", "An eligible private Keepsake was not found.");
  if (projection.sourceKeepsakeId !== sourceKeepsakeId)
    throw new CommunityError(
      "COMMUNITY_KEEPSAKE_SOURCE_MISMATCH",
      "The private Keepsake source could not be verified.",
    );
  const draft = prepareWayfarerVoyageLogDraft(projection);
  const verified = await source.verifySourceWatermark({
    ownerAccountId,
    sourceKeepsakeId,
    sourceWatermark: draft.sourceWatermark,
    sourceProjectionChecksum: draft.sourceProjectionChecksum,
  });
  if (verified.sourceKeepsakeId !== sourceKeepsakeId || verified.sourceKeepsakeId !== projection.sourceKeepsakeId)
    throw new CommunityError(
      "COMMUNITY_KEEPSAKE_SOURCE_MISMATCH",
      "The private Keepsake source could not be verified.",
    );
  if (
    !verified.valid ||
    verified.sourceWatermark !== draft.sourceWatermark ||
    verified.sourceProjectionChecksum !== draft.sourceProjectionChecksum
  )
    throw new CommunityError(
      "COMMUNITY_KEEPSAKE_SOURCE_STALE",
      "The private Keepsake changed before sharing preparation completed.",
    );
  return store.createIfMissing({ ...draft, ownerAccountId });
}

/** The production adapter cannot exist until Wayfarer Phase 3 is converged. */
export const unavailableWayfarerKeepsakeSource: HarborlightKeepsakeSource = {
  async getEligiblePrivateKeepsake() {
    throw new CommunityError(
      "COMMUNITY_WAYFARER_SOURCE_UNAVAILABLE",
      "Private Keepsake sharing is temporarily unavailable.",
    );
  },
  async getPublicSharingCandidates() {
    throw new CommunityError(
      "COMMUNITY_WAYFARER_SOURCE_UNAVAILABLE",
      "Private Keepsake sharing is temporarily unavailable.",
    );
  },
  async verifySourceWatermark() {
    throw new CommunityError(
      "COMMUNITY_WAYFARER_SOURCE_UNAVAILABLE",
      "Private Keepsake sharing is temporarily unavailable.",
    );
  },
};
