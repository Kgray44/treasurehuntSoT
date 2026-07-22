import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  PRIVATE_CONTRACT_VERSION,
  canTransitionPrivateOperation,
  type PrivateJobType,
  type PrivateOperationState,
} from "./contracts";
import { privateFailure, sha256 } from "./core";

// Generated Prisma clients are upgraded after the additive Phase 2 migrations.
const privateDb = db as any;

export async function createPrivateUploadOperation(input: {
  ownerAccountId?: string | null;
  expectedBytes?: number;
  expectedSha256?: string;
  idempotencyKey: string;
  expiresAt: Date;
}) {
  const existing = await privateDb.privateContentOperation.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    include: { upload: true },
  });
  if (existing?.upload) return { operation: existing, upload: existing.upload, reused: true as const };
  const correlationId = randomUUID();
  const operation = await privateDb.privateContentOperation.create({
    data: {
      ownerAccountId: input.ownerAccountId ?? null,
      kind: "PRIVATE_PACKAGE_UPLOAD",
      state: "RECEIVING",
      idempotencyKey: input.idempotencyKey,
      correlationId,
      progress: JSON.stringify({ encryptedBytesReceived: 0 }),
      upload: {
        create: {
          storageProvider: "local",
          storageKey: `uploads/${correlationId}`,
          expectedBytes: input.expectedBytes,
          expectedSha256: input.expectedSha256,
          expiresAt: input.expiresAt,
        },
      },
    },
    include: { upload: true },
  });
  return { operation, upload: operation.upload!, reused: false as const };
}

export async function recordPrivateUploadPart(input: {
  uploadId: string;
  partNumber: number;
  bytes: Buffer;
  providerTag?: string;
}) {
  if (!Number.isInteger(input.partNumber) || input.partNumber < 1) throw privateFailure("PRIVATE_PACKAGE_INVALID");
  const upload = await privateDb.privateContentUpload.findUniqueOrThrow({
    where: { id: input.uploadId },
    include: { operation: true },
  });
  if (upload.completedAt || upload.cancelledAt || upload.expiresAt <= new Date())
    throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
  const digest = sha256(input.bytes);
  const part = await privateDb.privateContentUploadPart.upsert({
    where: { uploadId_partNumber: { uploadId: input.uploadId, partNumber: input.partNumber } },
    create: {
      uploadId: input.uploadId,
      partNumber: input.partNumber,
      sha256: digest,
      byteLength: input.bytes.length,
      providerTag: input.providerTag,
    },
    update: {},
  });
  if (part.sha256 !== digest || part.byteLength !== input.bytes.length)
    throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
  const receivedBytes =
    (
      await privateDb.privateContentUploadPart.aggregate({
        where: { uploadId: input.uploadId },
        _sum: { byteLength: true },
      })
    )._sum.byteLength ?? 0;
  await db.$transaction([
    privateDb.privateContentUpload.update({ where: { id: input.uploadId }, data: { receivedBytes } }),
    privateDb.privateContentOperation.update({
      where: { id: upload.operationId },
      data: { progress: JSON.stringify({ encryptedBytesReceived: receivedBytes }) },
    }),
  ]);
  return { part, receivedBytes };
}

export async function transitionPrivateOperation(
  id: string,
  from: PrivateOperationState,
  to: PrivateOperationState,
  progress?: Record<string, number>,
) {
  if (!canTransitionPrivateOperation(from, to)) throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
  const result = await privateDb.privateContentOperation.updateMany({
    where: { id, state: from },
    data: { state: to, ...(progress ? { progress: JSON.stringify(progress) } : {}) },
  });
  if (!result.count) throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
}

export async function completePrivateUpload(input: { uploadId: string; expectedSha256?: string }) {
  const upload = await privateDb.privateContentUpload.findUniqueOrThrow({
    where: { id: input.uploadId },
    include: { operation: true, parts: { orderBy: { partNumber: "asc" } } },
  });
  if (upload.operation.state !== "RECEIVING") throw privateFailure("PRIVATE_PACKAGE_CONFLICT");
  if (upload.expectedBytes !== null && upload.receivedBytes !== upload.expectedBytes)
    throw privateFailure("PRIVATE_PACKAGE_LIMIT_EXCEEDED");
  // The storage provider verifies the complete-object digest; this stores only the durable part receipt.
  await db.$transaction([
    privateDb.privateContentUpload.update({
      where: { id: upload.id },
      data: { completedAt: new Date(), expectedSha256: input.expectedSha256 ?? upload.expectedSha256 },
    }),
    privateDb.privateContentOperation.update({ where: { id: upload.operationId }, data: { state: "UPLOADED" } }),
  ]);
  return { operationId: upload.operationId, parts: upload.parts.length, receivedBytes: upload.receivedBytes };
}

export async function requestPrivateOperationCancellation(id: string) {
  const operation = await privateDb.privateContentOperation.findUniqueOrThrow({ where: { id } });
  if (["COMPLETED", "CANCELLED", "FAILED"].includes(operation.state)) return operation;
  await privateDb.privateContentOperation.update({
    where: { id },
    data: { state: "CANCEL_REQUESTED", cancelRequestedAt: new Date() },
  });
  return privateDb.privateContentOperation.findUniqueOrThrow({ where: { id } });
}

export async function enqueuePrivateJob(input: {
  operationId: string;
  type: PrivateJobType;
  idempotencyKey: string;
  correlationId: string;
  payload: Record<string, unknown>;
}) {
  return privateDb.privateContentJob.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      operationId: input.operationId,
      type: input.type,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      payload: JSON.stringify({ schemaVersion: PRIVATE_CONTRACT_VERSION, ...input.payload }),
    },
    update: {},
  });
}

export async function claimPrivateJobs(workerId: string, limit = 10, leaseMs = 30_000) {
  const now = new Date();
  // A process crash leaves a durable lease, never process-memory authority. Once
  // it expires, any worker may safely put the idempotent job back on the queue.
  await privateDb.privateContentJob.updateMany({
    where: { state: "CLAIMED", claimExpiresAt: { lt: now } },
    data: { state: "PENDING", claimOwner: null, claimedAt: null, claimExpiresAt: null },
  });
  const candidates = await privateDb.privateContentJob.findMany({
    where: {
      state: "PENDING",
      availableAt: { lte: now },
      OR: [{ claimExpiresAt: null }, { claimExpiresAt: { lt: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const claimed: string[] = [];
  for (const job of candidates) {
    const result = await privateDb.privateContentJob.updateMany({
      where: { id: job.id, state: "PENDING", OR: [{ claimExpiresAt: null }, { claimExpiresAt: { lt: now } }] },
      data: {
        state: "CLAIMED",
        claimedAt: now,
        claimOwner: workerId,
        claimExpiresAt: new Date(now.getTime() + leaseMs),
      },
    });
    if (result.count) claimed.push(job.id);
  }
  return privateDb.privateContentJob.findMany({ where: { id: { in: claimed } }, orderBy: { createdAt: "asc" } });
}

export async function renewPrivateJobLease(id: string, workerId: string, leaseMs = 30_000) {
  if (!Number.isSafeInteger(leaseMs) || leaseMs < 1_000) throw privateFailure("PRIVATE_PACKAGE_INVALID");
  return privateDb.privateContentJob.updateMany({
    where: { id, state: "CLAIMED", claimOwner: workerId },
    data: { claimExpiresAt: new Date(Date.now() + leaseMs) },
  });
}

export async function cancelClaimedPrivateJob(id: string, workerId: string) {
  return privateDb.privateContentJob.updateMany({
    where: { id, state: "CLAIMED", claimOwner: workerId },
    data: { state: "CANCELLED", completedAt: new Date(), claimExpiresAt: null },
  });
}

export async function finishPrivateJob(id: string, workerId: string) {
  return privateDb.privateContentJob.updateMany({
    where: { id, state: "CLAIMED", claimOwner: workerId },
    data: { state: "COMPLETED", completedAt: new Date(), claimExpiresAt: null },
  });
}

export async function retryPrivateJob(id: string, workerId: string, failureCode: string) {
  const job = await privateDb.privateContentJob.findFirst({ where: { id, state: "CLAIMED", claimOwner: workerId } });
  if (!job) return false;
  const attempts = job.attemptCount + 1;
  await privateDb.privateContentJob.update({
    where: { id },
    data:
      attempts >= job.maxAttempts
        ? { state: "FAILED", attemptCount: attempts, failureCode, claimExpiresAt: null }
        : {
            state: "PENDING",
            attemptCount: attempts,
            failureCode,
            claimOwner: null,
            claimedAt: null,
            claimExpiresAt: null,
            availableAt: new Date(Date.now() + attempts * 1_000),
          },
  });
  return true;
}
