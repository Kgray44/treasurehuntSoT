import { describe, expect, it } from "vitest";
import { canonicalJson } from "../../src/tideglass/core";
import { compareSemanticSnapshots } from "../../src/tideglass/comparison";
import { canonicalizePublishedSnapshot } from "../../src/tideglass/semantic";
import { compareExactEditions } from "../../src/tideglass/service";
import { anchor, baseSnapshot, clone, edition, FixtureRepository, largeSnapshot } from "./fixtures";

function semantic(snapshot: unknown, id: string, checksum: string) {
  const result = canonicalizePublishedSnapshot(JSON.stringify(snapshot), anchor(id, checksum));
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

describe("Tideglass determinism, graph symmetry, and Phase 1 performance bounds", () => {
  it("produces identical record IDs, ordering, and digest across 100 repeated comparisons", () => {
    const source = baseSnapshot();
    const target = clone(source);
    target.tale.title = "Repeated deterministic title";
    target.tale.playerCountMax = 6;
    const before = semantic(source, "edition-a", "source-checksum");
    const after = semantic(target, "edition-b", "target-checksum");
    const baseline = compareSemanticSnapshots(before, after);
    for (let run = 0; run < 100; run += 1) {
      const result = compareSemanticSnapshots(before, after);
      expect(result.deterministicDigest).toBe(baseline.deterministicDigest);
      expect(result.changes.map((change) => change.id)).toEqual(baseline.changes.map((change) => change.id));
      expect(canonicalJson(result)).toBe(canonicalJson(baseline));
    }
  });

  it("maps graph additions to removals in reverse without sharing comparison identity", () => {
    const source = baseSnapshot();
    const target = clone(source);
    (target.chapters[0].blocks[0].connections as Array<Record<string, unknown>>).push({
      targetBlockId: "block-opening",
      connectionType: "OPTIONAL",
      label: "Synthetic loop",
      conditionExpression: "fixture == true",
      orderIndex: 1,
    });
    const a = semantic(source, "edition-a", "source-checksum");
    const b = semantic(target, "edition-b", "target-checksum");
    const forward = compareSemanticSnapshots(a, b);
    const reverse = compareSemanticSnapshots(b, a);
    expect(forward.changes).toContainEqual(expect.objectContaining({ entityType: "GRAPH_EDGE", kind: "ADDED" }));
    expect(reverse.changes).toContainEqual(expect.objectContaining({ entityType: "GRAPH_EDGE", kind: "REMOVED" }));
    expect(reverse.comparisonId).not.toBe(forward.comparisonId);
  });

  it("keeps deterministic receipt identity separate from operational timing", async () => {
    const source = edition("edition-a", baseSnapshot());
    const targetSnapshot = baseSnapshot();
    targetSnapshot.tale.title = "Operational timing test";
    const target = edition("edition-b", targetSnapshot);
    const repository = new FixtureRepository([source, target]);
    const request = { chronicleId: "chronicle-tideglass", sourceEditionId: "edition-a", targetEditionId: "edition-b" };
    const first = await compareExactEditions(repository, { kind: "ACCOUNT", accountId: "fixture" }, request);
    const second = await compareExactEditions(repository, { kind: "ACCOUNT", accountId: "fixture" }, request);
    if (!first.ok || !second.ok) throw new Error("comparison failed");
    expect(second.value.receipt).toEqual(first.value.receipt);
    expect(second.value.changeSet).toEqual(first.value.changeSet);
    expect(second.value.operation.correlationId).not.toBe(first.value.operation.correlationId);
  });

  it("compares hundreds of blocks with map-based matching inside the generous Phase 1 review bound", async () => {
    const sourceSnapshot = largeSnapshot(500);
    const targetSnapshot = clone(sourceSnapshot);
    targetSnapshot.chapters[5].blocks[20].title = "Changed large synthetic block";
    targetSnapshot.assets[10].displayName = "Changed large synthetic asset";
    targetSnapshot.artifacts[10].persistentAfterUnlock = false;
    targetSnapshot.locations[10].verificationProfile = { provider: "visionLocation" };
    const source = edition("edition-large-a", sourceSnapshot);
    const target = edition("edition-large-b", targetSnapshot);
    const result = await compareExactEditions(
      new FixtureRepository([source, target]),
      { kind: "ACCOUNT", accountId: "fixture" },
      {
        chronicleId: "chronicle-tideglass",
        sourceEditionId: "edition-large-a",
        targetEditionId: "edition-large-b",
      },
    );
    if (!result.ok) throw new Error(result.code);
    expect(result.value.changeSet.changes.length).toBeGreaterThanOrEqual(4);
    expect(result.value.operation.normalizationDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.value.operation.comparisonDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.value.operation.totalDurationMs).toBeLessThan(5_000);
  });
});
