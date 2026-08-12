import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorization: vi.fn(),
  studio: vi.fn(),
  snapshot: vi.fn(),
  checksum: vi.fn(),
  list: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.authorization }));
vi.mock("@/chronicle/studio-service", () => ({ getStudioTale: mocks.studio }));
vi.mock("@/chronicle/publishing", () => ({ snapshotFromStudio: mocks.snapshot }));
vi.mock("@/drydock/simulation/source", () => ({ drydockSimulationSourceChecksum: mocks.checksum }));
vi.mock("@/drydock/scenario-store", () => ({
  DrydockScenarioRevisionConflictError: class DrydockScenarioRevisionConflictError extends Error {},
  listDrydockScenarios: mocks.list,
  saveDrydockScenario: mocks.save,
}));

import { GET, POST } from "./route";

const checksum = "a".repeat(64);
const scenario = {
  schemaVersion: 1,
  id: "scenario-1",
  revision: 1,
  sourceChecksum: checksum,
  title: "Path",
  purpose: "Verify path",
  seed: "seed",
  initialState: { variables: {}, inventory: [], actorMode: "CREATOR" },
  environment: {
    virtualStart: "2026-01-01T00:00:00.000Z",
    locale: "en-US",
    viewport: "DESKTOP",
    reducedMotion: false,
    soundEnabled: true,
    keyboardOnly: false,
  },
  limits: { maxSteps: 10, maxStates: 10, maxTraceEntries: 10, maxVirtualMilliseconds: 1000 },
  inputs: [],
  faults: [],
  assertions: [],
  tags: [],
};
const context = { params: Promise.resolve({ taleId: "tale-1" }) };

describe("Drydock Scenario route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorization.mockResolvedValue({ session: { accountId: "creator-1" } });
    mocks.studio.mockResolvedValue({});
    mocks.snapshot.mockReturnValue({});
    mocks.checksum.mockReturnValue(checksum);
  });

  it("does not disclose Scenario summaries without Creator authorization", async () => {
    mocks.authorization.mockResolvedValueOnce(null);
    const response = await GET(new Request("http://localhost/scenarios"), context);
    expect(response.status).toBe(404);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("refuses a stale Scenario before it can be persisted", async () => {
    const response = await POST(
      new Request("http://localhost/scenarios", {
        method: "POST",
        body: JSON.stringify({ ...scenario, sourceChecksum: "b".repeat(64) }),
      }),
      context,
    );
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("DRYDOCK_SCENARIO_STALE_SOURCE");
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("persists only a current, CSRF-authorized Scenario revision", async () => {
    mocks.save.mockResolvedValueOnce({ scenarioId: "scenario-1", revision: 1 });
    const response = await POST(
      new Request("http://localhost/scenarios", { method: "POST", body: JSON.stringify(scenario) }),
      context,
    );
    expect(response.status).toBe(201);
    expect(mocks.authorization).toHaveBeenLastCalledWith("tale-1", expect.any(Request));
    expect(mocks.save).toHaveBeenCalledWith("tale-1", expect.objectContaining({ id: "scenario-1" }));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
