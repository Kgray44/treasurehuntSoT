import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { writePlatformAudit } from "@/platform/audit";
import { canonicalAccountForLegacyActor } from "@/wayfarer/accounts";
import { decryptPrivatePackage, encryptPrivatePayload } from "./package";
import { isWithin, privateFailure, redactPrivate, sha256, type PrivatePayload } from "./core";
import { LocalPrivateAssetStore, type StagedPrivateObject } from "./storage";

export type PrivateImportPlan = {
  packageId: string;
  packageRevision: number;
  packageSha256: string;
  planSha256: string;
  assetCount: number;
  bytes: number;
  conflict?: "PACKAGE_ALREADY_IMPORTED" | "PACKAGE_REVISION_CONFLICT";
};
export type PrivateImportReceipt = {
  importId: string;
  packageId: string;
  packageRevision: number;
  packageSha256: string;
  status: string;
  importedAssetIds: string[];
  reusedAssetIds: string[];
  correlationId: string;
};
export type PrivateExportReceipt = {
  packageBytes: Buffer;
  packageSha256: string;
  packageId: string;
  packageRevision: number;
  roundTripVerified: true;
};

function planFor(
  payload: PrivatePayload,
  packageBytes: Buffer,
  existing?: { id: string; status: string } | null,
): PrivateImportPlan {
  const { manifest } = payload;
  const packageSha256 = sha256(packageBytes);
  const input = {
    packageId: manifest.packageId,
    packageRevision: manifest.packageRevision,
    packageSha256,
    assetCount: manifest.assets.length,
    bytes: manifest.totals.plaintextBytes,
    conflict: existing ? ("PACKAGE_ALREADY_IMPORTED" as const) : undefined,
  };
  return { ...input, planSha256: sha256(JSON.stringify(input)) };
}

export async function inspectPrivatePackage(packageBytes: Buffer, passphrase: string) {
  const payload = await decryptPrivatePackage(packageBytes, passphrase);
  const existing = await db.privateContentImport.findUnique({
    where: {
      packageId_packageRevision: {
        packageId: payload.manifest.packageId,
        packageRevision: payload.manifest.packageRevision,
      },
    },
    select: { id: true, status: true },
  });
  const plan = planFor(payload, packageBytes, existing);
  return {
    status: "valid" as const,
    plan,
    envelope: { formatVersion: 1, cipher: "aes-256-gcm" },
    manifest: {
      packageId: payload.manifest.packageId,
      packageRevision: payload.manifest.packageRevision,
      assets: payload.manifest.assets.length,
      files: payload.manifest.totals.files,
    },
  };
}

export async function importPrivatePackage(input: {
  packageBytes: Buffer;
  passphrase: string;
  actorId: string;
  confirm: boolean;
  root?: string;
  stagingRoot?: string;
}): Promise<PrivateImportReceipt> {
  const payload = await decryptPrivatePackage(input.packageBytes, input.passphrase);
  const ownerAccountId = await canonicalAccountForLegacyActor(input.actorId);
  const existing = await db.privateContentImport.findUnique({
    where: {
      packageId_packageRevision: {
        packageId: payload.manifest.packageId,
        packageRevision: payload.manifest.packageRevision,
      },
    },
  });
  const plan = planFor(payload, input.packageBytes, existing);
  if (!input.confirm)
    throw privateFailure(
      "PRIVATE_CONTENT_FORBIDDEN",
      "Review the private package plan, then explicitly confirm import.",
    );
  if (existing)
    return {
      importId: existing.id,
      packageId: existing.packageId,
      packageRevision: existing.packageRevision,
      packageSha256: existing.packageSha256,
      status: existing.status,
      importedAssetIds: JSON.parse(existing.importedAssetIds),
      reusedAssetIds: [],
      correlationId: existing.correlationId,
    };
  const correlationId = randomUUID();
  const store = new LocalPrivateAssetStore({ root: input.root, stagingRoot: input.stagingRoot });
  const staged = new Map<string, StagedPrivateObject>();
  const reused: string[] = [];
  try {
    for (const asset of payload.manifest.assets) {
      if (await store.objectExists(asset.sha256)) reused.push(asset.sha256);
      else
        staged.set(
          asset.logicalId,
          await store.stageObject(Buffer.from(payload.entries[asset.relativePath], "base64url"), asset.sha256),
        );
    }
    const record = await db.$transaction(async (tx) => {
      const created = await tx.privateContentImport.create({
        data: {
          packageId: plan.packageId,
          packageRevision: plan.packageRevision,
          packageSha256: plan.packageSha256,
          planSha256: plan.planSha256,
          status: "FINALIZING_ASSETS",
          ownerActorId: input.actorId,
          ownerAccountId,
          contentJson: JSON.stringify(payload),
          correlationId,
        },
      });
      const assetIds: string[] = [];
      for (const asset of payload.manifest.assets) {
        const storageKey = `objects/${asset.sha256.slice(0, 2)}/${asset.sha256.slice(2, 4)}/${asset.sha256}`;
        const object = await tx.privateAssetObject.upsert({
          where: { sha256: asset.sha256 },
          update: {},
          create: {
            sha256: asset.sha256,
            byteLength: asset.byteLength,
            mediaType: asset.mediaType,
            representation: asset.representation,
            storageKey,
          },
        });
        const reference = await tx.privateAssetReference.create({
          data: {
            importId: created.id,
            objectId: object.id,
            logicalId: asset.logicalId,
            ownerActorId: input.actorId,
            ownerAccountId,
          },
        });
        assetIds.push(reference.id);
      }
      return { id: created.id, assetIds };
    });
    for (const stagedObject of staged.values()) await store.finalizeObject(stagedObject);
    await db.$transaction(async (tx) => {
      await tx.privateAssetReference.updateMany({ where: { importId: record.id }, data: { available: true } });
      await tx.privateAssetObject.updateMany({
        where: { sha256: { in: payload.manifest.assets.map((asset) => asset.sha256) } },
        data: { finalizedAt: new Date() },
      });
      await tx.privateContentImport.update({
        where: { id: record.id },
        data: { status: "COMPLETED", importedAssetIds: JSON.stringify(record.assetIds), completedAt: new Date() },
      });
    });
    await writePlatformAudit({
      actorType: "CREATOR",
      actorId: input.actorId,
      action: "PRIVATE_PACKAGE_IMPORTED",
      resourceType: "PRIVATE_CONTENT_IMPORT",
      resourceId: record.id,
      correlationId,
      metadata: redactPrivate({
        packageId: plan.packageId,
        packageRevision: plan.packageRevision,
        assetCount: record.assetIds.length,
        packageSha256: plan.packageSha256,
      }) as Record<string, unknown>,
    });
    return {
      importId: record.id,
      packageId: plan.packageId,
      packageRevision: plan.packageRevision,
      packageSha256: plan.packageSha256,
      status: "COMPLETED",
      importedAssetIds: record.assetIds,
      reusedAssetIds: reused,
      correlationId,
    };
  } catch (error) {
    // A concurrent package may win the unique package identity race.  It is
    // idempotent from the caller's point of view and never creates a second Tale.
    const raced = await db.privateContentImport.findUnique({
      where: {
        packageId_packageRevision: {
          packageId: payload.manifest.packageId,
          packageRevision: payload.manifest.packageRevision,
        },
      },
    });
    if (raced)
      return {
        importId: raced.id,
        packageId: raced.packageId,
        packageRevision: raced.packageRevision,
        packageSha256: raced.packageSha256,
        status: raced.status,
        importedAssetIds: JSON.parse(raced.importedAssetIds),
        reusedAssetIds: reused,
        correlationId: raced.correlationId,
      };
    await Promise.all([...staged.values()].map((item) => store.deleteStagedObject(item.stagingId)));
    throw error;
  }
}

/** Re-stage missing objects from the encrypted-import record and finish a safe retry. */
export async function retryPrivateImportFinalization(input: { importId: string; root?: string; stagingRoot?: string }) {
  const record = await db.privateContentImport.findUniqueOrThrow({
    where: { id: input.importId },
    include: { assetReferences: { include: { object: true } } },
  });
  if (!["FINALIZING_ASSETS", "FINALIZATION_RETRY"].includes(record.status))
    throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
  const payload = JSON.parse(record.contentJson ?? "{}") as PrivatePayload;
  const store = new LocalPrivateAssetStore({ root: input.root, stagingRoot: input.stagingRoot });
  const staged: StagedPrivateObject[] = [];
  try {
    for (const asset of payload.manifest.assets) {
      if (!(await store.objectExists(asset.sha256)))
        staged.push(
          await store.stageObject(Buffer.from(payload.entries[asset.relativePath], "base64url"), asset.sha256),
        );
    }
    for (const stagedObject of staged) await store.finalizeObject(stagedObject);
    await db.$transaction(async (tx) => {
      await tx.privateAssetReference.updateMany({ where: { importId: record.id }, data: { available: true } });
      await tx.privateAssetObject.updateMany({
        where: { id: { in: record.assetReferences.map((reference) => reference.objectId) } },
        data: { finalizedAt: new Date() },
      });
      await tx.privateContentImport.update({
        where: { id: record.id },
        data: { status: "COMPLETED", completedAt: new Date(), finalizationErrorCode: null },
      });
    });
    return { importId: record.id, status: "COMPLETED" as const };
  } catch (error) {
    await db.privateContentImport.update({
      where: { id: record.id },
      data: { status: "FINALIZATION_RETRY", finalizationErrorCode: "PRIVATE_ASSET_FINALIZATION_FAILED" },
    });
    await Promise.all(staged.map((item) => store.deleteStagedObject(item.stagingId)));
    throw error;
  }
}

function assertPrivateOutputPath(outputPath: string) {
  const destination = path.resolve(outputPath);
  const repository = path.resolve(process.cwd());
  if (!path.isAbsolute(outputPath) || isWithin(repository, destination))
    throw privateFailure(
      "PRIVATE_CONTENT_CONFIGURATION_INVALID",
      "Private exports must be written outside the repository.",
    );
  return destination;
}

export async function exportPrivateImport(importId: string, passphrase: string): Promise<PrivateExportReceipt> {
  const record = await db.privateContentImport.findUniqueOrThrow({ where: { id: importId } });
  const payload = JSON.parse(record.contentJson ?? "{}") as PrivatePayload;
  const packageBytes = await encryptPrivatePayload(payload, passphrase);
  const verified = await decryptPrivatePackage(packageBytes, passphrase);
  if (verified.manifest.packageId !== record.packageId || verified.manifest.packageRevision !== record.packageRevision)
    throw privateFailure("PRIVATE_PACKAGE_INVALID");
  return {
    packageBytes,
    packageSha256: sha256(packageBytes),
    packageId: record.packageId,
    packageRevision: record.packageRevision,
    roundTripVerified: true,
  };
}

export async function writePrivateExport(input: { importId: string; passphrase: string; outputPath: string }) {
  const receipt = await exportPrivateImport(input.importId, input.passphrase);
  const destination = assertPrivateOutputPath(input.outputPath);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await writeFile(destination, receipt.packageBytes, { flag: "wx", mode: 0o600 });
  return { ...receipt, outputPath: destination };
}

// Backups intentionally reuse the versioned encrypted package codec.  They are
// import snapshots only: no sessions, credentials, invitations, or server keys.
export async function createPrivateBackup(input: { importId: string; passphrase: string; outputPath: string }) {
  const receipt = await writePrivateExport(input);
  return { ...receipt, backupSha256: receipt.packageSha256, verified: true as const };
}

export async function verifyPrivateBackup(packageBytes: Buffer, passphrase: string) {
  const payload = await decryptPrivatePackage(packageBytes, passphrase);
  return {
    packageId: payload.manifest.packageId,
    packageRevision: payload.manifest.packageRevision,
    assetCount: payload.manifest.assets.length,
    verified: true as const,
  };
}
