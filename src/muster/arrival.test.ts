import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn(), access: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { playerProfile: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } } }));
vi.mock("./service", () => ({
  loadMusterAccess: mocks.access,
  MusterError: class extends Error {
    constructor(
      message: string,
      readonly status = 400,
    ) {
      super(message);
    }
  },
}));
import { arrivalFor, recordArrival } from "./arrival";
const actor = { accountId: "synthetic-account", legacyGameMasterId: null };
describe("Embarkation canonical presentation receipts", () => {
  beforeEach(() => vi.resetAllMocks());
  it("preserves concurrently updated Journal state through a failed compare-and-swap", async () => {
    mocks.findUnique
      .mockResolvedValueOnce({ id: "p", preferences: JSON.stringify({ journals: { v: { page: 1 } } }) })
      .mockResolvedValueOnce({
        id: "p",
        preferences: JSON.stringify({ journals: { v: { page: 2 } }, retained: "value" }),
      });
    mocks.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    await recordArrival("v", actor);
    expect(mocks.access).toHaveBeenCalledWith("v", actor, expect.anything(), true);
    const saved = JSON.parse(mocks.updateMany.mock.calls[1][0].data.preferences);
    expect(saved.journals.v.page).toBe(2);
    expect(saved.retained).toBe("value");
    expect(saved.arrivals.v.presentedAt).toEqual(expect.any(String));
  });
  it("is idempotent and never mutates a seen person's presentation receipt", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "p",
      preferences: JSON.stringify({ arrivals: { v: { presentedAt: "2026-01-01" } } }),
    });
    await recordArrival("v", actor);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("keeps guest names out of the registered welcome and scopes seen state per Voyage", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "p",
      displayName: "Temporary guest",
      claimedAt: null,
      preferences: JSON.stringify({ arrivals: { different: { presentedAt: "2026-01-01" } } }),
    });
    const result = await arrivalFor("v", actor);
    expect(result.person.registered).toBe(false);
    expect(result.seen).toBe(false);
  });
  it("does not write a receipt after access is revoked", async () => {
    mocks.access.mockRejectedValue(new Error("revoked"));
    await expect(recordArrival("v", actor)).rejects.toThrow("revoked");
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
