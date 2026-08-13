import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOperator: vi.fn(),
  requireAssurance: vi.fn(),
  rateLimit: vi.fn(),
  parseBody: vi.fn(),
  readGrant: vi.fn(),
  compare: vi.fn(),
  projection: vi.fn(),
  errorResponse: vi.fn(),
}));

vi.mock("@/admiralty/authorization", () => ({ requireAdmiraltyOperator: mocks.requireOperator }));
vi.mock("@/admiralty/assurance", () => ({ requireRecentPrivilegedAssurance: mocks.requireAssurance }));
vi.mock("@/admiralty/http", () => ({
  admiraltyErrorResponse: mocks.errorResponse,
  enforceAdmiraltyRateLimit: mocks.rateLimit,
  parseAdmiraltyBody: mocks.parseBody,
}));
vi.mock("@/admiralty/schemas", () => ({ supportTideglassDiagnosticSchema: {} }));
vi.mock("@/admiralty/support-access", () => ({ readSupportAccessGrant: mocks.readGrant }));
vi.mock("@/tideglass/diagnostics", () => ({ tideglassDiagnosticProjection: mocks.projection }));
vi.mock("@/tideglass/service", () => ({
  compareExactEditions: mocks.compare,
  prismaTideglassEditionRepository: { provider: "prisma" },
}));

import { POST } from "./route";

describe("POST /api/admin/support/tideglass", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireOperator.mockResolvedValue({ accountId: "operator-a" });
    mocks.requireAssurance.mockResolvedValue(undefined);
    mocks.rateLimit.mockReturnValue({ "X-RateLimit-Limit": "20" });
    mocks.parseBody.mockResolvedValue({
      grantId: "grant-a",
      targetAccountId: "creator-a",
      chronicleId: "chronicle-a",
      sourceEditionId: "edition-a",
      targetEditionId: "edition-b",
    });
    mocks.readGrant.mockResolvedValue({ scope: "TIDEGLASS_DIAGNOSTICS", available: true });
    mocks.compare.mockResolvedValue({ ok: false, code: "EDITION_NOT_AUTHORIZED", message: "bounded" });
    mocks.projection.mockReturnValue({ available: false, failureCode: "EDITION_NOT_AUTHORIZED" });
  });

  it("requires governed support access then compares only as the grant target", async () => {
    const response = await POST(new Request("https://example.test/api/admin/support/tideglass", { method: "POST" }));

    expect(mocks.requireOperator).toHaveBeenCalledWith("SUPPORT_USE", { request: expect.any(Request) });
    expect(mocks.requireAssurance).toHaveBeenCalledWith({ accountId: "operator-a" });
    expect(mocks.readGrant).toHaveBeenCalledWith(
      { accountId: "operator-a" },
      { grantId: "grant-a", targetAccountId: "creator-a", scope: "TIDEGLASS_DIAGNOSTICS" },
    );
    expect(mocks.compare).toHaveBeenCalledWith(
      { provider: "prisma" },
      { kind: "ACCOUNT", accountId: "creator-a" },
      { chronicleId: "chronicle-a", sourceEditionId: "edition-a", targetEditionId: "edition-b" },
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      ok: true,
      diagnostic: { available: false, failureCode: "EDITION_NOT_AUTHORIZED" },
    });
  });
});
