import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  rate: vi.fn(),
  compare: vi.fn(),
  annotations: vi.fn(),
  project: vi.fn(),
  safeError: vi.fn(),
}));

vi.mock("@/chronicle/studio-authorization", () => ({ requireOwnedStudioTale: mocks.authorize }));
vi.mock("@/tideglass/http", () => ({
  enforceTideglassRateLimit: mocks.rate,
  tideglassSafeError: mocks.safeError,
}));
vi.mock("@/tideglass/service", () => ({
  prismaTideglassEditionRepository: {},
  compareExactEditions: mocks.compare,
}));
vi.mock("@/tideglass/annotations", () => ({ prismaTideglassAnnotationRepository: { listPair: mocks.annotations } }));
vi.mock("@/tideglass/projection", () => ({ projectTideglassComparison: mocks.project }));

const pair = {
  source: { editionId: "edition-a", editionChecksum: "a".repeat(64) },
  target: { editionId: "edition-b", editionChecksum: "b".repeat(64) },
};

describe("Tideglass Phase 3 Studio semantic cutover", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.authorize.mockReset().mockResolvedValue({ session: { accountId: "creator-a" }, tale: { id: "tale-a" } });
    mocks.rate.mockReset().mockReturnValue({ ok: true, headers: { "x-rate-limit": "ok" } });
    mocks.compare.mockReset().mockResolvedValue({
      ok: true,
      value: { changeSet: { pair, comparisonPolicyVersion: "tideglass.policy.v1" } },
    });
    mocks.annotations.mockReset().mockResolvedValue([]);
    mocks.project.mockReset().mockReturnValue({
      projectionStatus: "COMPLETE",
      visibleChangeCount: 1,
      summary: { headline: { templateKey: "tideglass.summary.overall" }, categoryGroups: [], compatibility: [] },
    });
    mocks.safeError
      .mockReset()
      .mockReturnValue(NextResponse.json({ code: "TIDEGLASS_INTERNAL_FAILURE" }, { status: 500 }));
  });

  it("replaces the legacy raw Studio diff with a creator-authorized Tideglass semantic projection", async () => {
    const route = await import("../../src/app/api/studio/tales/[taleId]/versions/compare/route");
    const response = await route.GET(
      new Request("http://localhost/api/studio/tales/tale-a/versions/compare?left=edition-a&right=edition-b"),
      { params: Promise.resolve({ taleId: "tale-a" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.compare).toHaveBeenCalledWith(
      {},
      { kind: "ACCOUNT", accountId: "creator-a" },
      { chronicleId: "tale-a", sourceEditionId: "edition-a", targetEditionId: "edition-b" },
    );
    expect(mocks.project).toHaveBeenCalledWith(expect.anything(), "CREATOR_FULL", "DETAILED", []);
    const body = await response.json();
    expect(body).toMatchObject({ projection: { projectionStatus: "COMPLETE", visibleChangeCount: 1 } });
    expect(JSON.stringify(body)).not.toMatch(/PRIVATE_RAW_PATH|contentSnapshot|before|after|path/u);
  });
});
