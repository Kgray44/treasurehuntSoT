import { createHash, randomUUID } from "node:crypto";
import { writeAdministrativeAudit } from "@/admiralty/audit";
import { db } from "@/lib/db";
import { CommunityError, stableJson } from "./domain";

export const communityOutboxRuntimePolicyKey = "COMMUNITY_OUTBOX_RUNTIME";
export const communityOutboxRuntimeDefaults = Object.freeze({
  dispatchEnabled: true,
  batchSize: 25,
  pollIntervalMs: 1_000,
});

export type CommunityOutboxRuntimePolicy = Readonly<{
  key: typeof communityOutboxRuntimePolicyKey;
  dispatchEnabled: boolean;
  batchSize: number;
  pollIntervalMs: number;
  revision: number;
  source: "DEFAULT" | "GOVERNED_POLICY";
}>;

export type CommunityOutboxRuntimePolicyInput = Readonly<{
  dispatchEnabled: boolean;
  batchSize: number;
  pollIntervalMs: number;
  expectedRevision: number;
  reason: string;
  idempotencyKey: string;
}>;

export type CommunityOperationalActor = Readonly<{
  accountId: string;
  roles: readonly string[];
  authorizationBasis: string;
}>;

type PolicyState = Pick<CommunityOutboxRuntimePolicy, "dispatchEnabled" | "batchSize" | "pollIntervalMs" | "revision">;

function policyState(policy: CommunityOutboxRuntimePolicy): PolicyState {
  return {
    dispatchEnabled: policy.dispatchEnabled,
    batchSize: policy.batchSize,
    pollIntervalMs: policy.pollIntervalMs,
    revision: policy.revision,
  };
}

function fingerprint(value: Record<string, unknown>) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function parsePolicyState(value: string): PolicyState {
  try {
    const parsed = JSON.parse(value) as Partial<PolicyState>;
    if (
      typeof parsed.dispatchEnabled === "boolean" &&
      Number.isInteger(parsed.batchSize) &&
      Number.isInteger(parsed.pollIntervalMs) &&
      Number.isInteger(parsed.revision)
    )
      return parsed as PolicyState;
  } catch {
    // A durable owner receipt is written by this module. A malformed receipt
    // cannot be safely replayed as a successful change.
  }
  throw new CommunityError("COMMUNITY_OPERATIONAL_RECEIPT_INVALID", "The owner receipt cannot be safely replayed.");
}

function assertOperationsAuthority(actor: CommunityOperationalActor) {
  if (!actor.roles.some((role) => ["ADMINISTRATOR", "OPERATIONS_OPERATOR", "CONFIGURATION_OPERATOR"].includes(role)))
    throw new CommunityError("COMMUNITY_ACCESS_DENIED", "Community operational authority is required.");
}

function assertPolicyInput(input: CommunityOutboxRuntimePolicyInput) {
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0)
    throw new CommunityError("COMMUNITY_OPERATIONAL_POLICY_INVALID", "The policy revision is invalid.");
  if (!Number.isInteger(input.batchSize) || input.batchSize < 1 || input.batchSize > 25)
    throw new CommunityError("COMMUNITY_OPERATIONAL_POLICY_INVALID", "Choose between 1 and 25 jobs per batch.");
  if (!Number.isInteger(input.pollIntervalMs) || input.pollIntervalMs < 1_000 || input.pollIntervalMs > 60_000)
    throw new CommunityError(
      "COMMUNITY_OPERATIONAL_POLICY_INVALID",
      "Choose a poll interval between 1 second and 60 seconds.",
    );
  if (input.reason.trim().length < 8 || input.reason.trim().length > 240)
    throw new CommunityError("COMMUNITY_OPERATIONAL_POLICY_INVALID", "Provide a bounded operational reason.");
  if (!/^[A-Za-z0-9_-]{16,128}$/u.test(input.idempotencyKey))
    throw new CommunityError("COMMUNITY_OPERATIONAL_POLICY_INVALID", "A valid idempotency key is required.");
}

function toPolicy(
  record: {
    dispatchEnabled: boolean;
    batchSize: number;
    pollIntervalMs: number;
    revision: number;
  } | null,
): CommunityOutboxRuntimePolicy {
  return record
    ? {
        key: communityOutboxRuntimePolicyKey,
        dispatchEnabled: record.dispatchEnabled,
        batchSize: record.batchSize,
        pollIntervalMs: record.pollIntervalMs,
        revision: record.revision,
        source: "GOVERNED_POLICY",
      }
    : { key: communityOutboxRuntimePolicyKey, ...communityOutboxRuntimeDefaults, revision: 0, source: "DEFAULT" };
}

/**
 * The Community worker reads this owner-held policy before it claims work.
 * No environment variable, private worker payload, or lease owner is exposed
 * through the contract.
 */
export async function readCommunityOutboxRuntimePolicy(): Promise<CommunityOutboxRuntimePolicy> {
  return toPolicy(
    await db.communityOperationalPolicy.findUnique({
      where: { key: communityOutboxRuntimePolicyKey },
      select: { dispatchEnabled: true, batchSize: true, pollIntervalMs: true, revision: true },
    }),
  );
}

export async function previewCommunityOutboxRuntimePolicyUpdate(
  actor: CommunityOperationalActor,
  input: CommunityOutboxRuntimePolicyInput,
) {
  assertOperationsAuthority(actor);
  assertPolicyInput(input);
  const current = await readCommunityOutboxRuntimePolicy();
  if (current.revision !== input.expectedRevision)
    throw new CommunityError(
      "COMMUNITY_OPERATIONAL_POLICY_CONFLICT",
      "The Community runtime policy changed. Refresh and review it again.",
    );
  const resulting: CommunityOutboxRuntimePolicy = {
    key: communityOutboxRuntimePolicyKey,
    dispatchEnabled: input.dispatchEnabled,
    batchSize: input.batchSize,
    pollIntervalMs: input.pollIntervalMs,
    revision: current.revision + 1,
    source: "GOVERNED_POLICY",
  };
  return { current, resulting };
}

export async function updateCommunityOutboxRuntimePolicy(
  actor: CommunityOperationalActor,
  input: CommunityOutboxRuntimePolicyInput,
) {
  assertOperationsAuthority(actor);
  assertPolicyInput(input);
  const requestFingerprint = fingerprint({
    policyKey: communityOutboxRuntimePolicyKey,
    actorAccountId: actor.accountId,
    expectedRevision: input.expectedRevision,
    dispatchEnabled: input.dispatchEnabled,
    batchSize: input.batchSize,
    pollIntervalMs: input.pollIntervalMs,
    reason: input.reason.trim(),
  });

  return db.$transaction(async (tx) => {
    const priorReceipt = await tx.communityOperationalPolicyChange.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (priorReceipt) {
      if (priorReceipt.requestFingerprint !== requestFingerprint)
        throw new CommunityError(
          "COMMUNITY_OPERATIONAL_POLICY_CONFLICT",
          "The idempotency key belongs to a different policy change.",
        );
      return {
        policy: {
          key: communityOutboxRuntimePolicyKey,
          ...parsePolicyState(priorReceipt.afterState),
          source: "GOVERNED_POLICY" as const,
        },
        receipt: {
          id: priorReceipt.id,
          correlationId: priorReceipt.correlationId,
          idempotent: true,
          before: parsePolicyState(priorReceipt.beforeState),
          after: parsePolicyState(priorReceipt.afterState),
        },
      };
    }

    const currentRecord = await tx.communityOperationalPolicy.findUnique({
      where: { key: communityOutboxRuntimePolicyKey },
      select: { id: true, dispatchEnabled: true, batchSize: true, pollIntervalMs: true, revision: true },
    });
    const current = toPolicy(currentRecord);
    if (current.revision !== input.expectedRevision)
      throw new CommunityError(
        "COMMUNITY_OPERATIONAL_POLICY_CONFLICT",
        "The Community runtime policy changed. Refresh and review it again.",
      );

    const nextRevision = current.revision + 1;
    let persisted;
    if (currentRecord) {
      const updated = await tx.communityOperationalPolicy.updateMany({
        where: { id: currentRecord.id, revision: current.revision },
        data: {
          dispatchEnabled: input.dispatchEnabled,
          batchSize: input.batchSize,
          pollIntervalMs: input.pollIntervalMs,
          revision: nextRevision,
        },
      });
      if (!updated.count)
        throw new CommunityError(
          "COMMUNITY_OPERATIONAL_POLICY_CONFLICT",
          "The Community runtime policy changed. Refresh and review it again.",
        );
      persisted = await tx.communityOperationalPolicy.findUniqueOrThrow({ where: { id: currentRecord.id } });
    } else {
      try {
        persisted = await tx.communityOperationalPolicy.create({
          data: {
            key: communityOutboxRuntimePolicyKey,
            dispatchEnabled: input.dispatchEnabled,
            batchSize: input.batchSize,
            pollIntervalMs: input.pollIntervalMs,
            revision: nextRevision,
          },
        });
      } catch {
        throw new CommunityError(
          "COMMUNITY_OPERATIONAL_POLICY_CONFLICT",
          "The Community runtime policy changed. Refresh and review it again.",
        );
      }
    }

    const policy = toPolicy(persisted);
    const before = policyState(current);
    const after = policyState(policy);
    const correlationId = randomUUID();
    const change = await tx.communityOperationalPolicyChange.create({
      data: {
        policyKey: communityOutboxRuntimePolicyKey,
        actorAccountId: actor.accountId,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint,
        correlationId,
        expectedRevision: input.expectedRevision,
        resultingRevision: policy.revision,
        beforeState: stableJson(before),
        afterState: stableJson(after),
      },
    });
    await writeAdministrativeAudit(
      {
        actorAccountId: actor.accountId,
        actorRole: actor.roles[0] ?? "CONFIGURATION_OPERATOR",
        capability: "CONFIG_OPERATE",
        action: "ADMIRALTY_COMMUNITY_OUTBOX_RUNTIME_POLICY_CHANGED",
        targetType: "CommunityOperationalPolicy",
        targetId: communityOutboxRuntimePolicyKey,
        reason: input.reason.trim(),
        authorizationBasis: actor.authorizationBasis,
        correlationId,
        beforeSummary: before,
        afterSummary: after,
        detail: { owner: "Harborlight", contract: "community-outbox-runtime-policy-v1" },
      },
      tx,
    );
    return { policy, receipt: { id: change.id, correlationId, idempotent: false, before, after } };
  });
}

export async function previewReleaseExpiredCommunityOutboxClaims(actor: CommunityOperationalActor) {
  assertOperationsAuthority(actor);
  const expiredClaims = await db.communityOutboxEvent.count({
    where: { processedAt: null, terminalFailureAt: null, claimExpiresAt: { lt: new Date() } },
  });
  return { expiredClaims };
}

/** Releases only leases whose owner has already expired. It never claims,
 * retries, cancels, or reads the event payload. */
export async function releaseExpiredCommunityOutboxClaims(
  actor: CommunityOperationalActor,
  input: Readonly<{ idempotencyKey: string; reason: string }>,
) {
  assertOperationsAuthority(actor);
  if (!/^[A-Za-z0-9_-]{16,128}$/u.test(input.idempotencyKey))
    throw new CommunityError("COMMUNITY_OPERATIONAL_POLICY_INVALID", "A valid idempotency key is required.");
  if (input.reason.trim().length < 8 || input.reason.trim().length > 240)
    throw new CommunityError("COMMUNITY_OPERATIONAL_POLICY_INVALID", "Provide a bounded operational reason.");
  return db.$transaction(async (tx) => {
    const prior = await tx.communityOperationalCommandReceipt.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (prior)
      return {
        receipt: { id: prior.id, correlationId: prior.correlationId, idempotent: true },
        releasedClaims: Number((JSON.parse(prior.result) as { releasedClaims?: number }).releasedClaims ?? 0),
      };

    const released = await tx.communityOutboxEvent.updateMany({
      where: { processedAt: null, terminalFailureAt: null, claimExpiresAt: { lt: new Date() } },
      data: { claimOwner: null, claimedAt: null, claimExpiresAt: null },
    });
    const correlationId = randomUUID();
    const receipt = await tx.communityOperationalCommandReceipt.create({
      data: {
        commandType: "RELEASE_EXPIRED_OUTBOX_CLAIMS",
        actorAccountId: actor.accountId,
        targetType: "CommunityOutboxLease",
        targetId: "expired-claims",
        idempotencyKey: input.idempotencyKey,
        correlationId,
        result: stableJson({ releasedClaims: released.count }),
      },
    });
    await writeAdministrativeAudit(
      {
        actorAccountId: actor.accountId,
        actorRole: actor.roles[0] ?? "OPERATIONS_OPERATOR",
        capability: "JOBS_OPERATE",
        action: "ADMIRALTY_COMMUNITY_EXPIRED_OUTBOX_CLAIMS_RELEASED",
        targetType: "CommunityOutboxLease",
        targetId: "expired-claims",
        reason: input.reason.trim(),
        authorizationBasis: actor.authorizationBasis,
        correlationId,
        beforeSummary: { expiredClaims: released.count },
        afterSummary: { releasedClaims: released.count },
        detail: { owner: "Harborlight", command: "RELEASE_EXPIRED_OUTBOX_CLAIMS" },
      },
      tx,
    );
    return { receipt: { id: receipt.id, correlationId, idempotent: false }, releasedClaims: released.count };
  });
}
