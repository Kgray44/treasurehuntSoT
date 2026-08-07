import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAccount: vi.fn(),
  scheduleDeletion: vi.fn(),
  clearCookies: vi.fn(),
}));

vi.mock("@/wayfarer/http", () => ({
  requireWayfarerAccount: mocks.requireAccount,
  clearProductIdentityCookies: mocks.clearCookies,
}));
vi.mock("@/wayfarer/account-lifecycle", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wayfarer/account-lifecycle")>()),
  scheduleAccountDeletion: mocks.scheduleDeletion,
}));

import { POST } from "./route";

describe("POST /api/account/data/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAccount.mockResolvedValue({ accountId: "account-1" });
    mocks.scheduleDeletion.mockResolvedValue({ id: "deletion-1", state: "SCHEDULED" });
    mocks.clearCookies.mockResolvedValue(undefined);
  });

  it("homeport.owner-correction.round1.deletion-api binds authorization to the canonical session and clears it", async () => {
    const request = new Request("http://localhost/api/account/data/delete", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": "csrf-1" },
      body: JSON.stringify({ password: "synthetic-password", confirmation: "DELETE ACCOUNT" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mocks.requireAccount).toHaveBeenCalledWith(request);
    expect(mocks.scheduleDeletion).toHaveBeenCalledWith("account-1", "synthetic-password", "DELETE ACCOUNT");
    expect(mocks.clearCookies).toHaveBeenCalledOnce();
  });

  it("denies a request rejected by the canonical session/CSRF boundary before parsing or mutation", async () => {
    mocks.requireAccount.mockResolvedValue(null);
    const request = new Request("http://localhost/api/account/data/delete", { method: "POST" });
    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(mocks.scheduleDeletion).not.toHaveBeenCalled();
    expect(mocks.clearCookies).not.toHaveBeenCalled();
  });

  it("requires the exact typed confirmation", async () => {
    const request = new Request("http://localhost/api/account/data/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "synthetic-password", confirmation: "DELETE" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mocks.scheduleDeletion).not.toHaveBeenCalled();
  });
});
