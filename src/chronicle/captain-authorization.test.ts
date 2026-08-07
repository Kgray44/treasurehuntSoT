import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  overview: vi.fn(),
  playthrough: vi.fn(),
}));

vi.mock("@/wayfarer/http", () => ({ requireWayfarerAccount: mocks.account }));
vi.mock("@/homeport/workspace-capabilities", () => ({ workspaceCapabilityOverview: mocks.overview }));
vi.mock("@/lib/db", () => ({ db: { taleSession: { findFirst: mocks.playthrough } } }));

import {
  captainAuthorityClauses,
  hasCaptainAuthority,
  requireCaptainSession,
  requireCaptainWorkspace,
} from "./captain-authorization";

describe("homeport.owner-correction.round3 canonical Captain authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.account.mockResolvedValue({
      accountId: "account-a",
      account: { legacyGameMasterId: null },
    });
    mocks.overview.mockResolvedValue({ workspaces: [{ id: "CAPTAIN", state: "ACTIVE" }] });
    mocks.playthrough.mockResolvedValue({
      id: "voyage-a",
      captainId: "account-a",
      captainAccountId: "account-a",
    });
  });

  it("permits an ordinary canonical account to enter Captain without a GameMasterSession", async () => {
    await expect(requireCaptainWorkspace()).resolves.toMatchObject({ accountId: "account-a" });
    expect(mocks.overview).toHaveBeenCalledWith("account-a");
  });

  it("queries a Voyage through canonical ownership and retained legacy ownership only", async () => {
    await expect(requireCaptainSession("voyage-a")).resolves.toMatchObject({
      session: { accountId: "account-a" },
      playthrough: { id: "voyage-a" },
    });
    expect(mocks.playthrough).toHaveBeenCalledWith({
      where: {
        id: "voyage-a",
        OR: [{ captainAccountId: "account-a" }, { captainId: "account-a" }],
      },
    });
    expect(captainAuthorityClauses({ accountId: "account-a", legacyGameMasterId: "legacy-a" })).toEqual([
      { captainAccountId: "account-a" },
      { captainId: "account-a" },
      { captainId: "legacy-a" },
    ]);
  });

  it("denies another account's Voyage without converting the denial into authentication", () => {
    expect(
      hasCaptainAuthority(
        { captainId: "account-b", captainAccountId: "account-b" },
        { accountId: "account-a", legacyGameMasterId: null },
      ),
    ).toBe(false);
  });
});
