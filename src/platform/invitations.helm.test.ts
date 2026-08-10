import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canonicalAccount: vi.fn(),
  account: vi.fn(),
  version: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/wayfarer/accounts", () => ({ canonicalAccountForLegacyActor: mocks.canonicalAccount }));
vi.mock("@/lib/db", () => ({
  db: {
    userAccount: { findUnique: mocks.account },
    publishedTaleVersion: { findFirst: mocks.version },
    $transaction: mocks.transaction,
  },
}));

import {
  createPlaythroughAndInvitations,
  createPlaythroughSchema,
  membershipStatusAfterInvitationAcceptance,
} from "./invitations";

const input = {
  taleId: "tale-0001",
  versionId: "version-0001",
  voyageName: "Moonlit Run",
  captainMode: "CAPTAIN_CONTROLLED" as const,
  hints: "ON_REQUEST" as const,
  sideQuests: true,
  players: [{ playerId: "other-profile", displayName: "Crew Member", crewRole: "Navigator" }],
};

describe("Project Helm Phase 1 Voyage creation contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canonicalAccount.mockResolvedValue("account-1");
    mocks.account.mockResolvedValue({
      id: "account-1",
      legacyGameMasterId: null,
      profile: { id: "profile-1", status: "ACTIVE", displayName: "Mara Tide" },
    });
  });

  it("defaults omitted participation to Captain-only", () => {
    expect(createPlaythroughSchema.parse(input).captainParticipationMode).toBe("CAPTAIN_ONLY");
  });

  it("activates an invitation accepted after launch and preserves setup readiness before launch", () => {
    expect(membershipStatusAfterInvitationAcceptance("INVITING")).toBe("READY");
    expect(membershipStatusAfterInvitationAcceptance("SCHEDULED")).toBe("READY");
    expect(membershipStatusAfterInvitationAcceptance("ACTIVE")).toBe("ACTIVE_MEMBER");
    expect(membershipStatusAfterInvitationAcceptance("PAUSED")).toBe("ACTIVE_MEMBER");
  });

  it("rejects Captain + Player truthfully when the canonical account lacks an active Player Profile", async () => {
    mocks.account.mockResolvedValue({ id: "account-1", legacyGameMasterId: null, profile: null });
    await expect(
      createPlaythroughAndInvitations(
        { ...input, captainParticipationMode: "CAPTAIN_AND_PLAYER" },
        "account-1",
        "https://example.test",
      ),
    ).rejects.toThrow(/active Player Profile/i);
    expect(mocks.version).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a fake self-invitation in either mode so setup cannot disagree with canonical participation", async () => {
    await expect(
      createPlaythroughAndInvitations(
        {
          ...input,
          captainParticipationMode: "CAPTAIN_ONLY",
          players: [{ playerId: "profile-1", displayName: "Mara Tide", crewRole: "Navigator" }],
        },
        "account-1",
        "https://example.test",
      ),
    ).rejects.toThrow(/Captain participation/i);
    expect(mocks.version).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
