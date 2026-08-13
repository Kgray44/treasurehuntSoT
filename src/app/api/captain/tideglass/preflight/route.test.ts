import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCaptainWorkspace: vi.fn(),
  loadContext: vi.fn(),
  compare: vi.fn(),
}));

vi.mock("@/chronicle/captain-authorization", () => ({ requireCaptainWorkspace: mocks.requireCaptainWorkspace }));
vi.mock("@/tideglass/helm-preflight", () => ({
  loadTideglassHelmPreflightContext: mocks.loadContext,
  compareTideglassHelmPreflight: mocks.compare,
}));

import { GET } from "./route";

const context = {
  chronicle: { id: "tale-a", slug: "lantern-coast", title: "Lantern Coast" },
  selectedEdition: { id: "edition-old", label: "1.0", publishedAt: "2026-01-01T00:00:00.000Z" },
  recommendedEdition: { id: "edition-current", label: "2.0", publishedAt: "2026-02-01T00:00:00.000Z" },
};

describe("GET /api/captain/tideglass/preflight", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireCaptainWorkspace.mockResolvedValue({ accountId: "captain-a" });
    mocks.loadContext.mockResolvedValue(context);
  });

  it("requires the Captain workspace before disclosing whether an edition is available", async () => {
    mocks.requireCaptainWorkspace.mockResolvedValue(null);

    const response = await GET(
      new Request("https://example.test/api/captain/tideglass/preflight?taleId=tale-a&selectedEditionId=edition-old"),
    );

    expect(response.status).toBe(401);
    expect(mocks.loadContext).not.toHaveBeenCalled();
  });

  it("fails closed when the selected edition is outside the Captain Library scope", async () => {
    mocks.loadContext.mockResolvedValue(null);

    const response = await GET(
      new Request("https://example.test/api/captain/tideglass/preflight?taleId=tale-a&selectedEditionId=foreign"),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "That Chronicle edition is unavailable in Captain's Console." });
    expect(mocks.compare).not.toHaveBeenCalled();
  });

  it("returns only the read-only Captain-safe summary for the exact selected and recommended pair", async () => {
    mocks.compare.mockResolvedValue({
      kind: "COMPARISON",
      context,
      projection: {
        visibleChangeCount: 2,
        summary: { headline: "Two player-safe changes", digest: "safe-digest", partial: false },
        audience: "CAPTAIN_SAFE",
        changes: [{ hiddenInternalField: "must-not-leak" }],
      },
    });

    const response = await GET(
      new Request("https://example.test/api/captain/tideglass/preflight?taleId=tale-a&selectedEditionId=edition-old"),
    );

    expect(mocks.loadContext).toHaveBeenCalledWith({
      captainAccountId: "captain-a",
      taleId: "tale-a",
      selectedEditionId: "edition-old",
    });
    expect(mocks.compare).toHaveBeenCalledWith(context, "captain-a");
    expect(await response.json()).toEqual({
      state: "COMPARISON",
      selectedEdition: context.selectedEdition,
      recommendedEdition: context.recommendedEdition,
      visibleChangeCount: 2,
      summary: { headline: "Two player-safe changes", digest: "safe-digest", partial: false },
    });
  });
});
