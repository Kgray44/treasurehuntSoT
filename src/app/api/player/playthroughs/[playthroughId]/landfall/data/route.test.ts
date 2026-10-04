import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { landfallFixture } from "@/landfall/fixtures";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), csrf: vi.fn(), chart: vi.fn(), rate: vi.fn(), execute: vi.fn() }));
vi.mock("@/platform/auth", () => ({ requirePlayerIdentity: mocks.identity, verifyPlayerCsrf: mocks.csrf }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.rate }));
vi.mock("../route", () => ({ GET: mocks.chart }));
vi.mock("@/landfall/remote-data-server", () => ({
  configuredRemoteServices: () => [],
  RemoteLandfallDataService: class {
    execute = mocks.execute;
    recipient(operation: string) {
      return operation === "STATUS" ? null : "geo.example.test";
    }
  },
}));
import { POST } from "./route";
const publicDefinition = structuredClone(landfallFixture);
publicDefinition.worldspaces[0].privacyPolicy.classification = "PUBLIC_REAL_WORLD";
const bootstrap = projectPlayerLandfallBootstrap(
  {
    sessionId: "synthetic-session",
    publishedVersionId: "synthetic-pin",
    taleId: "fixture",
    currentSequence: 4,
    definition: publicDefinition,
  },
  { releasedAssets: [], chapterId: null, blockId: null },
);
const context = { params: Promise.resolve({ playthroughId: "synthetic-session" }) };
const chart = (value = bootstrap) =>
  mocks.chart.mockImplementation(async () => Response.json({ available: true, bootstrap: value }));
const send = (body: unknown) =>
  POST(
    new Request("https://example.test/api/player/playthroughs/synthetic-session/landfall/data", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": "synthetic-csrf",
        "x-landfall-recipient": "geo.example.test",
      },
      body: JSON.stringify(body),
    }),
    context,
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.identity.mockResolvedValue({ playerProfileId: "synthetic-player" });
  mocks.csrf.mockResolvedValue(true);
  mocks.rate.mockReturnValue({ allowed: true });
  mocks.execute.mockResolvedValue({ state: "NOT_CONFIGURED", canComplete: false });
  chart();
});
afterEach(() => vi.useRealTimers());
describe("authorized optional online data route", () => {
  it("requires the reviewed recipient before sending any online query", async () => {
    const response = await POST(
      new Request("https://example.test/lookup", {
        method: "POST",
        headers: { "x-csrf-token": "synthetic-csrf", "x-landfall-recipient": "other.example.test" },
        body: JSON.stringify({ operation: "SEARCH", consent: true, query: "Synthetic Square", limit: 5 }),
      }),
      context,
    );
    expect(response.status).toBe(409);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("discards late results after the current objective or access changes", async () => {
    mocks.chart.mockResolvedValueOnce(Response.json({ available: true, bootstrap }));
    mocks.chart.mockResolvedValueOnce(
      Response.json({ available: true, bootstrap: { ...bootstrap, currentSequence: 5 } }),
    );
    expect((await send({ operation: "SEARCH", consent: true, query: "Synthetic Square", limit: 5 })).status).toBe(409);
    expect(mocks.execute).toHaveBeenCalledOnce();
    vi.clearAllMocks();
    chart();
    await send({ operation: "STATUS" });
    expect(mocks.chart).toHaveBeenCalledOnce();
  });
  it("requires identity, CSRF and current access before any provider operation", async () => {
    mocks.identity.mockResolvedValueOnce(null);
    expect((await send({ operation: "STATUS" })).status).toBe(401);
    mocks.csrf.mockResolvedValueOnce(false);
    expect((await send({ operation: "STATUS" })).status).toBe(403);
    expect(mocks.chart).not.toHaveBeenCalled();
    mocks.chart.mockResolvedValueOnce(Response.json({ error: "Not found" }, { status: 404 }));
    expect((await send({ operation: "STATUS" })).status).toBe(404);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("keeps output private, passes cancellation and never fabricates configured data", async () => {
    const response = await send({ operation: "SEARCH", consent: true, query: "Synthetic Square", limit: 5 });
    expect(await response.json()).toEqual({ state: "NOT_CONFIGURED", canComplete: false });
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(mocks.execute).toHaveBeenCalledWith(
      { operation: "SEARCH", consent: true, query: "Synthetic Square", limit: 5 },
      expect.any(AbortSignal),
    );
  });
  it("refuses historical, paused, wrong-session, unreleased or virtual objectives", async () => {
    for (const changed of [
      { ...bootstrap, paused: true },
      { ...bootstrap, replayOnly: true },
      { ...bootstrap, activeWaypointId: null },
      { ...bootstrap, sessionId: "other-session" },
      {
        ...bootstrap,
        runtimeDefinition: { ...bootstrap.runtimeDefinition, worldspaces: [landfallFixture.worldspaces[1]] },
      },
    ]) {
      chart(changed);
      expect((await send({ operation: "STATUS" })).status).toBe(409);
    }
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("never sends private or approximate Worldspace information to an online service", async () => {
    for (const classification of ["PRIVATE_REAL_WORLD", "APPROXIMATE_REAL_WORLD"] as const) {
      const value = structuredClone(bootstrap);
      value.runtimeDefinition.worldspaces[0].privacyPolicy.classification = classification;
      chart(value);
      expect((await send({ operation: "SEARCH", consent: true, query: "Synthetic Square", limit: 5 })).status).toBe(
        409,
      );
    }
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("rejects missing consent, scope/URL overrides, extra fields, oversized requests and local abuse", async () => {
    expect((await send({ operation: "SEARCH", consent: false, query: "Synthetic Square", limit: 5 })).status).toBe(400);
    expect(
      (
        await send({
          operation: "SEARCH",
          consent: true,
          query: "Synthetic Square",
          limit: 5,
          url: "https://127.0.0.1/private",
        })
      ).status,
    ).toBe(400);
    expect((await send({ operation: "STATUS", scope: { playerProfileId: "another-player" } })).status).toBe(400);
    expect((await send({ operation: "SEARCH", consent: true, query: "x".repeat(8193), limit: 5 })).status).toBe(413);
    mocks.rate.mockReturnValueOnce({ allowed: false });
    expect((await send({ operation: "STATUS" })).status).toBe(429);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("rejects valid-prefix stalled bodies and cancels the reader before external work", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"operation":"STATUS"}'));
      },
      cancel,
    });
    const init = {
      method: "POST",
      body,
      duplex: "half",
      headers: { "x-csrf-token": "synthetic-csrf" },
    };
    const response = POST(new Request("https://example.test", init), context);
    await vi.advanceTimersByTimeAsync(3001);
    expect((await response).status).toBe(400);
    expect(cancel).toHaveBeenCalledOnce();
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
