import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  context: vi.fn(),
  compare: vi.fn(),
  rate: vi.fn(),
  parse: vi.fn(),
  safeError: vi.fn(),
  unavailable: vi.fn(),
}));

vi.mock("@/wayfarer/http", () => ({ requireWayfarerAccount: mocks.session }));
vi.mock("@/tideglass/passage-service", () => ({
  loadTideglassPassageContext: mocks.context,
  compareTideglassPassage: mocks.compare,
}));
vi.mock("@/tideglass/http", () => ({
  enforceTideglassRateLimit: mocks.rate,
  parseBoundedTideglassJson: mocks.parse,
  tideglassSafeError: mocks.safeError,
  tideglassUnavailable: mocks.unavailable,
}));

const context = {
  chronicle: { id: "chronicle-synthetic", slug: "synthetic", title: "Synthetic Chronicle" },
  editions: [
    { id: "edition-a", label: "Edition A", publishedAt: "2026-08-01T00:00:00.000Z", availability: "HISTORICAL_ONLY" },
    { id: "edition-b", label: "Edition B", publishedAt: "2026-08-02T00:00:00.000Z", availability: "PLAYABLE" },
  ],
  recommendedEditionId: "edition-b",
  playedAnchors: [
    {
      recordId: "record-a",
      editionId: "edition-a",
      editionChecksum: "private-checksum",
      completedAt: "2026-08-01T00:00:00.000Z",
    },
  ],
  allowedEditionIds: ["edition-a", "edition-b"],
  audience: "PLAYER_SAFE" as const,
};

describe("Tideglass Phase 3 passage API", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.session.mockReset().mockResolvedValue({ account: { id: "account-owner", profile: { id: "profile-owner" } } });
    mocks.context.mockReset().mockResolvedValue(context);
    mocks.compare.mockReset().mockResolvedValue({
      kind: "COMPARISON",
      selection: { kind: "PAIR", sourceEditionId: "edition-a", targetEditionId: "edition-b", playedAnchor: null },
      projection: { audience: "PLAYER_SAFE", projectionStatus: "COMPLETE", changes: [] },
    });
    mocks.rate.mockReset().mockReturnValue({ ok: true, headers: { "x-rate-limit": "ok" } });
    mocks.parse.mockReset().mockImplementation((request: Request) => request.json());
    mocks.safeError
      .mockReset()
      .mockReturnValue(NextResponse.json({ code: "TIDEGLASS_INTERNAL_FAILURE" }, { status: 500 }));
    mocks.unavailable
      .mockReset()
      .mockReturnValue(NextResponse.json({ code: "TIDEGLASS_UNAVAILABLE" }, { status: 404 }));
  });

  it("returns a narrow server-derived context without checksums or internal authorization sets", async () => {
    const route = await import("../../src/app/api/tideglass/chronicles/[taleSlug]/route");
    const response = await route.GET(new Request("http://localhost/api/tideglass/chronicles/synthetic"), {
      params: Promise.resolve({ taleSlug: "synthetic" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      chronicle: context.chronicle,
      recommendation: { available: true, editionId: "edition-b" },
      playedAnchors: [{ recordId: "record-a", editionId: "edition-a" }],
    });
    expect(JSON.stringify(body)).not.toMatch(/private-checksum|allowedEditionIds|PLAYER_SAFE/u);
    expect(mocks.context).toHaveBeenCalledWith("synthetic", {
      accountId: "account-owner",
      playerProfileId: "profile-owner",
    });
  });

  it("derives the player audience on the server and rejects client authority fields", async () => {
    const route = await import("../../src/app/api/tideglass/chronicles/[taleSlug]/route");
    const accepted = await route.POST(
      new Request("http://localhost/api/tideglass/chronicles/synthetic", {
        method: "POST",
        body: JSON.stringify({ from: "edition-a", to: "edition-b", historyRecord: "record-a", mode: "DETAILED" }),
      }),
      { params: Promise.resolve({ taleSlug: "synthetic" }) },
    );
    expect(accepted.status).toBe(200);
    expect(mocks.compare).toHaveBeenCalledWith(context, {
      sourceEditionId: "edition-a",
      targetEditionId: "edition-b",
      historyRecordId: "record-a",
      mode: "DETAILED",
    });

    mocks.compare.mockClear();
    const escalated = await route.POST(
      new Request("http://localhost/api/tideglass/chronicles/synthetic", {
        method: "POST",
        body: JSON.stringify({ from: "edition-a", to: "edition-b", audience: "CREATOR_FULL" }),
      }),
      { params: Promise.resolve({ taleSlug: "synthetic" }) },
    );
    expect(escalated.status).toBe(400);
    expect(mocks.compare).not.toHaveBeenCalled();
  });

  it("does not enumerate a Chronicle when the server context declines access", async () => {
    mocks.context.mockResolvedValueOnce(null);
    const route = await import("../../src/app/api/tideglass/chronicles/[taleSlug]/route");
    const response = await route.GET(new Request("http://localhost/api/tideglass/chronicles/private"), {
      params: Promise.resolve({ taleSlug: "private" }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "TIDEGLASS_UNAVAILABLE" });
  });
});
