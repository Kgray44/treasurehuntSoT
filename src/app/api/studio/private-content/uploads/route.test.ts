import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), csrf: vi.fn(), initiate: vi.fn() }));
vi.mock("@/lib/security", () => ({ requireGmCapability: mocks.session, verifyCsrf: mocks.csrf }));
vi.mock("@/private-content/uploads", () => ({ initiatePrivateUpload: mocks.initiate }));

import { POST } from "./route";

describe("private upload initiation route", () => {
  it("denies an anonymous request before reading package metadata", async () => {
    mocks.session.mockResolvedValue(null);
    const response = await POST(
      new Request("http://localhost/api/studio/private-content/uploads", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: "request-identity-0001" }),
      }),
    );
    expect(response.status).toBe(403);
    expect(mocks.initiate).not.toHaveBeenCalled();
  });

  it("denies CSRF failure and only initiates a Creator-authorized request", async () => {
    mocks.session.mockResolvedValue({ userId: "creator-a" });
    mocks.csrf.mockResolvedValueOnce(false);
    const request = () =>
      new Request("http://localhost/api/studio/private-content/uploads", {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: "request-identity-0002", expectedBytes: 16 }),
      });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.initiate).not.toHaveBeenCalled();
    mocks.csrf.mockResolvedValueOnce(true);
    mocks.initiate.mockResolvedValueOnce({ uploadId: "upload-a", operationId: "operation-a", reused: false });
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.initiate).toHaveBeenLastCalledWith(
      expect.objectContaining({ actorId: "creator-a", idempotencyKey: "request-identity-0002" }),
    );
  });
});
