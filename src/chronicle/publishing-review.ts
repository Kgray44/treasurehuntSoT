import { db } from "@/lib/db";
import { getStudioTale } from "@/chronicle/studio-service";
import { parsePublishedSnapshot, snapshotFromStudio } from "@/chronicle/publishing";
import { publishedSourceChecksum } from "@/chronicle/snapshot";
import { getDrydockCurrentCompatibility, getDrydockReadiness } from "@/drydock/readiness-store";
import { buildPublishingReview } from "@/studio/publishing-review";

/** Owner-only publishing projection; the browser receives no raw snapshots or provider payloads. */
export async function getStudioPublishingReview(taleId: string) {
  const [studio, currentPublished, readiness, compatibility] = await Promise.all([
    getStudioTale(taleId),
    db.publishedTaleVersion.findFirst({
      where: { taleId, isCurrent: true },
      select: { versionLabel: true, checksum: true, contentSnapshot: true },
    }),
    getDrydockReadiness(taleId),
    getDrydockCurrentCompatibility(taleId),
  ]);
  const snapshot = snapshotFromStudio(studio);
  const privateEvidence = await db.drydockExternalEvidenceReference.findMany({
    where: { draft: { taleId }, sourceChecksum: publishedSourceChecksum(snapshot) },
    select: { providerId: true, evidenceKind: true, status: true, safeSummary: true },
    take: 100,
  });
  const published = currentPublished
    ? {
        versionLabel: currentPublished.versionLabel,
        checksum: currentPublished.checksum,
        snapshot: parsePublishedSnapshot(currentPublished.contentSnapshot),
      }
    : null;
  const protectedEvidence = privateEvidence.filter((evidence) =>
    /private|protected|media|scan/i.test(`${evidence.providerId} ${evidence.evidenceKind}`),
  );
  return {
    review: buildPublishingReview(snapshot, published),
    readiness,
    compatibility,
    protectedContent: {
      visibility: studio.tale.visibility,
      evidence: protectedEvidence,
      recorded: protectedEvidence.length > 0,
    },
  };
}
