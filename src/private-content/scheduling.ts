/* eslint-disable @typescript-eslint/no-explicit-any -- additive operational Prisma fields. */
import { db } from "@/lib/db";
import { privateFailure } from "./core";
const privateDb = db as any;
export const privateScheduledKinds = [
  "BACKUP_CREATE",
  "BACKUP_VERIFY",
  "INTEGRITY_RECONCILE",
  "UPLOAD_CLEANUP",
  "STAGING_CLEANUP",
  "MULTIPART_CLEANUP",
  "QUARANTINE_RETENTION",
  "ORPHAN_REVIEW",
  "RESTORE_DRILL",
] as const;
export type PrivateScheduledKind = (typeof privateScheduledKinds)[number];
export function privateScheduleKey(kind: PrivateScheduledKind, window: string) {
  if (!/^[A-Za-z0-9_.:-]{1,120}$/.test(window)) throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID");
  return `${kind}:${window}`;
}
export async function enqueueScheduledPrivateOperation(input: {
  kind: PrivateScheduledKind;
  window: string;
  runAfter: Date;
}) {
  const scheduleKey = privateScheduleKey(input.kind, input.window);
  return privateDb.privateScheduledOperation.upsert({
    where: { scheduleKey },
    create: { kind: input.kind, scheduleKey, runAfter: input.runAfter },
    update: {},
  });
}
export async function claimScheduledPrivateOperations(input: {
  owner: string;
  now?: Date;
  leaseMs?: number;
  limit?: number;
}) {
  const now = input.now ?? new Date();
  const leaseMs = input.leaseMs ?? 30_000;
  const candidates = await privateDb.privateScheduledOperation.findMany({
    where: { state: "PENDING", runAfter: { lte: now }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
    take: input.limit ?? 10,
    orderBy: { runAfter: "asc" },
  });
  const claimed: string[] = [];
  for (const operation of candidates) {
    const result = await privateDb.privateScheduledOperation.updateMany({
      where: { id: operation.id, state: "PENDING", OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
      data: { state: "CLAIMED", leaseOwner: input.owner, leaseUntil: new Date(now.getTime() + leaseMs) },
    });
    if (result.count) claimed.push(operation.id);
  }
  return privateDb.privateScheduledOperation.findMany({ where: { id: { in: claimed } } });
}
export function backupOverdue(input: { lastVerifiedAt: Date | null; now?: Date; maximumAgeMs: number }) {
  return (
    !input.lastVerifiedAt || (input.now ?? new Date()).getTime() - input.lastVerifiedAt.getTime() > input.maximumAgeMs
  );
}
