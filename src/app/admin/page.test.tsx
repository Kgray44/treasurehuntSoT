import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireOperator: vi.fn(), overview: vi.fn(), notFound: vi.fn() }));
vi.mock("@/admiralty/authorization", () => ({ requireAdmiraltyOperator: mocks.requireOperator }));
vi.mock("@/admiralty/projections", () => ({ admiraltyOverview: mocks.overview }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import { AdmiraltyError } from "@/admiralty/errors";
import AdmiraltyPage from "./page";

describe("secure Admiralty page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  it.each([
    ["anonymous", "ADMIRALTY_AUTH_REQUIRED"],
    ["ordinary or revoked operator", "ADMIRALTY_CAPABILITY_DENIED"],
  ])("returns not found for %s before privileged projection", async (_name, code) => {
    mocks.requireOperator.mockRejectedValueOnce(new AdmiraltyError(code as never, "denied", 403));
    await expect(AdmiraltyPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
    expect(mocks.overview).not.toHaveBeenCalled();
  });

  it("loads the projection only after server authorization", async () => {
    const operator = {
      accountId: "operator-a",
      displayName: "Admiral Test",
      roles: ["ADMINISTRATOR"],
      capabilities: ["PLATFORM_OBSERVE"],
      sessionExpiresAt: new Date("2030-01-01T00:00:00.000Z"),
    };
    mocks.requireOperator.mockResolvedValue(operator);
    mocks.overview.mockResolvedValue({
      operator,
      assurance: { recent: false },
      support: { activeGrantCount: 0, pendingRequestCount: 0 },
      registry: { total: 92, implemented: 16 },
      environment: { application: "Voyagewright", version: "0.2.0", environment: "test", buildIdentity: null },
      audit: { recentCount24Hours: 0, recent: [] },
    });
    await expect(AdmiraltyPage()).resolves.toBeTruthy();
    expect(mocks.overview).toHaveBeenCalledWith(operator);
  });
});
