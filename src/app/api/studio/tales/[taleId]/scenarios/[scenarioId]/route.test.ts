import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorization: vi.fn(), get: vi.fn(), duplicate: vi.fn(), archive: vi.fn() }));
vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.authorization }));
vi.mock("@/chronicle/api", () => ({ apiError: () => new Response(null, { status: 400 }) }));
vi.mock("@/drydock/scenario-store", () => ({
  getDrydockScenario: mocks.get,
  duplicateDrydockScenario: mocks.duplicate,
  archiveDrydockScenario: mocks.archive,
}));

import { DELETE, POST } from "./route";

const context = { params: Promise.resolve({ taleId: "tale", scenarioId: "scenario" }) };

describe("Drydock Scenario revision detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorization.mockResolvedValue({});
  });

  it("does not disclose duplicate or archive operations across Creator boundaries", async () => {
    mocks.authorization.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    expect((await POST(new Request("http://localhost/scenario", { method: "POST" }), context)).status).toBe(404);
    expect((await DELETE(new Request("http://localhost/scenario", { method: "DELETE" }), context)).status).toBe(404);
    expect(mocks.duplicate).not.toHaveBeenCalled();
    expect(mocks.archive).not.toHaveBeenCalled();
  });

  it("duplicates an exact stored revision and archives only its owned Scenario identity", async () => {
    mocks.duplicate.mockResolvedValueOnce({ scenarioId: "duplicate", revision: 1 });
    mocks.archive.mockResolvedValueOnce(true);

    const duplicate = await POST(new Request("http://localhost/scenario?revision=2", { method: "POST" }), context);
    const archived = await DELETE(new Request("http://localhost/scenario", { method: "DELETE" }), context);

    expect(duplicate.status).toBe(201);
    expect(mocks.duplicate).toHaveBeenCalledWith("tale", "scenario", 2);
    expect(archived.status).toBe(200);
    expect(mocks.archive).toHaveBeenCalledWith("tale", "scenario");
  });
});
