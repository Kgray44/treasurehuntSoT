import { CommunityError } from "./domain";

type CommunityPublicationSource = Readonly<{
  id: string;
  checksum: string;
  drydockPublishingEvidence: { digest: string; sourceChecksum: string } | null;
}>;

/**
 * Harborlight retains package/publication ownership. This boundary only proves
 * that its immutable Chronicle source carries an exact-source Drydock receipt.
 */
export function assertCommunityDrydockPublicationGate(source: CommunityPublicationSource | null) {
  if (!source?.drydockPublishingEvidence)
    throw new CommunityError(
      "COMMUNITY_DRYDOCK_EVIDENCE_REQUIRED",
      "This published Chronicle has no immutable Drydock launch evidence.",
    );
  if (source.drydockPublishingEvidence.sourceChecksum !== source.checksum)
    throw new CommunityError(
      "COMMUNITY_DRYDOCK_EVIDENCE_MISMATCH",
      "This Chronicle's Drydock evidence does not match the immutable published source.",
    );
  return {
    publishedVersionId: source.id,
    sourceChecksum: source.checksum,
    evidenceDigest: source.drydockPublishingEvidence.digest,
  };
}
