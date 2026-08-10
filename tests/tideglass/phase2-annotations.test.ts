import { describe, expect, it } from "vitest";
import {
  appendTideglassAnnotation,
  currentTideglassAnnotations,
  tideglassAnnotationWarnings,
  type TideglassAnnotationAppend,
  type TideglassAnnotationRepository,
  type TideglassCreatorAnnotation,
} from "../../src/tideglass/annotations";
import { compareExactEditions } from "../../src/tideglass/service";
import { baseSnapshot, clone, edition, FixtureRepository } from "./fixtures";

class AnnotationMemoryRepository implements TideglassAnnotationRepository {
  rows: TideglassCreatorAnnotation[] = [];

  async listPair(input: Parameters<TideglassAnnotationRepository["listPair"]>[0]) {
    return this.rows.filter((row) =>
      Object.entries(input).every(([key, value]) => row[key as keyof TideglassCreatorAnnotation] === value),
    );
  }

  async findIdempotent(accountId: string, idempotencyKey: string) {
    return (
      this.rows.find((row) => row.createdByAccountId === accountId && row.idempotencyKey === idempotencyKey) ?? null
    );
  }

  async appendRevision(input: TideglassAnnotationAppend) {
    const latest = this.rows
      .filter((row) => row.annotationKey === input.annotationKey)
      .sort((left, right) => right.revision - left.revision)[0];
    if ((latest?.id ?? null) !== input.supersedesAnnotationId) throw new Error("ANNOTATION_REVISION_CONFLICT");
    const { correlationId: _correlationId, ...data } = input;
    void _correlationId;
    const created = {
      ...data,
      id: `annotation-${this.rows.length + 1}`,
      revision: (latest?.revision ?? 0) + 1,
      createdAt: new Date(`2026-08-09T12:00:0${this.rows.length}Z`),
    } satisfies TideglassCreatorAnnotation;
    this.rows.push(created);
    return created;
  }
}

async function comparison() {
  const sourceSnapshot = baseSnapshot();
  const targetSnapshot = clone(sourceSnapshot);
  targetSnapshot.tale.playerCountMax = 8;
  targetSnapshot.chapters[0].blocks[0].title = "Changed story";
  const source = edition("edition-a", sourceSnapshot);
  const target = edition("edition-b", targetSnapshot);
  const result = await compareExactEditions(
    new FixtureRepository([source, target]),
    { kind: "ACCOUNT", accountId: "creator-a" },
    { chronicleId: "chronicle-tideglass", sourceEditionId: source.id, targetEditionId: target.id },
    { cache: null },
  );
  if (!result.ok) throw new Error(result.code);
  return result.value.changeSet;
}

function createInput(changeSet: Awaited<ReturnType<typeof comparison>>) {
  return {
    operation: "CREATE",
    sourceEditionId: changeSet.pair.source.editionId,
    sourceEditionChecksum: changeSet.pair.source.editionChecksum,
    targetEditionId: changeSet.pair.target.editionId,
    targetEditionChecksum: changeSet.pair.target.editionChecksum,
    scopeType: "PAIR",
    annotationKind: "HEADLINE",
    headline: "Major crew update",
    spoilerLevel: "PREVIEW_SAFE",
    highlighted: true,
    replayGuidance: "WORTH_REVISITING",
    idempotencyKey: "create-one",
  };
}

describe("Tideglass Phase 2 Creator annotation revisions", () => {
  it("creates, corrects, and withdraws immutable monotonic revisions", async () => {
    const changeSet = await comparison();
    const semanticBefore = structuredClone(changeSet);
    const repository = new AnnotationMemoryRepository();
    const created = await appendTideglassAnnotation(
      repository,
      "creator-a",
      "chronicle-tideglass",
      changeSet,
      createInput(changeSet),
    );
    if (!created.ok) throw new Error(created.code);
    const revised = await appendTideglassAnnotation(repository, "creator-a", "chronicle-tideglass", changeSet, {
      ...createInput(changeSet),
      operation: "REVISE",
      annotationKey: created.value.annotationKey,
      supersedesAnnotationId: created.value.id,
      headline: "Corrected major crew update",
      idempotencyKey: "revise-one",
    });
    if (!revised.ok) throw new Error(revised.code);
    const withdrawn = await appendTideglassAnnotation(repository, "creator-a", "chronicle-tideglass", changeSet, {
      operation: "WITHDRAW",
      sourceEditionId: changeSet.pair.source.editionId,
      sourceEditionChecksum: changeSet.pair.source.editionChecksum,
      targetEditionId: changeSet.pair.target.editionId,
      targetEditionChecksum: changeSet.pair.target.editionChecksum,
      annotationKey: created.value.annotationKey,
      supersedesAnnotationId: revised.value.id,
      idempotencyKey: "withdraw-one",
    });
    expect(withdrawn.ok && withdrawn.value.revision).toBe(3);
    expect(repository.rows.map((row) => [row.revision, row.state])).toEqual([
      [1, "ACTIVE"],
      [2, "ACTIVE"],
      [3, "WITHDRAWN"],
    ]);
    expect(currentTideglassAnnotations(repository.rows)).toEqual([]);
    expect(changeSet).toEqual(semanticBefore);
  });

  it("replays an idempotent mutation without adding a revision", async () => {
    const changeSet = await comparison();
    const repository = new AnnotationMemoryRepository();
    const first = await appendTideglassAnnotation(
      repository,
      "creator-a",
      "chronicle-tideglass",
      changeSet,
      createInput(changeSet),
    );
    const second = await appendTideglassAnnotation(
      repository,
      "creator-a",
      "chronicle-tideglass",
      changeSet,
      createInput(changeSet),
    );
    expect(first.ok && second.ok && second.idempotent).toBe(true);
    expect(repository.rows).toHaveLength(1);
  });

  it("rejects reuse of an idempotency key for a different mutation payload", async () => {
    const changeSet = await comparison();
    const repository = new AnnotationMemoryRepository();
    const first = await appendTideglassAnnotation(
      repository,
      "creator-a",
      "chronicle-tideglass",
      changeSet,
      createInput(changeSet),
    );
    const conflicting = await appendTideglassAnnotation(repository, "creator-a", "chronicle-tideglass", changeSet, {
      ...createInput(changeSet),
      headline: "Different request using the same key",
    });
    expect(first.ok).toBe(true);
    expect(conflicting).toMatchObject({ ok: false, code: "ANNOTATION_REVISION_CONFLICT" });
    expect(repository.rows).toHaveLength(1);
  });

  it("prevents another authorized collaborator from hijacking a logical annotation revision", async () => {
    const changeSet = await comparison();
    const repository = new AnnotationMemoryRepository();
    const created = await appendTideglassAnnotation(
      repository,
      "creator-a",
      "chronicle-tideglass",
      changeSet,
      createInput(changeSet),
    );
    if (!created.ok) throw new Error(created.code);
    const foreign = await appendTideglassAnnotation(repository, "creator-b", "chronicle-tideglass", changeSet, {
      ...createInput(changeSet),
      operation: "REVISE",
      annotationKey: created.value.annotationKey,
      supersedesAnnotationId: created.value.id,
      idempotencyKey: "foreign-revision",
    });
    expect(foreign).toMatchObject({ ok: false, code: "ANNOTATION_REVISION_CONFLICT" });
    expect(repository.rows).toHaveLength(1);
  });

  it("rejects cross-pair binding, Change-ID IDOR, mass assignment, and revision hijacking", async () => {
    const changeSet = await comparison();
    const repository = new AnnotationMemoryRepository();
    const crossPair = await appendTideglassAnnotation(repository, "creator-a", "chronicle-tideglass", changeSet, {
      ...createInput(changeSet),
      sourceEditionChecksum: "0".repeat(64),
      idempotencyKey: "cross-pair",
    });
    const crossChronicle = await appendTideglassAnnotation(repository, "creator-a", "chronicle-other", changeSet, {
      ...createInput(changeSet),
      idempotencyKey: "cross-chronicle",
    });
    const idor = await appendTideglassAnnotation(repository, "creator-a", "chronicle-tideglass", changeSet, {
      ...createInput(changeSet),
      scopeType: "CHANGE",
      changeRecordId: "foreign-change",
      idempotencyKey: "idor",
    });
    const massAssignment = await appendTideglassAnnotation(repository, "creator-a", "chronicle-tideglass", changeSet, {
      ...createInput(changeSet),
      createdByAccountId: "attacker",
      idempotencyKey: "mass-assignment",
    });
    const hijack = await appendTideglassAnnotation(repository, "creator-a", "chronicle-tideglass", changeSet, {
      ...createInput(changeSet),
      operation: "REVISE",
      annotationKey: "foreign-key",
      supersedesAnnotationId: "foreign-revision",
      idempotencyKey: "hijack",
    });
    expect(crossPair).toMatchObject({ ok: false, code: "ANNOTATION_PAIR_MISMATCH" });
    expect(crossChronicle).toMatchObject({ ok: false, code: "ANNOTATION_PAIR_MISMATCH" });
    expect(idor).toMatchObject({ ok: false, code: "ANNOTATION_CHANGE_UNAVAILABLE" });
    expect(massAssignment).toMatchObject({ ok: false, code: "ANNOTATION_INVALID" });
    expect(hijack).toMatchObject({ ok: false, code: "ANNOTATION_REVISION_CONFLICT" });
  });

  it("rejects scriptable HTML, JavaScript URLs, storage paths, control bytes, and oversized text", async () => {
    const changeSet = await comparison();
    for (const [index, headline] of [
      "<script>alert(1)</script>",
      "javascript:alert(1)",
      "s3://private-bucket/object",
      "bad\u0000value",
      "x".repeat(161),
    ].entries()) {
      const result = await appendTideglassAnnotation(
        new AnnotationMemoryRepository(),
        "creator-a",
        "chronicle-tideglass",
        changeSet,
        { ...createInput(changeSet), headline, idempotencyKey: `unsafe-${index}` },
      );
      expect(result.ok).toBe(false);
    }
  });

  it("does not let a Change-scoped note classify story evidence as preview safe", async () => {
    const changeSet = await comparison();
    const storyChange = changeSet.changes.find((change) => change.spoilerLevel === "STORY_SPOILER");
    if (!storyChange) throw new Error("missing story fixture change");
    const result = await appendTideglassAnnotation(
      new AnnotationMemoryRepository(),
      "creator-a",
      "chronicle-tideglass",
      changeSet,
      {
        ...createInput(changeSet),
        scopeType: "CHANGE",
        changeRecordId: storyChange.id,
        spoilerLevel: "PREVIEW_SAFE",
        idempotencyKey: "spoiler-lowering",
      },
    );
    expect(result).toMatchObject({ ok: false, code: "ANNOTATION_INVALID" });
  });

  it("warns without censoring machine/Creator contradictions and major omissions", async () => {
    const changeSet = await comparison();
    const repository = new AnnotationMemoryRepository();
    const created = await appendTideglassAnnotation(repository, "creator-a", "chronicle-tideglass", changeSet, {
      ...createInput(changeSet),
      headline: "Minor wording update with no gameplay changes",
    });
    expect(created.ok).toBe(true);
    const warnings = tideglassAnnotationWarnings(changeSet, repository.rows);
    expect(warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "TG-ANNOTATION-SIGNIFICANCE-CONTRADICTION",
        "TG-ANNOTATION-GAMEPLAY-CONTRADICTION",
        "TG-ANNOTATION-MAJOR-OMISSION",
      ]),
    );
    expect(repository.rows[0].headline).toBe("Minor wording update with no gameplay changes");
  });

  it("warns when an accessibility improvement claim conflicts with a field emptied in place", async () => {
    const sourceSnapshot = baseSnapshot();
    sourceSnapshot.chapters[0].blocks.push({
      id: "block-captioned-image",
      blockType: "image",
      title: "Synthetic image",
      configuration: {
        assetId: "asset-cover",
        caption: "Safe synthetic caption",
        altText: "A synthetic harbor illustration.",
        displayMode: "journalFrame",
        objectFit: "cover",
        focalX: 50,
        focalY: 50,
        entranceMotion: "reveal",
        completionMode: "playerConfirmation",
      },
    });
    const targetSnapshot = clone(sourceSnapshot);
    (targetSnapshot.chapters[0].blocks.at(-1)?.configuration as Record<string, unknown>).caption = "";
    const compared = await compareExactEditions(
      new FixtureRepository([
        edition("edition-captioned", sourceSnapshot),
        edition("edition-caption-removed", targetSnapshot),
      ]),
      { kind: "ACCOUNT", accountId: "creator-a" },
      {
        chronicleId: "chronicle-tideglass",
        sourceEditionId: "edition-captioned",
        targetEditionId: "edition-caption-removed",
      },
      { cache: null },
    );
    if (!compared.ok) throw new Error(compared.code);
    const repository = new AnnotationMemoryRepository();
    const created = await appendTideglassAnnotation(
      repository,
      "creator-a",
      "chronicle-tideglass",
      compared.value.changeSet,
      {
        ...createInput(compared.value.changeSet),
        headline: "Accessibility improved",
        idempotencyKey: "accessibility-claim",
      },
    );
    expect(created.ok).toBe(true);
    expect(tideglassAnnotationWarnings(compared.value.changeSet, repository.rows)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "TG-ANNOTATION-ACCESSIBILITY-CONTRADICTION" })]),
    );
  });
});
