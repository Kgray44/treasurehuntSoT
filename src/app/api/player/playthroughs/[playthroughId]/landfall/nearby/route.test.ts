import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { landfallFixture } from "@/landfall/fixtures";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), csrf: vi.fn(), chart: vi.fn(), rate: vi.fn() }));
vi.mock("@/platform/auth", () => ({ requirePlayerIdentity: mocks.identity, verifyPlayerCsrf: mocks.csrf }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.rate }));
vi.mock("../route", () => ({ GET: mocks.chart }));
import { POST } from "./route";
const bootstrap = projectPlayerLandfallBootstrap(
  {
    sessionId: "session-1",
    publishedVersionId: "version-1",
    taleId: "fixture",
    currentSequence: 4,
    definition: landfallFixture,
  },
  { releasedAssets: [], chapterId: null, blockId: null },
);
const context = { params: Promise.resolve({ playthroughId: "session-1" }) };
const owner = { platform: "ANDROID", address: "AQI=", channel: 9, preamble: 9 },
  peer = { platform: "ANDROID", address: "AwQ=" };
let actor = 0;
const chart = (changed = bootstrap) =>
  mocks.chart.mockImplementation(async () => Response.json({ available: true, bootstrap: changed }));
const send = (body: unknown) =>
  POST(
    new Request("https://example.test/api/player/playthroughs/session-1/landfall/nearby", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": "synthetic-csrf" },
      body: JSON.stringify(body),
    }),
    context,
  );
beforeEach(() => {
  vi.clearAllMocks();
  actor++;
  mocks.identity.mockResolvedValue({ playerProfileId: `player-${actor}` });
  mocks.csrf.mockResolvedValue(true);
  mocks.rate.mockReturnValue({ allowed: true });
  chart();
  vi.stubEnv("LANDFALL_NEARBY_PAIRING_MODE", "ephemeral-instance");
});
afterEach(() => vi.unstubAllEnvs());
describe("authorized first-party companion route", () => {
  it("requires identity, CSRF and current Voyage access before creating private pairing state", async () => {
    mocks.identity.mockResolvedValueOnce(null);
    expect((await send({ operation: "CREATE", offer: owner })).status).toBe(401);
    mocks.csrf.mockResolvedValueOnce(false);
    expect((await send({ operation: "CREATE", offer: owner })).status).toBe(403);
    expect(mocks.chart).not.toHaveBeenCalled();
    mocks.chart.mockResolvedValueOnce(Response.json({ error: "Voyage not found." }, { status: 404 }));
    expect((await send({ operation: "CREATE", offer: owner })).status).toBe(404);
  });
  it("exchanges protected parameters through private responses and consumes a code once", async () => {
    const response = await send({ operation: "CREATE", offer: owner }),
      created = await response.json();
    expect(response.headers.get("cache-control")).toContain("private, no-store");
    expect(created.state).toBe("WAITING");
    expect(JSON.stringify(created)).not.toContain("sessionKey");
    const joined = await (await send({ operation: "JOIN", code: created.code, offer: peer })).json();
    const read = await (await send({ operation: "READ", handle: created.handle })).json();
    expect(joined).toMatchObject({ state: "READY", canComplete: false, peerVerified: false });
    expect(read.configuration.sessionKey).toBe(joined.configuration.sessionKey);
    expect(read.configuration.peerAddress).toBe(peer.address);
    expect((await send({ operation: "JOIN", code: created.code, offer: peer })).status).toBe(409);
    await send({ operation: "STOP", handle: joined.handle });
    expect((await send({ operation: "READ", handle: created.handle })).status).toBe(409);
  });
  it("reauthorizes scope on every read and refuses stale sequence, changed pin or another actor", async () => {
    const created = await (await send({ operation: "CREATE", offer: owner })).json();
    for (const changed of [
      { ...bootstrap, currentSequence: 5 },
      { ...bootstrap, publishedVersionId: "new-pin" },
      { ...bootstrap, activeWaypointId: "future" },
    ]) {
      chart(changed);
      expect((await send({ operation: "READ", handle: created.handle })).status).toBe(409);
    }
    chart();
    mocks.identity.mockResolvedValueOnce({ playerProfileId: "outsider" });
    expect((await send({ operation: "READ", handle: created.handle })).status).toBe(409);
    expect((await send({ operation: "READ", handle: created.handle })).status).toBe(200);
    await send({ operation: "STOP", handle: created.handle });
  });
  it("does not pair paused, historical, virtual, wrong-session or unreleased objectives", async () => {
    for (const changed of [
      { ...bootstrap, paused: true },
      { ...bootstrap, replayOnly: true },
      { ...bootstrap, activeWaypointId: null },
      { ...bootstrap, sessionId: "other" },
      {
        ...bootstrap,
        runtimeDefinition: { ...bootstrap.runtimeDefinition, worldspaces: [landfallFixture.worldspaces[1]] },
      },
    ]) {
      chart(changed);
      expect((await send({ operation: "CREATE", offer: owner })).status).toBe(409);
    }
  });
  it("requires explicit deployment opt-in and exposes no private parameter in its status probe", async () => {
    vi.stubEnv("LANDFALL_NEARBY_PAIRING_MODE", "");
    expect((await send({ operation: "STATUS" })).status).toBe(503);
    vi.stubEnv("LANDFALL_NEARBY_PAIRING_MODE", "ephemeral-instance");
    expect(await (await send({ operation: "STATUS" })).json()).toEqual({
      available: true,
      state: "CONFIGURED",
      peerVerified: false,
      canComplete: false,
    });
  });
  it("bounds request bytes, refuses extra authority fields and enforces rate limits", async () => {
    const oversized = await send({ operation: "STATUS", secret: "x".repeat(8193) });
    expect(oversized.status).toBe(413);
    expect((await send({ operation: "CREATE", offer: owner, scope: { playerProfileId: "other" } })).status).toBe(400);
    mocks.rate.mockReturnValueOnce({ allowed: false });
    expect((await send({ operation: "STATUS" })).status).toBe(429);
  });
  it("rejects a valid JSON prefix if a body never finishes and cancels its owned reader", async () => {
    vi.useFakeTimers();
    try {
      const cancel = vi.fn();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"operation":"STATUS"}'));
        },
        cancel,
      });
      const init = { method: "POST", body, duplex: "half", headers: { "x-csrf-token": "synthetic-csrf" } };
      const response = POST(new Request("https://example.test", init), context);
      await vi.advanceTimersByTimeAsync(3001);
      expect((await response).status).toBe(400);
      expect(cancel).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});
