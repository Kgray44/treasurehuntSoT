// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase1.participation
import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), voyages: vi.fn(), act: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/wayfarer/http", () => ({ requireWayfarerAccount: mocks.auth }));
vi.mock("@/crossdeck/service", () => ({
  createCrossdeckService: () => ({ list: mocks.list, voyages: mocks.voyages, act: mocks.act }),
}));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: mocks.rate,
  rateLimitHeaders: () => ({ "Retry-After": "60" }),
}));
import { GET, POST } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: "session", accountId: "person", csrfToken: "csrf" });
  mocks.list.mockResolvedValue([]);
  mocks.voyages.mockResolvedValue([]);
  mocks.act.mockResolvedValue({ removed: true });
  mocks.rate.mockReturnValue({ allowed: true });
});
const request = (body: unknown) =>
  new Request("https://voyagewright.test/api/crossdeck", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "x-csrf-token": "csrf" },
  });
describe("Crossdeck authenticated no-store API", () => {
  it("passes mutations through Wayfarer CSRF validation before touching the service", async () => {
    mocks.auth.mockResolvedValue(null);
    const req = request({ action: "remove", surfaceId: "00000000-0000-4000-8000-000000000001" });
    expect((await POST(req)).status).toBe(401);
    expect(mocks.auth).toHaveBeenCalledWith(req);
    expect(mocks.act).not.toHaveBeenCalled();
  });
  it("does not enumerate surfaces while signed out", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await GET(new Request("https://voyagewright.test/api/crossdeck"))).status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("rejects forged identity fields and large payloads", async () => {
    expect(
      (
        await POST(
          request({ action: "remove", surfaceId: "00000000-0000-4000-8000-000000000001", accountId: "forged" }),
        )
      ).status,
    ).toBe(400);
    expect((await POST(request({ large: "a".repeat(8200) }))).status).toBe(413);
    expect(mocks.act).not.toHaveBeenCalled();
  });
  it("rate-limits guessing before looking up a challenge", async () => {
    mocks.rate.mockReturnValue({ allowed: false });
    const result = await POST(
      request({ action: "challenge", surfaceId: "00000000-0000-4000-8000-000000000001", role: "CHART" }),
    );
    expect(result.status).toBe(429);
    expect(result.headers.get("Retry-After")).toBe("60");
    expect(mocks.act).not.toHaveBeenCalled();
  });
  it("never caches private summaries and never returns internal errors", async () => {
    const result = await GET(new Request("https://voyagewright.test/api/crossdeck?voyage=voyage"));
    expect(result.headers.get("Cache-Control")).toBe("no-store, private");
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ accountId: "person" }), "voyage");
    mocks.list.mockRejectedValue(new Error("database-password-sensitive"));
    const failed = await GET(new Request("https://voyagewright.test/api/crossdeck"));
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("database-password");
  });
});
