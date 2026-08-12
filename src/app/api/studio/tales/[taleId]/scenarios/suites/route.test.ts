import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorization: vi.fn(), studio: vi.fn(), snapshot: vi.fn(), checksum: vi.fn(), save: vi.fn(), list: vi.fn() }));
vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.authorization }));
vi.mock("@/chronicle/studio-service", () => ({ getStudioTale: mocks.studio }));
vi.mock("@/chronicle/publishing", () => ({ snapshotFromStudio: mocks.snapshot }));
vi.mock("@/drydock/simulation/source", () => ({ drydockSimulationSourceChecksum: mocks.checksum }));
vi.mock("@/drydock/suite-store", () => ({
  DrydockScenarioSuiteUnavailableError: class DrydockScenarioSuiteUnavailableError extends Error {},
  saveDrydockScenarioSuite: mocks.save,
  listDrydockScenarioSuites: mocks.list,
}));

import { POST } from "./route";

describe("Drydock Scenario Suite route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.authorization.mockResolvedValue({}); mocks.studio.mockResolvedValue({}); mocks.snapshot.mockReturnValue({}); mocks.checksum.mockReturnValue("a".repeat(64)); });

  it("requires Creator authorization and supplies only a server-derived source identity", async () => {
    mocks.save.mockResolvedValueOnce({ suiteId: "suite", members: [] });
    const response = await POST(new Request("http://localhost/suites", { method: "POST", body: JSON.stringify({ schemaVersion: 1 }) }), { params: Promise.resolve({ taleId: "tale" }) });
    expect(response.status).toBe(201);
    expect(mocks.save).toHaveBeenCalledWith("tale", { schemaVersion: 1 }, "a".repeat(64));
  });
});
