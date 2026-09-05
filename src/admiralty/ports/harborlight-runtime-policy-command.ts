import type { AdmiraltyCommandPort } from "../commands";
import { AdmiraltyError } from "../errors";
import {
  previewCommunityOutboxRuntimePolicyUpdate,
  updateCommunityOutboxRuntimePolicy,
} from "@/community/operational-policy";
import { CommunityError } from "@/community/domain";

export type CommunityOutboxRuntimePolicyCommandInput = Readonly<{
  expectedRevision: number;
  dispatchEnabled: boolean;
  batchSize: number;
  pollIntervalMs: number;
}>;

function rethrowPolicyError(cause: unknown): never {
  if (cause instanceof AdmiraltyError) throw cause;
  if (cause instanceof CommunityError) {
    if (cause.code === "COMMUNITY_OPERATIONAL_POLICY_CONFLICT")
      throw new AdmiraltyError(
        "ADMIN_CONFLICT",
        "The Community runtime policy changed. Refresh and review it again.",
        409,
      );
    if (cause.code === "COMMUNITY_ACCESS_DENIED")
      throw new AdmiraltyError("ADMIRALTY_CAPABILITY_DENIED", "Community operational authority is required.", 403);
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "The Community runtime policy is not valid.", 400);
  }
  throw cause;
}

export function harborlightRuntimePolicyPort(actor: {
  accountId: string;
  roles: readonly string[];
  authorizationBasis: string;
}): AdmiraltyCommandPort<CommunityOutboxRuntimePolicyCommandInput> {
  return {
    ownerDomain: "Harborlight",
    async preview(request) {
      let owner;
      try {
        owner = await previewCommunityOutboxRuntimePolicyUpdate(actor, {
          ...request.input,
          reason: request.reason,
          idempotencyKey: request.idempotencyKey,
        });
      } catch (cause) {
        rethrowPolicyError(cause);
      }
      const consequences = [
        `Community workers will ${owner.resulting.dispatchEnabled ? "accept new outbox work" : "stop claiming new outbox work"}.`,
        `Each worker pass will claim at most ${owner.resulting.batchSize} jobs.`,
        `Idle workers will poll every ${Math.round(owner.resulting.pollIntervalMs / 1_000)} seconds.`,
      ];
      return {
        commandType: request.commandType,
        targetSummary: { policy: "Community outbox runtime", owner: "Harborlight" },
        currentState: owner.current,
        resultingState: owner.resulting,
        consequences,
        warnings: owner.resulting.dispatchEnabled
          ? []
          : ["Expired leases will still be released, but queued Community work will wait until dispatch is resumed."],
        requiredCapability: "CONFIG_OPERATE",
        risk: "HIGH",
        reauthenticationRequired: true,
        auditBehavior:
          "Harborlight persists a revisioned owner receipt and a redacted Admiralty audit event in one transaction.",
        rollbackAvailable: true,
        compensatingAction: "Preview a new change using the resulting revision to restore the prior bounded policy.",
        revision: String(owner.current.revision),
      };
    },
    async execute(request) {
      let owner;
      try {
        owner = await updateCommunityOutboxRuntimePolicy(actor, {
          ...request.input,
          reason: request.reason,
          idempotencyKey: request.idempotencyKey,
        });
      } catch (cause) {
        rethrowPolicyError(cause);
      }
      return {
        outcome: "SUCCEEDED",
        ownerReceiptId: owner.receipt.id,
        correlationId: owner.receipt.correlationId,
        resultSummary: {
          policy: owner.policy,
          idempotent: owner.receipt.idempotent,
          rollbackAvailable: true,
        },
      };
    },
  };
}
