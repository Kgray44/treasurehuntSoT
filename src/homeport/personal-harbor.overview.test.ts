import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, materializeChronicleHistory, workspaceCapabilityOverview } = vi.hoisted(() => ({
  db: {
    playerProfile: { findUnique: vi.fn() },
    externalIdentity: { count: vi.fn() },
    accountSession: { count: vi.fn() },
    playerChronicleRecord: { count: vi.fn() },
    chronicleMemory: { count: vi.fn() },
    playerArtifactRecord: { count: vi.fn() },
    communitySave: { findMany: vi.fn() },
  },
  materializeChronicleHistory: vi.fn(),
  workspaceCapabilityOverview: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/wayfarer/chronicle-history", () => ({ materializeChronicleHistory }));
vi.mock("@/homeport/workspace-capabilities", () => ({ workspaceCapabilityOverview }));

import { passportOverview, personalHarborOverview } from "./personal-harbor";

describe("Chronicle Passport summary freshness", () => {
  let materializedRecords = 0;

  beforeEach(() => {
    materializedRecords = 0;
    vi.clearAllMocks();
    materializeChronicleHistory.mockImplementation(async () => {
      materializedRecords = 1;
      return { membershipsExamined: 1, recordsCreated: 1, recordsUpdated: 0, projectionFailures: 0 };
    });
    db.playerProfile.findUnique.mockResolvedValue({
      displayName: "Sera",
      handle: "sera",
      biography: null,
      defaultVisibility: "ONLY_ME",
      avatarMedia: null,
      bannerMedia: null,
    });
    db.externalIdentity.count.mockResolvedValue(0);
    db.accountSession.count.mockResolvedValue(1);
    db.playerChronicleRecord.count.mockImplementation(async () => materializedRecords);
    db.chronicleMemory.count.mockResolvedValue(0);
    db.playerArtifactRecord.count.mockResolvedValue(0);
    db.communitySave.findMany.mockResolvedValue([]);
    workspaceCapabilityOverview.mockResolvedValue({ workspaces: [] });
  });

  it("converges Personal Harbor then Passport after the same authoritative refresh", async () => {
    const harbor = await personalHarborOverview("account-owner", "profile-owner");
    const passport = await passportOverview("account-owner", "profile-owner");

    expect(harbor.counts.history).toBe(1);
    expect(passport.sections.find((section) => section.id === "history")?.count).toBe(1);
    expect(materializeChronicleHistory).toHaveBeenNthCalledWith(1, "profile-owner");
    expect(materializeChronicleHistory).toHaveBeenNthCalledWith(2, "profile-owner");
  });

  it("converges Passport then Personal Harbor without treating invitations as played records", async () => {
    const passport = await passportOverview("account-owner", "profile-owner");
    const harbor = await personalHarborOverview("account-owner", "profile-owner");

    expect(passport.sections.find((section) => section.id === "history")?.count).toBe(1);
    expect(harbor.counts.history).toBe(1);
    expect(db.communitySave.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: "account-owner", kind: "SAVE" } }),
    );
  });
});
