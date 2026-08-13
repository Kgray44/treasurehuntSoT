import { beforeEach, describe, expect, it, vi } from "vitest";
import { newAdmiraltyCommandRequest } from "../commands";
import { CommunityError } from "@/community/domain";

const owner = vi.hoisted(() => ({
  applyModerationAction: vi.fn(),
  previewModerationAction: vi.fn(),
}));

vi.mock("@/community/moderation", () => owner);

import { harborlightModerationPort } from "./harborlight-admin-command";

const actor = {
  accountId: "moderator_1234567890",
  roles: ["MODERATION_OPERATOR"],
  authorizationBasis: "ROLE_CAPABILITY",
};

function command() {
  return newAdmiraltyCommandRequest({
    commandType: "MODERATION_ACTION",
    actorAccountId: actor.accountId,
    targetType: "LISTING",
    targetId: "listing_1234567890",
    expectedRevision: "4",
    reason: "Verified safety report requires listing quarantine.",
    idempotencyKey: "moderation_12345678901234567890",
    input: {
      caseId: "case_1234567890",
      subjectType: "LISTING",
      actionType: "QUARANTINE_LISTING",
      expectedRevision: 4,
      reasonCode: "CHILD_SAFETY",
      secondReviewerId: "reviewer_1234567890",
    },
  });
}

describe("Harborlight Admiralty command port", () => {
  beforeEach(() => vi.resetAllMocks());

  it("fails closed with a stable conflict when the case changes", async () => {
    owner.previewModerationAction.mockRejectedValue(
      new CommunityError("COMMUNITY_MODERATION_CONFLICT", "owner diagnostic"),
    );

    await expect(harborlightModerationPort(actor).preview(command())).rejects.toMatchObject({
      code: "ADMIN_CONFLICT",
      status: 409,
    });
  });

  it("preserves the owner command's target, second reviewer, and idempotency key", async () => {
    owner.applyModerationAction.mockResolvedValue({
      id: "action_1234567890",
      correlationId: "correlation_1234567890",
      state: "ACTIONED",
    });
    const result = await harborlightModerationPort(actor).execute(command(), {} as never);

    expect(result).toMatchObject({ ownerReceiptId: "action_1234567890", outcome: "SUCCEEDED" });
    expect(owner.applyModerationAction).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: actor.accountId, roles: ["MODERATOR"] }),
      expect.objectContaining({
        caseId: "case_1234567890",
        subjectId: "listing_1234567890",
        secondReviewerId: "reviewer_1234567890",
        idempotencyKey: "moderation_12345678901234567890",
      }),
    );
  });
});
