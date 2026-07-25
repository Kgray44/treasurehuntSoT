import { CommunityError } from "@/community/domain";

// Canonical private Keepsakes, history, reflection, and private consent belong
// to Wayfarer. Harborlight retains only the public Voyage Log policy below;
// sharing preparation is implemented through wayfarer-keepsake-source.ts.

function requiredText(value: string, field: string, maximum = 280) {
  const normalized = value.normalize("NFKC").trim();
  if (!normalized || normalized.length > maximum || /[\u0000-\u001f\u007f-\u009f]/u.test(normalized))
    throw new CommunityError("COMMUNITY_INVALID_VOYAGE_LOG", `${field} is invalid.`);
  return normalized;
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
