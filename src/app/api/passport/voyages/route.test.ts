import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWayfarerAccount, materializeChronicleHistory, queryJourneyArchive } = vi.hoisted(() => ({
  requireWayfarerAccount: vi.fn(),
  materializeChronicleHistory: vi.fn(),
  queryJourneyArchive: vi.fn(),
}));

vi.mock("@/wayfarer/http", () => ({ requireWayfarerAccount }));
vi.mock("@/wayfarer/chronicle-history", () => ({ materializeChronicleHistory }));
vi.mock("@/wakebook/archive-query", () => ({ queryJourneyArchive }));

import { GET } from "./route";
import { encodeArchiveCursor } from "@/wakebook/presentation";

describe("GET /api/passport/voyages", () => {
  beforeEach(() => {
    requireWayfarerAccount.mockReset();
    materializeChronicleHistory.mockReset();
    queryJourneyArchive.mockReset();
  });

  it("does not disclose archive data without a profile session", async () => {
    requireWayfarerAccount.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/passport/voyages"));

    expect(response.status).toBe(401);
    expect(materializeChronicleHistory).not.toHaveBeenCalled();
    expect(queryJourneyArchive).not.toHaveBeenCalled();
  });

  it("passes strict filters and the authenticated owner to the bounded archive query", async () => {
    requireWayfarerAccount.mockResolvedValue({ account: { profile: { id: "profile-owner" } } });
    const projection = {
      membershipsExamined: 4,
      recordsCreated: 1,
      recordsUpdated: 2,
      projectionFailures: 0,
    };
    materializeChronicleHistory.mockResolvedValue(projection);
    queryJourneyArchive.mockResolvedValue({ groups: [], invitations: [], resultCount: 0, pageCount: 0 });

    const response = await GET(
      new Request(
        "http://localhost/api/passport/voyages?limit=24&search=Harbor&status=COMPLETED&year=2026&role=CAPTAIN&hasMemories=true&hasKeepsake=false&hasArtifacts=true&sort=OLDEST",
      ),
    );

    expect(response.status).toBe(200);
    expect(queryJourneyArchive).toHaveBeenCalledWith(
      "profile-owner",
      {
        limit: 24,
        search: "Harbor",
        status: "COMPLETED",
        year: 2026,
        role: "CAPTAIN",
        hasMemories: true,
        hasKeepsake: false,
        hasArtifacts: true,
        sort: "OLDEST",
      },
      projection,
    );
  });

  it("rejects malformed filters before materialization", async () => {
    requireWayfarerAccount.mockResolvedValue({ account: { profile: { id: "profile-owner" } } });

    const response = await GET(new Request("http://localhost/api/passport/voyages?limit=1000&unknown=true"));

    expect(response.status).toBe(400);
    expect(materializeChronicleHistory).not.toHaveBeenCalled();
    expect(queryJourneyArchive).not.toHaveBeenCalled();
  });

  it("does not repeat Wayfarer materialization on an opaque cursor continuation", async () => {
    requireWayfarerAccount.mockResolvedValue({ account: { profile: { id: "profile-owner" } } });
    queryJourneyArchive.mockResolvedValue({ groups: [], invitations: [], resultCount: 48, pageCount: 24 });
    const cursor = encodeArchiveCursor({
      v: 1,
      sort: "NEWEST",
      date: "2026-01-01T00:00:00.000Z",
      id: "record-24",
    });

    const response = await GET(
      new Request(`http://localhost/api/passport/voyages?limit=24&cursor=${encodeURIComponent(cursor)}`),
    );

    expect(response.status).toBe(200);
    expect(materializeChronicleHistory).not.toHaveBeenCalled();
    expect(queryJourneyArchive).toHaveBeenCalledWith(
      "profile-owner",
      expect.objectContaining({ cursor, limit: 24, sort: "NEWEST" }),
      { membershipsExamined: 0, recordsCreated: 0, recordsUpdated: 0, projectionFailures: 0 },
    );
  });

  it("preserves readable accepted history when supplementary materialization fails", async () => {
    requireWayfarerAccount.mockResolvedValue({ account: { profile: { id: "profile-owner" } } });
    materializeChronicleHistory.mockRejectedValue(new Error("projection unavailable"));
    queryJourneyArchive.mockResolvedValue({ groups: [], warnings: ["partial"] });

    const response = await GET(new Request("http://localhost/api/passport/voyages"));

    expect(response.status).toBe(200);
    expect(queryJourneyArchive).toHaveBeenCalledWith(
      "profile-owner",
      expect.objectContaining({ limit: 12, sort: "NEWEST" }),
      { membershipsExamined: 0, recordsCreated: 0, recordsUpdated: 0, projectionFailures: 1 },
    );
  });
});
