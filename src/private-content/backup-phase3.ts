import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type {
  PrivateKeyProvider,
  PrivateObjectDescriptor,
  PrivateStorageProvider,
  WrappedPrivateDataKey,
} from "./contracts";
import { assertIsolatedPrivateRestoreTarget } from "./operations-phase3";
import { privateFailure, sha256 } from "./core";

const backupAad = Buffer.from("forever-treasure-sealed-hold-backup-v1");
const maxBackupObjectBytes = 32 * 1024 * 1024;

export type PrivateBackupRecordSet = {
  schemaVersion: string;
  imports: readonly Record<string, unknown>[];
  mappings: readonly Record<string, unknown>[];
  assetObjects: readonly Record<string, unknown>[];
  assetReferences: readonly Record<string, unknown>[];
  encryptedPayloads: readonly Record<string, unknown>[];
  wrappedKeys: readonly { provider: string; keyVersion: string; algorithm: string; wrappedKey: string }[];
  scans: readonly Record<string, unknown>[];
  operations: readonly Record<string, unknown>[];
  scheduledOperations: readonly Record<string, unknown>[];
};
export type PrivateSealedBackupValue = {
  version: 1;
  nonce: string;
  ciphertext: string;
  digest: string;
  wrappedKey: WrappedPrivateDataKey;
};
export type PrivateOperationalBackupManifest = {
  format: "forever-treasure-sealed-hold-backup";
  version: 1;
  backupId: string;
  sourceEnvironmentId: string;
  sourceDatabaseIdentity: string;
  createdAt: string;
  records: PrivateBackupRecordSet;
  objects: Array<{ source: PrivateObjectDescriptor; backup: PrivateObjectDescriptor }>;
  requiredKeyVersions: string[];
  manifestDigest: string;
};
export type PrivateBackupReceipt = {
  backupId: string;
  manifestDigest: string;
  objectCount: number;
  objectSetDigest: string;
  requiredKeyVersions: string[];
  verified: true;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function manifestDigest(input: Omit<PrivateOperationalBackupManifest, "manifestDigest">) {
  return sha256(
    stable({ ...input, objects: [...input.objects].sort((a, b) => a.source.key.localeCompare(b.source.key)) }),
  );
}
async function readBounded(stream: Readable, limit: number) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const part of stream) {
    const bytes = Buffer.isBuffer(part) ? part : Buffer.from(part);
    length += bytes.length;
    if (length > limit)
      throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED", "Private backup object exceeds the bounded limit.");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, length);
}

export async function sealPrivateBackupValue(
  value: unknown,
  keyProvider: PrivateKeyProvider,
): Promise<PrivateSealedBackupValue> {
  const plaintext = Buffer.from(stable(value));
  const dataKey = randomBytes(32);
  try {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", dataKey, nonce);
    cipher.setAAD(backupAad);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
    return {
      version: 1,
      nonce: nonce.toString("base64url"),
      ciphertext: encrypted.toString("base64url"),
      digest: sha256(encrypted),
      wrappedKey: await keyProvider.wrap(dataKey),
    };
  } finally {
    dataKey.fill(0);
    plaintext.fill(0);
  }
}
export async function unsealPrivateBackupValue(
  sealed: PrivateSealedBackupValue,
  keyProvider: PrivateKeyProvider,
): Promise<unknown> {
  if (sealed.version !== 1 || sha256(Buffer.from(sealed.ciphertext, "base64url")) !== sealed.digest)
    throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
  const dataKey = await keyProvider.unwrap(sealed.wrappedKey);
  try {
    const bytes = Buffer.from(sealed.ciphertext, "base64url");
    if (bytes.length < 17) throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
    const decipher = createDecipheriv("aes-256-gcm", dataKey, Buffer.from(sealed.nonce, "base64url"));
    decipher.setAAD(backupAad);
    decipher.setAuthTag(bytes.subarray(-16));
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(0, -16)), decipher.final()]).toString("utf8"));
  } catch (error) {
    if (error instanceof Error && "code" in error) throw error;
    throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
  } finally {
    dataKey.fill(0);
  }
}
function backupObjectKey(backupId: string, source: PrivateObjectDescriptor) {
  return `${sha256(backupId)}/objects/${sha256(source.key)}-${source.sha256}`;
}
function backupManifestKey(backupId: string) {
  return `${sha256(backupId)}/manifest`;
}
function keyWithoutNamespace(key: string, namespace: string) {
  const prefix = `${namespace}/`;
  if (!key.startsWith(prefix)) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
  return key.slice(prefix.length);
}

/** Builds, encrypts, persists, and immediately verifies a bounded backup using only private storage. */
export async function createAndVerifyPrivateOperationalBackup(input: {
  sourceEnvironmentId: string;
  sourceDatabaseIdentity: string;
  records: PrivateBackupRecordSet;
  objects: readonly PrivateObjectDescriptor[];
  storage: PrivateStorageProvider;
  keyProvider: PrivateKeyProvider;
  now?: Date;
  backupId?: string;
}): Promise<PrivateBackupReceipt> {
  const backupId = input.backupId ?? randomUUID();
  const copied: PrivateOperationalBackupManifest["objects"] = [];
  for (const source of input.objects) {
    if (!(await input.storage.exists(source)))
      throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH", "Private backup source object is missing.");
    const original = await readBounded(
      await input.storage.read(source),
      Math.min(maxBackupObjectBytes, source.byteLength + 1),
    );
    if (original.length !== source.byteLength || sha256(original) !== source.sha256)
      throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
    const sealed = await sealPrivateBackupValue({ bytes: original.toString("base64url") }, input.keyProvider);
    original.fill(0);
    const bytes = Buffer.from(JSON.stringify(sealed));
    const backup = await input.storage.put("backups", backupObjectKey(backupId, source), Readable.from([bytes]), {
      expectedSha256: sha256(bytes),
      contentLength: bytes.length,
      metadata: { purpose: "encrypted-backup-object" },
    });
    copied.push({ source, backup });
  }
  const requiredKeyVersions = [
    ...new Set(input.records.wrappedKeys.map((item) => `${item.provider}:${item.keyVersion}`)),
  ].sort();
  const body = {
    format: "forever-treasure-sealed-hold-backup" as const,
    version: 1 as const,
    backupId,
    sourceEnvironmentId: input.sourceEnvironmentId,
    sourceDatabaseIdentity: input.sourceDatabaseIdentity,
    createdAt: (input.now ?? new Date()).toISOString(),
    records: input.records,
    objects: copied,
    requiredKeyVersions,
  };
  const manifest: PrivateOperationalBackupManifest = { ...body, manifestDigest: manifestDigest(body) };
  const sealedManifest = await sealPrivateBackupValue(manifest, input.keyProvider);
  const manifestBytes = Buffer.from(JSON.stringify(sealedManifest));
  await input.storage.put("backups", backupManifestKey(backupId), Readable.from([manifestBytes]), {
    expectedSha256: sha256(manifestBytes),
    contentLength: manifestBytes.length,
    metadata: { purpose: "encrypted-backup-manifest" },
  });
  const verified = await verifyPrivateOperationalBackup({
    backupId,
    storage: input.storage,
    keyProvider: input.keyProvider,
    knownKeyVersions: requiredKeyVersions,
  });
  return {
    backupId,
    manifestDigest: verified.manifest.manifestDigest,
    objectCount: copied.length,
    objectSetDigest: sha256(stable(copied.map((item) => item.source))),
    requiredKeyVersions,
    verified: true,
  };
}

export async function verifyPrivateOperationalBackup(input: {
  backupId: string;
  storage: PrivateStorageProvider;
  keyProvider: PrivateKeyProvider;
  knownKeyVersions: readonly string[];
}) {
  const manifestKey = `backups/${backupManifestKey(input.backupId)}`;
  const manifestDescriptor = await readDescriptor(input.storage, manifestKey);
  const sealed = JSON.parse(
    (await readBounded(await input.storage.read(manifestDescriptor), maxBackupObjectBytes)).toString("utf8"),
  ) as PrivateSealedBackupValue;
  const manifest = (await unsealPrivateBackupValue(sealed, input.keyProvider)) as PrivateOperationalBackupManifest;
  const { manifestDigest: suppliedDigest, ...manifestBody } = manifest;
  if (
    manifest.format !== "forever-treasure-sealed-hold-backup" ||
    manifest.backupId !== input.backupId ||
    suppliedDigest !== manifestDigest(manifestBody)
  )
    throw privateFailure("PRIVATE_PACKAGE_AUTHENTICATION_FAILED");
  if (manifest.requiredKeyVersions.some((version) => !input.knownKeyVersions.includes(version)))
    throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private backup requires an unavailable key version.");
  for (const object of manifest.objects) {
    if (!(await input.storage.exists(object.backup)))
      throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH", "Private backup object is missing.");
    const sealedObject = JSON.parse(
      (await readBounded(await input.storage.read(object.backup), maxBackupObjectBytes)).toString("utf8"),
    ) as PrivateSealedBackupValue;
    const body = (await unsealPrivateBackupValue(sealedObject, input.keyProvider)) as { bytes?: string };
    const bytes = body.bytes ? Buffer.from(body.bytes, "base64url") : Buffer.alloc(0);
    const valid = bytes.length === object.source.byteLength && sha256(bytes) === object.source.sha256;
    bytes.fill(0);
    if (!valid) throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH", "Private backup object is corrupt.");
  }
  return { manifest, manifestDescriptor };
}
async function readDescriptor(storage: PrivateStorageProvider, key: string): Promise<PrivateObjectDescriptor> {
  const probe = { key, sha256: "" };
  const stream = await storage.read({ ...probe, byteLength: 0 });
  const bytes = await readBounded(stream, maxBackupObjectBytes);
  return { key, sha256: sha256(bytes), byteLength: bytes.length };
}

export async function restorePrivateOperationalBackup(input: {
  backupId: string;
  targetEnvironmentId: string;
  storage: PrivateStorageProvider;
  destinationStorage: PrivateStorageProvider;
  keyProvider: PrivateKeyProvider;
  knownKeyVersions: readonly string[];
  restoreRecords: (records: PrivateBackupRecordSet) => Promise<void>;
}) {
  const verified = await verifyPrivateOperationalBackup({
    backupId: input.backupId,
    storage: input.storage,
    keyProvider: input.keyProvider,
    knownKeyVersions: input.knownKeyVersions,
  });
  assertIsolatedPrivateRestoreTarget({
    targetEnvironmentId: input.targetEnvironmentId,
    sourceEnvironmentId: verified.manifest.sourceEnvironmentId,
    mode: "isolated-only",
  });
  await input.restoreRecords(verified.manifest.records);
  for (const item of verified.manifest.objects) {
    const sealed = JSON.parse(
      (await readBounded(await input.storage.read(item.backup), maxBackupObjectBytes)).toString("utf8"),
    ) as PrivateSealedBackupValue;
    const value = (await unsealPrivateBackupValue(sealed, input.keyProvider)) as { bytes: string };
    const bytes = Buffer.from(value.bytes, "base64url");
    try {
      const namespace = item.source.key.split("/", 1)[0] ?? "objects";
      await input.destinationStorage.put(
        namespace as "objects",
        keyWithoutNamespace(item.source.key, namespace),
        Readable.from([bytes]),
        { expectedSha256: item.source.sha256, contentLength: item.source.byteLength },
      );
    } finally {
      bytes.fill(0);
    }
  }
  return {
    backupId: input.backupId,
    targetEnvironmentId: input.targetEnvironmentId,
    restoredObjects: verified.manifest.objects.length,
    manifestDigest: verified.manifest.manifestDigest,
  };
}

export function planPrivateBackupRetention(input: {
  backups: Array<{ backupId: string; verifiedAt: Date | null; createdAt: Date }>;
  retain: number;
}) {
  const verified = input.backups
    .filter((backup) => backup.verifiedAt)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const protectedIds = new Set(verified.slice(0, Math.max(1, input.retain)).map((backup) => backup.backupId));
  return input.backups.map((backup) => ({
    backupId: backup.backupId,
    action: protectedIds.has(backup.backupId) || !backup.verifiedAt ? "RETAIN" : ("REVIEW_DELETE" as const),
  }));
}
