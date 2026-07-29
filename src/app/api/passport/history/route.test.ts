import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireWayfarerAccount, materializeChronicleHistory, listChronicleHistory } = vi.hoisted(() => ({
  requireWayfarerAccount: vi.fn(),
  materializeChronicleHistory: vi.fn(),
  listChronicleHistory: vi.fn(),
}));

vi.mock("@/wayfarer/http", () => ({ requireWayfarerAccount }));
vi.mock("@/wayfarer/chronicle-history", () => ({ materializeChronicleHistory, listChronicleHistory }));

import { GET, POST } from "./route";

describe("GET and POST /api/passport/history", () => {
  beforeEach(() => {
    requireWayfarerAccount.mockReset();
    materializeChronicleHistory.mockReset();
    listChronicleHistory.mockReset();
  });

  it("does not disclose history when a profile session is absent", async () => {
    requireWayfarerAccount.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/passport/history"));

    expect(response.status).toBe(401);
    expect(materializeChronicleHistory).not.toHaveBeenCalled();
    expect(listChronicleHistory).not.toHaveBeenCalled();
  });

  it("materializes and returns only the authenticated profile's filtered history", async () => {
    requireWayfarerAccount.mockResolvedValue({ account: { profile: { id: "profile-owner" } } });
    materializeChronicleHistory.mockResolvedValue({ recordsCreated: 1 });
    listChronicleHistory.mockResolvedValue({ items: [{ id: "record-1" }], invitations: [], nextCursor: null });

    const response = await GET(
      new Request("http://localhost/api/passport/history?limit=2&status=COMPLETED&search=harbor"),
    );

    expect(response.status).toBe(200);
    expect(materializeChronicleHistory).toHaveBeenCalledWith("profile-owner");
    expect(listChronicleHistory).toHaveBeenCalledWith("profile-owner", {
      cursor: undefined,
      limit: 2,
      status: "COMPLETED",
      search: "harbor",
    });
    await expect(response.json()).resolves.toEqual({ items: [{ id: "record-1" }], invitations: [], nextCursor: null });
  });

  it("rejects an explicit reconciliation request without an authenticated profile", async () => {
    requireWayfarerAccount.mockResolvedValue({ account: { profile: null } });

    const response = await POST(new Request("http://localhost/api/passport/history", { method: "POST" }));

    expect(response.status).toBe(403);
    expect(materializeChronicleHistory).not.toHaveBeenCalled();
  });
});
