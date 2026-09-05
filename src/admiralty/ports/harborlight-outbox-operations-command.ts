import type { AdmiraltyCommandPort } from "../commands";
import { AdmiraltyError } from "../errors";
import { CommunityError } from "@/community/domain";
import {
  previewReleaseExpiredCommunityOutboxClaims,
  releaseExpiredCommunityOutboxClaims,
} from "@/community/operational-policy";

function rethrowOperationsError(cause: unknown): never {
  if (cause instanceof AdmiraltyError) throw cause;
  if (cause instanceof CommunityError) {
    if (cause.code === "COMMUNITY_ACCESS_DENIED")
      throw new AdmiraltyError("ADMIRALTY_CAPABILITY_DENIED", "Community operations authority is required.", 403);
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "The Community recovery command is not valid.", 400);
  }
  throw cause;
}

export function harborlightReleaseExpiredOutboxClaimsPort(actor: {
  accountId: string;
  roles: readonly string[];
  authorizationBasis: string;
}): AdmiraltyCommandPort {
  return {
    ownerDomain: "Harborlight",
    async preview(request) {
      let owner;
      try {
        owner = await previewReleaseExpiredCommunityOutboxClaims(actor);
      } catch (cause) {
        rethrowOperationsError(cause);
      }
      return {
        commandType: request.commandType,
        targetSummary: { target: "Expired Community outbox leases", owner: "Harborlight" },
        currentState: { expiredClaims: owner.expiredClaims },
        resultingState: { releasedClaims: owner.expiredClaims, queuedWorkClaimed: 0 },
        consequences: [
          `${owner.expiredClaims} expired Community worker lease${owner.expiredClaims === 1 ? "" : "s"} will be released if still expired at execution.`,
          "No event payload is read, retried, cancelled, or newly claimed by this command.",
        ],
        warnings: owner.expiredClaims
          ? []
          : ["There are no expired leases to release. The command remains a safe no-op."],
        requiredCapability: "JOBS_OPERATE",
        risk: "HIGH",
        reauthenticationRequired: true,
        auditBehavior:
          "Harborlight persists an idempotent owner receipt and a redacted Admiralty audit event in one transaction.",
        rollbackAvailable: false,
      };
    },
    async execute(request) {
      let owner;
      try {
        owner = await releaseExpiredCommunityOutboxClaims(actor, {
          reason: request.reason,
          idempotencyKey: request.idempotencyKey,
        });
      } catch (cause) {
        rethrowOperationsError(cause);
      }
      return {
        outcome: "SUCCEEDED",
        ownerReceiptId: owner.receipt.id,
        correlationId: owner.receipt.correlationId,
        resultSummary: { releasedClaims: owner.releasedClaims, idempotent: owner.receipt.idempotent },
      };
    },
  };
}
