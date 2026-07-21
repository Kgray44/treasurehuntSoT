import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  requireGm: vi.fn(),
  requireGmCapability: vi.fn(),
  resolveFirstMigratedLegacyCampaign: vi.fn(),
  getTaleSessionState: vi.fn(),
  platformAuditEvent: { findMany: vi.fn() },
}));

vi.mock("@/lib/security", () => ({
  requireGm: dependencies.requireGm,
  requireGmCapability: dependencies.requireGmCapability,
}));
vi.mock("@/compatibility/legacy-companion", () => ({
  resolveFirstMigratedLegacyCampaign: dependencies.resolveFirstMigratedLegacyCampaign,
}));
vi.mock("@/chronicle/progression", () => ({ getTaleSessionState: dependencies.getTaleSessionState }));
vi.mock("@/lib/db", () => ({ db: { platformAuditEvent: dependencies.platformAuditEvent } }));

import { GET } from "./route";

describe("GET /api/gm/status captain boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireGm.mockResolvedValue(null);
    dependencies.requireGmCapability.mockResolvedValue({ userId: "captain-1", csrfToken: "csrf-captain" });
    dependencies.resolveFirstMigratedLegacyCampaign.mockResolvedValue({
      campaignSlug: "test-voyage",
      sessionId: "session-1",
    });
    dependencies.getTaleSessionState.mockResolvedValue({
      tale: { title: "Test Chronicle" },
      session: {
        status: "ACTIVE",
        currentSequence: 4,
        startedAt: null,
        updatedAt: new Date("2026-07-18T12:00:00.000Z"),
      },
      chapter: { orderIndex: 1, title: "Chapter" },
      chapters: [],
      events: [],
      inventory: [],
    });
    dependencies.platformAuditEvent.findMany.mockResolvedValue([]);
  });

  it("returns 401 when no authenticated staff session exists", async () => {
    dependencies.requireGmCapability.mockResolvedValueOnce(null);
    dependencies.requireGm.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHENTICATED" });
    expect(dependencies.resolveFirstMigratedLegacyCampaign).not.toHaveBeenCalled();
  });

  it("returns 403 to authenticated non-captain staff", async () => {
    dependencies.requireGmCapability.mockResolvedValueOnce(null);
    dependencies.requireGm.mockResolvedValueOnce({ userId: "creator-1", user: { role: "CREATOR" } });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Captain access is required to continue.", code: "FORBIDDEN" });
    expect(dependencies.resolveFirstMigratedLegacyCampaign).not.toHaveBeenCalled();
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
