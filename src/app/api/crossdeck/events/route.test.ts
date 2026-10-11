// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase2.continuity
import { beforeEach, describe, it, expect, vi } from "vitest";
import { CrossdeckError } from "@/crossdeck/contracts";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), connect: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/wayfarer/http", () => ({ requireWayfarerAccount: mocks.auth }));
vi.mock("@/crossdeck/realtime-server", () => ({ crossdeckRealtimeServer: () => ({ connect: mocks.connect }) }));
import { GET } from "./route";
const request = (extra = "", headers: HeadersInit = {}) =>
  new Request(
    `https://voyagewright.test/api/crossdeck/events?voyage=synthetic&surface=11111111-1111-4111-8111-111111111111${extra}`,
    { headers },
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: "session", accountId: "account" });
  mocks.connect.mockImplementation(
    async () =>
      new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
  );
});
describe("private same-origin event API", () => {
  it("requires canonical account authority and rejects foreign origins, query tokens and invalid scope", async () => {
    mocks.auth.mockResolvedValueOnce(null);
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("", { origin: "https://another.test" }))).status).toBe(403);
    expect((await GET(request("", { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect((await GET(request("&token=synthetic-token"))).status).toBe(400);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it("streams uncacheable metadata with buffering disabled and no cross-origin permission", async () => {
    const response = await GET(request("", { origin: "https://voyagewright.test", "sec-fetch-site": "same-origin" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(mocks.connect).toHaveBeenCalledWith(
      { id: "session", accountId: "account" },
      "synthetic",
      expect.any(String),
      expect.any(AbortSignal),
    );
  });
  it("preserves denial status without exposing session/resource/internal error data", async () => {
    mocks.connect.mockRejectedValueOnce(new CrossdeckError(403, "secret membership"));
    const denied = await GET(request());
    expect(denied.status).toBe(403);
    expect(await denied.text()).not.toContain("secret");
    mocks.connect.mockRejectedValueOnce(new Error("private database endpoint"));
    const unavailable = await GET(request());
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain("database");
  });
});
