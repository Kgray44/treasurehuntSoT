import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findChronicle: vi.fn(),
  findEditions: vi.fn(),
  compare: vi.fn(),
  annotations: vi.fn(),
  project: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    chronicle: { findFirst: mocks.findChronicle },
    publishedTaleVersion: { findMany: mocks.findEditions },
  },
}));
vi.mock("@/tideglass/service", () => ({
  prismaTideglassEditionRepository: { provider: "prisma" },
  compareExactEditions: mocks.compare,
}));
vi.mock("@/tideglass/annotations", () => ({ prismaTideglassAnnotationRepository: { listPair: mocks.annotations } }));
vi.mock("@/tideglass/projection", () => ({ projectTideglassComparison: mocks.project }));

import { compareTideglassHelmPreflight, loadTideglassHelmPreflightContext } from "@/tideglass/helm-preflight";

describe("Helm Tideglass preflight boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findChronicle.mockResolvedValue({
      id: "tale-a",
      slug: "lantern-coast",
      title: "Lantern Coast",
      latestPublishedVersionId: "edition-current",
    });
    mocks.findEditions.mockResolvedValue([
      { id: "edition-old", versionLabel: "1.0", publishedAt: new Date("2026-01-01T00:00:00.000Z") },
      { id: "edition-current", versionLabel: "2.0", publishedAt: new Date("2026-02-01T00:00:00.000Z") },
    ]);
  });

  it("accepts only a selected published edition that belongs to the Captain Library Chronicle", async () => {
    mocks.findEditions.mockResolvedValueOnce([
      { id: "edition-current", versionLabel: "2.0", publishedAt: new Date("2026-02-01T00:00:00.000Z") },
    ]);

    await expect(
      loadTideglassHelmPreflightContext({
        captainAccountId: "captain-a",
        taleId: "tale-a",
        selectedEditionId: "edition-foreign",
      }),
    ).resolves.toBeNull();
    expect(mocks.findEditions).toHaveBeenCalledWith(
      expect.objectContaining({ where: { taleId: "tale-a", id: { in: ["edition-foreign", "edition-current"] } } }),
    );
  });

  it("compares the exact selected-to-recommended pair as CAPTAIN and projects only CAPTAIN_SAFE details", async () => {
    const context = await loadTideglassHelmPreflightContext({
      captainAccountId: "captain-a",
      taleId: "tale-a",
      selectedEditionId: "edition-old",
    });
    if (!context) throw new Error("fixture context was unavailable");
    const result = {
      ok: true,
      value: {
        changeSet: {
          pair: {
            source: { editionId: "edition-old", editionChecksum: "old" },
            target: { editionId: "edition-current", editionChecksum: "current" },
            comparisonPolicyVersion: "policy",
          },
        },
      },
    };
    mocks.compare.mockResolvedValue(result);
    mocks.annotations.mockResolvedValue([]);
    mocks.project.mockReturnValue({ audience: "CAPTAIN_SAFE", visibleChangeCount: 1 });

    await expect(compareTideglassHelmPreflight(context, "captain-a")).resolves.toMatchObject({
      kind: "COMPARISON",
      projection: { audience: "CAPTAIN_SAFE" },
    });
    expect(mocks.compare).toHaveBeenCalledWith(
      { provider: "prisma" },
      { kind: "CAPTAIN", accountId: "captain-a" },
      { chronicleId: "tale-a", sourceEditionId: "edition-old", targetEditionId: "edition-current" },
    );
    expect(mocks.project).toHaveBeenCalledWith(result.value, "CAPTAIN_SAFE", "CONCISE", []);
  });
});
