import type { AdmiraltyCommandPort } from "../commands";
import { AdmiraltyError } from "../errors";
import { CommunityError } from "@/community/domain";
import { applyModerationAction, previewModerationAction } from "@/community/moderation";

function rethrowHarborlightCommandError(cause: unknown): never {
  if (cause instanceof AdmiraltyError) throw cause;
  if (cause instanceof CommunityError) {
    if (cause.code === "COMMUNITY_MODERATION_CASE_NOT_FOUND")
      throw new AdmiraltyError("ADMIN_TARGET_NOT_FOUND", "The moderation case is no longer available.", 404);
    if (
      [
        "COMMUNITY_MODERATION_CONFLICT",
        "COMMUNITY_MODERATION_CROSS_CASE_ACTION",
        "COMMUNITY_IDEMPOTENCY_CONFLICT",
        "COMMUNITY_SELF_REVIEW_FORBIDDEN",
      ].includes(cause.code)
    )
      throw new AdmiraltyError("ADMIN_CONFLICT", "The moderation case changed. Refresh and review a new preview.", 409);
    if (cause.code === "COMMUNITY_ACCESS_DENIED")
      throw new AdmiraltyError("ADMIRALTY_CAPABILITY_DENIED", "Moderation authorization is required.", 403);
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "The moderation command is not valid.", 400);
  }
  throw cause;
}

export type ModerationCommandInput = Readonly<{
  caseId: string;
  subjectType: string;
  actionType: string;
  expectedRevision: number;
  reasonCode: string;
  secondReviewerId?: string;
}>;

export function harborlightModerationPort(actor: {
  accountId: string;
  roles: readonly string[];
  authorizationBasis: string;
}): AdmiraltyCommandPort<ModerationCommandInput> {
  const ownerActor = {
    accountId: actor.accountId,
    roles: actor.roles.includes("ADMINISTRATOR") ? ["ADMINISTRATOR"] : ["MODERATOR"],
  };
  return {
    ownerDomain: "Harborlight",
    async preview(request) {
      let owner;
      try {
        owner = await previewModerationAction(ownerActor, {
          caseId: request.input.caseId,
          subjectType: request.input.subjectType,
          subjectId: request.targetId,
          actionType: request.input.actionType,
          expectedRevision: request.input.expectedRevision,
          reasonCode: request.input.reasonCode,
          secondReviewerId: request.input.secondReviewerId,
        });
      } catch (cause) {
        rethrowHarborlightCommandError(cause);
      }
      return {
        commandType: request.commandType,
        targetSummary: {
          subjectType: request.input.subjectType,
          subjectId: request.targetId,
          caseId: request.input.caseId,
        },
        currentState: { caseRevision: request.input.expectedRevision },
        resultingState: { caseStatus: owner.nextCaseStatus },
        consequences: ["Harborlight will apply its canonical moderation transition to the attached subject."],
        warnings: owner.requiresSecondReview ? ["This action requires the owner-defined second-review safeguard."] : [],
        requiredCapability: "COMMUNITY_MODERATE",
        risk: "CRITICAL",
        reauthenticationRequired: true,
        auditBehavior: "Harborlight transition, Community evidence, and Admiralty audit are transaction-bound.",
        rollbackAvailable: owner.restorationEligible,
        compensatingAction: owner.restorationEligible
          ? "Use Harborlight's governed restoration process when eligible."
          : undefined,
        revision: String(request.input.expectedRevision),
      };
    },
    async execute(request) {
      let action;
      try {
        action = await applyModerationAction(ownerActor, {
          caseId: request.input.caseId,
          subjectType: request.input.subjectType,
          subjectId: request.targetId,
          actionType: request.input.actionType,
          expectedRevision: request.input.expectedRevision,
          reasonCode: request.input.reasonCode,
          idempotencyKey: request.idempotencyKey,
          secondReviewerId: request.input.secondReviewerId,
          administrativeAudit: {
            actorRole: actor.roles[0] ?? "MODERATION_OPERATOR",
            capability: "COMMUNITY_MODERATE",
            authorizationBasis: actor.authorizationBasis,
            reason: request.reason,
          },
        });
      } catch (cause) {
        rethrowHarborlightCommandError(cause);
      }
      return {
        outcome: "SUCCEEDED",
        ownerReceiptId: action.id,
        correlationId: action.correlationId ?? request.commandId,
        resultSummary: { actionId: action.id, state: action.state },
      };
    },
  };
}
