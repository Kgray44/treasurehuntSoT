import { describe, expect, it } from "vitest";
import {
  TIDEGLASS_CHANGE_CODE_REGISTRY_VERSION,
  TIDEGLASS_PROJECTION_POLICY_VERSION,
  TIDEGLASS_SUMMARY_POLICY_VERSION,
  BoundedTideglassComparisonCache,
  changeCategories,
  changeKinds,
  type TideglassCreatorAnnotation,
  assessTideglassSignificance,
  buildTideglassSummary,
  classifyTideglassChange,
  classifyTideglassChangeSet,
  compatibilityDeltas,
  projectTideglassComparison,
  selectTideglassAudience,
} from "../../src/tideglass";
import { compareExactEditions } from "../../src/tideglass/service";
import { baseSnapshot, clone, edition, FixtureRepository, largeSnapshot } from "./fixtures";

const principal = { kind: "ACCOUNT" as const, accountId: "phase2-creator" };

async function resultFor(mutator?: (target: ReturnType<typeof baseSnapshot>) => void) {
  const sourceSnapshot = baseSnapshot();
  const targetSnapshot = clone(sourceSnapshot);
  mutator?.(targetSnapshot);
  const source = edition("edition-a", sourceSnapshot);
  const target = edition("edition-b", targetSnapshot);
  const result = await compareExactEditions(
    new FixtureRepository([source, target]),
    principal,
    { chronicleId: "chronicle-tideglass", sourceEditionId: source.id, targetEditionId: target.id },
    { cache: null },
  );
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

describe("Tideglass Phase 2 governed intelligence", () => {
  it("classifies every supported Change Record with a stable governed code and no unknown success", async () => {
    const result = await resultFor((target) => {
      target.tale.playerCountMax = 8;
      target.chapters[0].blocks[0].title = "A changed synthetic clue";
    });
    const classified = classifyTideglassChangeSet(result.changeSet);
    expect(classified.length).toBeGreaterThanOrEqual(2);
    expect(
      classified.every((change) => change.changeCode.startsWith("TG-") && change.changeCode !== "TG-UNKNOWN"),
    ).toBe(true);
    expect(TIDEGLASS_CHANGE_CODE_REGISTRY_VERSION).toBe("tideglass.change-codes.v1");
  });

  it("keeps the full governed category/kind code matrix stable", async () => {
    const result = await resultFor((target) => {
      target.tale.playerCountMax = 8;
    });
    const seed = result.changeSet.changes[0];
    const codes = changeCategories.flatMap((category) =>
      changeKinds.map(
        (kind) =>
          classifyTideglassChange({
            ...seed,
            id: `${category}:${kind}`,
            category,
            kind,
            evidence: { ...seed.evidence, semanticPath: `registry.${category}.${kind}` },
          }).changeCode,
      ),
    );
    expect(codes).toHaveLength(changeCategories.length * changeKinds.length);
    expect(codes.every((code) => /^TG-[A-Z0-9-]+$/u.test(code) && code !== "TG-UNKNOWN")).toBe(true);
  });

  it("escalates an accessibility regression without reducing positive accessibility intelligence", async () => {
    const addedSource = baseSnapshot();
    addedSource.chapters[0].blocks.push({
      id: "block-image",
      blockType: "image",
      title: "Synthetic image",
      configuration: {
        assetId: "asset-cover",
        caption: "",
        altText: "A synthetic harbor illustration.",
        displayMode: "journalFrame",
        objectFit: "cover",
        focalX: 50,
        focalY: 50,
        entranceMotion: "reveal",
        completionMode: "playerConfirmation",
      },
    });
    const addedTarget = clone(addedSource);
    (addedTarget.chapters[0].blocks.at(-1)?.configuration as Record<string, unknown>).caption =
      "Safe synthetic caption";
    const added = await compareExactEditions(
      new FixtureRepository([
        edition("edition-no-caption-a", addedSource),
        edition("edition-captioned-a", addedTarget),
      ]),
      principal,
      {
        chronicleId: "chronicle-tideglass",
        sourceEditionId: "edition-no-caption-a",
        targetEditionId: "edition-captioned-a",
      },
      { cache: null },
    );
    if (!added.ok) throw new Error(added.code);
    const removedSource = clone(addedTarget);
    const removedTarget = clone(removedSource);
    (removedTarget.chapters[0].blocks.at(-1)?.configuration as Record<string, unknown>).caption = "";
    const source = edition("edition-captioned", removedSource);
    const target = edition("edition-no-caption", removedTarget);
    const removed = await compareExactEditions(
      new FixtureRepository([source, target]),
      principal,
      { chronicleId: "chronicle-tideglass", sourceEditionId: source.id, targetEditionId: target.id },
      { cache: null },
    );
    if (!removed.ok) throw new Error(removed.code);
    const improvement = classifyTideglassChangeSet(added.value.changeSet).find(
      (change) => change.category === "ACCESSIBILITY",
    );
    const regression = classifyTideglassChangeSet(removed.value.changeSet).find(
      (change) => change.category === "ACCESSIBILITY",
    );
    expect(improvement).toMatchObject({ changeCode: "TG-A11Y-CAPTION", governedSignificance: "MAJOR" });
    expect(regression).toMatchObject({
      changeCode: "TG-A11Y-CAPTION",
      governedSignificance: "MAJOR",
      compatibilityRelevant: true,
    });
  });

  it("never lowers Phase 1 significance and reports explainable compatibility-critical evidence", async () => {
    const result = await resultFor((target) => {
      target.tale.minimumPlatformVersion = "9.0.0";
    });
    const changes = classifyTideglassChangeSet(result.changeSet);
    const assessment = assessTideglassSignificance(changes);
    expect(assessment.level).toBe("MAJOR");
    expect(assessment.compatibilityCritical).toBe(true);
    expect(assessment.reasons.flatMap((reason) => reason.changeIds)).toEqual(
      expect.arrayContaining(changes.map((c) => c.id)),
    );
    expect(changes[0].changeCode).toBe("TG-COMPAT-PLATFORM");
  });

  it("escalates three independent major categories with topology or ending evidence deterministically", async () => {
    const result = await resultFor((target) => {
      target.tale.playerCountMax = 8;
      target.tale.minimumPlatformVersion = "9.0.0";
      target.chapters.push({
        id: "chapter-new",
        title: "New chapter",
        blocks: [],
        orderIndex: 1,
        entryBlockId: null,
        completionBlockId: null,
      });
      target.chapters[0].blocks.push({
        id: "ending-new",
        blockType: "taleComplete",
        title: "A second ending",
        configuration: { completionMode: "playerConfirmation" },
      });
    });
    const assessment = assessTideglassSignificance(classifyTideglassChangeSet(result.changeSet));
    expect(assessment.level).toBe("TRANSFORMATIVE");
    expect(assessment.reasons[0].code).toBe("TG-SIGNIFICANCE-TRANSFORMATIVE-CROSS-SYSTEM");
  });

  it("emits evidence-linked compatibility deltas without claiming provider availability", async () => {
    const result = await resultFor((target) => {
      target.tale.providerRequirements = ["visionLocation"];
      target.tale.captainRequired = false;
    });
    const deltas = compatibilityDeltas(classifyTideglassChangeSet(result.changeSet));
    expect(deltas.map((delta) => delta.dimension)).toEqual(expect.arrayContaining(["PROVIDER", "CAPTAIN"]));
    expect(deltas.every((delta) => delta.sourceChangeIds.length === 1 && delta.certainty === "EXACT")).toBe(true);
    expect(JSON.stringify(deltas)).not.toMatch(/available|certified|ready/i);
  });

  it("keeps public counts and DTOs limited to preview-safe records", async () => {
    const result = await resultFor((target) => {
      target.tale.playerCountMax = 8;
      target.chapters[0].blocks[0].title = "Hidden synthetic story detail";
    });
    const projection = projectTideglassComparison(result, "PUBLIC_PREVIEW", "DETAILED");
    const serialized = JSON.stringify(projection);
    expect(projection.visibleChangeCount).toBeGreaterThan(0);
    expect(serialized).not.toContain("Hidden synthetic story detail");
    expect(serialized).not.toContain("block-opening");
    expect(serialized).not.toContain("withheldChangeCount");
    expect(serialized).not.toContain("hasWithheldChanges");
    expect(projection.changes.every((change) => change.disclosureState === "VISIBLE")).toBe(true);
    expect(
      projection.summary.categoryGroups.every(
        (group) => typeof group.labelKey === "string" && typeof group.accessibleDescriptionKey === "string",
      ),
    ).toBe(true);
  });

  it("marks Player spoilers DISCLOSABLE while withholding Creator, Captain, and private classes", async () => {
    const result = await resultFor((target) => {
      target.chapters[0].blocks[0].title = "Changed story detail";
      target.chapters[0].blocks[0].completion = { captainInstruction: "private operation" };
    });
    const player = projectTideglassComparison(result, "PLAYER_SAFE", "DETAILED");
    expect(player.changes.some((change) => change.disclosureState === "DISCLOSABLE")).toBe(true);
    expect(JSON.stringify(player)).not.toContain("captainInstruction");
  });

  it("marks unsupported semantics partial and exposes only safe unavailable-section metadata", async () => {
    const source = edition(
      "edition-unsupported-a",
      { schemaVersion: 99, unknowable: "PRIVATE_UNKNOWN_A" },
      { schemaVersion: 99 },
    );
    const target = edition(
      "edition-unsupported-b",
      { schemaVersion: 99, unknowable: "PRIVATE_UNKNOWN_B" },
      { schemaVersion: 99 },
    );
    const compared = await compareExactEditions(
      new FixtureRepository([source, target]),
      principal,
      { chronicleId: "chronicle-tideglass", sourceEditionId: source.id, targetEditionId: target.id },
      { cache: null },
    );
    if (!compared.ok) throw new Error(compared.code);
    const projection = projectTideglassComparison(compared.value, "PUBLIC_PREVIEW", "DETAILED");
    expect(projection.projectionStatus).toBe("PARTIAL");
    expect(projection.summary.partial).toBe(true);
    expect(projection.summary.unavailableSections).toContainEqual(
      expect.objectContaining({ code: "SCHEMA_UNSUPPORTED", sourceSchemaVersion: 99 }),
    );
    expect(JSON.stringify(projection)).not.toMatch(/PRIVATE_UNKNOWN|unknowable/u);
  });

  it("allows a requested audience only to narrow the server-derived maximum", () => {
    expect(selectTideglassAudience("PLAYER_SAFE", "CREATOR_FULL")).toBe("PLAYER_SAFE");
    expect(selectTideglassAudience("CREATOR_FULL", "PUBLIC_PREVIEW")).toBe("PUBLIC_PREVIEW");
  });

  it("produces traceable, byte-stable summary groups and policy evidence", async () => {
    const result = await resultFor((target) => {
      target.tale.playerCountMax = 8;
      target.tale.minimumPlatformVersion = "9.0.0";
    });
    const first = buildTideglassSummary(result.changeSet);
    const second = buildTideglassSummary(result.changeSet);
    expect(second).toEqual(first);
    expect(first.summaryPolicyVersion).toBe(TIDEGLASS_SUMMARY_POLICY_VERSION);
    expect(first.projectionPolicyVersion).toBe(TIDEGLASS_PROJECTION_POLICY_VERSION);
    for (const line of first.categoryGroups.flatMap((group) => group.lines)) {
      expect(line.changeIds.length).toBeGreaterThan(0);
      expect(line.changeCodes.every((code) => code.startsWith("TG-"))).toBe(true);
    }
  });

  it("binds annotation revisions into summary and projection digests while filtering hidden notes", async () => {
    const result = await resultFor((target) => {
      target.tale.playerCountMax = 8;
      target.chapters[0].blocks[0].title = "Hidden synthetic story detail";
    });
    const storyChange = result.changeSet.changes.find((change) => change.spoilerLevel === "STORY_SPOILER");
    if (!storyChange) throw new Error("missing story fixture change");
    const annotation = {
      id: "annotation-revision-1",
      annotationKey: "annotation-key",
      revision: 1,
      chronicleId: "chronicle-tideglass",
      sourceEditionId: result.changeSet.pair.source.editionId,
      sourceEditionChecksum: result.changeSet.pair.source.editionChecksum,
      targetEditionId: result.changeSet.pair.target.editionId,
      targetEditionChecksum: result.changeSet.pair.target.editionChecksum,
      comparisonPolicyVersion: result.changeSet.comparisonPolicyVersion,
      scopeType: "CHANGE",
      category: null,
      changeRecordId: storyChange.id,
      annotationKind: "DETAIL",
      headline: "Creator-only plot note",
      body: "The synthetic ending clue moves to the opening block.",
      spoilerLevel: "STORY_SPOILER",
      highlighted: false,
      replayGuidance: "WORTH_REVISITING",
      createdByAccountId: "phase2-creator",
      createdAt: "2026-08-09T12:00:00.000Z",
      supersedesAnnotationId: null,
      state: "ACTIVE",
      idempotencyKey: "annotation-create",
    } satisfies TideglassCreatorAnnotation;
    const revised = {
      ...annotation,
      id: "annotation-revision-2",
      revision: 2,
      headline: "Corrected creator-only plot note",
      supersedesAnnotationId: annotation.id,
      idempotencyKey: "annotation-revise",
    } satisfies TideglassCreatorAnnotation;
    const creatorOnly = {
      ...annotation,
      id: "annotation-creator-only",
      annotationKey: "annotation-creator-only-key",
      revision: 1,
      scopeType: "PAIR",
      changeRecordId: null,
      headline: "Internal Creator context",
      spoilerLevel: "CREATOR_ONLY",
      supersedesAnnotationId: null,
      idempotencyKey: "annotation-creator-only",
    } satisfies TideglassCreatorAnnotation;

    const firstSummary = buildTideglassSummary(result.changeSet, [annotation]);
    const revisedSummary = buildTideglassSummary(result.changeSet, [annotation, revised]);
    const currentOnlySummary = buildTideglassSummary(result.changeSet, [revised]);
    expect(revisedSummary.annotationDigest).not.toBe(firstSummary.annotationDigest);
    expect(revisedSummary.digest).not.toBe(firstSummary.digest);
    expect(revisedSummary.annotationDigest).toBe(currentOnlySummary.annotationDigest);
    expect(revisedSummary.digest).toBe(currentOnlySummary.digest);

    const withdrawn = {
      ...revised,
      id: "annotation-revision-3",
      revision: 3,
      state: "WITHDRAWN",
      supersedesAnnotationId: revised.id,
      idempotencyKey: "annotation-withdraw",
    } satisfies TideglassCreatorAnnotation;
    expect(buildTideglassSummary(result.changeSet, [annotation, revised, withdrawn]).annotationDigest).toBe(
      buildTideglassSummary(result.changeSet).annotationDigest,
    );

    const history = [annotation, revised, creatorOnly];
    const publicProjection = projectTideglassComparison(result, "PUBLIC_PREVIEW", "DETAILED", history);
    const playerProjection = projectTideglassComparison(result, "PLAYER_SAFE", "DETAILED", history);
    const creatorProjection = projectTideglassComparison(result, "CREATOR_FULL", "DETAILED", history);
    expect(JSON.stringify(publicProjection)).not.toMatch(
      /creator-only|internal creator|annotation-key|annotation-revision/iu,
    );
    expect(JSON.stringify(playerProjection)).not.toContain("Internal Creator context");
    expect(creatorProjection.annotations).toHaveLength(2);
    expect(creatorProjection.annotations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: revised.id,
          annotationKey: revised.annotationKey,
          revision: 2,
          disclosureState: "VISIBLE",
        }),
      ]),
    );
    expect(creatorProjection.projectionDigest).not.toBe(publicProjection.projectionDigest);
  });

  it("keeps large comparison intelligence, projections, annotations, and cache hits within the Phase 2 baseline", async () => {
    const sourceSnapshot = largeSnapshot(500);
    const imageBlock = sourceSnapshot.chapters[5].blocks[20];
    imageBlock.blockType = "image";
    imageBlock.configuration = {
      assetId: "large-asset-10",
      caption: "",
      altText: "A safe large synthetic illustration.",
      displayMode: "journalFrame",
      objectFit: "cover",
      focalX: 50,
      focalY: 50,
      entranceMotion: "reveal",
      completionMode: "playerConfirmation",
    };
    const targetSnapshot = clone(sourceSnapshot);
    targetSnapshot.tale.playerCountMax = 8;
    targetSnapshot.tale.captainRequired = false;
    targetSnapshot.tale.minimumPlatformVersion = "9.0.0";
    targetSnapshot.tale.providerRequirements = ["visionLocation", "captainManual"];
    targetSnapshot.chapters[5].blocks[21].title = "Changed large synthetic block";
    (targetSnapshot.chapters[5].blocks[20].configuration as Record<string, unknown>).caption =
      "Safe large synthetic caption";
    targetSnapshot.assets[10].mimeType = "image/png";
    targetSnapshot.artifacts[10].persistentAfterUnlock = false;
    targetSnapshot.locations[10].verificationProfile = { provider: "visionLocation" };
    const source = edition("edition-large-a", sourceSnapshot);
    const target = edition("edition-large-b", targetSnapshot);
    const cache = new BoundedTideglassComparisonCache(4);
    const startedAt = performance.now();
    const request = { chronicleId: "chronicle-tideglass", sourceEditionId: source.id, targetEditionId: target.id };
    const firstComparison = await compareExactEditions(new FixtureRepository([source, target]), principal, request, {
      cache,
    });
    const cachedComparison = await compareExactEditions(new FixtureRepository([source, target]), principal, request, {
      cache,
    });
    if (!firstComparison.ok || !cachedComparison.ok) throw new Error("large comparison failed");
    const result = firstComparison.value;
    const annotations = Array.from({ length: 2_000 }, (_, index) => ({
      id: `annotation-${index}`,
      annotationKey: `annotation-key-${index}`,
      revision: 1,
      chronicleId: "chronicle-tideglass",
      sourceEditionId: result.changeSet.pair.source.editionId,
      sourceEditionChecksum: result.changeSet.pair.source.editionChecksum,
      targetEditionId: result.changeSet.pair.target.editionId,
      targetEditionChecksum: result.changeSet.pair.target.editionChecksum,
      comparisonPolicyVersion: result.changeSet.comparisonPolicyVersion,
      scopeType: "PAIR" as const,
      category: null,
      changeRecordId: null,
      annotationKind: "DETAIL" as const,
      headline: `Synthetic annotation ${index}`,
      body: null,
      spoilerLevel: "CREATOR_ONLY" as const,
      highlighted: index % 100 === 0,
      replayGuidance: "NO_RECOMMENDATION" as const,
      createdByAccountId: "phase2-creator",
      createdAt: "2026-08-09T12:00:00.000Z",
      supersedesAnnotationId: null,
      state: "ACTIVE" as const,
      idempotencyKey: `annotation-create-${index}`,
    })) satisfies TideglassCreatorAnnotation[];
    const first = projectTideglassComparison(result, "CREATOR_FULL", "CONCISE", annotations);
    const second = projectTideglassComparison(result, "CREATOR_FULL", "CONCISE", [...annotations].reverse());
    const elapsedMs = performance.now() - startedAt;
    const classified = classifyTideglassChangeSet(result.changeSet);
    expect(classified.map((change) => change.category)).toEqual(
      expect.arrayContaining(["STORY_CONTENT", "MEDIA", "ACCESSIBILITY", "SETUP_REQUIREMENTS", "COMPATIBILITY"]),
    );
    expect(cachedComparison.value.operation.cacheStatus).toBe("HIT");
    expect(first.annotations).toHaveLength(2_000);
    expect(first.changes.every((change) => typeof change.kindLabelKey === "string")).toBe(true);
    expect(second.projectionDigest).toBe(first.projectionDigest);
    expect(elapsedMs).toBeLessThan(5_000);
  });

  it("returns a deterministic explicit no-change summary for equivalent editions", async () => {
    const result = await resultFor();
    const summary = buildTideglassSummary(result.changeSet);
    expect(result.changeSet.status).toBe("NO_MEANINGFUL_CHANGE");
    expect(summary.headline.templateKey).toBe("tideglass.summary.no-meaningful-change");
    expect(summary.categoryGroups).toEqual([]);
  });
});
