import { beforeEach, describe, expect, it, vi } from "vitest";
import { landfallFixture } from "@/landfall/fixtures";

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  member: vi.fn(),
  state: vi.fn(),
  pinned: vi.fn(),
  events: vi.fn(),
  receipt: vi.fn(),
}));
vi.mock("@/platform/auth", () => ({ requirePlayerIdentity: mocks.identity, playerCanAccessPlaythrough: mocks.member }));
vi.mock("@/chronicle/progression", () => ({ getTaleSessionState: mocks.state }));
vi.mock("@/landfall/published", () => ({ loadPinnedLandfallDefinition: mocks.pinned }));
vi.mock("@/lib/db", () => ({ db: { taleSessionEvent: { findMany: mocks.events, findUnique: mocks.receipt } } }));

import { GET } from "./route";

const context = { params: Promise.resolve({ playthroughId: "session-1" }) };

describe("Player Landfall bootstrap route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.identity.mockResolvedValue({ playerProfileId: "player-1" });
    mocks.member.mockResolvedValue(true);
    mocks.state.mockResolvedValue({
      session: { status: "ACTIVE", versionId: "version-1" },
      chapter: null,
      block: null,
      assets: [],
    });
    mocks.pinned.mockResolvedValue({
      sessionId: "session-1",
      taleId: "fixture-tale",
      publishedVersionId: "version-1",
      currentSequence: 4,
      definition: landfallFixture,
    });
    mocks.events.mockResolvedValue([]);
    mocks.receipt.mockResolvedValue(null);
  });

  it("blocks missing identity and membership before reading published geometry", async () => {
    mocks.identity.mockResolvedValueOnce(null);
    const anonymous = await GET(new Request("https://example.test"), context);
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers.get("cache-control")).toContain("no-store");
    mocks.member.mockResolvedValueOnce(false);
    const outsider = await GET(new Request("https://example.test"), context);
    expect(outsider.status).toBe(404);
    expect(mocks.pinned).not.toHaveBeenCalled();
  });

  it("uses only the authorized pinned snapshot and no-store response", async () => {
    const response = await GET(new Request("https://example.test"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.member).toHaveBeenCalledWith("session-1", "player-1");
    const body = await response.json();
    expect(body.available).toBe(true);
    expect(body.bootstrap.scene.features.map((item: { id: string }) => item.id)).toEqual([
      "town-arrival",
      "town-route",
    ]);
    expect(JSON.stringify(body)).not.toContain("isle-region");
  });

  it("withholds the chart when paused or the pinned version changes", async () => {
    mocks.state.mockResolvedValueOnce({ session: { status: "PAUSED", versionId: "version-1" } });
    expect(await (await GET(new Request("https://example.test"), context)).json()).toEqual({ available: false });
    mocks.pinned.mockResolvedValueOnce({
      sessionId: "session-1",
      taleId: "fixture-tale",
      publishedVersionId: "other-version",
      currentSequence: 4,
      definition: landfallFixture,
    });
    expect((await GET(new Request("https://example.test"), context)).status).toBe(409);
  });

  it("fails closed without exposing malformed pinned content", async () => {
    mocks.pinned.mockRejectedValueOnce(new Error("private snapshot details"));
    const response = await GET(new Request("https://example.test"), context);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toContain("private snapshot details");
  });
  it("returns only the current member's actor-bound recorded evidence and withholds another actor or pin", async () => {
    const payload = {
      actorProfileId: "player-1",
      publishedVersionId: "version-1",
      evidenceId: "fix",
      worldspaceId: "town",
      waypointId: "town-arrival",
    };
    const event = { sessionId: "session-1", eventType: "landfallWaypointConfirmed", payload: JSON.stringify(payload) };
    const request = () => new Request("https://example.test?receiptEvidenceId=fix");
    mocks.receipt.mockResolvedValueOnce(event);
    expect((await (await GET(request(), context)).json()).recordedEvidence).toEqual({
      evidenceId: "fix",
      worldspaceId: "town",
      waypointId: "town-arrival",
    });
    for (const change of [{ actorProfileId: "other" }, { publishedVersionId: "other" }]) {
      mocks.receipt.mockResolvedValueOnce({ ...event, payload: JSON.stringify({ ...payload, ...change }) });
      expect((await (await GET(request(), context)).json()).recordedEvidence).toBeNull();
    }
    mocks.member.mockResolvedValueOnce(false);
    const before = mocks.receipt.mock.calls.length;
    expect((await GET(request(), context)).status).toBe(404);
    expect(mocks.receipt).toHaveBeenCalledTimes(before);
  });
});
