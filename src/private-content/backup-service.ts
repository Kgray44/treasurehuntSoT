/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 3 fields may precede generated clients in deployment. */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { writePlatformAudit } from "@/platform/audit";
import type { PrivateProviderRuntime } from "./providers";
import { createAndVerifyPrivateOperationalBackup, type PrivateBackupRecordSet } from "./backup-phase3";
import { privateFailure } from "./core";

const privateDb = db as any;
export async function collectPrivateBackupRecordSet(): Promise<{
  records: PrivateBackupRecordSet;
  objects: Array<{ key: string; sha256: string; byteLength: number; mediaType?: string }>;
}> {
  const [imports, mappings, assetObjects, assetReferences, encryptedPayloads, wrappedKeys, scans] = await Promise.all([
    privateDb.privateContentImport.findMany({
      select: {
        id: true,
        packageId: true,
        packageRevision: true,
        packageSha256: true,
        planSha256: true,
        status: true,
        ownerAccountId: true,
        sourceTaleId: true,
        normalizedPayloadId: true,
        materializationStatus: true,
        importedTaleIds: true,
        importedAssetIds: true,
        warnings: true,
        correlationId: true,
        createdAt: true,
        completedAt: true,
      },
    }),
    privateDb.privateContentImportMapping.findMany(),
    privateDb.privateAssetObject.findMany(),
    privateDb.privateAssetReference.findMany(),
    privateDb.privateContentEncryptedPayload.findMany(),
    privateDb.privateContentWrappedKey.findMany(),
    privateDb.privateContentScan.findMany(),
  ]);
  return {
    records: {
      schemaVersion: "sealed-hold-phase3-v1",
      imports,
      mappings,
      assetObjects,
      assetReferences,
      encryptedPayloads,
      wrappedKeys,
      scans,
    },
    objects: assetObjects.map((object: any) => ({
      key: object.storageKey,
      sha256: object.sha256,
      byteLength: object.byteLength,
      mediaType: object.mediaType,
    })),
  };
}
/** Durable backup execution records failure before any provider operation and only marks verified after cryptographic verification. */
export async function createDurablePrivateBackup(input: {
  runtime: PrivateProviderRuntime;
  sourceEnvironmentId: string;
  sourceDatabaseIdentity: string;
  actorId?: string;
  idempotencyKey: string;
}) {
  const existing = await privateDb.privateBackupRun.findFirst({ where: { backupId: input.idempotencyKey } });
  if (existing?.state === "VERIFIED") return { reused: true as const, backup: existing };
  const backupId = input.idempotencyKey;
  await privateDb.privateBackupRun.upsert({
    where: { backupId },
    create: {
      backupId,
      state: "RUNNING",
      manifestDigest: "0".repeat(64),
      snapshotIdentity: input.sourceDatabaseIdentity,
      objectSetDigest: "0".repeat(64),
      keyVersions: "[]",
    },
    update: { state: "RUNNING" },
  });
  try {
    const { records, objects } = await collectPrivateBackupRecordSet();
    const receipt = await createAndVerifyPrivateOperationalBackup({
      sourceEnvironmentId: input.sourceEnvironmentId,
      sourceDatabaseIdentity: input.sourceDatabaseIdentity,
      records,
      objects,
      storage: input.runtime.storage,
      keyProvider: input.runtime.keyProvider,
      backupId,
    });
    const backup = await privateDb.privateBackupRun.update({
      where: { backupId },
      data: {
        state: "VERIFIED",
        manifestDigest: receipt.manifestDigest,
        objectSetDigest: receipt.objectSetDigest,
        keyVersions: JSON.stringify(receipt.requiredKeyVersions),
        verifiedAt: new Date(),
      },
    });
    await writePlatformAudit({
      actorType: input.actorId ? "CREATOR" : "SYSTEM",
      actorId: input.actorId ?? null,
      action: "PRIVATE_BACKUP_VERIFIED",
      resourceType: "PRIVATE_BACKUP",
      resourceId: backupId,
      metadata: { objectCount: receipt.objectCount, keyVersionCount: receipt.requiredKeyVersions.length },
    });
    return { reused: false as const, backup, receipt };
  } catch (error) {
    await privateDb.privateBackupRun.update({ where: { backupId }, data: { state: "FAILED" } }).catch(() => undefined);
    await writePlatformAudit({
      actorType: input.actorId ? "CREATOR" : "SYSTEM",
      actorId: input.actorId ?? null,
      action: "PRIVATE_BACKUP_FAILED",
      resourceType: "PRIVATE_BACKUP",
      resourceId: backupId,
      outcome: "FAILED",
    }).catch(() => undefined);
    if (error instanceof Error && "code" in error) throw error;
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private backup failed.");
  }
}
export function privateBackupIdempotencyKey(window: string) {
  if (!/^[A-Za-z0-9_.:-]{1,120}$/.test(window)) throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID");
  return `backup:${window}`;
}
export function newPrivateBackupOperationId() {
  return randomUUID();
}
