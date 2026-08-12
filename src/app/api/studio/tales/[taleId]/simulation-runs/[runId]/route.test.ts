import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorization: vi.fn(), get: vi.fn(), cancel: vi.fn() }));
vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.authorization }));
vi.mock("@/chronicle/api", () => ({ apiError: () => new Response(null, { status: 400 }) }));
vi.mock("@/drydock/simulation-store", () => ({
  DrydockSimulationUnavailableError: class DrydockSimulationUnavailableError extends Error {},
  getDrydockSimulationRun: mocks.get,
  requestDrydockSimulationCancellation: mocks.cancel,
}));

import { DELETE, GET } from "./route";

const context = { params: Promise.resolve({ taleId: "tale", runId: "run" }) };

describe("Drydock simulation receipt route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorization.mockResolvedValue({});
  });

  it("hides receipts and cancellation from a non-owning Creator", async () => {
    mocks.authorization.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/run"), context)).status).toBe(404);
    expect((await DELETE(new Request("http://localhost/run", { method: "DELETE" }), context)).status).toBe(404);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });

  it("returns a safe receipt projection and requests owned cancellation idempotently", async () => {
    mocks.get.mockResolvedValueOnce({ summary: { runId: "run" }, result: { status: "COMPLETED" }, trace: [] });
    mocks.cancel.mockResolvedValueOnce(true);
    const receipt = await GET(new Request("http://localhost/run"), context);
    const cancellation = await DELETE(new Request("http://localhost/run", { method: "DELETE" }), context);

    expect(receipt.status).toBe(200);
    expect(JSON.stringify(await receipt.json())).not.toContain("sourceSnapshot");
    expect(cancellation.status).toBe(202);
    expect(mocks.cancel).toHaveBeenCalledWith("tale", "run");
  });
});
