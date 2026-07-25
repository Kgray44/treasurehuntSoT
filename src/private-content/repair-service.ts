/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 3 Prisma fields can precede generated clients. */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { writePlatformAudit } from "@/platform/audit";
import type { PrivateIntegrityAction } from "./recovery";
import { createPrivateRepairPlan } from "./operations-phase3";
import { privateFailure } from "./core";
import type { PrivateProviderRuntime } from "./providers";
const privateDb = db as any;
export async function persistPrivateRepairPlan(input: {
  snapshotDigest: string;
  actions: readonly PrivateIntegrityAction[];
  expiresAt: Date;
  now?: Date;
}) {
  const plan = createPrivateRepairPlan(input);
  return privateDb.privateRepairPlan.create({
    data: {
      id: plan.id,
      digest: plan.digest,
      snapshotDigest: plan.snapshotDigest,
      dryRun: true,
      expiresAt: new Date(plan.expiresAt),
      actions: {
        create: plan.actions.map((action, ordinal) => ({
          ordinal,
          action: action.action,
          reason: action.reason,
          opaqueTarget: action.key,
          preconditionDigest: action.preconditionDigest,
        })),
      },
    },
    include: { actions: true },
  });
}
export async function approvePrivateRepairPlan(input: {
  digest: string;
  administratorAccountId: string;
  reason: string;
  now?: Date;
}) {
  if (!/^[A-Z0-9_ -]{3,120}$/i.test(input.reason))
    throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Repair approval reason is invalid.");
  const now = input.now ?? new Date();
  const result = await privateDb.privateRepairPlan.updateMany({
    where: { digest: input.digest, state: "DRAFT", dryRun: true, expiresAt: { gt: now } },
    data: { state: "APPROVED", dryRun: false, approvedById: input.administratorAccountId, approvedAt: now },
  });
  if (!result.count) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private repair plan is stale or unavailable.");
  await writePlatformAudit({
    actorType: "CREATOR",
    actorId: input.administratorAccountId,
    action: "PRIVATE_REPAIR_PLAN_APPROVED",
    resourceType: "PRIVATE_REPAIR_PLAN",
    resourceId: input.digest,
    metadata: { reasonCode: input.reason.toUpperCase().replace(/[^A-Z0-9]+/g, "_") },
  });
  return privateDb.privateRepairPlan.findUniqueOrThrow({ where: { digest: input.digest }, include: { actions: true } });
}
/** Claims one approved plan, rechecks its snapshot, and writes action receipts one at a time. */
export async function executePrivateRepairPlan(input: {
  digest: string;
  currentSnapshotDigest: string;
  owner: string;
  apply: (action: {
    id: string;
    action: string;
    reason: string;
    opaqueTarget: string;
    preconditionDigest: string;
  }) => Promise<void>;
  now?: Date;
  leaseMs?: number;
}) {
  const now = input.now ?? new Date();
  const lease = randomUUID();
  const leaseUntil = new Date(now.getTime() + (input.leaseMs ?? 30_000));
  const claim = await privateDb.privateRepairPlan.updateMany({
    where: {
      digest: input.digest,
      state: "APPROVED",
      dryRun: false,
      snapshotDigest: input.currentSnapshotDigest,
      expiresAt: { gt: now },
      OR: [{ executionUntil: null }, { executionUntil: { lt: now } }],
    },
    data: { state: "EXECUTING", executionLease: lease, executionUntil: leaseUntil },
  });
  if (!claim.count) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private repair plan preconditions changed.");
  const plan = await privateDb.privateRepairPlan.findUniqueOrThrow({
    where: { digest: input.digest },
    include: { actions: true },
  });
  try {
    for (const action of plan.actions) {
      if (action.action === "DELETE_AFTER_GRACE" && action.reason !== "ORPHAN")
        throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private garbage collection target is blocked.");
      const stillOwned = await privateDb.privateRepairPlan.count({
        where: { digest: input.digest, state: "EXECUTING", executionLease: lease, executionUntil: { gt: new Date() } },
      });
      if (!stillOwned) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private repair lease was lost.");
      await input.apply(action);
      await privateDb.privateRepairAction.update({
        where: { id: action.id },
        data: { state: "COMPLETED", resultCode: "APPLIED" },
      });
    }
    await privateDb.privateRepairPlan.update({
      where: { digest: input.digest },
      data: { state: "COMPLETED", executionUntil: null },
    });
    await writePlatformAudit({
      actorType: "SYSTEM",
      actorId: input.owner,
      action: "PRIVATE_REPAIR_COMPLETED",
      resourceType: "PRIVATE_REPAIR_PLAN",
      resourceId: input.digest,
      metadata: { actionCount: plan.actions.length },
    });
    return { digest: input.digest, actions: plan.actions.length, state: "COMPLETED" as const };
  } catch (error) {
    await privateDb.privateRepairPlan
      .updateMany({
        where: { digest: input.digest, executionLease: lease },
        data: { state: "APPROVED", executionLease: null, executionUntil: null },
      })
      .catch(() => undefined);
    throw error;
  }
}

/**
 * Local durable repair realization. It deliberately loads the stored plan and
 * action rows by digest; callers cannot supply a replacement action list.
 * Destructive deletion is limited to a proven unreferenced ORPHAN action.
 */
export async function executeStoredPrivateRepair(input: {
  runtime: PrivateProviderRuntime;
  digest: string;
  currentSnapshotDigest: string;
  owner: string;
}) {
  return executePrivateRepairPlan({
    digest: input.digest,
    currentSnapshotDigest: input.currentSnapshotDigest,
    owner: input.owner,
    apply: async (action) => {
      const object = await privateDb.privateAssetObject.findFirst({ where: { storageKey: action.opaqueTarget } });
      if (action.action === "REVIEW") {
        if (object)
          await privateDb.privateAssetReference.updateMany({
            where: { objectId: object.id },
            data: { available: false },
          });
        return;
      }
      if (!object) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private repair target is unavailable.");
      const descriptor = {
        key: object.storageKey,
        sha256: object.sha256,
        byteLength: object.byteLength,
        mediaType: object.mediaType,
      };
      if (action.action === "QUARANTINE") {
        const quarantined = await input.runtime.storage.moveToQuarantine(descriptor, action.reason);
        await privateDb.$transaction([
          privateDb.privateAssetObject.update({
            where: { id: object.id },
            data: { storageKey: quarantined.key, scanStatus: "QUARANTINED", quarantinedAt: new Date() },
          }),
          privateDb.privateAssetReference.updateMany({ where: { objectId: object.id }, data: { available: false } }),
        ]);
        return;
      }
      if (action.action !== "DELETE_AFTER_GRACE" || action.reason !== "ORPHAN")
        throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private repair action is blocked.");
      const references = await privateDb.privateAssetReference.count({ where: { objectId: object.id } });
      if (references) throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private repair target is still referenced.");
      await input.runtime.storage.remove(descriptor);
      await privateDb.privateAssetObject.delete({ where: { id: object.id } });
    },
  });
}
