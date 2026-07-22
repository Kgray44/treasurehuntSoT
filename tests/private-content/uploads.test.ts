import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  completePrivateUploadStream,
  initiatePrivateUpload,
  receivePrivateUploadPart,
} from "@/private-content/uploads";

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
});
