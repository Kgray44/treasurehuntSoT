import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorization: vi.fn(), readiness: vi.fn(), requirements: vi.fn() }));

vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.authorization }));
vi.mock("@/drydock/readiness-store", () => ({
  getDrydockReadiness: mocks.readiness,
  drydockReadinessRequirements: mocks.requirements,
}));

import { GET } from "./route";

const context = { params: Promise.resolve({ taleId: "tale-1" }) };

describe("Drydock readiness route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorization.mockResolvedValue({ session: { accountId: "creator-1" } });
    mocks.readiness.mockResolvedValue({
      status: "TRIALS_INCOMPLETE",
      sourceChecksum: "a".repeat(64),
      requiredSuites: [],
    });
    mocks.requirements.mockResolvedValue({ policyVersion: "drydock-required-suite-v1", requirements: [] });
  });

  it("does not inspect a foreign Chronicle", async () => {
    mocks.authorization.mockResolvedValueOnce(null);
    const response = await GET(new Request("http://localhost/readiness"), context);
    expect(response.status).toBe(404);
    expect(mocks.readiness).not.toHaveBeenCalled();
  });

  it("returns the canonical decision with private no-store semantics", async () => {
    const response = await GET(new Request("http://localhost/readiness"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      readiness: { status: "TRIALS_INCOMPLETE", sourceChecksum: "a".repeat(64), requiredSuites: [] },
      requirements: { policyVersion: "drydock-required-suite-v1", requirements: [] },
    });
    expect(mocks.requirements).toHaveBeenCalledWith("tale-1");
  });
});
