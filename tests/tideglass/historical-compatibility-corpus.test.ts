import { describe, expect, it } from "vitest";
import { compareExactEditions } from "../../src/tideglass/service";
import { baseSnapshot, clone, edition, FixtureRepository, type FixtureSnapshot } from "./fixtures";

function retainedSyntheticHistory() {
  const snapshots: FixtureSnapshot[] = [baseSnapshot()];
  for (let index = 1; index < 24; index += 1) {
    const next = clone(snapshots[index - 1]);
    switch (index % 6) {
      case 0:
        next.tale.title = `The Glass Harbor, retained edition ${index}`;
        break;
      case 1:
        next.tale.playerCountMax = 6 + index;
        break;
      case 2:
        next.tale.estimatedDuration = 105 + index * 15;
        break;
      case 3:
        next.tale.captainRequired = !next.tale.captainRequired;
        break;
      case 4:
        next.tale.providerRequirements = ["captainManual", `synthetic-provider-${index}`];
        break;
      default:
        next.tale.contentWarnings = `synthetic-warning-${index}`;
        break;
    }
    snapshots.push(next);
  }
  return snapshots.map((snapshot, index) => edition(`retained-edition-${index}`, snapshot));
}

describe("Tideglass synthetic retained-history compatibility corpus", () => {
  it("compares every exact adjacent pair across a 24-edition retained Chronicle history deterministically", async () => {
    const editions = retainedSyntheticHistory();
    const repository = new FixtureRepository(editions);
    const principal = { kind: "ACCOUNT" as const, accountId: "fixture" };
    const digests: string[] = [];

    for (let index = 1; index < editions.length; index += 1) {
      const request = {
        chronicleId: "chronicle-tideglass",
        sourceEditionId: editions[index - 1].id,
        targetEditionId: editions[index].id,
      };
      const first = await compareExactEditions(repository, principal, request, { cache: null });
      const second = await compareExactEditions(repository, principal, request, { cache: null });
      if (!first.ok || !second.ok) throw new Error("synthetic retained-history comparison failed");
      expect(first.value.changeSet.status).toBe("COMPLETE");
      expect(first.value.changeSet.changes.length).toBeGreaterThan(0);
      expect(second.value.changeSet.deterministicDigest).toBe(first.value.changeSet.deterministicDigest);
      digests.push(first.value.changeSet.deterministicDigest);
    }

    expect(digests).toHaveLength(23);
    expect(new Set(digests).size).toBeGreaterThan(1);
  });
});
