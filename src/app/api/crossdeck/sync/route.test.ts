// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase2.continuity
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), command: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/wayfarer/http", () => ({ requireWayfarerAccount: mocks.auth }));
vi.mock("@/crossdeck/sync-service", () => ({
  createCrossdeckSyncService: () => ({ read: mocks.read, command: mocks.command }),
}));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: mocks.rate,
  rateLimitHeaders: () => ({ "Retry-After": "60" }),
}));
import { GET, POST } from "./route";
const body = () => ({
  messageId: crypto.randomUUID(),
  surfaceId: crypto.randomUUID(),
  voyageId: "voyage",
  sequence: 1,
  payloadSchemaVersion: 1,
  payload: { action: "focus", family: "MAP", targetId: crypto.randomUUID() },
});
const post = (input: unknown) =>
  new Request("https://voyagewright.test/api/crossdeck/sync", { method: "POST", body: JSON.stringify(input) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: "session", accountId: "account" });
  mocks.read.mockResolvedValue({ revision: 1 });
  mocks.command.mockResolvedValue({ revision: 2 });
  mocks.rate.mockReturnValue({ allowed: true });
});
describe("sync API security", () => {
  it("requires canonical auth and CSRF before reads/mutations", async () => {
    mocks.auth.mockResolvedValue(null);
    const request = post(body());
    expect((await POST(request)).status).toBe(401);
    expect(mocks.auth).toHaveBeenCalledWith(request);
    expect((await GET(new Request("https://voyagewright.test/api/crossdeck/sync"))).status).toBe(401);
    expect(mocks.command).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("rejects forged identity, arbitrary payloads and oversized state", async () => {
    expect((await POST(post({ ...body(), personId: "forged" }))).status).toBe(400);
    expect((await POST(post({ ...body(), payload: { action: "advanceStory" } }))).status).toBe(400);
    expect((await POST(post({ ...body(), content: "a".repeat(9000) }))).status).toBe(413);
    expect(mocks.command).not.toHaveBeenCalled();
  });
  it("does not cache or disclose internal faults and rate-limits mutations", async () => {
    const query = new Request(
      `https://voyagewright.test/api/crossdeck/sync?voyage=voyage&surface=${crypto.randomUUID()}`,
    );
    expect((await GET(query)).headers.get("Cache-Control")).toBe("no-store, private");
    mocks.read.mockRejectedValue(new Error("secret-token"));
    expect(await (await GET(query)).text()).not.toContain("secret-token");
    mocks.rate.mockReturnValue({ allowed: false });
    expect((await POST(post(body()))).status).toBe(429);
  });
});
