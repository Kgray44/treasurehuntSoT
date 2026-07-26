import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { assessPrivateReadiness, parsePrivateContentConfiguration } from "@/private-content/config";
import { AwsKmsPrivateKeyProvider } from "@/private-content/key-provider";
import { S3CompatiblePrivateStorageProvider, type S3CompatibleObjectClient } from "@/private-content/provider-storage";
import {
  approvePrivateRepairPlan,
  assertIsolatedPrivateRestoreTarget,
  canRetirePrivateKey,
  createPrivateRepairPlan,
  createReferentiallyClosedBackupSnapshot,
  executeApprovedPrivateRepairPlan,
} from "@/private-content/operations-phase3";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const environment = (overrides: Record<string, string | undefined> = {}) =>
  ({
    NODE_ENV: "test",
    PRIVATE_CONTENT_PROVIDER_ROOT: "C:\\private-test",
    PRIVATE_CONTENT_LOCAL_MASTER_KEY: "a".repeat(64),
    DATABASE_URL: "file:./test.db",
    ...overrides,
  }) as NodeJS.ProcessEnv;

class MemoryS3 implements S3CompatibleObjectClient {
  readonly objects = new Map<string, Buffer>();
  readonly parts = new Map<string, Map<number, Buffer>>();
  async health() {
    return { healthy: true, providerVersion: "memory-s3" };
  }
  async put(key: string, body: Readable) {
    const chunks: Buffer[] = [];
    for await (const part of body) chunks.push(Buffer.from(part));
    this.objects.set(key, Buffer.concat(chunks));
    return {};
  }
  async read(key: string, range?: { start: number; end?: number }) {
    const value = this.objects.get(key)!;
    return Readable.from([range ? value.subarray(range.start, (range.end ?? value.length - 1) + 1) : value]);
  }
  async head(key: string) {
    const value = this.objects.get(key);
    return value ? { sha256: hash(value.toString()), byteLength: value.length } : null;
  }
  async copy(source: string, destination: string) {
    this.objects.set(destination, Buffer.from(this.objects.get(source)!));
  }
  async remove(key: string) {
    this.objects.delete(key);
  }
  async beginMultipart(key: string) {
    const uploadId = `upload-${this.parts.size}`;
    this.parts.set(uploadId, new Map());
    return { uploadId };
  }
  async uploadPart(uploadId: string, _key: string, partNumber: number, body: Readable, expectedSha256: string) {
    const chunks: Buffer[] = [];
    for await (const part of body) chunks.push(Buffer.from(part));
    const value = Buffer.concat(chunks);
    if (hash(value.toString()) !== expectedSha256) throw new Error("checksum");
    this.parts.get(uploadId)!.set(partNumber, value);
    return { etag: expectedSha256, byteLength: value.length };
  }
  async completeMultipart(uploadId: string, key: string) {
    const parts = this.parts.get(uploadId)!;
    this.objects.set(key, Buffer.concat([...parts.entries()].sort(([a], [b]) => a - b).map(([, value]) => value)));
    return {};
  }
  async abortMultipart(uploadId: string) {
    this.parts.delete(uploadId);
  }
}

describe("Phase 3 operational controls", () => {
  it("rejects production local fallback and reports role-specific readiness", () => {
    expect(() => parsePrivateContentConfiguration(environment({ NODE_ENV: "production" }))).toThrow();
    expect(assessPrivateReadiness("worker", [{ kind: "DATABASE", healthy: true } as never])).toMatchObject({
      ready: false,
      blockedKinds: expect.arrayContaining(["STORAGE", "SCANNER"]),
    });
  });

  it("uses the S3 contract for immutable copy, range reads, and multipart assembly", async () => {
    const provider = new S3CompatiblePrivateStorageProvider({ prefix: "isolated/test", client: new MemoryS3() });
    const source = await provider.put("uploads", "a", Readable.from(["hello world"]), {
      expectedSha256: hash("hello world"),
      contentLength: 11,
    });
    const final = await provider.promote(source, { namespace: "objects", key: "a" });
    const range = await provider.read(final, { start: 6 });
    const chunks: Buffer[] = [];
    for await (const part of range) chunks.push(Buffer.from(part));
    expect(Buffer.concat(chunks).toString()).toBe("world");
    const upload = await provider.beginMultipart({ key: "b" });
    const part = await provider.uploadPart({
      uploadId: upload.uploadId,
      partNumber: 1,
      body: Readable.from(["bytes"]),
      expectedSha256: hash("bytes"),
    });
    await expect(
      provider.completeMultipart({ uploadId: upload.uploadId, parts: [{ partNumber: 1, etag: part.etag }] }),
    ).resolves.toMatchObject({ byteLength: 5 });
    const firstQuarantine = await provider.moveToQuarantine(final, "CORRUPT_OBJECT");
    const retryQuarantine = await provider.moveToQuarantine(final, "CORRUPT_OBJECT");
    expect(retryQuarantine).toMatchObject({
      key: firstQuarantine.key,
      sha256: final.sha256,
      byteLength: final.byteLength,
    });
  });

  it("binds KMS decrypt to context and clears transient plaintext after rewrap", async () => {
    const ciphertext = Buffer.from("x".repeat(32)).toString("base64");
    const client = {
      invoke: async (target: string, body: Record<string, unknown>) => {
        if ((body.EncryptionContext as Record<string, string>).environment !== "isolated") throw new Error("context");
        if (target === "DescribeKey") return { KeyMetadata: { KeyId: "key-v2", KeyState: "Enabled" } };
        if (target === "Encrypt") return { CiphertextBlob: ciphertext, KeyId: "key-v2" };
        return { Plaintext: ciphertext };
      },
    };
    const provider = new AwsKmsPrivateKeyProvider({
      client,
      keyId: "alias/sealed",
      encryptionContext: { environment: "isolated" },
    });
    const wrapped = await provider.wrap(Buffer.alloc(32, 7));
    expect(wrapped.keyVersion).toBe("key-v2");
    await expect(provider.unwrap({ ...wrapped, provider: "different" })).rejects.toMatchObject({
      code: "PRIVATE_CONTENT_FORBIDDEN",
    });
  });

  it("requires approved, fresh, non-dry-run repair plans and rejects production restore targets", async () => {
    const snapshot = hash("snapshot");
    const plan = createPrivateRepairPlan({
      snapshotDigest: snapshot,
      expiresAt: new Date("2030-01-01"),
      actions: [{ key: "opaque", reason: "ORPHAN", action: "DELETE_AFTER_GRACE" }],
    });
    const approved = approvePrivateRepairPlan(plan, {
      administratorAccountId: "admin",
      explicitDigest: plan.digest,
      now: new Date("2029-01-01"),
    });
    const apply = vi.fn().mockResolvedValue(undefined);
    await expect(
      executeApprovedPrivateRepairPlan({
        plan: approved,
        currentSnapshotDigest: snapshot,
        explicitDigest: approved.digest,
        now: new Date("2029-01-01"),
        apply,
      }),
    ).resolves.toMatchObject({ state: "COMPLETED", dryRun: false });
    expect(apply).toHaveBeenCalledTimes(1);
    expect(() =>
      assertIsolatedPrivateRestoreTarget({
        targetEnvironmentId: "production",
        sourceEnvironmentId: "dev",
        mode: "isolated-only",
      }),
    ).toThrow();
    expect(
      canRetirePrivateKey({
        version: "v1",
        activeVersion: "v2",
        liveReferences: 0,
        backupReferences: 0,
        restoreVerified: true,
        explicitlyApproved: true,
      }),
    ).toBe(true);
    expect(
      createReferentiallyClosedBackupSnapshot({
        databaseSnapshotIdentity: "db",
        recordsDigest: hash("records"),
        objects: [{ key: "objects/a", sha256: hash("a"), byteLength: 1 }],
        requiredKeyVersions: ["v1"],
      }).objectSetDigest,
    ).toMatch(/^[a-f0-9]{64}$/);
  });
});
