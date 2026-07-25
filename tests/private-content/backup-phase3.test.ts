import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import {
  createAndVerifyPrivateOperationalBackup,
  planPrivateBackupRetention,
  restorePrivateOperationalBackup,
  verifyPrivateOperationalBackup,
} from "@/private-content/backup-phase3";
import { LocalPrivateKeyProvider } from "@/private-content/key-provider";
import { LocalPhase2PrivateStorageProvider } from "@/private-content/provider-storage";

const roots: string[] = [];
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
async function storage() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sealed-hold-phase3-backup-"));
  roots.push(root);
  return new LocalPhase2PrivateStorageProvider({ root });
}
const key = () => new LocalPrivateKeyProvider(Buffer.alloc(32, 9), "test-v1");
const records = () => ({
  schemaVersion: "sqlite-phase3",
  imports: [{ id: "import-1", status: "COMPLETED" }],
  mappings: [{ importId: "import-1", sourceLogicalId: "x", targetId: "x" }],
  assetObjects: [{ id: "object-1", scanStatus: "CLEAN" }],
  assetReferences: [{ objectId: "object-1", available: true }],
  encryptedPayloads: [{ id: "payload-1" }],
  wrappedKeys: [
    { provider: "local-development", keyVersion: "test-v1", algorithm: "AES-256-GCM", wrappedKey: "opaque" },
  ],
  scans: [{ objectId: "object-1", state: "CLEAN" }],
  operations: [{ id: "operation-1", state: "COMPLETED" }],
  scheduledOperations: [{ id: "schedule-1", state: "PENDING" }],
});
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("Phase 3 encrypted operational backups", () => {
  it("encrypts, verifies, retains, and restores into two distinct isolated targets", async () => {
    const source = await storage();
    const destinationOne = await storage();
    const destinationTwo = await storage();
    const object = await source.put("objects", "assets/a", Readable.from(["synthetic asset"]), {
      expectedSha256: digest("synthetic asset"),
      contentLength: 15,
    });
    const receipt = await createAndVerifyPrivateOperationalBackup({
      sourceEnvironmentId: "source-synthetic",
      sourceDatabaseIdentity: "sqlite:source",
      records: records(),
      objects: [object],
      storage: source,
      keyProvider: key(),
      backupId: "backup-synthetic",
    });
    expect(receipt).toMatchObject({ verified: true, objectCount: 1 });
    const restored: unknown[] = [];
    for (const [target, destination] of [
      ["drill-one", destinationOne],
      ["drill-two", destinationTwo],
    ] as const) {
      await expect(
        restorePrivateOperationalBackup({
          backupId: receipt.backupId,
          targetEnvironmentId: target,
          storage: source,
          destinationStorage: destination,
          keyProvider: key(),
          knownKeyVersions: ["local-development:test-v1"],
          restoreRecords: async (value) => {
            restored.push(value);
          },
        }),
      ).resolves.toMatchObject({ restoredObjects: 1 });
      expect(await destination.exists(object)).toBe(true);
      expect(await new LocalPhase2PrivateStorageProvider({ root: destination.root }).exists(object)).toBe(true);
    }
    expect(restored).toHaveLength(2);
    expect(
      planPrivateBackupRetention({
        backups: [
          { backupId: "old", verifiedAt: new Date(0), createdAt: new Date(0) },
          { backupId: receipt.backupId, verifiedAt: new Date(), createdAt: new Date() },
        ],
        retain: 1,
      }),
    ).toContainEqual({ backupId: receipt.backupId, action: "RETAIN" });
  });
  it("fails closed for tampering, unknown keys, and production restore targets", async () => {
    const source = await storage();
    const destination = await storage();
    const object = await source.put("objects", "assets/b", Readable.from(["asset"]), {
      expectedSha256: digest("asset"),
      contentLength: 5,
    });
    await createAndVerifyPrivateOperationalBackup({
      sourceEnvironmentId: "dev-source",
      sourceDatabaseIdentity: "sqlite:source",
      records: records(),
      objects: [object],
      storage: source,
      keyProvider: key(),
      backupId: "backup-failures",
    });
    await expect(
      verifyPrivateOperationalBackup({
        backupId: "backup-failures",
        storage: source,
        keyProvider: key(),
        knownKeyVersions: [],
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_CONTENT_FORBIDDEN" });
    await expect(
      restorePrivateOperationalBackup({
        backupId: "backup-failures",
        targetEnvironmentId: "production",
        storage: source,
        destinationStorage: destination,
        keyProvider: key(),
        knownKeyVersions: ["local-development:test-v1"],
        restoreRecords: async () => undefined,
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_CONTENT_FORBIDDEN" });
  });
});
