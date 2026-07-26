import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  db: {
    $transaction: vi.fn(),
    communityVoyageLog: { findFirst: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => dependencies);

import { editVoyageLogDraft, transitionOwnedVoyageLog } from "./voyage-log-owner";

describe("Voyage Log owner lifecycle", () => {
  beforeEach(() => vi.resetAllMocks());

  it("allows a draft to archive without incorrectly requiring a publish transition", async () => {
    dependencies.db.communityVoyageLog.findFirst.mockResolvedValue({ id: "log-1", lifecycleState: "DRAFT" });
    dependencies.db.communityVoyageLog.update.mockResolvedValue({ id: "log-1", lifecycleState: "ARCHIVED" });

    await expect(
      transitionOwnedVoyageLog({ ownerAccountId: "owner", voyageLogId: "log-1", to: "ARCHIVED" }),
    ).resolves.toMatchObject({ lifecycleState: "ARCHIVED" });
    expect(dependencies.db.communityVoyageLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lifecycleState: "ARCHIVED" }) }),
    );
  });

  it("rejects a stale revision instead of overwriting a newer draft", async () => {
    dependencies.db.communityVoyageLog.findFirst.mockResolvedValue({ id: "log-1", lifecycleState: "DRAFT" });
    dependencies.db.$transaction.mockImplementation((operation: (tx: unknown) => unknown) =>
      operation({
        communityVoyageLog: { updateMany: vi.fn().mockResolvedValue({ count: 0 }), findUnique: vi.fn() },
      }),
    );

    await expect(
      editVoyageLogDraft({
        ownerAccountId: "owner",
        voyageLogId: "log-1",
        expectedUpdatedAt: new Date("2026-07-25T12:00:00.000Z"),
        title: "Corrected log",
        visibility: "PRIVATE",
        spoilerLevel: "NONE",
      }),
    ).rejects.toMatchObject({ code: "COMMUNITY_VOYAGE_LOG_CONFLICT" });
  });
});
