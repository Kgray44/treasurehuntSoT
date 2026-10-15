// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ operator: vi.fn(), overview: vi.fn(), history: vi.fn(), operation: vi.fn() }));
vi.mock("@/admiralty/authorization", () => ({ requireAdmiraltyOperator: mocks.operator }));
vi.mock("@/admiralty/http", () => ({
  enforceAdmiraltyRateLimit: vi.fn(),
  admiraltyErrorResponse: (error: { status?: number }) =>
    Response.json({ error: "Unavailable" }, { status: error.status ?? 400 }),
}));
vi.mock("@/parallax/ai-economics", () => ({
  aiEconomicsOverview: mocks.overview,
  aiEconomicsHistory: mocks.history,
  aiEconomicsOperation: mocks.operation,
  defaultEconomicsFilter: () => ({ from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-10-15T00:00:00Z") }),
}));
import { GET } from "./route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.operator.mockResolvedValue({ accountId: "synthetic-admin", roles: ["ADMINISTRATOR"] });
  mocks.overview.mockResolvedValue({ totals: {} });
});
describe("Administrator-only privacy-safe AI economics", () => {
  it("denies ordinary users and configuration observers before loading analytics", async () => {
    mocks.operator.mockRejectedValueOnce({ status: 403 });
    expect((await GET(new Request("http://localhost/api/admin/ai-economics"))).status).toBe(403);
    mocks.operator.mockResolvedValue({ accountId: "observer", roles: ["CONFIGURATION_OBSERVER"] });
    expect((await GET(new Request("http://localhost/api/admin/ai-economics"))).status).toBe(403);
    expect(mocks.overview).not.toHaveBeenCalled();
  });
  it("requires both canonical authorities and marks analytics private", async () => {
    const response = await GET(new Request("http://localhost/api/admin/ai-economics"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.operator).toHaveBeenNthCalledWith(1, "CONFIG_OBSERVE");
    expect(mocks.operator).toHaveBeenNthCalledWith(2, "ACCOUNT_OBSERVE");
  });
  it("rejects invalid dates, excessive ranges and oversized history pages", async () => {
    for (const query of [
      "from=invalid",
      "from=2024-01-01T00:00:00Z&to=2026-01-01T00:00:00Z",
      "section=history&take=101",
    ])
      expect((await GET(new Request(`http://localhost/api/admin/ai-economics?${query}`))).status).toBe(400);
    expect(mocks.overview).not.toHaveBeenCalled();
  });
  it("bounds and forwards operation drill-downs without exposing execution bodies", async () => {
    mocks.history.mockResolvedValue({ records: [], nextCursor: null });
    const response = await GET(
      new Request(
        "http://localhost/api/admin/ai-economics?section=history&capabilityId=ROOM_RECONSTRUCTION&accountId=synthetic-person&take=20&search=request",
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.history).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilityId: "ROOM_RECONSTRUCTION",
        accountId: "synthetic-person",
        search: "request",
      }),
      expect.objectContaining({ take: 20 }),
    );
    mocks.operation.mockResolvedValue(null);
    expect(
      (await GET(new Request("http://localhost/api/admin/ai-economics?section=operation&id=missing"))).status,
    ).toBe(404);
  });
});
