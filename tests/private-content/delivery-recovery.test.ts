import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import {
  PrivateAssetDeliveryService,
  createQuarantineOverrideAudit,
  enforcePrivateScanState,
  parsePrivateByteRange,
} from "@/private-content/delivery-phase2";
import { LocalPhase2PrivateStorageProvider } from "@/private-content/provider-storage";
import {
  createPrivateBackupManifest,
  reconcilePrivateIntegrity,
  verifyPrivateBackupManifest,
} from "@/private-content/recovery";

const roots: string[] = [];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
async function storage() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sealed-delivery-"));
  roots.push(root);
  return new LocalPhase2PrivateStorageProvider({ root });
}
async function text(stream: Readable) {
  const parts: Buffer[] = [];
  for await (const part of stream) parts.push(Buffer.isBuffer(part) ? part : Buffer.from(part));
  return Buffer.concat(parts).toString();
}
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("private delivery and recovery", () => {
  it("streams only CLEAN authorized assets with bounded ranges and opaque denials", async () => {
    const provider = await storage();
    const object = await provider.put("objects", "assets/a", Readable.from(["private asset"]), {
      expectedSha256: hash("private asset"),
    });
    const service = new PrivateAssetDeliveryService(provider, { canReadPrivateAsset: async () => true });
    const delivered = await service.open({
      asset: { id: "asset", object, scanState: "CLEAN", mediaType: "image/png" },
      range: "bytes=8-99",
    });
    expect(delivered.status).toBe(206);
    expect(delivered.headers["Content-Range"]).toBe("bytes 8-12/13");
    expect(await text(delivered.stream)).toBe("asset");
    await expect(
      service.open({ asset: { id: "asset", object, scanState: "SUSPICIOUS", mediaType: "image/png" } }),
    ).rejects.toMatchObject({ code: "PRIVATE_CONTENT_FORBIDDEN" });
    await expect(
      new PrivateAssetDeliveryService(provider, { canReadPrivateAsset: async () => false }).open({
        asset: { id: "asset", object, scanState: "CLEAN", mediaType: "image/png" },
      }),
    ).rejects.toMatchObject({ code: "PRIVATE_CONTENT_FORBIDDEN" });
  });

  it("keeps every non-clean scanner result quarantined and records valid override intent", () => {
    expect(enforcePrivateScanState("CLEAN")).toEqual({ outcome: "PROMOTE", scanState: "CLEAN" });
    for (const state of ["NOT_CONFIGURED", "FAILED", "SUSPICIOUS", "MALICIOUS"] as const)
      expect(enforcePrivateScanState(state)).toMatchObject({ outcome: "QUARANTINE", scanState: state });
    expect(createQuarantineOverrideAudit({ assetId: "a", actorId: "u", reasonCode: "FALSE_POSITIVE" })).toMatchObject({
      reasonCode: "FALSE_POSITIVE",
    });
    expect(() => parsePrivateByteRange("bytes=1-2,3-4", 9)).toThrow();
  });

  it("detects backup manifest tampering before restore", () => {
    const manifest = createPrivateBackupManifest({
      backupId: "b",
      createdAt: "2026-07-22T00:00:00.000Z",
      canonicalDigest: hash("canonical"),
      objects: [{ key: "objects/a", sha256: hash("a"), byteLength: 1 }],
      wrappedKeyMetadata: [{ provider: "test", keyVersion: "1", wrappedKeyDigest: hash("wrapped") }],
    });
    expect(verifyPrivateBackupManifest(manifest)).toBe(true);
    expect(verifyPrivateBackupManifest({ ...manifest, canonicalDigest: hash("changed") })).toBe(false);
  });

  it("plans dry-run integrity repair without deleting ambiguous or backup-referenced objects", () => {
    const plan = reconcilePrivateIntegrity({
      now: new Date("2026-07-22T00:00:00.000Z"),
      graceMs: 1000,
      objects: [
        {
          object: { key: "objects/corrupt", sha256: hash("c"), byteLength: 1 },
          exists: true,
          digestValid: false,
          scanState: "CLEAN",
          keyVersion: "1",
          knownKeyVersions: ["1"],
          liveReferences: 1,
          backupReferences: 0,
          createdAt: new Date(0),
          namespace: "objects",
        },
        {
          object: { key: "objects/old-orphan", sha256: hash("o"), byteLength: 1 },
          exists: true,
          digestValid: true,
          scanState: "CLEAN",
          keyVersion: "1",
          knownKeyVersions: ["1"],
          liveReferences: 0,
          backupReferences: 0,
          createdAt: new Date(0),
          namespace: "objects",
        },
        {
          object: { key: "objects/backup", sha256: hash("b"), byteLength: 1 },
          exists: true,
          digestValid: true,
          scanState: "CLEAN",
          keyVersion: "1",
          knownKeyVersions: ["1"],
          liveReferences: 0,
          backupReferences: 1,
          createdAt: new Date(0),
          namespace: "objects",
        },
      ],
    });
    expect(plan.dryRun).toBe(true);
    expect(plan.actions).toContainEqual({ key: "objects/corrupt", reason: "CORRUPT_OBJECT", action: "QUARANTINE" });
    expect(plan.actions).toContainEqual({ key: "objects/old-orphan", reason: "ORPHAN", action: "DELETE_AFTER_GRACE" });
    expect(plan.actions.some((item) => item.key === "objects/backup" && item.action === "DELETE_AFTER_GRACE")).toBe(
      false,
    );
  });
});
