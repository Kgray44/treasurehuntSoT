import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { db } from "@/lib/db";
import { getStudioTale, saveStudioDraft } from "@/chronicle/studio-service";
import { sha256, type PrivatePayload } from "@/private-content/core";
import { privatePayloadFromCanonicalImport } from "@/private-content/canonical-export";
import { materializePrivatePackage } from "@/private-content/materialization";
import { decryptPrivatePackage, encryptPrivatePayload } from "@/private-content/package";
import { LocalPrivateKeyProvider } from "@/private-content/key-provider";
import { LocalPhase2PrivateStorageProvider } from "@/private-content/provider-storage";
import { SyntheticPrivateScanner } from "@/private-content/scanner";
import { exportPrivateImport, importPrivatePackage } from "@/private-content/service";

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
      tales: [
        {
          logicalId: "proof-tale",
          slug: `isolated-${contentType}-${suffix}`,
          title: "Isolated proof",
          contentPath: "tales/proof.json",
        },
      ],
      assets: [],
      dependencies: [],
      totals: { files: 1, assets: 0, plaintextBytes: Buffer.from(entry, "base64url").length },
    },
    entries: { "tales/proof.json": entry },
    checksums: { "tales/proof.json": sha256(Buffer.from(entry, "base64url")) },
  };
}

async function main() {
  const outcomes = [] as Array<{
    contentType: string;
    taleId: string;
    mappingCount: number;
    versionCount: number;
    currentStateExport?: boolean;
  }>;
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
        contentJson: "",
        correlationId: randomUUID(),
      },
    });
    const sourcePayload = payload(contentType, suffix);
    const receipt = await materializePrivatePackage({
      importId,
      payload: sourcePayload,
      ownerActorId: "phase2-isolated-proof",
    });
    const taleId = receipt.taleIds[0]!;
    const [draft, blockCount, mappingCount, sessionCount, invitationCount, listingCount, releaseCount] =
      await Promise.all([
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
    if (contentType === "tale-draft") {
      const studio = await getStudioTale(taleId);
      const editedTitle = "Edited after private import";
      await saveStudioDraft(
        taleId,
        {
          autosaveVersion: studio.draft.autosaveVersion,
          tale: { ...studio.tale, title: editedTitle, visibility: "PRIVATE" },
          chapters: studio.draft.chapters,
        },
        "phase2-isolated-proof",
      );
      const exported = await privatePayloadFromCanonicalImport({ importId, sourcePayload });
      const packageBytes = await encryptPrivatePayload(exported, "phase2-export-proof");
      const verified = await decryptPrivatePackage(packageBytes, "phase2-export-proof");
      const exportedDraft = JSON.parse(
        Buffer.from(verified.entries[verified.manifest.tales[0]!.contentPath]!, "base64url").toString("utf8"),
      );
      if (exportedDraft.tale.title !== editedTitle)
        throw new Error("Current-state export retained stale imported content.");
      outcomes.push({
        contentType,
        taleId,
        mappingCount,
        versionCount: receipt.versionIds.length,
        currentStateExport: true,
      });
    } else {
      outcomes.push({ contentType, taleId, mappingCount, versionCount: receipt.versionIds.length });
    }
  }
  const serviceRoot = await mkdtemp(path.join(tmpdir(), "sealed-hold-v1-proof-"));
  try {
    const suffix = randomUUID().slice(0, 8);
    const sourcePayload = payload("tale-draft", suffix);
    const services = {
      storage: new LocalPhase2PrivateStorageProvider({ root: path.join(serviceRoot, "provider") }),
      keyProvider: new LocalPrivateKeyProvider(Buffer.alloc(32, 7)),
      scanner: new SyntheticPrivateScanner(),
    };
    const imported = await importPrivatePackage({
      packageBytes: await encryptPrivatePayload(sourcePayload, "phase2-v1-proof"),
      passphrase: "phase2-v1-proof",
      actorId: "phase2-v1-proof",
      confirm: true,
      root: path.join(serviceRoot, "objects"),
      stagingRoot: path.join(serviceRoot, "staging"),
      services,
    });
    if (imported.status !== "COMPLETED") throw new Error("V1 service proof did not complete.");
    const importedRecord = await db.privateContentImport.findUniqueOrThrow({ where: { id: imported.importId } });
    if (
      (importedRecord as { contentJson?: string | null; normalizedPayloadId?: string | null }).contentJson !== null ||
      !(importedRecord as { normalizedPayloadId?: string | null }).normalizedPayloadId
    )
      throw new Error("V1 service proof retained a plaintext retry payload.");
    const taleId = JSON.parse(importedRecord.importedTaleIds)[0] as string;
    const studio = await getStudioTale(taleId);
    await saveStudioDraft(
      taleId,
      {
        autosaveVersion: studio.draft.autosaveVersion,
        tale: { ...studio.tale, title: "V1 exported current state" },
        chapters: studio.draft.chapters,
      },
      "phase2-v1-proof",
    );
    const exported = await exportPrivateImport(imported.importId, "phase2-v1-export", services);
    const verified = await decryptPrivatePackage(exported.packageBytes, "phase2-v1-export");
    const exportedDraft = JSON.parse(
      Buffer.from(verified.entries[verified.manifest.tales[0]!.contentPath]!, "base64url").toString("utf8"),
    );
    if (exportedDraft.tale.title !== "V1 exported current state")
      throw new Error("V1 export was not current-state canonical.");
    outcomes.push({ contentType: "v1-service", taleId, mappingCount: 0, versionCount: 0, currentStateExport: true });
  } finally {
    await rm(serviceRoot, { recursive: true, force: true });
  }
  const foreignKeyFindings = (await db.$queryRawUnsafe<Array<unknown>>("PRAGMA foreign_key_check")).length;
  if (foreignKeyFindings) throw new Error(`Foreign-key check reported ${foreignKeyFindings} finding(s).`);
  process.stdout.write(`${JSON.stringify({ status: "passed", outcomes, foreignKeyFindings })}\n`);
}

void main().finally(() => db.$disconnect());
