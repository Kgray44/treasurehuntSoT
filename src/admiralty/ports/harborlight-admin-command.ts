import type { AdmiraltyCommandPort } from "../commands";
import { applyModerationAction, previewModerationAction } from "@/community/moderation";

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
      const owner = await previewModerationAction(ownerActor, {
        caseId: request.input.caseId,
        subjectType: request.input.subjectType,
        subjectId: request.targetId,
        actionType: request.input.actionType,
        expectedRevision: request.input.expectedRevision,
        reasonCode: request.input.reasonCode,
        secondReviewerId: request.input.secondReviewerId,
      });
      return {
        commandType: request.commandType,
        targetSummary: { subjectType: request.input.subjectType, subjectId: request.targetId, caseId: request.input.caseId },
        currentState: { caseRevision: request.input.expectedRevision },
        resultingState: { caseStatus: owner.nextCaseStatus },
        consequences: ["Harborlight will apply its canonical moderation transition to the attached subject."],
        warnings: owner.requiresSecondReview ? ["This action requires the owner-defined second-review safeguard."] : [],
        requiredCapability: "COMMUNITY_MODERATE",
        risk: "CRITICAL",
        reauthenticationRequired: true,
        auditBehavior: "Harborlight transition, Community evidence, and Admiralty audit are transaction-bound.",
        rollbackAvailable: owner.restorationEligible,
        compensatingAction: owner.restorationEligible ? "Use Harborlight's governed restoration process when eligible." : undefined,
        revision: String(request.input.expectedRevision),
      };
    },
    async execute(request) {
      const action = await applyModerationAction(ownerActor, {
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
      return { outcome: "SUCCEEDED", ownerReceiptId: action.id, correlationId: action.correlationId ?? request.commandId, resultSummary: { actionId: action.id, state: action.state } };
    },
  };
}
