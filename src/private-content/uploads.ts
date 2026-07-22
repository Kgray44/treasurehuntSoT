/* eslint-disable @typescript-eslint/no-explicit-any -- additive Phase 2 Prisma fields can precede generated client types */
import { Readable } from "node:stream";
import { db } from "@/lib/db";
import { canonicalAccountForLegacyActor } from "@/wayfarer/accounts";
import type { PrivateObjectDescriptor, PrivateStorageProvider } from "./contracts";
import { privateFailure, sha256 } from "./core";
import {
  completePrivateUpload,
  createPrivateUploadOperation,
  recordPrivateUploadPart,
  requestPrivateOperationCancellation,
} from "./operations";
import { LocalPhase2PrivateStorageProvider, UnconfiguredS3CompatiblePrivateStorageProvider } from "./provider-storage";
import { stagePrivatePackageV2 } from "./v2-streaming-io";

const privateDb = db as any;
const MAX_PART_BYTES = 8 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 128 * 1024 * 1024;
const MAX_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

type UploadRecord = any;
type MultipartProgress = { encryptedBytesReceived?: number; multipartUploadId?: string };

export type UploadDependencies = {
  storage: () => PrivateStorageProvider;
  accountForActor: (actorId: string) => Promise<string | null>;
  createOperation: typeof createPrivateUploadOperation;
  recordPart: typeof recordPrivateUploadPart;
  complete: typeof completePrivateUpload;
  requestCancellation: typeof requestPrivateOperationCancellation;
  findUpload: (uploadId: string) => Promise<UploadRecord | null>;
  updateProgress: (operationId: string, progress: MultipartProgress) => Promise<void>;
  setOperationState: (operationId: string, state: "RECEIVING" | "UPLOAD_PAUSED") => Promise<void>;
  cancelUpload: (upload: UploadRecord) => Promise<void>;
};

function configuredStorage(): PrivateStorageProvider {
  return process.env.PRIVATE_CONTENT_STORAGE_PROVIDER === "s3"
    ? new UnconfiguredS3CompatiblePrivateStorageProvider()
    : new LocalPhase2PrivateStorageProvider();
}

const defaults: UploadDependencies = {
  storage: configuredStorage,
  accountForActor: canonicalAccountForLegacyActor,
  createOperation: createPrivateUploadOperation,
  recordPart: recordPrivateUploadPart,
  complete: completePrivateUpload,
  requestCancellation: requestPrivateOperationCancellation,
  findUpload: (uploadId) =>
    privateDb.privateContentUpload.findUnique({
      where: { id: uploadId },
      include: { operation: true, parts: { orderBy: { partNumber: "asc" } } },
    }),
  updateProgress: async (operationId, progress) => {
    await privateDb.privateContentOperation.update({
      where: { id: operationId },
      data: { progress: JSON.stringify(progress) },
    });
  },
  setOperationState: async (operationId, state) => {
    await privateDb.privateContentOperation.update({ where: { id: operationId }, data: { state } });
  },
  cancelUpload: async (upload) => {
    await privateDb.$transaction([
      privateDb.privateContentUpload.update({ where: { id: upload.id }, data: { cancelledAt: new Date() } }),
      privateDb.privateContentOperation.update({ where: { id: upload.operationId }, data: { state: "CANCELLED" } }),
    ]);
  },
};

function dependencies(overrides: Partial<UploadDependencies> = {}): UploadDependencies {
  return { ...defaults, ...overrides };
}

function parseProgress(value: string | null | undefined): MultipartProgress {
  try {
    const parsed = JSON.parse(value ?? "{}") as MultipartProgress;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function assertDigest(value: string | undefined) {
  if (value !== undefined && !/^[a-f0-9]{64}$/i.test(value)) throw privateFailure("PRIVATE_PACKAGE_INVALID");
  return value?.toLowerCase();
}

function assertByteCount(value: number | undefined) {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0 || value > MAX_UPLOAD_BYTES))
    throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED");
  return value;
}

function assertIdempotencyKey(value: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,191}$/.test(value)) throw privateFailure("PRIVATE_PACKAGE_INVALID");
  return value;
}

function storageKeyFor(upload: UploadRecord) {
  const prefix = "uploads/";
  if (typeof upload.storageKey !== "string" || !upload.storageKey.startsWith(prefix))
    throw privateFailure("PRIVATE_PACKAGE_INVALID");
  return upload.storageKey.slice(prefix.length);
}

async function ownedUpload(uploadId: string, actorId: string, deps: UploadDependencies) {
  const [upload, ownerAccountId] = await Promise.all([deps.findUpload(uploadId), deps.accountForActor(actorId)]);
  if (!upload || !ownerAccountId || upload.operation?.ownerAccountId !== ownerAccountId)
    throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
  if (upload.expiresAt <= new Date() && !upload.completedAt && !upload.cancelledAt) {
    const multipartUploadId = parseProgress(upload.operation.progress).multipartUploadId;
    if (multipartUploadId)
      await deps
        .storage()
        .abortMultipart(multipartUploadId)
        .catch(() => undefined);
    await deps.cancelUpload(upload);
    throw privateFailure("PRIVATE_PACKAGE_CONFLICT", "Private upload has expired.");
  }
  return upload;
}

async function readBounded(body: Readable, signal?: AbortSignal) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const item of body) {
    if (signal?.aborted) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private upload was cancelled.");
    const chunk = Buffer.isBuffer(item) ? item : Buffer.from(item);
    bytes += chunk.length;
    if (bytes > MAX_PART_BYTES) throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED");
    chunks.push(chunk);
  }
  if (!bytes) throw privateFailure("PRIVATE_PACKAGE_INVALID");
  return Buffer.concat(chunks, bytes);
}

function contiguousParts(parts: Array<{ partNumber: number }>) {
  return parts.every((part, index) => part.partNumber === index + 1);
}

export async function initiatePrivateUpload(
  input: { actorId: string; idempotencyKey: string; expectedBytes?: number; expectedSha256?: string; ttlMs?: number },
  overrides: Partial<UploadDependencies> = {},
) {
  const deps = dependencies(overrides);
  const expectedBytes = assertByteCount(input.expectedBytes);
  const expectedSha256 = assertDigest(input.expectedSha256);
  const ttlMs = Math.min(input.ttlMs ?? MAX_UPLOAD_TTL_MS, MAX_UPLOAD_TTL_MS);
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw privateFailure("PRIVATE_PACKAGE_INVALID");
  const ownerAccountId = await deps.accountForActor(input.actorId);
  if (!ownerAccountId) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN");
  const started = await deps.createOperation({
    ownerAccountId,
    expectedBytes,
    expectedSha256,
    idempotencyKey: assertIdempotencyKey(input.idempotencyKey),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  const persisted = started.reused ? await deps.findUpload(started.upload.id) : null;
  const effectiveUpload = persisted ?? started.upload;
  const effectiveOperation = persisted?.operation ?? started.operation;
  const progress = parseProgress(effectiveOperation.progress);
  if (!progress.multipartUploadId) {
    const multipart = await deps.storage().beginMultipart({ key: storageKeyFor(effectiveUpload), expectedBytes });
    try {
      await deps.updateProgress(effectiveOperation.id, {
        encryptedBytesReceived: effectiveUpload.receivedBytes,
        multipartUploadId: multipart.uploadId,
      });
      progress.multipartUploadId = multipart.uploadId;
    } catch (error) {
      await deps
        .storage()
        .abortMultipart(multipart.uploadId)
        .catch(() => undefined);
      throw error;
    }
  }
  return {
    operationId: effectiveOperation.id,
    uploadId: effectiveUpload.id,
    expiresAt: effectiveUpload.expiresAt,
    receivedBytes: effectiveUpload.receivedBytes,
    reused: started.reused,
  };
}

export async function receivePrivateUploadPart(
  input: {
    actorId: string;
    uploadId: string;
    partNumber: number;
    body: Readable;
    expectedSha256: string;
    signal?: AbortSignal;
  },
  overrides: Partial<UploadDependencies> = {},
) {
  const deps = dependencies(overrides);
  if (!Number.isSafeInteger(input.partNumber) || input.partNumber < 1 || input.partNumber > 1_000_000)
    throw privateFailure("PRIVATE_PACKAGE_INVALID");
  const expectedSha256 = assertDigest(input.expectedSha256)!;
  const upload = await ownedUpload(input.uploadId, input.actorId, deps);
  if (upload.completedAt || upload.cancelledAt || upload.operation.state !== "RECEIVING")
    throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
  const bytes = await readBounded(input.body, input.signal);
  const digest = sha256(bytes);
  if (digest !== expectedSha256) throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
  const existing = upload.parts.find((part: { partNumber: number }) => part.partNumber === input.partNumber);
  if (existing) {
    if (existing.sha256 !== digest || existing.byteLength !== bytes.length)
      throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
    return { receivedBytes: upload.receivedBytes, partNumber: input.partNumber, reused: true };
  }
  const multipartUploadId = parseProgress(upload.operation.progress).multipartUploadId;
  if (!multipartUploadId) throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
  const providerPart = await deps.storage().uploadPart({
    uploadId: multipartUploadId,
    partNumber: input.partNumber,
    body: Readable.from([bytes]),
    expectedSha256,
  });
  if (providerPart.etag !== digest || providerPart.byteLength !== bytes.length)
    throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
  const receipt = await deps.recordPart({
    uploadId: upload.id,
    partNumber: input.partNumber,
    bytes,
    providerTag: providerPart.etag,
  });
  await deps.updateProgress(upload.operationId, {
    encryptedBytesReceived: receipt.receivedBytes,
    multipartUploadId,
  });
  return { receivedBytes: receipt.receivedBytes, partNumber: input.partNumber, reused: false };
}

export async function completePrivateUploadStream(
  input: { actorId: string; uploadId: string; expectedSha256?: string },
  overrides: Partial<UploadDependencies> = {},
) {
  const deps = dependencies(overrides);
  const requestedDigest = assertDigest(input.expectedSha256);
  const upload = await ownedUpload(input.uploadId, input.actorId, deps);
  if (upload.completedAt)
    return {
      operationId: upload.operationId,
      parts: upload.parts.length,
      receivedBytes: upload.receivedBytes,
      reused: true,
    };
  if (upload.cancelledAt || upload.operation.state !== "RECEIVING" || !contiguousParts(upload.parts))
    throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
  const expectedSha256 = requestedDigest ?? upload.expectedSha256 ?? undefined;
  if (upload.expectedSha256 && requestedDigest && upload.expectedSha256 !== requestedDigest)
    throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
  const multipartUploadId = parseProgress(upload.operation.progress).multipartUploadId;
  if (!multipartUploadId) throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
  const object = await deps.storage().completeMultipart({
    uploadId: multipartUploadId,
    parts: upload.parts.map((part: { partNumber: number; providerTag: string | null }) => ({
      partNumber: part.partNumber,
      etag: part.providerTag ?? "",
    })),
  });
  if ((expectedSha256 && object.sha256 !== expectedSha256) || object.byteLength !== upload.receivedBytes) {
    await deps
      .storage()
      .remove(object)
      .catch(() => undefined);
    throw privateFailure("PRIVATE_PACKAGE_CHECKSUM_MISMATCH");
  }
  const result = await deps.complete({ uploadId: upload.id, expectedSha256: object.sha256 });
  return { ...result, descriptor: publicObject(object), reused: false };
}

export async function cancelPrivateUpload(
  input: { actorId: string; uploadId: string },
  overrides: Partial<UploadDependencies> = {},
) {
  const deps = dependencies(overrides);
  const upload = await ownedUpload(input.uploadId, input.actorId, deps);
  if (upload.completedAt || upload.cancelledAt) return { cancelled: Boolean(upload.cancelledAt) };
  await deps.requestCancellation(upload.operationId);
  const multipartUploadId = parseProgress(upload.operation.progress).multipartUploadId;
  if (multipartUploadId) await deps.storage().abortMultipart(multipartUploadId);
  await deps.cancelUpload(upload);
  return { cancelled: true };
}

/** Pause preserves durable multipart state; it never aborts or deletes uploaded parts. */
export async function pausePrivateUpload(
  input: { actorId: string; uploadId: string },
  overrides: Partial<UploadDependencies> = {},
) {
  const deps = dependencies(overrides);
  const upload = await ownedUpload(input.uploadId, input.actorId, deps);
  if (upload.completedAt || upload.cancelledAt || upload.operation.state !== "RECEIVING")
    throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
  await deps.setOperationState(upload.operationId, "UPLOAD_PAUSED");
  return { uploadId: upload.id, operationId: upload.operationId, state: "UPLOAD_PAUSED" as const };
}

/** Resume accepts the existing multipart receiver and only transitions a paused upload. */
export async function resumePrivateUpload(
  input: { actorId: string; uploadId: string },
  overrides: Partial<UploadDependencies> = {},
) {
  const deps = dependencies(overrides);
  const upload = await ownedUpload(input.uploadId, input.actorId, deps);
  if (upload.completedAt || upload.cancelledAt || upload.operation.state !== "UPLOAD_PAUSED")
    throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
  if (!parseProgress(upload.operation.progress).multipartUploadId) throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
  await deps.setOperationState(upload.operationId, "RECEIVING");
  return { uploadId: upload.id, operationId: upload.operationId, state: "RECEIVING" as const };
}

export async function privateUploadStatus(
  input: { actorId: string; uploadId: string },
  overrides: Partial<UploadDependencies> = {},
) {
  const upload = await ownedUpload(input.uploadId, input.actorId, dependencies(overrides));
  return {
    operationId: upload.operationId,
    uploadId: upload.id,
    state: upload.operation.state,
    receivedBytes: upload.receivedBytes,
    expectedBytes: upload.expectedBytes,
    partCount: upload.parts.length,
    expiresAt: upload.expiresAt,
    completedAt: upload.completedAt,
    cancelledAt: upload.cancelledAt,
  };
}

/** Authenticated v2 inspection reads the immutable upload object directly from private storage. */
export async function inspectCompletedPrivateUploadV2(
  input: { actorId: string; uploadId: string; passphrase: string; stagingRoot: string },
  overrides: Partial<UploadDependencies> = {},
) {
  const deps = dependencies(overrides);
  const upload = await ownedUpload(input.uploadId, input.actorId, deps);
  if (!upload.completedAt || upload.operation.state !== "UPLOADED" || !upload.expectedSha256)
    throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
  const source = await deps.storage().read({
    key: upload.storageKey,
    sha256: upload.expectedSha256,
    byteLength: upload.receivedBytes,
  });
  const staged = await stagePrivatePackageV2({ source, passphrase: input.passphrase, stagingRoot: input.stagingRoot });
  return {
    operationId: upload.operationId,
    packageId: staged.manifest.packageId,
    packageRevision: staged.manifest.packageRevision,
    fileCount: staged.files.length,
    assetCount: staged.manifest.assets.length,
  };
}

function publicObject(object: PrivateObjectDescriptor) {
  return { sha256: object.sha256, byteLength: object.byteLength };
}

/** Receivers use raw binary bodies. This is intentionally not a JSON/base64 transport. */
export function nodeReadableFromRequest(request: Request) {
  if (!request.body) throw privateFailure("PRIVATE_PACKAGE_INVALID");
  return Readable.fromWeb(request.body as any);
}

export const privateUploadLimits = { maxPartBytes: MAX_PART_BYTES, maxUploadBytes: MAX_UPLOAD_BYTES };
