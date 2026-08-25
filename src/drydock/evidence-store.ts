import { db } from "@/lib/db";
import {
  assertSafeDrydockPublishingEvidencePayload,
  creatorPublishingEvidenceProjection,
  type DrydockPublishingEvidencePayload,
} from "@/drydock/publishing-evidence";

/** Returns an allowlisted immutable evidence projection only for the owning Chronicle version. */
export async function getDrydockPublishingEvidence(taleId: string, versionId: string) {
  const version = await db.publishedTaleVersion.findFirst({
    where: { id: versionId, taleId },
    select: {
      id: true,
      checksum: true,
      publishedAt: true,
      drydockPublishingEvidence: { select: { id: true, evidence: true, digest: true } },
    },
  });
  if (!version?.drydockPublishingEvidence) return null;
  let payload: DrydockPublishingEvidencePayload;
  try {
    payload = JSON.parse(version.drydockPublishingEvidence.evidence) as DrydockPublishingEvidencePayload;
    assertSafeDrydockPublishingEvidencePayload(payload);
  } catch {
    throw new Error("DRYDOCK_PUBLISHING_EVIDENCE_INVALID");
  }
  if (payload.digest !== version.drydockPublishingEvidence.digest || payload.sourceChecksum !== version.checksum)
    throw new Error("DRYDOCK_PUBLISHING_EVIDENCE_MISMATCH");
  return {
    evidenceId: version.drydockPublishingEvidence.id,
    versionId: version.id,
    publishedAt: version.publishedAt.toISOString(),
    evidence: creatorPublishingEvidenceProjection(payload),
  };
}
