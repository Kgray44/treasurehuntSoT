import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  csrf: vi.fn(),
  list: vi.fn(),
  register: vi.fn(),
  request: vi.fn(),
  update: vi.fn(),
  withdraw: vi.fn(),
}));
vi.mock("@/lib/security", () => ({ requireGmCapability: mocks.session, verifyCsrf: mocks.csrf }));
vi.mock("@/private-content/media/service", () => ({
  listOwnerProtectedMedia: mocks.list,
  registerProtectedMedia: mocks.register,
  requestProtectedMediaDerivative: mocks.request,
  updateProtectedMediaAccessibilityDescription: mocks.update,
  withdrawProtectedMediaDerivative: mocks.withdraw,
}));

import { GET, POST } from "./route";

describe("protected media owner route", () => {
  it("does not disclose metadata or accept mutations without Creator authorization", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(403);
    expect((await POST(new Request("http://localhost/media", { method: "POST", body: "{}" }))).status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("requires CSRF and sends a server-derived owner to a derivative request", async () => {
    mocks.session.mockResolvedValue({ userId: "creator-id", accountId: "account-id", csrfToken: "csrf" });
    mocks.csrf.mockResolvedValueOnce(false);
    const request = () =>
      new Request("http://localhost/media", {
        method: "POST",
        body: JSON.stringify({
          action: "request-derivative",
          mediaId: "media",
          associationId: "association",
          purpose: "VOYAGE_LOG_COMMUNITY",
          audience: "PUBLIC",
          idempotencyKey: "request-key-0001",
          consentAssertionId: "consent-0001",
        }),
      });
    expect((await POST(request())).status).toBe(403);
    mocks.csrf.mockResolvedValueOnce(true);
    mocks.request.mockResolvedValueOnce({ operationId: "op", state: "QUEUED", reused: false });
    expect((await POST(request())).status).toBe(202);
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({ ownerAccountId: "account-id", mediaId: "media", consentAssertionId: "consent-0001" }),
    );
  });
});
