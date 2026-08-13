import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorization: vi.fn(), studio: vi.fn(), validate: vi.fn(), explorer: vi.fn() }));

vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.authorization }));
vi.mock("@/chronicle/studio-service", () => ({ getStudioTale: mocks.studio }));
vi.mock("@/drydock/incremental", () => ({
  drydockDraftInputFromStudio: vi.fn((draft) => draft),
  validateDrydockDraftContracts: mocks.validate,
}));
vi.mock("@/drydock/variable-explorer", () => ({ createDrydockVariableExplorer: mocks.explorer }));

import { GET } from "./route";

const context = { params: Promise.resolve({ taleId: "tale-1" }) };

describe("Shipwright variable explorer route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorization.mockResolvedValue({ session: { accountId: "creator-1" } });
    mocks.studio.mockResolvedValue({ draft: { chapters: [], assets: [] }, assets: [] });
    mocks.validate.mockReturnValue({
      variableRegistry: { declarations: [] },
      variableUsageIndex: {},
      graphAnalysis: {},
      stateAnalysis: {},
      issues: [],
    });
    mocks.explorer.mockReturnValue({ schemaVersion: 1, variables: [] });
  });

  it("returns 404 without reading a foreign Chronicle", async () => {
    mocks.authorization.mockResolvedValueOnce(null);
    const response = await GET(new Request("http://localhost/variables"), context);
    expect(response.status).toBe(404);
    expect(mocks.studio).not.toHaveBeenCalled();
  });

  it("allows the private GET without incorrectly requiring a mutation CSRF challenge", async () => {
    const response = await GET(new Request("http://localhost/variables"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.authorization).toHaveBeenCalledWith("tale-1");
    expect((await response.json()).explorer).toEqual({ schemaVersion: 1, variables: [] });
  });
});
