import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorization: vi.fn(), studio: vi.fn(), snapshot: vi.fn(), list: vi.fn(), schedule: vi.fn(), execute: vi.fn() }));
vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.authorization }));
vi.mock("@/chronicle/studio-service", () => ({ getStudioTale: mocks.studio }));
vi.mock("@/chronicle/publishing", () => ({ snapshotFromStudio: mocks.snapshot }));
vi.mock("@/chronicle/api", () => ({ apiError: () => new Response(null, { status: 400 }) }));
vi.mock("@/drydock/simulation-store", () => ({
  DrydockSimulationSourceChangedError: class DrydockSimulationSourceChangedError extends Error {},
  DrydockSimulationUnavailableError: class DrydockSimulationUnavailableError extends Error {},
  listDrydockSimulationRuns: mocks.list,
  scheduleDrydockSimulation: mocks.schedule,
  executeDrydockSimulationRun: mocks.execute,
}));

import { GET, POST } from "./route";

const context = { params: Promise.resolve({ taleId: "tale", scenarioId: "scenario" }) };

describe("Drydock simulation run route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorization.mockResolvedValue({});
    mocks.studio.mockResolvedValue({});
    mocks.snapshot.mockReturnValue({ source: "server-derived" });
  });

  it("keeps simulation receipts private to the owning Creator", async () => {
    mocks.authorization.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://localhost/runs"), context)).status).toBe(404);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("persists then executes a server-source-bound run", async () => {
    mocks.schedule.mockResolvedValueOnce({ runId: "run-1" });
    mocks.execute.mockResolvedValueOnce({ summary: { runId: "run-1", status: "COMPLETED" } });

    const response = await POST(new Request("http://localhost/runs", { method: "POST", body: JSON.stringify({ revision: 3 }) }), context);

    expect(response.status).toBe(201);
    expect(mocks.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ taleId: "tale", scenarioId: "scenario", revision: 3, snapshot: { source: "server-derived" } }),
    );
    expect(mocks.execute).toHaveBeenCalledWith("tale", "run-1");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("rejects unsupported run options without scheduling", async () => {
    const response = await POST(new Request("http://localhost/runs", { method: "POST", body: JSON.stringify({ execute: "now" }) }), context);
    expect(response.status).toBe(400);
    expect(mocks.schedule).not.toHaveBeenCalled();
  });
});
