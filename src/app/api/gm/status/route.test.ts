import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  requireGm: vi.fn(),
  requireGmCapability: vi.fn(),
  campaign: { findFirstOrThrow: vi.fn() },
  buildPublicSnapshot: vi.fn(),
}));

vi.mock("@/lib/security", () => ({
  requireGm: dependencies.requireGm,
  requireGmCapability: dependencies.requireGmCapability,
}));
vi.mock("@/lib/db", () => ({ db: { campaign: dependencies.campaign } }));
vi.mock("@/lib/snapshot", () => ({ buildPublicSnapshot: dependencies.buildPublicSnapshot }));

import { GET } from "./route";

describe("GET /api/gm/status captain boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireGm.mockResolvedValue(null);
    dependencies.requireGmCapability.mockResolvedValue({ userId: "captain-1", csrfToken: "csrf-captain" });
    dependencies.campaign.findFirstOrThrow.mockResolvedValue({
      id: "campaign-1",
      slug: "test-voyage",
      title: "Test Voyage",
      status: "ACTIVE",
      currentSequence: 4,
      createdAt: new Date("2026-07-18T12:00:00.000Z"),
      updatedAt: new Date("2026-07-18T12:00:00.000Z"),
      chapters: [
        {
          id: "chapter-1",
          ordinal: 1,
          state: "ACTIVE",
          content: { title: "Chapter", objective: "Objective", developmentOnly: true },
          hints: [],
          revealedAt: null,
          solvedAt: null,
        },
      ],
      events: [],
      artifacts: [],
      mapLocations: [],
      sideQuests: [],
      playerAccesses: [],
      playerPresences: [],
      preparedActions: [],
      auditLogs: [],
      saveStates: [],
      journalEntries: [],
    });
    dependencies.buildPublicSnapshot.mockResolvedValue({ sequence: 4, chapter: { state: "ACTIVE" } });
  });

  it("returns 401 when no authenticated staff session exists", async () => {
    dependencies.requireGmCapability.mockResolvedValueOnce(null);
    dependencies.requireGm.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHENTICATED" });
    expect(dependencies.campaign.findFirstOrThrow).not.toHaveBeenCalled();
  });

  it("returns 403 to authenticated non-captain staff", async () => {
    dependencies.requireGmCapability.mockResolvedValueOnce(null);
    dependencies.requireGm.mockResolvedValueOnce({ userId: "creator-1", user: { role: "CREATOR" } });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Captain access is required to continue.", code: "FORBIDDEN" });
    expect(dependencies.campaign.findFirstOrThrow).not.toHaveBeenCalled();
  });

  it("returns status only for a captain-capable session", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(dependencies.requireGmCapability).toHaveBeenCalledWith("CAPTAIN");
    expect(body).toMatchObject({
      csrfToken: "csrf-captain",
      campaign: { slug: "test-voyage", sequence: 4 },
    });
  });
});
