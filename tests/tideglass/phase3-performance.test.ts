import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { projectTideglassComparison } from "../../src/tideglass/projection";
import { compareExactEditions } from "../../src/tideglass/service";
import { clone, edition, FixtureRepository, largeSnapshot } from "./fixtures";

describe("Tideglass Phase 3 passage performance", () => {
  it("projects a reasonably large synthetic comparison without a Phase 4 job system", async () => {
    const sourceSnapshot = largeSnapshot(600);
    const targetSnapshot = clone(sourceSnapshot);
    for (const chapter of targetSnapshot.chapters) chapter.title = `${chapter.title} revised`;
    targetSnapshot.chapters[4].blocks[12].title = "A large synthetic semantic revision";
    targetSnapshot.tale.minimumPlatformVersion = "3.0.0";
    const source = edition("phase3-large-a", sourceSnapshot);
    const target = edition("phase3-large-b", targetSnapshot);
    const startedAt = performance.now();
    const compared = await compareExactEditions(
      new FixtureRepository([source, target]),
      { kind: "PASSAGE", subjectId: "phase3-performance" },
      { chronicleId: source.chronicleId, sourceEditionId: source.id, targetEditionId: target.id },
      { cache: null },
    );
    if (!compared.ok) throw new Error(compared.code);
    const projection = projectTideglassComparison(compared.value, "CREATOR_FULL", "DETAILED");
    const elapsedMs = performance.now() - startedAt;
    expect(projection.visibleChangeCount).toBeGreaterThanOrEqual(12);
    expect(projection.changes.length).toBe(projection.visibleChangeCount);
    expect(elapsedMs).toBeLessThan(5_000);
  });
});
