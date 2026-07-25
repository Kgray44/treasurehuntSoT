import { CommunityError } from "./domain";
import { assertVoyageLogPublicationAllowed, type VoyageLogPublicationInput } from "./keepsakes";

export const voyageLogLifecycleStates = [
  "DRAFT",
  "CONSENT_PENDING",
  "READY",
  "PUBLISHED",
  "CONSENT_REVIEW_REQUIRED",
  "ARCHIVED",
  "REMOVED",
] as const;
export type VoyageLogLifecycleState = (typeof voyageLogLifecycleStates)[number];

const transitions: Readonly<Record<VoyageLogLifecycleState, readonly VoyageLogLifecycleState[]>> = {
  DRAFT: ["CONSENT_PENDING", "READY", "ARCHIVED", "REMOVED"],
  CONSENT_PENDING: ["READY", "CONSENT_REVIEW_REQUIRED", "ARCHIVED", "REMOVED"],
  READY: ["CONSENT_PENDING", "PUBLISHED", "CONSENT_REVIEW_REQUIRED", "ARCHIVED", "REMOVED"],
  PUBLISHED: ["CONSENT_REVIEW_REQUIRED", "ARCHIVED", "REMOVED"],
  CONSENT_REVIEW_REQUIRED: ["CONSENT_PENDING", "READY", "ARCHIVED", "REMOVED"],
  ARCHIVED: ["READY", "REMOVED"],
  REMOVED: [],
};

export type VoyageLogReadiness = Readonly<{
  ready: boolean;
  reasons: readonly string[];
}>;

export function voyageLogReadiness(
  input: VoyageLogPublicationInput & {
    sourceProvenanceVerified: boolean;
    sourceWatermarkUnchanged: boolean;
    sourceChecksumUnchanged: boolean;
    publishedTaleVersionId?: string | null;
    projectionChecksum?: string | null;
    searchEligible: boolean;
    openGraphEligible: boolean;
  },
): VoyageLogReadiness {
  const reasons: string[] = [];
  if (!input.sourceProvenanceVerified) reasons.push("Wayfarer source provenance is not verified.");
  if (!input.sourceWatermarkUnchanged || !input.sourceChecksumUnchanged)
    reasons.push("The Wayfarer source changed after sharing preparation.");
  if (!input.publishedTaleVersionId) reasons.push("An exact published Tale Version is required.");
  if (!input.projectionChecksum) reasons.push("The public projection has not been checksummed.");
  if (!input.searchEligible) reasons.push("The selected visibility is not eligible for safe search indexing.");
  if (!input.openGraphEligible) reasons.push("The selected visibility is not eligible for safe sharing metadata.");
  try {
    assertVoyageLogPublicationAllowed(input);
  } catch (cause) {
    reasons.push(cause instanceof Error ? cause.message : "Publication policy is not satisfied.");
  }
  return Object.freeze({ ready: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export function assertVoyageLogTransition(from: VoyageLogLifecycleState, to: VoyageLogLifecycleState) {
  if (!transitions[from]?.includes(to))
    throw new CommunityError("COMMUNITY_VOYAGE_LOG_TRANSITION_INVALID", `${from} cannot transition to ${to}.`);
}

export function assertVoyageLogPublishable(input: Parameters<typeof voyageLogReadiness>[0]) {
  const readiness = voyageLogReadiness(input);
  if (!readiness.ready)
    throw new CommunityError("COMMUNITY_VOYAGE_LOG_NOT_READY", readiness.reasons[0] ?? "Voyage Log is not ready.");
  return readiness;
}
