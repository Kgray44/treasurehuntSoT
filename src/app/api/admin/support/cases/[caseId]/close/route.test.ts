import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOperator: vi.fn(),
  requireAssurance: vi.fn(),
  rateLimit: vi.fn(),
  parseBody: vi.fn(),
  closeCase: vi.fn(),
  errorResponse: vi.fn(),
}));

vi.mock("@/admiralty/authorization", () => ({ requireAdmiraltyOperator: mocks.requireOperator }));
vi.mock("@/admiralty/assurance", () => ({ requireRecentPrivilegedAssurance: mocks.requireAssurance }));
vi.mock("@/admiralty/http", () => ({
  admiraltyErrorResponse: mocks.errorResponse,
  enforceAdmiraltyRateLimit: mocks.rateLimit,
  parseAdmiraltyBody: mocks.parseBody,
}));
vi.mock("@/admiralty/schemas", () => ({ supportCaseCloseSchema: {} }));
vi.mock("@/admiralty/support-pilot-service", () => ({ closeSupportCase: mocks.closeCase }));

import { POST } from "./route";

describe("POST /api/admin/support/cases/:caseId/close", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireOperator.mockResolvedValue({ accountId: "operator-a" });
    mocks.requireAssurance.mockResolvedValue(undefined);
    mocks.rateLimit.mockReturnValue({ "X-RateLimit-Limit": "10" });
    mocks.parseBody.mockResolvedValue({ reason: "The bounded synthetic investigation is complete." });
    mocks.closeCase.mockResolvedValue({
      caseId: "case-a",
      caseNumber: "S1-CASEA",
      status: "CLOSED",
      idempotent: false,
    });
  });

  it("requires session-bound assurance and returns the durable closure result without caching", async () => {
    const request = new Request("https://example.test/api/admin/support/cases/case-a/close", { method: "POST" });
    const response = await POST(request, { params: Promise.resolve({ caseId: "case-a" }) });

    expect(mocks.requireOperator).toHaveBeenCalledWith("SUPPORT_USE", { request });
    expect(mocks.requireAssurance).toHaveBeenCalledWith({ accountId: "operator-a" });
    expect(mocks.rateLimit).toHaveBeenCalledWith("support-case-close:operator-a", 10, 10 * 60_000);
    expect(mocks.closeCase).toHaveBeenCalledWith(
      { accountId: "operator-a" },
      { caseId: "case-a", reason: "The bounded synthetic investigation is complete." },
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      ok: true,
      supportCase: { caseId: "case-a", caseNumber: "S1-CASEA", status: "CLOSED", idempotent: false },
    });
  });
});
