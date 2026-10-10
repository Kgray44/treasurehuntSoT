import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  identity: vi.fn(),
  membership: vi.fn(),
  csrf: vi.fn(),
  load: vi.fn(),
  record: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@/platform/auth", () => ({
  requirePlayerIdentity: m.identity,
  playerCanAccessPlaythrough: m.membership,
  verifyPlayerCsrf: m.csrf,
}));
vi.mock("@/parallax/service", () => ({ loadReleasedSpatialMoment: m.load, recordSpatialObservation: m.record }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: m.rate }));
import { GET, POST } from "./route";
const ctx = { params: Promise.resolve({ playthroughId: "voyage-1" }) };
const req = () =>
  new Request("https://example.test/api?block=passage-1", {
    method: "POST",
    headers: { "x-csrf-token": "csrf" },
    body: JSON.stringify({ blockId: "passage-1" }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.identity.mockResolvedValue({ playerProfileId: "player-1" });
  m.membership.mockResolvedValue(true);
  m.csrf.mockResolvedValue(true);
  m.rate.mockReturnValue({ allowed: true });
  m.load.mockResolvedValue({ replayOnly: false });
  m.record.mockResolvedValue({ progressionChanged: false });
});
it("authorizes before exposing any released spatial content", async () => {
  m.identity.mockResolvedValueOnce(null);
  expect((await GET(new Request("https://example.test?block=passage-1"), ctx)).status).toBe(401);
  m.membership.mockResolvedValueOnce(false);
  expect((await GET(new Request("https://example.test?block=passage-1"), ctx)).status).toBe(404);
  expect(m.load).not.toHaveBeenCalled();
});
it("projects a pinned released moment with private no-store headers", async () => {
  const r = await GET(new Request("https://example.test?block=passage-1"), ctx);
  expect(r.status).toBe(200);
  expect(m.load).toHaveBeenCalledWith("voyage-1", "player-1", "passage-1");
  expect(r.headers.get("Cache-Control")).toContain("no-store");
});
it("rejects invalid block keys and unreleased content", async () => {
  expect((await GET(new Request("https://example.test?block=../secret"), ctx)).status).toBe(400);
  m.load.mockRejectedValueOnce(new Error());
  expect((await GET(new Request("https://example.test?block=passage-1"), ctx)).status).toBe(404);
});
it("protects receipt submission with membership, CSRF, size and rate gates", async () => {
  m.membership.mockResolvedValueOnce(false);
  expect((await POST(req(), ctx)).status).toBe(404);
  m.csrf.mockResolvedValueOnce(false);
  expect((await POST(req(), ctx)).status).toBe(403);
  m.rate.mockReturnValueOnce({ allowed: false });
  expect((await POST(req(), ctx)).status).toBe(429);
  expect(
    (await POST(new Request("https://example.test", { method: "POST", body: "x".repeat(8193) }), ctx)).status,
  ).toBe(413);
  expect(m.record).not.toHaveBeenCalled();
});
it("records observation only and handles rejected/replayed evidence truthfully", async () => {
  const r = await POST(req(), ctx);
  expect(await r.json()).toMatchObject({ progressionChanged: false });
  m.record.mockRejectedValueOnce(new Error());
  expect((await POST(req(), ctx)).status).toBe(409);
});
