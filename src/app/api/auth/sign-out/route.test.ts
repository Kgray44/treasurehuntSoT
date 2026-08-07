import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  requireAccount: vi.fn(),
  revoke: vi.fn(),
  clear: vi.fn(),
}));

vi.mock("@/wayfarer/accounts", () => ({ revokeAccountSession: mocks.revoke }));
vi.mock("@/wayfarer/http", () => ({
  requireWayfarerAccount: mocks.requireAccount,
  clearProductIdentityCookies: mocks.clear,
}));

describe("POST /api/auth/sign-out", () => {
  beforeEach(() => {
    mocks.requireAccount.mockReset().mockResolvedValue({ accountId: "account-1", id: "session-1" });
    mocks.revoke.mockReset().mockResolvedValue(undefined);
    mocks.clear.mockReset().mockResolvedValue(undefined);
  });

  it("homeport.signout.compatibility revokes canonical state and clears identity adapters", async () => {
    const response = await POST(new Request("http://localhost/api/auth/sign-out", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(mocks.revoke).toHaveBeenCalledWith("account-1", "session-1");
    expect(mocks.clear).toHaveBeenCalledOnce();
  });
});
