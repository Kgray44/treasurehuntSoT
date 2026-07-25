import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  requireCanonicalAccountIdentity: vi.fn(),
  verifyPlayerCsrf: vi.fn(),
  findCompletedSessionForOwner: vi.fn(),
  createKeepsakeIfMissing: vi.fn(),
}));

vi.mock("@/platform/auth", () => dependencies);
vi.mock("@/community/keepsake-store", () => ({
  findCompletedSessionForOwner: dependencies.findCompletedSessionForOwner,
  databaseKeepsakeStore: {
    findCompletedSessionForOwner: dependencies.findCompletedSessionForOwner,
    createKeepsakeIfMissing: dependencies.createKeepsakeIfMissing,
  },
}));

import { POST } from "@/app/api/community/keepsakes/route";

describe("POST /api/community/keepsakes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.requireCanonicalAccountIdentity.mockResolvedValue({ accountId: "account-1", playerProfileId: "profile-1" });
    dependencies.verifyPlayerCsrf.mockResolvedValue(true);
    dependencies.findCompletedSessionForOwner.mockResolvedValue({
      id: "session-1",
      taleId: "tale-1",
      publishedVersionId: "version-1",
      status: "COMPLETED",
      completedAt: new Date("2026-07-25T12:00:00Z"),
      previewMode: false,
      taleTitle: "The Safe Harbor",
    });
    dependencies.createKeepsakeIfMissing.mockResolvedValue({
      created: true,
      keepsake: {
        id: "keepsake-1",
        ownerAccountId: "account-1",
        taleSessionId: "session-1",
        publishedVersionId: "version-1",
        safeSnapshot: JSON.stringify({ schemaVersion: 1, taleId: "tale-1", taleTitle: "The Safe Harbor", publishedVersionId: "version-1", completedAt: "2026-07-25T12:00:00.000Z" }),
        favoriteMoment: null,
        representationChecksum: "checksum",
        status: "READY",
        createdAt: new Date("2026-07-25T12:00:00Z"),
        updatedAt: new Date("2026-07-25T12:00:00Z"),
      },
    });
  });

  it("requires a canonical account before accepting a private-generation request", async () => {
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
        body: JSON.stringify({ taleSessionId: "session-1" }),
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "COMMUNITY_ACCESS_DENIED" });
  });

  it("rejects malformed or surplus input without exposing a validation detail", async () => {
    const response = await POST(
      new Request("http://localhost/api/community/keepsakes", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": "valid" },
        body: JSON.stringify({ taleSessionId: "session-1", taleTitle: "Client supplied text is forbidden" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "COMMUNITY_INVALID_KEEPSAKE",
      error: "The Voyage Keepsake request is invalid.",
    });
  });

  it("derives the title and completion eligibility server-side before generating once", async () => {
    const response = await POST(
      new Request("http://localhost/api/community/keepsakes", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": "valid" },
        body: JSON.stringify({ taleSessionId: "session-1" }),
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ state: "CREATED", keepsake: { id: "keepsake-1", taleTitle: "The Safe Harbor" } });
    expect(dependencies.findCompletedSessionForOwner).toHaveBeenCalledWith("session-1", "account-1");
    expect(dependencies.createKeepsakeIfMissing).toHaveBeenCalledWith(expect.objectContaining({ ownerAccountId: "account-1", taleSessionId: "session-1" }));
  });
});
