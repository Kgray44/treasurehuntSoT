import { createHash } from "node:crypto";

import { CommunityError, stableJson } from "@/community/domain";

/**
 * Harborlight owns a private, deliberately small record of a completed Voyage.
 * It never reads or writes TaleSession progression, variables, events, answers,
 * Captain notes, or private Chronicle prose.  The caller must resolve the
 * canonical session through One Voyage and pass this constrained projection.
 */
export type CanonicalCompletedTaleSession = Readonly<{
  id: string;
  taleId: string;
  publishedVersionId: string | null;
  status: string;
  completedAt: Date | null;
  previewMode: boolean;
}>;

export type KeepsakeSafeSnapshot = Readonly<{
  schemaVersion: 1;
  taleId: string;
  taleTitle: string;
  publishedVersionId: string;
  completedAt: string;
}>;

export type PrivateVoyageKeepsake = Readonly<{
  id: string;
  ownerAccountId: string;
  taleSessionId: string;
  publishedVersionId: string | null;
  safeSnapshot: string;
  favoriteMoment: string | null;
  representationChecksum: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export type CreateKeepsakeRecord = Readonly<{
  ownerAccountId: string;
  taleSessionId: string;
  publishedVersionId: string;
  safeSnapshot: string;
  representationChecksum: string;
}>;

/**
 * The persistence adapter must enforce the schema's unique(ownerAccountId,
 * taleSessionId) constraint atomically. Returning an existing row turns retry
 * and concurrent requests into the same successful private generation.
 */
export interface KeepsakeStore {
  findCompletedSessionForOwner(
    sessionId: string,
    ownerAccountId: string,
  ): Promise<CanonicalCompletedTaleSession | null>;
  createKeepsakeIfMissing(input: CreateKeepsakeRecord): Promise<{ keepsake: PrivateVoyageKeepsake; created: boolean }>;
}

export type GenerateKeepsakeInput = Readonly<{
  ownerAccountId: string;
  taleSessionId: string;
  taleTitle: string;
}>;

function requiredText(value: string, field: string, maximum = 280) {
  const normalized = value.normalize("NFKC").trim();
  if (!normalized || normalized.length > maximum || /[\u0000-\u001f\u007f-\u009f]/u.test(normalized))
    throw new CommunityError("COMMUNITY_INVALID_KEEPSAKE", `${field} is invalid.`);
  return normalized;
}

export function assertCanonicalCompletedSession(
  session: CanonicalCompletedTaleSession | null,
): asserts session is CanonicalCompletedTaleSession & { completedAt: Date; publishedVersionId: string } {
  if (!session || session.status !== "COMPLETED" || !session.completedAt || session.previewMode || !session.publishedVersionId)
    throw new CommunityError(
      "COMMUNITY_COMPLETION_REQUIRED",
      "A completed canonical, non-preview Tale Session is required for a Voyage Keepsake.",
    );
}

/** Builds a versioned allowlist rather than copying a Chronicle/session payload. */
export function createKeepsakeSafeSnapshot(input: {
  session: CanonicalCompletedTaleSession;
  taleTitle: string;
}): KeepsakeSafeSnapshot {
  assertCanonicalCompletedSession(input.session);
  return Object.freeze({
    schemaVersion: 1,
    taleId: requiredText(input.session.taleId, "Tale ID", 191),
    taleTitle: requiredText(input.taleTitle, "Tale title", 140),
    publishedVersionId: requiredText(input.session.publishedVersionId, "Published version ID", 191),
    completedAt: input.session.completedAt.toISOString(),
  });
}

export function checksumKeepsakeRepresentation(snapshot: KeepsakeSafeSnapshot) {
  return createHash("sha256").update(stableJson(snapshot)).digest("hex");
}

export async function generatePrivateVoyageKeepsake(
  store: KeepsakeStore,
  input: GenerateKeepsakeInput,
): Promise<{ keepsake: PrivateVoyageKeepsake; created: boolean }> {
  const ownerAccountId = requiredText(input.ownerAccountId, "Owner account ID", 191);
  const taleSessionId = requiredText(input.taleSessionId, "Tale Session ID", 191);
  const session = await store.findCompletedSessionForOwner(taleSessionId, ownerAccountId);
  assertCanonicalCompletedSession(session);
  const snapshot = createKeepsakeSafeSnapshot({ session, taleTitle: input.taleTitle });
  return store.createKeepsakeIfMissing({
    ownerAccountId,
    taleSessionId,
    publishedVersionId: snapshot.publishedVersionId,
    safeSnapshot: stableJson(snapshot),
    representationChecksum: checksumKeepsakeRepresentation(snapshot),
  });
}

/** An owner may view their safe record, but source identity/progression evidence remains private. */
export function toPrivateKeepsakeProjection(keepsake: PrivateVoyageKeepsake) {
  const snapshot = JSON.parse(keepsake.safeSnapshot) as KeepsakeSafeSnapshot;
  return {
    id: keepsake.id,
    taleTitle: snapshot.taleTitle,
    completedAt: snapshot.completedAt,
    favoriteMoment: keepsake.favoriteMoment,
    representationChecksum: keepsake.representationChecksum,
    status: keepsake.status,
  };
}

export const voyageLogVisibilities = ["PRIVATE", "CREW_ONLY", "UNLISTED", "COMMUNITY"] as const;
export type VoyageLogVisibility = (typeof voyageLogVisibilities)[number];
export const creatorShareRestrictions = [
  "PRIVATE_ONLY",
  "NO_PUBLIC_SHARING",
  "NO_MEDIA",
  "NO_LOCATION",
  "NO_PARTICIPANT_NAMES",
] as const;
export type CreatorShareRestriction = (typeof creatorShareRestrictions)[number];

export type ConsentRecord = Readonly<{ purpose: string; grantedAt: Date | null; revokedAt: Date | null }>;
export type VoyageLogParticipant = Readonly<{
  id: string;
  displayNameSnapshot: string;
  isChild: boolean;
  consents: readonly ConsentRecord[];
}>;
export type VoyageLogMedia = Readonly<{
  id: string;
  derivativeChecksum: string;
  processingStatus: string;
  scanStatus: string;
  exifGpsRemoved: boolean;
  consents: readonly ConsentRecord[];
}>;
export type VoyageLogLocation = Readonly<{
  classification: "NONE" | "APPROXIMATE" | "PRIVATE" | "EXACT";
  generalizedLabel?: string | null;
}>;
export type VoyageLogPublicationInput = Readonly<{
  visibility: VoyageLogVisibility;
  restrictions: readonly CreatorShareRestriction[];
  participants: readonly VoyageLogParticipant[];
  media: readonly VoyageLogMedia[];
  location?: VoyageLogLocation | null;
}>;

export function hasActiveConsent(consents: readonly ConsentRecord[], purpose: string) {
  return consents.some((consent) => consent.purpose === purpose && !!consent.grantedAt && !consent.revokedAt);
}

export function assertCreatorSharingAllowed(
  visibility: VoyageLogVisibility,
  restrictions: readonly CreatorShareRestriction[],
) {
  const active = new Set(restrictions);
  if (active.has("PRIVATE_ONLY") && visibility !== "PRIVATE")
    throw new CommunityError("COMMUNITY_CREATOR_RESTRICTION", "This Chronicle permits private Keepsakes only.");
  if (active.has("NO_PUBLIC_SHARING") && visibility === "COMMUNITY")
    throw new CommunityError("COMMUNITY_CREATOR_RESTRICTION", "This Chronicle does not permit Community publication.");
}

export function isPublicMediaReady(media: VoyageLogMedia) {
  return (
    media.processingStatus === "READY" &&
    media.scanStatus === "CLEAN" &&
    media.exifGpsRemoved &&
    hasActiveConsent(media.consents, "PUBLIC_MEDIA")
  );
}

/**
 * Applies all consent, media, location, and Creator policy gates before a
 * non-private log can be saved as shared. A revocation fails this check even
 * if a prior publish succeeded, so callers must re-evaluate on every update
 * and public read/projection.
 */
export function assertVoyageLogPublicationAllowed(input: VoyageLogPublicationInput) {
  assertCreatorSharingAllowed(input.visibility, input.restrictions);
  if (input.visibility === "PRIVATE") return;
  for (const participant of input.participants) {
    if (!hasActiveConsent(participant.consents, "DISPLAY_IN_LOG"))
      throw new CommunityError("COMMUNITY_PARTICIPANT_CONSENT_REQUIRED", "Every included participant must consent to sharing.");
  }
  if (input.media.some((media) => !isPublicMediaReady(media)))
    throw new CommunityError(
      "COMMUNITY_MEDIA_NOT_READY",
      "Shared media must be clean, derivative-ready, GPS-sanitized, and actively consented.",
    );
  if (new Set(input.restrictions).has("NO_MEDIA") && input.media.length)
    throw new CommunityError("COMMUNITY_CREATOR_RESTRICTION", "The Creator does not permit media sharing.");
}

export type PublicVoyageLog = Readonly<{
  slug: string;
  title: string;
  safeSummary?: string;
  spoilerLevel: "NONE" | "PREVIEW_SAFE";
  approximateLocation?: string;
  verifiedCompletion: true;
  participants: readonly Readonly<{ displayName: string }>[];
  media: readonly Readonly<{ id: string; checksum: string }>[];
}>;

export function toPublicVoyageLogProjection(input: VoyageLogPublicationInput & {
  slug: string;
  title: string;
  safeSummary?: string | null;
  spoilerLevel: string;
  verifiedCompletion: boolean;
  publishedAt: Date | null;
}): PublicVoyageLog | null {
  if (input.visibility !== "COMMUNITY" || !input.publishedAt || !input.verifiedCompletion) return null;
  try {
    assertVoyageLogPublicationAllowed(input);
  } catch {
    return null;
  }
  const restrictions = new Set(input.restrictions);
  const participants = restrictions.has("NO_PARTICIPANT_NAMES")
    ? []
    : input.participants.flatMap((participant) =>
        !participant.isChild && hasActiveConsent(participant.consents, "PUBLIC_NAME")
          ? [{ displayName: requiredText(participant.displayNameSnapshot, "Participant name", 140) }]
          : [],
      );
  const location =
    !restrictions.has("NO_LOCATION") && input.location?.classification === "APPROXIMATE" && input.location.generalizedLabel
      ? requiredText(input.location.generalizedLabel, "Approximate location", 140)
      : undefined;
  return Object.freeze({
    slug: requiredText(input.slug, "Voyage Log slug", 160),
    title: requiredText(input.title, "Voyage Log title", 140),
    ...(input.safeSummary ? { safeSummary: requiredText(input.safeSummary, "Voyage Log summary", 280) } : {}),
    spoilerLevel: input.spoilerLevel === "NONE" ? "NONE" : "PREVIEW_SAFE",
    ...(location ? { approximateLocation: location } : {}),
    verifiedCompletion: true,
    participants: Object.freeze(participants),
    media: Object.freeze(input.media.map((media) => Object.freeze({ id: media.id, checksum: media.derivativeChecksum }))),
  });
}
