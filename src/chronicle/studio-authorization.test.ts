import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  overview: vi.fn(),
  tale: vi.fn(),
  asset: vi.fn(),
}));

vi.mock("@/wayfarer/http", () => ({ requireWayfarerAccount: mocks.account }));
vi.mock("@/homeport/workspace-capabilities", () => ({ workspaceCapabilityOverview: mocks.overview }));
vi.mock("@/lib/db", () => ({
  db: {
    chronicle: { findFirst: mocks.tale },
    taleAsset: { findUnique: mocks.asset },
  },
}));

import { requireOwnedStudioAsset, requireOwnedStudioTale, requireStudioWorkspace } from "./studio-authorization";

describe("homeport.owner-correction.round3.resource-authority-separated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.account.mockResolvedValue({
      accountId: "account-1",
      account: { legacyGameMasterId: null, roles: [] },
    });
    mocks.overview.mockResolvedValue({ workspaces: [{ id: "CREATOR", state: "ACTIVE" }] });
    mocks.tale.mockResolvedValue({ id: "tale-1", creatorId: "account-1", creatorAccountId: "account-1" });
    mocks.asset.mockResolvedValue({ id: "asset-1", taleId: "tale-1" });
  });

  it("permits ordinary Creator workspace entry without synthesizing object ownership", async () => {
    await expect(requireStudioWorkspace()).resolves.toMatchObject({ accountId: "account-1" });
    await requireOwnedStudioTale("tale-1");
    expect(mocks.tale).toHaveBeenCalledWith({
      where: {
        id: "tale-1",
        OR: [{ creatorAccountId: "account-1" }, { creatorId: "account-1" }],
      },
      select: { id: true, creatorId: true, creatorAccountId: true },
    });
  });

  it("denies a Chronicle not returned by the owner-scoped query and never broadens through asset IDs", async () => {
    mocks.tale.mockResolvedValue(null);
    await expect(requireOwnedStudioTale("unrelated-tale")).resolves.toBeNull();
    await expect(requireOwnedStudioAsset("asset-1")).resolves.toBeNull();
  });

  it("permits an explicitly Chronicle-scoped Creator collaborator without granting global ownership", async () => {
    mocks.account.mockResolvedValue({
      accountId: "account-1",
      account: {
        legacyGameMasterId: null,
        roles: [{ role: "CREATOR", scopeType: "CHRONICLE", scopeId: "tale-1" }],
      },
    });
    await expect(requireOwnedStudioTale("tale-1")).resolves.toBeTruthy();
    expect(mocks.tale).toHaveBeenCalledWith({
      where: { id: "tale-1" },
      select: { id: true, creatorId: true, creatorAccountId: true },
    });
  });

  it("denies resource lookup when the active-Chronicle policy blocks Creator workspace entry", async () => {
    mocks.overview.mockResolvedValue({ workspaces: [{ id: "CREATOR", state: "BLOCKED" }] });
    await expect(requireOwnedStudioTale("tale-1")).resolves.toBeNull();
    expect(mocks.tale).not.toHaveBeenCalled();
  });
});
