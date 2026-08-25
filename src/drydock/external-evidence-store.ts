import { getStudioTale } from "@/chronicle/studio-service";
import { publishedSourceChecksum, snapshotFromStudio } from "@/chronicle/snapshot";
import type { ExternalEvidenceSummary } from "@/drydock/readiness";
import { db } from "@/lib/db";

const projection = (row: {
  providerId: string;
  providerVersion: string;
  evidenceKind: string;
  status: string;
  safeSummary: string;
  expiresAt: Date | null;
}): ExternalEvidenceSummary => ({
  providerId: row.providerId,
  providerVersion: row.providerVersion,
  evidenceKind: row.evidenceKind,
  status: row.expiresAt && row.expiresAt <= new Date() ? "EXPIRED" : (row.status as ExternalEvidenceSummary["status"]),
  safeSummary: row.safeSummary,
});

export async function listCurrentDrydockExternalEvidence(taleId: string) {
  const checksum = publishedSourceChecksum(snapshotFromStudio(await getStudioTale(taleId)));
  const rows = await db.drydockExternalEvidenceReference.findMany({
    where: { draft: { is: { taleId } }, sourceChecksum: checksum },
    orderBy: [{ providerId: "asc" }, { evidenceKind: "asc" }],
    take: 100,
  });
  return { sourceChecksum: checksum, evidence: rows.map(projection) };
}

export async function recordCurrentDrydockExternalEvidence(input: {
  taleId: string;
  providerId: string;
  providerVersion: string;
  evidenceKind: string;
  status: "PRESENT" | "MISSING" | "UNAVAILABLE" | "EXTERNAL_VALIDATION_REQUIRED";
  safeSummary: string;
  sourceReference?: string;
  expiresAt?: Date;
}) {
  const checksum = publishedSourceChecksum(snapshotFromStudio(await getStudioTale(input.taleId)));
  const draft = await db.taleDraft.findFirst({
    where: { taleId: input.taleId },
    orderBy: { revisionNumber: "desc" },
    select: { id: true },
  });
  if (!draft) throw new Error("DRYDOCK_EXTERNAL_EVIDENCE_DRAFT_UNAVAILABLE");
  const existing = await db.drydockExternalEvidenceReference.findFirst({
    where: {
      draftId: draft.id,
      providerId: input.providerId,
      providerVersion: input.providerVersion,
      evidenceKind: input.evidenceKind,
      sourceChecksum: checksum,
    },
    select: { id: true },
  });
  const data = {
    status: input.status,
    safeSummary: input.safeSummary,
    sourceReference: input.sourceReference,
    checkedAt: new Date(),
    expiresAt: input.expiresAt ?? null,
  };
  const row = existing
    ? await db.drydockExternalEvidenceReference.update({ where: { id: existing.id }, data })
    : await db.drydockExternalEvidenceReference.create({
        data: {
          draftId: draft.id,
          providerId: input.providerId,
          providerVersion: input.providerVersion,
          evidenceKind: input.evidenceKind,
          sourceChecksum: checksum,
          ...data,
        },
      });
  return { sourceChecksum: checksum, evidence: projection(row) };
}
