import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { db } from "@/lib/db";
import { writePlatformAudit } from "@/platform/audit";
import { canonicalAccountForLegacyActor } from "@/wayfarer/accounts";
import { decryptPrivatePackage, encryptPrivatePayload } from "./package";
import { isWithin, privateFailure, redactPrivate, sha256, type PrivatePayload } from "./core";
import type {
  PrivateKeyProvider,
  PrivateObjectDescriptor,
  PrivateScannerProvider,
  PrivateStorageProvider,
} from "./contracts";
import { LocalPrivateKeyProvider } from "./key-provider";
import { decryptNormalizedPayload, encryptNormalizedPayload, type EncryptedNormalizedPayload } from "./payloads";
import { LocalPhase2PrivateStorageProvider } from "./provider-storage";
import { materializePrivatePackage } from "./materialization";
import { LocalPrivateAssetStore, type StagedPrivateObject } from "./storage";
import { LegacyPrivateAssetDeliveryStorageProvider } from "./storage";
import { UnconfiguredPrivateScanner } from "./scanner";

// The generated Prisma client can lag an additive migration in a fresh checkout.
const privateDb = db as any;

export type PrivatePayloadServices = {
  storage: PrivateStorageProvider;
  keyProvider: PrivateKeyProvider;
  scanner?: PrivateScannerProvider;
};

function configuredLocalKeyProvider() {
  const encoded = process.env.PRIVATE_CONTENT_LOCAL_MASTER_KEY;
  if (!encoded) throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private key storage is not configured.");
  const key = /^[a-f0-9]{64}$/i.test(encoded) ? Buffer.from(encoded, "hex") : Buffer.from(encoded, "base64url");
  if (key.length !== 32)
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private key storage is not configured.");
  return new LocalPrivateKeyProvider(key);
}

async function scanImportedAssets(input: {
  importId: string;
  scanner: PrivateScannerProvider;
  store: LocalPrivateAssetStore;
}) {
  const references = await privateDb.privateAssetReference.findMany({
    where: { importId: input.importId },
    include: { object: true },
  });
  const storage = new LegacyPrivateAssetDeliveryStorageProvider(input.store);
  const results: Array<{ objectId: string; state: string }> = [];
  for (const reference of references) {
    const result = await input.scanner.scan({
      object: {
        key: reference.object.storageKey,
        sha256: reference.object.sha256,
        byteLength: reference.object.byteLength,
        mediaType: reference.object.mediaType,
      },
      mediaType: reference.object.mediaType,
    });
    await privateDb.privateContentScan.create({
      data: {
        objectId: reference.objectId,
        provider: result.provider,
        state: result.state,
        safeCode: result.safeCode ?? null,
        scannedAt: new Date(),
      },
    });
    await privateDb.privateAssetObject.update({
      where: { id: reference.objectId },
      data: {
        scanStatus: result.state,
        ...(result.state === "CLEAN" ? {} : { quarantinedAt: new Date() }),
      },
    });
    results.push({ objectId: reference.objectId, state: result.state });
  }
  return { clean: results.every((result) => result.state === "CLEAN"), results };
}

function payloadServices(services?: PrivatePayloadServices): PrivatePayloadServices {
  return (
    services ?? {
      storage: new LocalPhase2PrivateStorageProvider(),
      keyProvider: configuredLocalKeyProvider(),
    }
  );
}

async function readAll(stream: Readable, maximumBytes: number) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > maximumBytes) throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, length);
}

type StoredEncryptedPayload = {
  encryptedPayload: EncryptedNormalizedPayload;
  descriptor: PrivateObjectDescriptor;
};

/** Persist retry data outside the database, then read/decrypt it before it becomes authoritative. */
async function storeNormalizedPayload(input: {
  importId: string;
  payload: PrivatePayload;
  services: PrivatePayloadServices;
}): Promise<StoredEncryptedPayload> {
  const encryptedPayload = await encryptNormalizedPayload(input.payload, input.services.keyProvider);
  const descriptor = await input.services.storage.put(
    "normalized",
    `imports/${input.importId}/${encryptedPayload.digest}`,
    Readable.from([encryptedPayload.bytes]),
    {
      expectedSha256: encryptedPayload.digest,
      contentLength: encryptedPayload.bytes.length,
      metadata: { cipher: encryptedPayload.cipher, purpose: "normalized-retry" },
    },
  );
  try {
    const verified = await decryptNormalizedPayload(
      {
        ...encryptedPayload,
        bytes: await readAll(await input.services.storage.read(descriptor), encryptedPayload.bytes.length),
      },
      input.services.keyProvider,
    );
    if (JSON.stringify(verified) !== JSON.stringify(input.payload))
      throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
    return { encryptedPayload, descriptor };
  } catch (error) {
    await input.services.storage.remove(descriptor).catch(() => undefined);
    throw error;
  }
}

async function recordNormalizedPayload(input: {
  importId: string;
  stored: StoredEncryptedPayload;
  clearLegacy?: boolean;
}) {
  const wrapped = await privateDb.privateContentWrappedKey.create({
    data: {
      provider: input.stored.encryptedPayload.wrappedKey.provider,
      keyVersion: input.stored.encryptedPayload.wrappedKey.keyVersion,
      wrappedKey: input.stored.encryptedPayload.wrappedKey.wrappedKey,
      algorithm: input.stored.encryptedPayload.wrappedKey.algorithm,
    },
  });
  const encrypted = await privateDb.privateContentEncryptedPayload.create({
    data: {
      objectKey: input.stored.descriptor.key,
      sha256: input.stored.descriptor.sha256,
      byteLength: input.stored.descriptor.byteLength,
      cipher: input.stored.encryptedPayload.cipher,
      wrappedKeyId: wrapped.id,
    },
  });
  await privateDb.privateContentImport.update({
    where: { id: input.importId },
    data: { normalizedPayloadId: encrypted.id, ...(input.clearLegacy ? { contentJson: null } : {}) },
  });
  return encrypted;
}

async function encryptedPayloadForRecord(
  record: { normalizedPayloadId: string | null },
  services: PrivatePayloadServices,
) {
  if (!record.normalizedPayloadId) return null;
  const encrypted = await privateDb.privateContentEncryptedPayload.findUniqueOrThrow({
    where: { id: record.normalizedPayloadId },
  });
  const wrapped = await privateDb.privateContentWrappedKey.findUniqueOrThrow({ where: { id: encrypted.wrappedKeyId } });
  const bytes = await readAll(
    await services.storage.read({
      key: encrypted.objectKey,
      sha256: encrypted.sha256,
      byteLength: encrypted.byteLength,
    }),
    encrypted.byteLength,
  );
  return decryptNormalizedPayload(
    {
      bytes,
      digest: encrypted.sha256,
      cipher: encrypted.cipher,
      wrappedKey: {
        provider: wrapped.provider,
        keyVersion: wrapped.keyVersion,
        wrappedKey: wrapped.wrappedKey,
        algorithm: wrapped.algorithm,
      },
    },
    services.keyProvider,
  );
}

/** Migration-window dual read: encrypted retry data wins; legacy plaintext is read only for backfill. */
export async function readPrivateImportRetryPayload(
  record: { normalizedPayloadId: string | null; contentJson: string | null },
  services?: PrivatePayloadServices,
) {
  const encrypted = await encryptedPayloadForRecord(record, payloadServices(services));
  if (encrypted) return encrypted;
  if (!record.contentJson) throw privateFailure("PRIVATE_PACKAGE_CONFLICT", "The retry source is unavailable.");
  try {
    return JSON.parse(record.contentJson) as PrivatePayload;
  } catch {
    throw privateFailure("PRIVATE_PACKAGE_INVALID");
  }
}

/** Resumable, verify-before-clear migration for Phase 1 plaintext retry rows. */
export async function migrateLegacyPrivateImportPayload(input: {
  importId: string;
  services?: PrivatePayloadServices;
}) {
  const record = await privateDb.privateContentImport.findUniqueOrThrow({ where: { id: input.importId } });
  const services = payloadServices(input.services);
  const scanner = services.scanner ?? new UnconfiguredPrivateScanner();
  if (record.normalizedPayloadId) {
    await readPrivateImportRetryPayload(record, services);
    return { importId: record.id, migrated: false as const, alreadyEncrypted: true as const };
  }
  const payload = await readPrivateImportRetryPayload(record, services);
  const stored = await storeNormalizedPayload({ importId: record.id, payload, services });
  try {
    await recordNormalizedPayload({ importId: record.id, stored, clearLegacy: true });
  } catch (error) {
    await services.storage.remove(stored.descriptor).catch(() => undefined);
    throw error;
  }
  return { importId: record.id, migrated: true as const, alreadyEncrypted: false as const };
}

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
  services?: PrivatePayloadServices;
  slugConflict?: "reject" | "remap";
}): Promise<PrivateImportReceipt> {
  const payload = await decryptPrivatePackage(input.packageBytes, input.passphrase);
  const importId = randomUUID();
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
  const services = payloadServices(input.services);
  const scanner = services.scanner ?? new UnconfiguredPrivateScanner();
  const store = new LocalPrivateAssetStore({ root: input.root, stagingRoot: input.stagingRoot });
  const staged = new Map<string, StagedPrivateObject>();
  const reused: string[] = [];
  // New imports retain only verified encrypted retry data. Neither this object
  // nor the passphrase is placed in contentJson, jobs, or audit events.
  const stored = await storeNormalizedPayload({ importId, payload, services });
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
          id: importId,
          packageId: plan.packageId,
          packageRevision: plan.packageRevision,
          packageSha256: plan.packageSha256,
          planSha256: plan.planSha256,
          status: "FINALIZING_ASSETS",
          ownerActorId: input.actorId,
          ownerAccountId,
          contentJson: null,
          correlationId,
        } as any,
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
    try {
      await recordNormalizedPayload({ importId: record.id, stored });
    } catch (error) {
      await services.storage.remove(stored.descriptor).catch(() => undefined);
      throw error;
    }
    for (const stagedObject of staged.values()) await store.finalizeObject(stagedObject);
    const scan = await scanImportedAssets({ importId: record.id, scanner, store });
    if (!scan.clean) {
      await privateDb.privateContentImport.update({
        where: { id: record.id },
        data: { status: "QUARANTINED", importedAssetIds: JSON.stringify(record.assetIds) },
      });
      return {
        importId: record.id,
        packageId: plan.packageId,
        packageRevision: plan.packageRevision,
        packageSha256: plan.packageSha256,
        status: "QUARANTINED",
        importedAssetIds: record.assetIds,
        reusedAssetIds: reused,
        correlationId,
      };
    }
    await db.$transaction(async (tx) => {
      await tx.privateAssetReference.updateMany({ where: { importId: record.id }, data: { available: true } });
      await tx.privateAssetObject.updateMany({
        where: { sha256: { in: payload.manifest.assets.map((asset) => asset.sha256) } },
        data: { finalizedAt: new Date() },
      });
      await tx.privateContentImport.update({
        where: { id: record.id },
        data: { status: "FINALIZING_ASSETS", importedAssetIds: JSON.stringify(record.assetIds) },
      });
    });
    await materializePrivatePackage({
      importId: record.id,
      payload,
      ownerActorId: input.actorId,
      ownerAccountId,
      slugConflict: input.slugConflict,
    });
    await privateDb.privateContentImport.update({
      where: { id: record.id },
      data: { status: "COMPLETED", completedAt: new Date() },
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
    await services.storage.remove(stored.descriptor).catch(() => undefined);
    throw error;
  }
}

/** Re-stage missing objects from the encrypted-import record and finish a safe retry. */
export async function retryPrivateImportFinalization(input: {
  importId: string;
  root?: string;
  stagingRoot?: string;
  services?: PrivatePayloadServices;
}) {
  const record = await db.privateContentImport.findUniqueOrThrow({
    where: { id: input.importId },
    include: { assetReferences: { include: { object: true } } },
  });
  if (!["FINALIZING_ASSETS", "FINALIZATION_RETRY"].includes(record.status))
    throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
  const payload = await readPrivateImportRetryPayload(record as any, input.services);
  const store = new LocalPrivateAssetStore({ root: input.root, stagingRoot: input.stagingRoot });
  const scanner = payloadServices(input.services).scanner ?? new UnconfiguredPrivateScanner();
  const staged: StagedPrivateObject[] = [];
  try {
    for (const asset of payload.manifest.assets) {
      if (!(await store.objectExists(asset.sha256)))
        staged.push(
          await store.stageObject(Buffer.from(payload.entries[asset.relativePath], "base64url"), asset.sha256),
        );
    }
    for (const stagedObject of staged) await store.finalizeObject(stagedObject);
    const scan = await scanImportedAssets({ importId: record.id, scanner, store });
    if (!scan.clean) {
      await privateDb.privateContentImport.update({
        where: { id: record.id },
        data: { status: "QUARANTINED", finalizationErrorCode: null },
      });
      return { importId: record.id, status: "QUARANTINED" as const };
    }
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
    if ((record as any).materializationStatus !== "COMPLETED")
      await materializePrivatePackage({
        importId: record.id,
        payload,
        ownerActorId: record.ownerActorId ?? "private-import",
        ownerAccountId: record.ownerAccountId,
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

export async function exportPrivateImport(
  importId: string,
  passphrase: string,
  services?: PrivatePayloadServices,
): Promise<PrivateExportReceipt> {
  const record = await db.privateContentImport.findUniqueOrThrow({ where: { id: importId } });
  const payload = await readPrivateImportRetryPayload(record as any, services);
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

export async function writePrivateExport(input: {
  importId: string;
  passphrase: string;
  outputPath: string;
  services?: PrivatePayloadServices;
}) {
  const receipt = await exportPrivateImport(input.importId, input.passphrase, input.services);
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
