import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  requireCanonicalAccountIdentity: vi.fn(),
  verifyPlayerCsrf: vi.fn(),
}));

vi.mock("@/platform/auth", () => dependencies);

import { POST } from "@/app/api/community/keepsakes/route";

describe("POST /api/community/keepsakes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.requireCanonicalAccountIdentity.mockResolvedValue({ accountId: "account-1", playerProfileId: "profile-1" });
    dependencies.verifyPlayerCsrf.mockResolvedValue(true);
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

  it("does not claim a generated Keepsake until a migration-backed atomic store is wired", async () => {
    const response = await POST(
      new Request("http://localhost/api/community/keepsakes", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": "valid" },
        body: JSON.stringify({ taleSessionId: "session-1" }),
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: "COMMUNITY_KEEPSAKE_STORE_UNAVAILABLE",
      error: "Voyage Keepsake generation is not available until its secure storage service is configured.",
    });
  });
});
