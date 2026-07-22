/* eslint-disable @typescript-eslint/no-explicit-any -- durable upload fixtures use intentionally partial database records */
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  cancelPrivateUpload,
  completePrivateUploadStream,
  expirePrivateUploads,
  initiatePrivateUpload,
  inspectCompletedPrivateUploadV2,
  pausePrivateUpload,
  receivePrivateUploadPart,
  resumePrivateUpload,
} from "@/private-content/uploads";
import { encryptPrivatePackageV2 } from "@/private-content/streaming";
import { makePayload } from "@/private-content/package";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const storage = {
  name: "test",
  supportsMultipart: true,
  supportsSignedRead: false,
  beginMultipart: vi.fn(async () => ({ uploadId: "11111111-1111-1111-1111-111111111111" })),
  uploadPart: vi.fn(async (input: { body: Readable }) => {
    const chunks: Buffer[] = [];
    for await (const chunk of input.body) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    return { etag: digest(bytes), byteLength: bytes.length };
  }),
  completeMultipart: vi.fn(async () => ({ key: "uploads/package", sha256: digest("hello world"), byteLength: 11 })),
  abortMultipart: vi.fn(async () => undefined),
  put: vi.fn(),
  read: vi.fn(),
  exists: vi.fn(),
  promote: vi.fn(),
  moveToQuarantine: vi.fn(),
  remove: vi.fn(async () => undefined),
};

describe("Phase 2 raw private upload service", () => {
  it("expires a bounded batch only after aborting its provider multipart receiver", async () => {
    const expired: any = { id: "upload-expired", operationId: "operation-expired", expiresAt: new Date("2026-07-21T00:00:00.000Z"), completedAt: null, cancelledAt: null, operation: { progress: JSON.stringify({ multipartUploadId: "11111111-1111-1111-1111-111111111111" }) } };
    const cancelUpload = vi.fn(async () => undefined);
    const abortMultipart = vi.fn(async () => undefined);
    await expect(expirePrivateUploads({ now: new Date("2026-07-22T00:00:00.000Z"), limit: 10 }, { findExpiredUploads: async () => [expired], cancelUpload, storage: () => ({ ...storage, abortMultipart }) as any })).resolves.toEqual({ expired: 1, inspected: 1 });
    expect(abortMultipart).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111");
    expect(cancelUpload).toHaveBeenCalledWith(expired);
  });
  it("pauses and resumes only the owned durable multipart receiver", async () => {
    const upload: any = { id: "upload-paused", operationId: "operation-paused", storageKey: "uploads/paused", expiresAt: new Date(Date.now() + 60_000), completedAt: null, cancelledAt: null, operation: { ownerAccountId: "account-1", state: "RECEIVING", progress: JSON.stringify({ multipartUploadId: "11111111-1111-1111-1111-111111111111" }) }, parts: [] };
    const setOperationState = vi.fn(async (_operationId: string, state: string) => { upload.operation.state = state; });
    const deps: any = { accountForActor: async () => "account-1", findUpload: async () => upload, setOperationState };
    await expect(pausePrivateUpload({ actorId: "creator", uploadId: upload.id }, deps)).resolves.toMatchObject({ state: "UPLOAD_PAUSED" });
    await expect(resumePrivateUpload({ actorId: "creator", uploadId: upload.id }, deps)).resolves.toMatchObject({ state: "RECEIVING" });
    expect(setOperationState.mock.calls).toEqual([["operation-paused", "UPLOAD_PAUSED"], ["operation-paused", "RECEIVING"]]);
  });
  it("inspects a completed v2 upload directly from its provider stream", async () => {
    const entry = Buffer.from('{"schemaVersion":1}').toString("base64url");
    const payload = makePayload({ manifest: { packageId: "upload-v2-proof", packageRevision: 1, formatVersion: 1, createdAt: "2026-07-22T00:00:00.000Z", sourceApplicationVersion: "0.2", minimumApplicationVersion: "0.2", classification: "private", contentType: "tale-draft", tales: [{ logicalId: "tale", slug: "upload-v2", title: "Upload v2", contentPath: "tales/proof.json" }], assets: [], dependencies: [], totals: { files: 1, assets: 0, plaintextBytes: Buffer.from(entry, "base64url").length } }, entries: { "tales/proof.json": entry } });
    const wire: Buffer[] = []; for await (const chunk of encryptPrivatePackageV2(payload, "upload passphrase")) wire.push(chunk);
    const root = await mkdtemp(path.join(os.tmpdir(), "sealed-upload-v2-"));
    try {
      const upload: any = { id: "upload-v2", operationId: "operation-v2", storageKey: "uploads/v2", expectedSha256: digest(Buffer.concat(wire)), receivedBytes: Buffer.concat(wire).length, expiresAt: new Date(Date.now() + 60_000), completedAt: new Date(), cancelledAt: null, parts: [], operation: { ownerAccountId: "account-1", state: "UPLOADED", progress: "{}" } };
      const result = await inspectCompletedPrivateUploadV2({ actorId: "creator", uploadId: upload.id, passphrase: "upload passphrase", stagingRoot: root }, { storage: () => ({ ...storage, read: async () => Readable.from(wire) }) as any, accountForActor: async () => "account-1", findUpload: async () => upload });
      expect(result).toMatchObject({ packageId: "upload-v2-proof", fileCount: 1 });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it("initiates an opaque durable upload and persists its multipart receiver", async () => {
    const updateProgress = vi.fn(async () => undefined);
    const result = await initiatePrivateUpload(
      {
        actorId: "creator",
        idempotencyKey: "upload-idempotency-key-0001",
        expectedBytes: 11,
        expectedSha256: digest("hello world"),
      },
      {
        storage: () => storage as any,
        accountForActor: async () => "account-1",
        createOperation: async () => ({
          operation: { id: "operation-1", progress: "{}" },
          upload: {
            id: "upload-1",
            storageKey: "uploads/package",
            receivedBytes: 0,
            expiresAt: new Date(Date.now() + 60_000),
          },
          reused: false,
        }),
        updateProgress,
      },
    );
    expect(result).toMatchObject({ operationId: "operation-1", uploadId: "upload-1", reused: false });
    expect(storage.beginMultipart).toHaveBeenCalledWith({ key: "package", expectedBytes: 11 });
    expect((updateProgress.mock.calls as any)[0]?.[1]).toMatchObject({ multipartUploadId: expect.any(String) });
  });

  it("records bounded raw parts, makes an identical retry idempotent, and verifies completion", async () => {
    const part = Buffer.from("hello world");
    const upload: any = {
      id: "upload-1",
      operationId: "operation-1",
      expectedBytes: 11,
      expectedSha256: digest(part),
      receivedBytes: 0,
      expiresAt: new Date(Date.now() + 60_000),
      completedAt: null,
      cancelledAt: null,
      parts: [],
      operation: {
        ownerAccountId: "account-1",
        state: "RECEIVING",
        progress: JSON.stringify({ multipartUploadId: "11111111-1111-1111-1111-111111111111" }),
      },
    };
    const recordPart = vi.fn(async () => ({ part: { id: "part-1" }, receivedBytes: 11 }));
    const deps = {
      storage: () => storage as any,
      accountForActor: async () => "account-1",
      findUpload: async () => upload,
      recordPart,
      updateProgress: vi.fn(async () => undefined),
      complete: vi.fn(async () => ({ operationId: "operation-1", parts: 1, receivedBytes: 11 })),
    };
    await expect(
      receivePrivateUploadPart(
        {
          actorId: "creator",
          uploadId: "upload-1",
          partNumber: 1,
          body: Readable.from([part]),
          expectedSha256: digest(part),
        },
        deps as any,
      ),
    ).resolves.toMatchObject({ receivedBytes: 11, reused: false });
    upload.parts = [{ partNumber: 1, sha256: digest(part), byteLength: 11, providerTag: digest(part) }];
    upload.receivedBytes = 11;
    await expect(
      receivePrivateUploadPart(
        {
          actorId: "creator",
          uploadId: "upload-1",
          partNumber: 1,
          body: Readable.from([part]),
          expectedSha256: digest(part),
        },
        deps as any,
      ),
    ).resolves.toMatchObject({ reused: true });
    await expect(
      completePrivateUploadStream({ actorId: "creator", uploadId: "upload-1" }, deps as any),
    ).resolves.toMatchObject({ operationId: "operation-1", receivedBytes: 11 });
  });

  it("aborts the provider multipart upload before marking a durable upload cancelled", async () => {
    const upload: any = {
      id: "upload-cancel",
      operationId: "operation-cancel",
      expiresAt: new Date(Date.now() + 60_000),
      completedAt: null,
      cancelledAt: null,
      operation: { ownerAccountId: "account-1", progress: JSON.stringify({ multipartUploadId: "multipart-cancel" }) },
      parts: [],
    };
    const requestCancellation = vi.fn(async () => undefined);
    const cancelUpload = vi.fn(async () => undefined);
    await expect(
      cancelPrivateUpload({ actorId: "creator", uploadId: upload.id }, {
        storage: () => storage as any,
        accountForActor: async () => "account-1",
        findUpload: async () => upload,
        requestCancellation,
        cancelUpload,
      } as any),
    ).resolves.toEqual({ cancelled: true });
    expect(storage.abortMultipart).toHaveBeenCalledWith("multipart-cancel");
    expect(requestCancellation).toHaveBeenCalledWith("operation-cancel");
    expect(cancelUpload).toHaveBeenCalledWith(upload);
  });
});
