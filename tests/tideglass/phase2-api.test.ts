import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { annotationMutationSchema, tideglassCreatorAnnotationDto } from "../../src/tideglass/annotations";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  rate: vi.fn(),
  parse: vi.fn(),
  compare: vi.fn(),
  list: vi.fn(),
  append: vi.fn(),
  project: vi.fn(),
  selectAudience: vi.fn(),
  editions: vi.fn(),
  annotationDto: vi.fn(),
  safeError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { publishedTaleVersion: { findMany: mocks.editions } } }));

vi.mock("@/tideglass/http", () => ({
  requireTideglassCreatorChronicle: mocks.authorize,
  enforceTideglassRateLimit: mocks.rate,
  parseBoundedTideglassJson: mocks.parse,
  tideglassUnavailable: () => NextResponse.json({ code: "TIDEGLASS_UNAVAILABLE" }, { status: 404 }),
  tideglassSafeError: mocks.safeError,
}));

vi.mock("@/tideglass", () => ({
  annotationMutationSchema,
  tideglassAudiences: ["PUBLIC_PREVIEW", "PLAYER_SAFE", "CREATOR_FULL"],
  tideglassSummaryModes: ["CONCISE", "DETAILED"],
  prismaTideglassAnnotationRepository: { listPair: mocks.list },
  prismaTideglassEditionRepository: {},
  compareExactEditions: mocks.compare,
  appendTideglassAnnotation: mocks.append,
  projectTideglassComparison: mocks.project,
  selectTideglassAudience: mocks.selectAudience,
  tideglassCreatorAnnotationDto: mocks.annotationDto,
}));

const pair = {
  chronicleId: "chronicle-tideglass",
  source: {
    chronicleId: "chronicle-tideglass",
    editionId: "edition-a",
    editionChecksum: "a".repeat(64),
    sourceSchemaVersion: 1,
  },
  target: {
    chronicleId: "chronicle-tideglass",
    editionId: "edition-b",
    editionChecksum: "b".repeat(64),
    sourceSchemaVersion: 1,
  },
};

const compared = {
  ok: true,
  value: {
    changeSet: { pair, comparisonPolicyVersion: "tideglass.policy.v1" },
    operation: { correlationId: "correlation", cacheStatus: "MISS" },
  },
};

describe("Tideglass Phase 2 API boundaries", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.authorize.mockReset().mockResolvedValue({ accountId: "creator-a" });
    mocks.rate.mockReset().mockReturnValue({ ok: true, headers: {} });
    mocks.parse.mockReset().mockImplementation((request: Request) => request.json());
    mocks.compare.mockReset().mockResolvedValue(compared);
    mocks.list.mockReset().mockResolvedValue([]);
    mocks.append.mockReset().mockResolvedValue({ ok: true, idempotent: false, value: { id: "annotation-a" } });
    mocks.project.mockReset().mockReturnValue({
      safeProjection: true,
      policy: { projectionPolicyVersion: "tideglass.projection.v1", summaryPolicyVersion: "tideglass.summary.v1" },
      projectionStatus: "COMPLETE",
      summary: { overallSignificance: null, compatibility: [] },
      visibleCategoryCounts: {},
    });
    mocks.selectAudience.mockReset().mockImplementation((_maximum: string, requested: string) => requested);
    mocks.editions.mockReset().mockResolvedValue([]);
    mocks.annotationDto.mockReset().mockImplementation((annotation: { id: string }) => ({ id: annotation.id }));
    mocks.safeError
      .mockReset()
      .mockImplementation((cause: unknown) =>
        cause instanceof Error && cause.message === "INVALID"
          ? NextResponse.json({ code: "TIDEGLASS_REQUEST_INVALID" }, { status: 400 })
          : NextResponse.json(
              { code: "TIDEGLASS_INTERNAL_FAILURE", error: "Tideglass could not complete the request." },
              { status: 500 },
            ),
      );
  });

  it("authorizes edition listing without enumerating a hidden Chronicle", async () => {
    mocks.authorize.mockResolvedValueOnce(null);
    const route = await import("../../src/app/api/chronicles/[chronicleId]/editions/route");
    const response = await route.GET(new Request("http://localhost/editions"), {
      params: Promise.resolve({ chronicleId: "chronicle-hidden" }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "TIDEGLASS_UNAVAILABLE" });
    expect(mocks.editions).not.toHaveBeenCalled();
  });

  it("returns authoritative edition metadata without inventing playability or recommendation", async () => {
    mocks.editions.mockResolvedValueOnce([
      {
        id: "edition-a",
        versionNumber: 1,
        versionLabel: "1.0",
        publishedAt: "2026-08-09T12:00:00.000Z",
        schemaVersion: 1,
        isCurrent: true,
        contentSnapshot: "PRIVATE_SNAPSHOT",
        checksum: "PRIVATE_CHECKSUM",
      },
    ]);
    const route = await import("../../src/app/api/chronicles/[chronicleId]/editions/route");
    const response = await route.GET(new Request("http://localhost/editions"), {
      params: Promise.resolve({ chronicleId: "chronicle-tideglass" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.editions[0]).toMatchObject({
      id: "edition-a",
      isCurrent: true,
      retainedState: null,
      playable: null,
      recommended: null,
    });
    expect(body.availability.available).toBe(false);
    expect(body.recommendation.available).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/PRIVATE_SNAPSHOT|PRIVATE_CHECKSUM|contentSnapshot|checksum/u);
  });

  it("contains unexpected edition-read failures inside the safe API envelope", async () => {
    mocks.editions.mockRejectedValueOnce(new Error("PRIVATE_DATABASE_DETAIL"));
    const route = await import("../../src/app/api/chronicles/[chronicleId]/editions/route");
    const response = await route.GET(new Request("http://localhost/editions"), {
      params: Promise.resolve({ chronicleId: "chronicle-tideglass" }),
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: "TIDEGLASS_INTERNAL_FAILURE",
      error: "Tideglass could not complete the request.",
    });
    expect(mocks.safeError).toHaveBeenCalledWith(expect.objectContaining({ message: "PRIVATE_DATABASE_DETAIL" }));
  });

  it("returns a generic correlation-bound internal failure without echoing the cause", async () => {
    const actual = await vi.importActual<typeof import("../../src/tideglass/http")>("../../src/tideglass/http");
    const response = actual.tideglassSafeError(new Error("PRIVATE_DATABASE_DETAIL"), "correlation-safe");
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      code: "TIDEGLASS_INTERNAL_FAILURE",
      error: "Tideglass could not complete the request.",
      correlationId: "correlation-safe",
    });
    expect(JSON.stringify(body)).not.toContain("PRIVATE_DATABASE_DETAIL");
  });

  it("returns only a server projection and rejects client-supplied authority fields", async () => {
    const route = await import("../../src/app/api/chronicles/[chronicleId]/comparison/route");
    const accepted = await route.POST(
      new Request("http://localhost/api/chronicles/chronicle-tideglass/comparison", {
        method: "POST",
        body: JSON.stringify({
          sourceEditionId: "edition-a",
          targetEditionId: "edition-b",
          requestedAudience: "PUBLIC_PREVIEW",
          mode: "DETAILED",
        }),
      }),
      { params: Promise.resolve({ chronicleId: "chronicle-tideglass" }) },
    );
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({
      projection: {
        safeProjection: true,
        policy: { projectionPolicyVersion: "tideglass.projection.v1", summaryPolicyVersion: "tideglass.summary.v1" },
        projectionStatus: "COMPLETE",
        summary: { overallSignificance: null, compatibility: [] },
        visibleCategoryCounts: {},
      },
      operation: { correlationId: "correlation", cacheStatus: "MISS" },
    });
    expect(mocks.project).toHaveBeenCalledWith(compared.value, "PUBLIC_PREVIEW", "DETAILED", []);

    mocks.compare.mockClear();
    const escalated = await route.POST(
      new Request("http://localhost/api/chronicles/chronicle-tideglass/comparison", {
        method: "POST",
        body: JSON.stringify({
          sourceEditionId: "edition-a",
          targetEditionId: "edition-b",
          requestedAudience: "CREATOR_FULL",
          creator: true,
        }),
      }),
      { params: Promise.resolve({ chronicleId: "chronicle-tideglass" }) },
    );
    expect(escalated.status).toBe(400);
    expect(mocks.compare).not.toHaveBeenCalled();
  });

  it("fails annotation mutation at the canonical auth/CSRF boundary before comparison or storage", async () => {
    mocks.authorize.mockResolvedValueOnce(null);
    const route = await import("../../src/app/api/chronicles/[chronicleId]/comparison/annotations/route");
    const request = new Request("http://localhost/api/chronicles/chronicle-tideglass/comparison/annotations", {
      method: "POST",
      headers: { "x-csrf-token": "wrong" },
      body: JSON.stringify({}),
    });
    const response = await route.POST(request, {
      params: Promise.resolve({ chronicleId: "chronicle-tideglass" }),
    });
    expect(response.status).toBe(404);
    expect(mocks.authorize).toHaveBeenCalledWith("chronicle-tideglass", request);
    expect(mocks.compare).not.toHaveBeenCalled();
    expect(mocks.append).not.toHaveBeenCalled();
  });

  it("rejects raw snapshot and actor mass-assignment fields before annotation mutation", async () => {
    const route = await import("../../src/app/api/chronicles/[chronicleId]/comparison/annotations/route");
    const response = await route.POST(
      new Request("http://localhost/api/chronicles/chronicle-tideglass/comparison/annotations", {
        method: "POST",
        headers: { "x-csrf-token": "csrf" },
        body: JSON.stringify({
          operation: "CREATE",
          sourceEditionId: "edition-a",
          sourceEditionChecksum: "a".repeat(64),
          targetEditionId: "edition-b",
          targetEditionChecksum: "b".repeat(64),
          scopeType: "PAIR",
          annotationKind: "DETAIL",
          body: "Safe note",
          spoilerLevel: "PREVIEW_SAFE",
          idempotencyKey: "strict-input",
          contentSnapshot: "private",
          createdByAccountId: "attacker",
        }),
      }),
      { params: Promise.resolve({ chronicleId: "chronicle-tideglass" }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.compare).not.toHaveBeenCalled();
    expect(mocks.append).not.toHaveBeenCalled();
  });

  it("uses distinct centralized rate-limit classes for compare, mutation, and preview", async () => {
    const compareRoute = await import("../../src/app/api/chronicles/[chronicleId]/comparison/route");
    await compareRoute.POST(
      new Request("http://localhost/compare", {
        method: "POST",
        body: JSON.stringify({ sourceEditionId: "edition-a", targetEditionId: "edition-b" }),
      }),
      { params: Promise.resolve({ chronicleId: "chronicle-tideglass" }) },
    );
    const previewRoute = await import("../../src/app/api/chronicles/[chronicleId]/comparison/preview/route");
    await previewRoute.POST(
      new Request("http://localhost/preview", {
        method: "POST",
        body: JSON.stringify({
          sourceEditionId: "edition-a",
          targetEditionId: "edition-b",
          audience: "PUBLIC_PREVIEW",
        }),
      }),
      { params: Promise.resolve({ chronicleId: "chronicle-tideglass" }) },
    );
    const annotationRoute = await import("../../src/app/api/chronicles/[chronicleId]/comparison/annotations/route");
    await annotationRoute.POST(
      new Request("http://localhost/annotations", {
        method: "POST",
        body: JSON.stringify({
          operation: "CREATE",
          sourceEditionId: "edition-a",
          sourceEditionChecksum: "a".repeat(64),
          targetEditionId: "edition-b",
          targetEditionChecksum: "b".repeat(64),
          scopeType: "PAIR",
          annotationKind: "DETAIL",
          body: "Safe note",
          spoilerLevel: "PREVIEW_SAFE",
          idempotencyKey: "rate-policy",
        }),
      }),
      { params: Promise.resolve({ chronicleId: "chronicle-tideglass" }) },
    );
    expect(mocks.rate).toHaveBeenCalledWith("comparison-read", "creator-a", "chronicle-tideglass");
    expect(mocks.rate).toHaveBeenCalledWith("projection-preview", "creator-a", "chronicle-tideglass");
    expect(mocks.rate).toHaveBeenCalledWith("annotation-mutation", "creator-a", "chronicle-tideglass");
  });

  it("returns explicit annotation DTOs instead of repository rows", () => {
    const dto = tideglassCreatorAnnotationDto({
      id: "annotation-a",
      annotationKey: "logical-a",
      revision: 1,
      chronicleId: "chronicle-tideglass",
      sourceEditionId: "edition-a",
      sourceEditionChecksum: "a".repeat(64),
      targetEditionId: "edition-b",
      targetEditionChecksum: "b".repeat(64),
      comparisonPolicyVersion: "tideglass.policy.v1",
      scopeType: "PAIR",
      category: null,
      changeRecordId: null,
      annotationKind: "HEADLINE",
      headline: "Safe headline",
      body: null,
      spoilerLevel: "PREVIEW_SAFE",
      highlighted: true,
      replayGuidance: "WORTH_REVISITING",
      createdByAccountId: "private-account-id",
      createdAt: new Date("2026-08-09T12:00:00.000Z"),
      supersedesAnnotationId: null,
      state: "ACTIVE",
      idempotencyKey: "private-idempotency-key",
    });
    expect(dto).toMatchObject({ id: "annotation-a", createdAt: "2026-08-09T12:00:00.000Z" });
    expect(dto).not.toHaveProperty("chronicleId");
    expect(dto).not.toHaveProperty("createdByAccountId");
    expect(dto).not.toHaveProperty("idempotencyKey");
    expect(dto).not.toHaveProperty("sourceEditionChecksum");
    expect(dto).not.toHaveProperty("targetEditionChecksum");
  });
});
