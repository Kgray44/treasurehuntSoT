import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  studio: vi.fn(),
  chronicle: vi.fn(),
  account: vi.fn(),
  workspace: vi.fn(),
}));

vi.mock("@/chronicle/studio-authorization", () => ({ requireStudioWorkspace: mocks.studio }));
vi.mock("@/homeport/workspace-capabilities", () => ({ workspaceCapabilityOverview: mocks.workspace }));
vi.mock("@/lib/db", () => ({
  db: {
    chronicle: { findFirst: mocks.chronicle },
    userAccount: { findUnique: mocks.account },
  },
}));

import { enforceTideglassRateLimit, requireTideglassCreatorChronicle } from "../../src/tideglass/http";
import { prismaTideglassEditionRepository } from "../../src/tideglass/service";

function session(
  roles: Array<{ role: string; scopeType: string; scopeId: string | null; revokedAt: Date | null }> = [],
) {
  return {
    accountId: "account-a",
    account: { legacyGameMasterId: null, roles },
  };
}

describe("Tideglass Phase 2 authorization and rate-limit identity", () => {
  beforeEach(() => {
    mocks.studio.mockReset();
    mocks.chronicle.mockReset();
    mocks.account.mockReset();
    mocks.workspace.mockReset().mockResolvedValue({ workspaces: [{ id: "CREATOR", state: "ACTIVE" }] });
  });

  it("accepts exact Chronicle-scoped Creator collaboration", async () => {
    mocks.studio.mockResolvedValue(
      session([{ role: "CREATOR", scopeType: "CHRONICLE", scopeId: "chronicle-a", revokedAt: null }]),
    );
    mocks.chronicle.mockResolvedValue({ id: "chronicle-a" });
    expect(await requireTideglassCreatorChronicle("chronicle-a")).toBeTruthy();
    expect(mocks.chronicle).toHaveBeenCalledWith({ where: { id: "chronicle-a" }, select: { id: true } });
  });

  it("does not invent Tideglass annotation authority from an administrator label", async () => {
    mocks.studio.mockResolvedValue(
      session([{ role: "ADMINISTRATOR", scopeType: "GLOBAL", scopeId: null, revokedAt: null }]),
    );
    mocks.chronicle.mockResolvedValue(null);
    expect(await requireTideglassCreatorChronicle("chronicle-a")).toBeNull();
    expect(mocks.chronicle.mock.calls[0][0].where.OR).toBeDefined();
  });

  it("does not let a bare administrator label bypass exact-edition Creator ownership", async () => {
    mocks.account.mockResolvedValue({
      legacyGameMasterId: null,
      roles: [{ role: "ADMINISTRATOR", scopeType: "GLOBAL", scopeId: null }],
    });
    mocks.chronicle.mockResolvedValue(null);
    const authorized = await prismaTideglassEditionRepository.authorizeEdition(
      { kind: "ACCOUNT", accountId: "account-a" },
      {
        id: "edition-a",
        chronicleId: "chronicle-a",
        contentSnapshot: "{}",
        schemaVersion: 1,
        checksum: "a".repeat(64),
      },
    );
    expect(authorized).toBe(false);
    expect(mocks.chronicle.mock.calls[0][0].where.OR).toBeDefined();
  });

  it("denies a foreign Creator without Chronicle ownership or scoped collaboration", async () => {
    mocks.account.mockResolvedValue({ legacyGameMasterId: null, roles: [] });
    mocks.chronicle.mockResolvedValue(null);
    const authorized = await prismaTideglassEditionRepository.authorizeEdition(
      { kind: "ACCOUNT", accountId: "foreign-creator" },
      {
        id: "edition-a",
        chronicleId: "chronicle-a",
        contentSnapshot: "{}",
        schemaVersion: 1,
        checksum: "a".repeat(64),
      },
    );
    expect(authorized).toBe(false);
  });

  it("isolates centralized comparison limits by account and Chronicle", () => {
    const suffix = Math.random().toString(36).slice(2);
    for (let index = 0; index < 30; index += 1)
      expect(enforceTideglassRateLimit("comparison-read", `account-a-${suffix}`, "chronicle-a").ok).toBe(true);
    expect(enforceTideglassRateLimit("comparison-read", `account-a-${suffix}`, "chronicle-a").ok).toBe(false);
    expect(enforceTideglassRateLimit("comparison-read", `account-b-${suffix}`, "chronicle-a").ok).toBe(true);
    expect(enforceTideglassRateLimit("comparison-read", `account-a-${suffix}`, "chronicle-b").ok).toBe(true);
  });
});
