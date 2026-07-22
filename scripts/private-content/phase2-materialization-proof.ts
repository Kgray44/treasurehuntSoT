import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { sha256, type PrivatePayload } from "@/private-content/core";
import { materializePrivatePackage } from "@/private-content/materialization";

function payload(contentType: "tale-draft" | "published-tale" | "tale-archive", suffix: string): PrivatePayload {
  const draft = {
    autosaveVersion: 1,
    tale: { title: `Isolated ${contentType}`, slug: `isolated-${contentType}-${suffix}`, visibility: "PRIVATE" },
    chapters: [
      {
        id: "chapter-01",
        title: "Opening",
        blocks: [
          {
            id: "block-0001",
            blockType: "narrative",
            title: "Opening passage",
            configuration: { heading: "Private heading", body: "Synthetic isolated content." },
          },
        ],
      },
    ],
  };
  const entry = Buffer.from(JSON.stringify(draft)).toString("base64url");
  return {
    manifest: {
      packageId: `proof-${contentType}-${suffix}`,
      packageRevision: 1,
      formatVersion: 1,
      createdAt: "2026-07-22T00:00:00.000Z",
      sourceApplicationVersion: "0.2.0",
      minimumApplicationVersion: "0.2.0",
      classification: "private",
      contentType,
      tales: [{ logicalId: "proof-tale", slug: `isolated-${contentType}-${suffix}`, title: "Isolated proof", contentPath: "tales/proof.json" }],
      assets: [],
      dependencies: [],
      totals: { files: 1, assets: 0, plaintextBytes: Buffer.from(entry, "base64url").length },
    },
    entries: { "tales/proof.json": entry },
    checksums: { "tales/proof.json": sha256(Buffer.from(entry, "base64url")) },
  };
}

async function main() {
  const outcomes = [] as Array<{ contentType: string; taleId: string; mappingCount: number; versionCount: number }>;
  for (const contentType of ["tale-draft", "published-tale", "tale-archive"] as const) {
    const importId = `proof_${contentType}_${randomUUID()}`;
    const suffix = randomUUID().slice(0, 8);
    await db.privateContentImport.create({
      data: {
        id: importId,
        packageId: `proof-${contentType}-${suffix}`,
        packageRevision: 1,
        packageSha256: sha256(importId),
        planSha256: sha256(`plan:${importId}`),
        status: "FINALIZING_ASSETS",
        ownerActorId: "phase2-isolated-proof",
        correlationId: randomUUID(),
      },
    });
    const receipt = await materializePrivatePackage({
      importId,
      payload: payload(contentType, suffix),
      ownerActorId: "phase2-isolated-proof",
    });
    const taleId = receipt.taleIds[0]!;
    const [draft, blockCount, mappingCount, sessionCount, invitationCount, listingCount, releaseCount] = await Promise.all([
      db.taleDraft.findFirst({ where: { taleId } }),
      db.storyBlock.count({ where: { chapter: { draft: { taleId } } } }),
      db.privateContentImportMapping.count({ where: { importId } }),
      db.taleSession.count({ where: { taleId } }),
      // This isolated database contains no unrelated invitations. Invitations
      // are playthrough-scoped rather than tale-scoped in the canonical model.
      db.invitation.count(),
      db.communityListing.count(),
      db.communityRelease.count(),
    ]);
    if (!draft || blockCount !== 1 || !mappingCount || sessionCount || invitationCount || listingCount || releaseCount)
      throw new Error("Canonical materialization proof did not preserve the private boundary.");
    outcomes.push({ contentType, taleId, mappingCount, versionCount: receipt.versionIds.length });
  }
  const foreignKeyFindings = (await db.$queryRawUnsafe<Array<unknown>>("PRAGMA foreign_key_check")).length;
  if (foreignKeyFindings) throw new Error(`Foreign-key check reported ${foreignKeyFindings} finding(s).`);
  process.stdout.write(`${JSON.stringify({ status: "passed", outcomes, foreignKeyFindings })}\n`);
}

void main().finally(() => db.$disconnect());
