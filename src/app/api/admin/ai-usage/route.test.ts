// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireOperator: vi.fn(),
  overview: vi.fn(),
  user: vi.fn(),
  history: vi.fn(),
  overrides: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@/admiralty/authorization", () => ({ requireAdmiraltyOperator: mocks.requireOperator }));
vi.mock("@/admiralty/http", () => ({
  enforceAdmiraltyRateLimit: mocks.rate,
  admiraltyErrorResponse: (cause: { status?: number }) =>
    Response.json({ error: "Access unavailable" }, { status: cause.status ?? 400 }),
}));
vi.mock("@/parallax/ai-quota-projections", () => ({
  aiQuotaOverview: mocks.overview,
  aiQuotaUserDetail: mocks.user,
  aiQuotaUsageHistory: mocks.history,
  aiQuotaOverrides: mocks.overrides,
}));
import { GET } from "./route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireOperator.mockResolvedValue({ accountId: "synthetic-operator" });
  mocks.overview.mockResolvedValue({ provider: { configured: false } });
  mocks.user.mockResolvedValue({ accountId: "synthetic-user", used: 12 });
  mocks.history.mockResolvedValue([]);
});
describe("AI usage observation and existing dossier identity", () => {
  it("requires account observation for the exception inventory and forwards a bounded cursor", async () => {
    mocks.overrides.mockResolvedValue({ items: [], total: 0, nextCursor: null });
    const response = await GET(
      new Request("http://localhost/api/admin/ai-usage?section=overrides&cursor=synthetic-account"),
    );
    expect(response.status).toBe(200);
    expect(mocks.requireOperator).toHaveBeenNthCalledWith(2, "ACCOUNT_OBSERVE");
    expect(mocks.overrides).toHaveBeenCalledWith("synthetic-account");
    mocks.requireOperator.mockImplementation(async (capability) => {
      if (capability === "ACCOUNT_OBSERVE") throw { status: 403 };
      return { accountId: "observer" };
    });
    mocks.overrides.mockClear();
    expect((await GET(new Request("http://localhost/api/admin/ai-usage?section=overrides"))).status).toBe(403);
    expect(mocks.overrides).not.toHaveBeenCalled();
  });
  it("requires configuration observation before reading platform usage", async () => {
    mocks.requireOperator.mockRejectedValue({ status: 403 });
    expect((await GET(new Request("http://localhost/api/admin/ai-usage"))).status).toBe(403);
    expect(mocks.overview).not.toHaveBeenCalled();
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("returns safe private platform metadata without a duplicate people search", async () => {
    const response = await GET(new Request("http://localhost/api/admin/ai-usage"));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(await response.json()).toEqual({ provider: { configured: false } });
    const removed = await GET(new Request("http://localhost/api/admin/ai-usage?section=users&q=anything"));
    expect(removed.status).toBe(400);
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("requires both account and configuration observation for dossier usage", async () => {
    mocks.requireOperator.mockImplementation(async (capability: string) => {
      if (capability === "ACCOUNT_OBSERVE") throw { status: 403 };
      return { accountId: "synthetic-operator" };
    });
    expect(
      (await GET(new Request("http://localhost/api/admin/ai-usage?section=user&accountId=synthetic-user"))).status,
    ).toBe(403);
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("loads only the canonical account requested by its dossier", async () => {
    const response = await GET(
      new Request("http://localhost/api/admin/ai-usage?section=user&accountId=synthetic-user"),
    );
    expect(await response.json()).toEqual({ user: { accountId: "synthetic-user", used: 12 } });
    expect(mocks.requireOperator).toHaveBeenNthCalledWith(1, "CONFIG_OBSERVE");
    expect(mocks.requireOperator).toHaveBeenNthCalledWith(2, "ACCOUNT_OBSERVE");
    expect(mocks.user).toHaveBeenCalledWith("synthetic-user");
  });
  it("bounds account exports and rejects unreasonable history ranges before reading", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/admin/ai-usage?section=export&accountId=synthetic-user&from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z",
      ),
    );
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    expect(mocks.history).toHaveBeenCalledWith({
      accountId: "synthetic-user",
      from: new Date("2026-10-01T00:00:00Z"),
      to: new Date("2026-11-01T00:00:00Z"),
      take: 1000,
    });
    mocks.history.mockClear();
    const invalid = await GET(
      new Request(
        "http://localhost/api/admin/ai-usage?section=history&from=2024-01-01T00:00:00Z&to=2026-11-01T00:00:00Z",
      ),
    );
    expect(invalid.status).toBe(400);
    expect(mocks.history).not.toHaveBeenCalled();
  });
});
