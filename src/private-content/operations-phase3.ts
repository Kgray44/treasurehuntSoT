import { randomUUID } from "node:crypto";
import { privateFailure, sha256 } from "./core";
import type { PrivateIntegrityAction } from "./recovery";

export type PrivateRepairPlan = {
  id: string;
  digest: string;
  snapshotDigest: string;
  dryRun: boolean;
  expiresAt: string;
  state: "DRAFT" | "APPROVED" | "EXECUTING" | "COMPLETED" | "EXPIRED" | "STALE";
  actions: Array<PrivateIntegrityAction & { preconditionDigest: string }>;
  approvedById?: string;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function createPrivateRepairPlan(input: {
  snapshotDigest: string;
  actions: readonly PrivateIntegrityAction[];
  expiresAt: Date;
  now?: Date;
}) {
  if (!/^[a-f0-9]{64}$/.test(input.snapshotDigest) || input.expiresAt <= (input.now ?? new Date()))
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private repair plan inputs are invalid.");
  const actions = input.actions.map((action) => ({ ...action, preconditionDigest: sha256(canonical(action)) }));
  const digest = sha256(
    canonical({
      snapshotDigest: input.snapshotDigest,
      dryRun: true,
      expiresAt: input.expiresAt.toISOString(),
      actions,
    }),
  );
  return {
    id: randomUUID(),
    digest,
    snapshotDigest: input.snapshotDigest,
    dryRun: true,
    expiresAt: input.expiresAt.toISOString(),
    state: "DRAFT" as const,
    actions,
  };
}

export function approvePrivateRepairPlan(
  plan: PrivateRepairPlan,
  input: { administratorAccountId: string; explicitDigest: string; now?: Date },
) {
  const now = input.now ?? new Date();
  if (
    !input.administratorAccountId ||
    input.explicitDigest !== plan.digest ||
    plan.state !== "DRAFT" ||
    new Date(plan.expiresAt) <= now
  )
    throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private repair approval was rejected.");
  return { ...plan, dryRun: false, state: "APPROVED" as const, approvedById: input.administratorAccountId };
}

/** Re-validates immutable action preconditions immediately before each side effect. */
export async function executeApprovedPrivateRepairPlan(input: {
  plan: PrivateRepairPlan;
  currentSnapshotDigest: string;
  explicitDigest: string;
  apply: (action: PrivateRepairPlan["actions"][number]) => Promise<void>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (
    input.plan.dryRun ||
    input.plan.state !== "APPROVED" ||
    input.plan.digest !== input.explicitDigest ||
    input.plan.snapshotDigest !== input.currentSnapshotDigest ||
    new Date(input.plan.expiresAt) <= now
  )
    throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private repair execution was rejected.");
  for (const action of input.plan.actions) {
    if (action.action === "DELETE_AFTER_GRACE" && action.reason !== "ORPHAN")
      throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private garbage collection target was rejected.");
    await input.apply(action);
  }
  return { ...input.plan, state: "COMPLETED" as const };
}

export type PrivateRecoverySnapshot = {
  databaseSnapshotIdentity: string;
  recordsDigest: string;
  objects: Array<{ key: string; sha256: string; byteLength: number }>;
  requiredKeyVersions: string[];
};

export function createReferentiallyClosedBackupSnapshot(input: PrivateRecoverySnapshot) {
  const objects = [...input.objects].sort((a, b) => a.key.localeCompare(b.key));
  if (
    !input.databaseSnapshotIdentity ||
    objects.some((item) => !/^[a-f0-9]{64}$/.test(item.sha256) || item.byteLength < 0)
  )
    throw privateFailure("PRIVATE_CONTENT_CONFIGURATION_INVALID", "Private backup snapshot is invalid.");
  return {
    ...input,
    objects,
    requiredKeyVersions: [...new Set(input.requiredKeyVersions)].sort(),
    objectSetDigest: sha256(canonical(objects)),
    snapshotDigest: sha256(
      canonical({
        databaseSnapshotIdentity: input.databaseSnapshotIdentity,
        recordsDigest: input.recordsDigest,
        objects,
        requiredKeyVersions: [...new Set(input.requiredKeyVersions)].sort(),
      }),
    ),
  };
}

/** Rejects anything that resembles the configured primary environment before restore work begins. */
export function assertIsolatedPrivateRestoreTarget(input: {
  targetEnvironmentId: string;
  sourceEnvironmentId: string;
  mode: "isolated-only";
}) {
  if (
    input.mode !== "isolated-only" ||
    !input.targetEnvironmentId ||
    input.targetEnvironmentId === input.sourceEnvironmentId ||
    /prod|production|canonical/i.test(input.targetEnvironmentId)
  )
    throw privateFailure("PRIVATE_CONTENT_FORBIDDEN", "Private restore requires an isolated target.");
  return { isolated: true as const, targetEnvironmentId: input.targetEnvironmentId };
}

export function canRetirePrivateKey(input: {
  version: string;
  activeVersion: string;
  liveReferences: number;
  backupReferences: number;
  restoreVerified: boolean;
  explicitlyApproved: boolean;
}) {
  return (
    input.version !== input.activeVersion &&
    input.liveReferences === 0 &&
    input.backupReferences === 0 &&
    input.restoreVerified &&
    input.explicitlyApproved
  );
}
