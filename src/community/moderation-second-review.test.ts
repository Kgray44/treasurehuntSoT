import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  userAccount: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { requireEligibleSecondReviewer } from "./moderation";

describe("Harborlight high-impact second review eligibility", () => {
  beforeEach(() => vi.resetAllMocks());

  it("fails closed when the required reviewer is absent, inactive, or lacks an eligible role", async () => {
    dbMock.userAccount.findUnique.mockResolvedValueOnce(null);
    await expect(
      requireEligibleSecondReviewer("QUARANTINE_LISTING", "moderator_1", "reviewer_1"),
    ).rejects.toMatchObject({
      code: "COMMUNITY_SECOND_REVIEWER_INELIGIBLE",
    });

    dbMock.userAccount.findUnique.mockResolvedValueOnce({ status: "SUSPENDED", roles: [{ role: "MODERATOR" }] });
    await expect(
      requireEligibleSecondReviewer("QUARANTINE_LISTING", "moderator_1", "reviewer_1"),
    ).rejects.toMatchObject({
      code: "COMMUNITY_SECOND_REVIEWER_INELIGIBLE",
    });

    dbMock.userAccount.findUnique.mockResolvedValueOnce({ status: "ACTIVE", roles: [{ role: "PLAYER" }] });
    await expect(
      requireEligibleSecondReviewer("QUARANTINE_LISTING", "moderator_1", "reviewer_1"),
    ).rejects.toMatchObject({
      code: "COMMUNITY_SECOND_REVIEWER_INELIGIBLE",
    });
  });

  it("accepts an active independent Admiralty moderation reviewer", async () => {
    dbMock.userAccount.findUnique.mockResolvedValue({ status: "ACTIVE", roles: [{ role: "MODERATION_OPERATOR" }] });
    await expect(
      requireEligibleSecondReviewer("QUARANTINE_LISTING", "moderator_1", "reviewer_1"),
    ).resolves.toBeUndefined();
    expect(dbMock.userAccount.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "reviewer_1" } }),
    );
  });
});
