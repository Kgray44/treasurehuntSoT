import { describe, expect, it } from "vitest";
import { compareExactEditions } from "../../src/tideglass/service";
import { constrainTideglassPassageRepository } from "../../src/tideglass/passage-service";
import { baseSnapshot, clone, edition, FixtureRepository } from "./fixtures";

describe("Tideglass Phase 3 server-passage authorization", () => {
  it("allows a comparison only when both exact editions were included in the trusted server context", async () => {
    const source = edition("edition-a", baseSnapshot());
    const targetSnapshot = clone(baseSnapshot());
    targetSnapshot.chapters[0].title = "Synthetic changed chapter";
    const target = edition("edition-b", targetSnapshot);
    const repository = constrainTideglassPassageRepository(new FixtureRepository([source, target]), [
      source.id,
      target.id,
    ]);

    const result = await compareExactEditions(
      repository,
      { kind: "PASSAGE", subjectId: "public:synthetic-chronicle" },
      { chronicleId: source.chronicleId, sourceEditionId: source.id, targetEditionId: target.id },
      { cache: null },
    );

    expect(result.ok).toBe(true);
  });

  it("fails closed rather than allowing a page query to select an edition outside the trusted context", async () => {
    const source = edition("edition-a", baseSnapshot());
    const target = edition("edition-b", clone(baseSnapshot()));
    const repository = constrainTideglassPassageRepository(new FixtureRepository([source, target]), [source.id]);

    const result = await compareExactEditions(
      repository,
      { kind: "PASSAGE", subjectId: "player:synthetic-owner" },
      { chronicleId: source.chronicleId, sourceEditionId: source.id, targetEditionId: target.id },
      { cache: null },
    );

    expect(result).toMatchObject({ ok: false, code: "EDITION_NOT_AUTHORIZED" });
  });
});
