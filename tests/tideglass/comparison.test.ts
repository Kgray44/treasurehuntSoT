import { describe, expect, it } from "vitest";
import { compareSemanticSnapshots, matchEntities } from "../../src/tideglass/comparison";
import { canonicalizePublishedSnapshot, type TideglassHistoricalReader } from "../../src/tideglass/semantic";
import type { SemanticEntity } from "../../src/tideglass/core";
import { anchor, baseSnapshot, clone, type FixtureSnapshot } from "./fixtures";

function semantic(snapshot: unknown, id: string, checksum = id, readers?: readonly TideglassHistoricalReader[]) {
  const result = canonicalizePublishedSnapshot(JSON.stringify(snapshot), anchor(id, checksum), readers);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function addBlock(snapshot: FixtureSnapshot, block: Record<string, unknown>, chapterIndex = 0) {
  const blocks = snapshot.chapters[chapterIndex].blocks;
  blocks.push({
    internalLabel: null,
    presentation: {},
    completion: {},
    creatorNotes: null,
    isEnabled: true,
    schemaVersion: 1,
    orderIndex: blocks.length,
    nextBlockId: null,
    connections: [],
    ...block,
    chapterId: snapshot.chapters[chapterIndex].id,
  });
}

function artifactReveal(recipientPolicy: string) {
  return {
    id: "block-artifact",
    blockType: "artifactReveal",
    title: "Synthetic artifact reveal",
    configuration: {
      ordinaryObjectLabel: "token",
      loreTitle: "Synthetic token",
      loreDescription: "Invented fixture lore.",
      addToCollection: true,
      recipientPolicy,
      selectedRecipientProfileIds: [],
      requiredCrewRole: null,
      discoveringMembershipId: null,
      personalGrantState: "COLLECTED",
      custodyKind: "PERSONAL",
      assemblyDefinitionId: null,
      componentRole: null,
      receiptState: "ACTIVE",
      correctionOfGrantId: null,
      correctionReason: null,
      revealAnimation: "lantern",
      completionMode: "playerConfirmation",
      artifactId: "artifact-glass-token",
    },
  };
}

function imageBlock(caption = "") {
  return {
    id: "block-image",
    blockType: "image",
    title: "Synthetic image",
    configuration: {
      assetId: "asset-cover",
      caption,
      altText: "A synthetic harbor illustration.",
      displayMode: "journalFrame",
      objectFit: "cover",
      focalX: 50,
      focalY: 50,
      entranceMotion: "reveal",
      completionMode: "playerConfirmation",
    },
  };
}

describe("Tideglass matching and domain comparators", () => {
  it("F04 emits one structural addition for a new chapter", () => {
    const source = baseSnapshot();
    const target = clone(source);
    target.chapters.push({
      id: "chapter-added",
      title: "Added synthetic chapter",
      subtitle: null,
      description: null,
      coverAssetId: null,
      estimatedDuration: 10,
      isOptional: true,
      metadata: {},
      orderIndex: 1,
      entryBlockId: null,
      completionBlockId: null,
      blocks: [],
    });
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(result.changes).toContainEqual(
      expect.objectContaining({
        category: "STRUCTURE",
        kind: "ADDED",
        entityType: "CHAPTER",
        targetEntityId: "chapter-added",
      }),
    );
  });

  it("F07 never fuzzy-matches recreated blocks with identical prose", () => {
    const source = baseSnapshot();
    const target = clone(source);
    target.chapters[0].blocks[0].id = "block-recreated";
    target.chapters[0].blocks[0].chapterId = "chapter-opening";
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(result.changes).toContainEqual(
      expect.objectContaining({ kind: "REMOVED", sourceEntityId: "block-opening" }),
    );
    expect(result.changes).toContainEqual(
      expect.objectContaining({ kind: "ADDED", targetEntityId: "block-recreated" }),
    );
    expect(result.changes.some((change) => change.kind === "MODIFIED" && change.entityType === "BLOCK")).toBe(false);
  });

  it("F08 supports explicit replacement only through an explicit matching-unit map", () => {
    const source: SemanticEntity = { id: "old", entityType: "BLOCK", facts: [] };
    const target: SemanticEntity = { id: "new", entityType: "BLOCK", facts: [] };
    expect(matchEntities([source], [target], { old: "new" })).toEqual([
      { kind: "EXPLICIT_REPLACEMENT", source, target },
    ]);
  });

  it("F09 classifies a new choice branch", () => {
    const source = baseSnapshot();
    const target = clone(source);
    addBlock(target, {
      id: "block-choice",
      blockType: "choice",
      title: "Choose a synthetic course",
      configuration: {
        prompt: "Choose.",
        choices: [
          { id: "choice-a", label: "Finish", targetBlockId: "block-finish" },
          { id: "choice-b", label: "Return", targetBlockId: "block-opening" },
        ],
        reversible: false,
        completionMode: "playerConfirmation",
      },
    });
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(
      result.changes.some((change) => change.category === "BRANCHING_AND_CHOICES" && change.kind === "ADDED"),
    ).toBe(true);
  });

  it("F10 detects a stable graph edge target rewire", () => {
    const source = baseSnapshot();
    const target = clone(source);
    const edge = (target.chapters[0].blocks[0].connections as Array<Record<string, unknown>>)[0];
    edge.targetBlockId = "block-opening";
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(result.changes).toContainEqual(
      expect.objectContaining({ category: "BRANCHING_AND_CHOICES", kind: "REWIRED" }),
    );
  });

  it("F11 classifies a new ending", () => {
    const source = baseSnapshot();
    const target = clone(source);
    addBlock(target, {
      id: "block-alternate-ending",
      blockType: "taleComplete",
      title: "Alternate synthetic ending",
      configuration: {
        finaleHeading: "Another ending",
        finaleContent: "A second invented outcome.",
        completionMessage: "Complete.",
        credits: "",
        replayAvailable: true,
        completionMode: "playerConfirmation",
      },
    });
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(result.changes).toContainEqual(expect.objectContaining({ category: "ENDING", kind: "ADDED" }));
  });

  it("F12 classifies completion-provider changes", () => {
    const source = baseSnapshot();
    const target = clone(source);
    (target.chapters[0].blocks[0].configuration as Record<string, unknown>).completionMode = "captainManual";
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(result.changes.some((change) => change.category === "COMPLETION" && change.kind === "MODIFIED")).toBe(true);
  });

  it("F13 classifies artifact recipient semantics", () => {
    const source = baseSnapshot();
    addBlock(source, artifactReveal("ALL_ACTIVE_PLAYERS"));
    const target = clone(source);
    (target.chapters[0].blocks.at(-1)?.configuration as Record<string, unknown>).recipientPolicy = "DISCOVERING_PLAYER";
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(result.changes.some((change) => change.category === "ARTIFACT" && change.kind === "MODIFIED")).toBe(true);
  });

  it("F14 classifies location/provider changes without exposing coordinates", () => {
    const source = baseSnapshot();
    source.locations.push({
      id: "location-glass-harbor",
      name: "Glass Harbor",
      locationType: "STORY",
      exactness: "APPROXIMATE",
      mapX: 12.345,
      mapY: 67.89,
      verificationProfile: { provider: "captainManual" },
      orderIndex: 0,
    });
    const target = clone(source);
    target.locations[0].verificationProfile = { provider: "visionLocation" };
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(result.changes.some((change) => change.category === "LOCATION_AND_MAP" && change.kind === "MODIFIED")).toBe(
      true,
    );
    expect(JSON.stringify(result)).not.toContain("12.345");
  });

  it("F15 classifies a caption addition as accessibility", () => {
    const source = baseSnapshot();
    addBlock(source, imageBlock(""));
    const target = clone(source);
    (target.chapters[0].blocks.at(-1)?.configuration as Record<string, unknown>).caption = "A safe synthetic caption.";
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(result.changes.some((change) => change.category === "ACCESSIBILITY" && change.kind === "MODIFIED")).toBe(
      true,
    );
  });

  it("F16 classifies a static/reduced-motion fallback addition as accessibility", () => {
    const source = baseSnapshot();
    addBlock(source, imageBlock());
    const target = clone(source);
    target.chapters[0].blocks.at(-1)!.presentation = { staticAssetId: "asset-cover" };
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(result.changes.some((change) => change.category === "ACCESSIBILITY" && change.kind === "ADDED")).toBe(true);
  });

  it("F17 classifies Player/Captain requirement changes", () => {
    const source = baseSnapshot();
    const target = clone(source);
    target.tale.playerCountMin = 3;
    target.tale.captainRequired = false;
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(result.changes.filter((change) => change.category === "SETUP_REQUIREMENTS")).toHaveLength(2);
  });

  it("F18 classifies minimum platform/provider requirement changes", () => {
    const source = baseSnapshot();
    const target = clone(source);
    target.tale.minimumPlatformVersion = "2.0.0";
    target.tale.providerRequirements = ["captainManual", "visionLocation"];
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(result.changes.filter((change) => change.category === "COMPATIBILITY")).toHaveLength(2);
  });

  it("F21 reports duplicate stable identity as unavailable instead of choosing a match", () => {
    const source = baseSnapshot();
    const target = clone(source);
    target.chapters[0].blocks.push(clone(target.chapters[0].blocks[0]));
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    expect(result.status).toBe("PARTIAL");
    expect(result.unsupportedSections).toContainEqual(
      expect.objectContaining({ section: "blocks", code: "AMBIGUOUS_IDENTITY" }),
    );
  });

  it("F23 reverses additions/removals and changes comparison identity", () => {
    const source = baseSnapshot();
    const target = clone(source);
    target.chapters.push({
      id: "chapter-directional",
      title: "Directional chapter",
      blocks: [],
      orderIndex: 1,
      entryBlockId: null,
      completionBlockId: null,
    });
    const a = semantic(source, "edition-a", "checksum-a");
    const b = semantic(target, "edition-b", "checksum-b");
    const forward = compareSemanticSnapshots(a, b);
    const reverse = compareSemanticSnapshots(b, a);
    expect(forward.changes).toContainEqual(
      expect.objectContaining({ kind: "ADDED", targetEntityId: "chapter-directional" }),
    );
    expect(reverse.changes).toContainEqual(
      expect.objectContaining({ kind: "REMOVED", sourceEntityId: "chapter-directional" }),
    );
    expect(reverse.comparisonId).not.toBe(forward.comparisonId);
  });

  it("F27 compares a meaningful complex Voyage across all required domains", () => {
    const source = baseSnapshot();
    addBlock(source, artifactReveal("ALL_ACTIVE_PLAYERS"));
    addBlock(source, imageBlock(""));
    const target = clone(source);
    addBlock(target, {
      id: "block-optional-branch",
      blockType: "choice",
      title: "Optional synthetic branch",
      configuration: {
        prompt: "Choose a route.",
        choices: [{ id: "choice-safe", label: "Alternate", targetBlockId: "block-alternate-ending" }],
        reversible: false,
        completionMode: "playerConfirmation",
      },
    });
    target.locations.push({
      id: "location-alternate-route",
      name: "Alternate synthetic route",
      locationType: "STORY",
      exactness: "APPROXIMATE",
      verificationProfile: { provider: "captainManual" },
      orderIndex: 0,
    });
    (
      target.chapters[0].blocks.find((block) => block.id === "block-artifact")!.configuration as Record<string, unknown>
    ).recipientPolicy = "DISCOVERING_PLAYER";
    (
      target.chapters[0].blocks.find((block) => block.id === "block-image")!.configuration as Record<string, unknown>
    ).caption = "A new synthetic caption.";
    addBlock(target, {
      id: "block-alternate-ending",
      blockType: "taleComplete",
      title: "Alternate ending",
      configuration: {
        finaleHeading: "Alternate mark",
        finaleContent: "A distinct invented ending.",
        completionMessage: "Complete.",
        credits: "",
        replayAvailable: true,
        completionMode: "playerConfirmation",
      },
    });
    const result = compareSemanticSnapshots(semantic(source, "edition-a"), semantic(target, "edition-b"));
    for (const category of ["BRANCHING_AND_CHOICES", "LOCATION_AND_MAP", "ARTIFACT", "ACCESSIBILITY", "ENDING"])
      expect(result.categoryCounts[category as keyof typeof result.categoryCounts], category).toBeGreaterThan(0);
  });
});
