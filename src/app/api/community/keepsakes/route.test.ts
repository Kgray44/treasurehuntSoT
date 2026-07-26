import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  requireCanonicalAccountIdentity: vi.fn(),
  verifyPlayerCsrf: vi.fn(),
  createVoyageLogDraftFromWayfarer: vi.fn(),
  ensureVoyageLogDraft: vi.fn(),
  databaseKeepsakeStore: { createIfMissing: vi.fn() },
}));

vi.mock("@/platform/auth", () => dependencies);
vi.mock("@/community/keepsake-store", () => ({ databaseKeepsakeStore: dependencies.databaseKeepsakeStore }));
vi.mock("@/community/wayfarer-keepsake-source", () => ({
  unavailableWayfarerKeepsakeSource: {
    getEligiblePrivateKeepsake: vi.fn(),
    getPublicSharingCandidates: vi.fn(),
    verifySourceWatermark: vi.fn(),
  },
  createVoyageLogDraftFromWayfarer: dependencies.createVoyageLogDraftFromWayfarer,
}));
vi.mock("@/community/voyage-log-owner", () => ({ ensureVoyageLogDraft: dependencies.ensureVoyageLogDraft }));

import { POST } from "@/app/api/community/keepsakes/route";

describe("POST /api/community/keepsakes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.requireCanonicalAccountIdentity.mockResolvedValue({
      accountId: "account-1",
      playerProfileId: "profile-1",
    });
    dependencies.verifyPlayerCsrf.mockResolvedValue(true);
    dependencies.createVoyageLogDraftFromWayfarer.mockResolvedValue({
      created: true,
      record: { id: "preparation-1", preparationState: "DRAFT_CREATED" },
    });
    dependencies.ensureVoyageLogDraft.mockResolvedValue({ id: "voyage-log-1", lifecycleState: "DRAFT" });
  });

  it("requires a canonical account before accepting public-sharing preparation", async () => {
    dependencies.requireCanonicalAccountIdentity.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/community/keepsakes", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "COMMUNITY_ACCESS_DENIED" });
    expect(dependencies.verifyPlayerCsrf).not.toHaveBeenCalled();
  });

  it("requires a valid CSRF token after identity resolution", async () => {
    dependencies.verifyPlayerCsrf.mockResolvedValue(false);
    const response = await POST(
      new Request("http://localhost/api/community/keepsakes", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": "expired" },
        body: JSON.stringify({ wayfarerKeepsakeId: "wayfarer-keepsake-1" }),
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "COMMUNITY_ACCESS_DENIED" });
  });

  it("rejects malformed or surplus input without exposing source validation detail", async () => {
    const response = await POST(
      new Request("http://localhost/api/community/keepsakes", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": "valid" },
        body: JSON.stringify({ wayfarerKeepsakeId: "source-1", taleSessionId: "forged-session" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "COMMUNITY_INVALID_KEEPSAKE_SOURCE",
      error: "The Wayfarer Keepsake request is invalid.",
    });
  });

  it("creates a private no-store Voyage Log draft through the Wayfarer port", async () => {
    const response = await POST(
      new Request("http://localhost/api/community/keepsakes", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": "valid" },
        body: JSON.stringify({ wayfarerKeepsakeId: "wayfarer-keepsake-1" }),
      }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      state: "DRAFT_CREATED",
      voyageLogDraft: { id: "voyage-log-1", state: "DRAFT" },
    });
    expect(dependencies.createVoyageLogDraftFromWayfarer).toHaveBeenCalledWith(
      expect.anything(),
      dependencies.databaseKeepsakeStore,
      { ownerAccountId: "account-1", sourceKeepsakeId: "wayfarer-keepsake-1" },
    );
    expect(dependencies.ensureVoyageLogDraft).toHaveBeenCalledWith({
      ownerAccountId: "account-1",
      keepsakeId: "preparation-1",
    });
  });
});
