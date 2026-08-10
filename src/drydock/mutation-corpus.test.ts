import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import fixture from "../../tests/fixtures/drydock/phase2-synthetic-chronicle.json";
import authoringFixture from "../../tests/fixtures/drydock/current-authoring-v1.json";
import type { DrydockAuthoredBlockInput } from "@/drydock/contracts/model";
import { validateDrydockDraftContracts, type DrydockDraftContractInput } from "@/drydock/incremental";

type MutationCase = {
  id: string;
  expectedIssueCodes: readonly string[];
  mutate: (draft: DrydockDraftContractInput) => void;
};

const baseDraft = (): DrydockDraftContractInput => structuredClone(fixture) as DrydockDraftContractInput;
const imageTemplate = authoringFixture.blocks.find((block) => block.blockType === "image") as DrydockAuthoredBlockInput;
const choiceTemplate = authoringFixture.blocks.find(
  (block) => block.blockType === "choice",
) as DrydockAuthoredBlockInput;
const conditionTemplate = authoringFixture.blocks.find(
  (block) => block.blockType === "condition",
) as DrydockAuthoredBlockInput;
const setVariableTemplate = authoringFixture.blocks.find(
  (block) => block.blockType === "setVariable",
) as DrydockAuthoredBlockInput;
const arrivalCheckTemplate = authoringFixture.blocks.find(
  (block) => block.blockType === "arrivalCheck",
) as DrydockAuthoredBlockInput;
const artifactRevealTemplate = authoringFixture.blocks.find(
  (block) => block.blockType === "artifactReveal",
) as DrydockAuthoredBlockInput;
const collectionUpdateTemplate = authoringFixture.blocks.find(
  (block) => block.blockType === "collectionUpdate",
) as DrydockAuthoredBlockInput;
const cinematicTemplate = authoringFixture.blocks.find(
  (block) => block.blockType === "cinematic",
) as DrydockAuthoredBlockInput;
const audioTemplate = authoringFixture.blocks.find((block) => block.blockType === "audio") as DrydockAuthoredBlockInput;
const chapterCompleteTemplate = authoringFixture.blocks.find(
  (block) => block.blockType === "chapterComplete",
) as DrydockAuthoredBlockInput;
const legacyVariableId = (name: string) =>
  `var-${createHash("sha256")
    .update(`legacy-variable:${name.normalize("NFKC")}`)
    .digest("hex")
    .slice(0, 20)}`;

function appendSyntheticImage(draft: DrydockDraftContractInput) {
  const image = structuredClone(imageTemplate);
  image.id = "synthetic-image";
  image.connections = [{ targetBlockId: "synthetic-finish", connectionType: "DEFAULT", orderIndex: 0 }];
  image.nextBlockId = "synthetic-finish";
  (draft.chapters[0].blocks as DrydockAuthoredBlockInput[]).push(image);
  return image;
}

/**
 * Synthetic-only mutations prove that the whole-Chronicle alarms activate.
 * Each case names its minimum expected rule codes; a case may legitimately
 * surface additional dependent diagnostics (for example, an unreachable
 * terminal after a broken entry edge).
 */
const cases: readonly MutationCase[] = [
  {
    id: "missing-terminal",
    expectedIssueCodes: ["DRYDOCK_GRAPH_TERMINAL_MISSING"],
    mutate: (draft) => {
      draft.chapters[0].blocks = draft.chapters[0].blocks.filter((block) => block.id !== "synthetic-finish");
      const opening = draft.chapters[0].blocks[0];
      opening.connections = [];
      opening.nextBlockId = null;
    },
  },
  {
    id: "dead-end",
    expectedIssueCodes: ["DRYDOCK_GRAPH_NO_TERMINAL_PATH", "DRYDOCK_GRAPH_UNREACHABLE"],
    mutate: (draft) => {
      const opening = draft.chapters[0].blocks[0];
      opening.connections = [];
      opening.nextBlockId = null;
    },
  },
  {
    id: "unreachable-passage",
    expectedIssueCodes: ["DRYDOCK_GRAPH_UNREACHABLE"],
    mutate: (draft) => {
      const island = structuredClone(draft.chapters[0].blocks[0]);
      island.id = "synthetic-unreachable";
      island.connections = [{ targetBlockId: "synthetic-finish", connectionType: "DEFAULT", orderIndex: 0 }];
      island.nextBlockId = "synthetic-finish";
      (draft.chapters[0].blocks as DrydockAuthoredBlockInput[]).push(island);
    },
  },
  {
    id: "missing-edge-target",
    expectedIssueCodes: ["DRYDOCK_REFERENCE_TARGET_MISSING"],
    mutate: (draft) => {
      const opening = draft.chapters[0].blocks[0];
      opening.connections = [{ targetBlockId: "synthetic-missing", connectionType: "DEFAULT", orderIndex: 0 }];
      opening.nextBlockId = "synthetic-missing";
    },
  },
  {
    id: "automatic-loop",
    expectedIssueCodes: ["DRYDOCK_GRAPH_AUTOMATIC_LOOP", "DRYDOCK_GRAPH_NO_TERMINAL_PATH"],
    mutate: (draft) => {
      const opening = draft.chapters[0].blocks[0];
      opening.connections = [{ targetBlockId: opening.id, connectionType: "DEFAULT", orderIndex: 0 }];
      opening.nextBlockId = opening.id;
    },
  },
  {
    id: "duplicate-canonical-edge",
    expectedIssueCodes: ["DRYDOCK_GRAPH_DUPLICATE_EDGE"],
    mutate: (draft) => {
      const choice = structuredClone(choiceTemplate);
      choice.id = "synthetic-opening";
      choice.configuration.choices = [
        { id: "duplicate-a", label: "First duplicate", targetBlockId: "synthetic-finish" },
        { id: "duplicate-b", label: "Second duplicate", targetBlockId: "synthetic-finish" },
      ];
      choice.connections = [
        { targetBlockId: "synthetic-finish", connectionType: "CHOICE", orderIndex: 0 },
        { targetBlockId: "synthetic-finish", connectionType: "CHOICE", orderIndex: 1 },
      ];
      choice.nextBlockId = "synthetic-finish";
      const chapters = draft.chapters as Array<{ id: string; blocks: DrydockAuthoredBlockInput[] }>;
      chapters[0].blocks[0] = choice;
    },
  },
  {
    id: "orphan-chapter",
    expectedIssueCodes: ["DRYDOCK_GRAPH_ORPHAN_CHAPTER"],
    mutate: (draft) => {
      const chapters = draft.chapters as Array<{ id: string; blocks: DrydockAuthoredBlockInput[] }>;
      chapters.push({ id: "synthetic-orphan-chapter", blocks: [] });
    },
  },
  {
    id: "invalid-cross-chapter-transition",
    expectedIssueCodes: ["DRYDOCK_GRAPH_CROSS_CHAPTER_TRANSITION_INVALID"],
    mutate: (draft) => {
      const chapters = draft.chapters as Array<{ id: string; blocks: DrydockAuthoredBlockInput[] }>;
      const terminal = structuredClone(chapters[0].blocks[1]);
      terminal.id = "synthetic-second-chapter-finish";
      chapters.push({ id: "synthetic-second-chapter", blocks: [terminal] });
      const opening = chapters[0].blocks[0];
      opening.connections = [{ targetBlockId: terminal.id, connectionType: "DEFAULT", orderIndex: 0 }];
      opening.nextBlockId = terminal.id;
    },
  },
  {
    id: "unsupported-schema-reader",
    expectedIssueCodes: ["DRYDOCK_BLOCK_VERSION_UNSUPPORTED"],
    mutate: (draft) => {
      draft.chapters[0].blocks[0].schemaVersion = 99;
    },
  },
  {
    id: "provider-not-configured",
    expectedIssueCodes: ["DRYDOCK_PROVIDER_NOT_CONFIGURED"],
    mutate: (draft) => {
      draft.chapters[0].blocks[0].completion = {
        mode: "visionLocation",
        provider: { id: "visionLocation", version: 1, options: { providerInstanceId: "synthetic-provider" } },
        fallbackMode: "captainManual",
      };
    },
  },
  {
    id: "provider-unregistered",
    expectedIssueCodes: ["DRYDOCK_PROVIDER_UNREGISTERED"],
    mutate: (draft) => {
      draft.chapters[0].blocks[0].completion = { mode: "syntheticUnknownProvider" };
    },
  },
  {
    id: "provider-accessible-fallback-missing",
    expectedIssueCodes: ["DRYDOCK_ACCESS_PROVIDER_FALLBACK"],
    mutate: (draft) => {
      const arrival = structuredClone(arrivalCheckTemplate);
      arrival.id = "synthetic-opening";
      arrival.connections = [{ targetBlockId: "synthetic-finish", connectionType: "DEFAULT", orderIndex: 0 }];
      arrival.nextBlockId = "synthetic-finish";
      arrival.completion = { mode: "captainManual" };
      (draft.chapters[0].blocks as DrydockAuthoredBlockInput[])[0] = arrival;
    },
  },
  {
    id: "always-true-condition",
    expectedIssueCodes: ["DRYDOCK_CONDITION_ALWAYS_TRUE"],
    mutate: (draft) => {
      const condition = structuredClone(conditionTemplate);
      condition.id = "synthetic-opening";
      condition.configuration.variable = "synthetic-flag";
      condition.configuration.value = true;
      condition.configuration.successTargetBlockId = "synthetic-finish";
      condition.configuration.failureTargetBlockId = "synthetic-finish";
      condition.connections = [
        { targetBlockId: "synthetic-finish", connectionType: "SUCCESS", orderIndex: 0 },
        { targetBlockId: "synthetic-finish", connectionType: "FAILURE", orderIndex: 1 },
      ];
      condition.nextBlockId = "synthetic-finish";
      (draft.chapters[0].blocks as DrydockAuthoredBlockInput[])[0] = condition;
      draft.variables = [
        {
          schemaVersion: 1,
          id: legacyVariableId("synthetic-flag"),
          name: "Synthetic flag",
          type: { kind: "BOOLEAN" },
          scope: "SESSION",
          defaultValue: true,
          allowedOperations: ["assign", "toggle"],
          privacy: "PLAYER_SAFE",
        },
      ];
    },
  },
  {
    id: "always-false-condition",
    expectedIssueCodes: ["DRYDOCK_CONDITION_ALWAYS_FALSE"],
    mutate: (draft) => {
      const condition = structuredClone(conditionTemplate);
      condition.id = "synthetic-opening";
      condition.configuration.variable = "synthetic-flag";
      condition.configuration.value = true;
      condition.configuration.successTargetBlockId = "synthetic-finish";
      condition.configuration.failureTargetBlockId = "synthetic-finish";
      condition.connections = [
        { targetBlockId: "synthetic-finish", connectionType: "SUCCESS", orderIndex: 0 },
        { targetBlockId: "synthetic-finish", connectionType: "FAILURE", orderIndex: 1 },
      ];
      condition.nextBlockId = "synthetic-finish";
      (draft.chapters[0].blocks as DrydockAuthoredBlockInput[])[0] = condition;
      draft.variables = [
        {
          schemaVersion: 1,
          id: legacyVariableId("synthetic-flag"),
          name: "Synthetic flag",
          type: { kind: "BOOLEAN" },
          scope: "SESSION",
          defaultValue: false,
          allowedOperations: ["assign", "toggle"],
          privacy: "PLAYER_SAFE",
        },
      ];
    },
  },
  {
    id: "write-never-read",
    expectedIssueCodes: ["DRYDOCK_VARIABLE_WRITE_NEVER_READ"],
    mutate: (draft) => {
      const writer = structuredClone(setVariableTemplate);
      writer.id = "synthetic-writer";
      writer.configuration.variable = "synthetic-inert";
      writer.configuration.variableId = "synthetic-inert";
      writer.configuration.variableName = "Synthetic inert";
      writer.connections = [{ targetBlockId: "synthetic-finish", connectionType: "DEFAULT", orderIndex: 0 }];
      writer.nextBlockId = "synthetic-finish";
      const opening = draft.chapters[0].blocks[0];
      opening.connections = [{ targetBlockId: writer.id, connectionType: "DEFAULT", orderIndex: 0 }];
      opening.nextBlockId = writer.id;
      (draft.chapters[0].blocks as DrydockAuthoredBlockInput[]).splice(1, 0, writer);
    },
  },
  {
    id: "performance-block-threshold",
    expectedIssueCodes: ["DRYDOCK_PERFORMANCE_BLOCK_COUNT_HIGH"],
    mutate: (draft) => {
      const blocks = draft.chapters[0].blocks as DrydockAuthoredBlockInput[];
      const source = structuredClone(blocks[0]);
      for (let index = 0; index < 255; index += 1) {
        const block = structuredClone(source);
        block.id = `synthetic-performance-${index}`;
        block.connections = [{ targetBlockId: "synthetic-finish", connectionType: "DEFAULT", orderIndex: 0 }];
        block.nextBlockId = "synthetic-finish";
        blocks.push(block);
      }
    },
  },
  {
    id: "state-proof-bound-exhausted",
    expectedIssueCodes: ["DRYDOCK_STATE_PROOF_INCOMPLETE"],
    mutate: (draft) => {
      draft.analysisLimits = { maximumStateIterations: 0 };
    },
  },
  {
    id: "repeated-artifact-grant",
    expectedIssueCodes: ["DRYDOCK_ARTIFACT_GRANT_DUPLICATE_RISK"],
    mutate: (draft) => {
      const firstGrant = structuredClone(artifactRevealTemplate);
      const secondGrant = structuredClone(collectionUpdateTemplate);
      firstGrant.id = "synthetic-first-artifact-grant";
      secondGrant.id = "synthetic-second-artifact-grant";
      firstGrant.configuration.artifactId = "synthetic-repeated-artifact";
      secondGrant.configuration.artifactId = "synthetic-repeated-artifact";
      firstGrant.connections = [{ targetBlockId: secondGrant.id, connectionType: "DEFAULT", orderIndex: 0 }];
      firstGrant.nextBlockId = secondGrant.id;
      secondGrant.connections = [{ targetBlockId: "synthetic-finish", connectionType: "DEFAULT", orderIndex: 0 }];
      secondGrant.nextBlockId = "synthetic-finish";
      const blocks = draft.chapters[0].blocks as DrydockAuthoredBlockInput[];
      blocks[0].connections = [{ targetBlockId: firstGrant.id, connectionType: "DEFAULT", orderIndex: 0 }];
      blocks[0].nextBlockId = firstGrant.id;
      blocks.splice(1, 0, firstGrant, secondGrant);
    },
  },
  {
    id: "artifact-grant-inside-repeatable-cycle",
    expectedIssueCodes: ["DRYDOCK_SIDE_EFFECT_REPEATS_IN_LOOP"],
    mutate: (draft) => {
      const grant = structuredClone(artifactRevealTemplate);
      grant.id = "synthetic-repeatable-artifact-grant";
      grant.configuration.artifactId = "synthetic-loop-artifact";
      grant.connections = [{ targetBlockId: "synthetic-opening", connectionType: "DEFAULT", orderIndex: 0 }];
      grant.nextBlockId = "synthetic-opening";
      const blocks = draft.chapters[0].blocks as DrydockAuthoredBlockInput[];
      blocks[0].connections = [{ targetBlockId: grant.id, connectionType: "DEFAULT", orderIndex: 0 }];
      blocks[0].nextBlockId = grant.id;
      blocks.splice(1, 0, grant);
    },
  },
  {
    id: "duplicate-completion-outcome",
    expectedIssueCodes: ["DRYDOCK_COMPLETION_OUTCOME_DUPLICATE_RISK"],
    mutate: (draft) => {
      const chapterComplete = structuredClone(chapterCompleteTemplate);
      chapterComplete.id = "synthetic-chapter-complete";
      chapterComplete.configuration.outcomeId = "synthetic-shared-outcome";
      chapterComplete.connections = [{ targetBlockId: "synthetic-finish", connectionType: "DEFAULT", orderIndex: 0 }];
      chapterComplete.nextBlockId = "synthetic-finish";
      const blocks = draft.chapters[0].blocks as DrydockAuthoredBlockInput[];
      blocks[0].connections = [{ targetBlockId: chapterComplete.id, connectionType: "DEFAULT", orderIndex: 0 }];
      blocks[0].nextBlockId = chapterComplete.id;
      blocks[1].configuration.outcomeId = "synthetic-shared-outcome";
      blocks.splice(1, 0, chapterComplete);
    },
  },
  {
    id: "missing-cinematic-captions",
    expectedIssueCodes: ["DRYDOCK_ACCESS_VIDEO_CAPTIONS"],
    mutate: (draft) => {
      const cinematic = structuredClone(cinematicTemplate);
      cinematic.id = "synthetic-cinematic";
      cinematic.configuration.captionsAssetId = "";
      cinematic.connections = [{ targetBlockId: "synthetic-finish", connectionType: "DEFAULT", orderIndex: 0 }];
      cinematic.nextBlockId = "synthetic-finish";
      const blocks = draft.chapters[0].blocks as DrydockAuthoredBlockInput[];
      blocks[0].connections = [{ targetBlockId: cinematic.id, connectionType: "DEFAULT", orderIndex: 0 }];
      blocks[0].nextBlockId = cinematic.id;
      blocks.splice(1, 0, cinematic);
    },
  },
  {
    id: "missing-audio-transcript",
    expectedIssueCodes: ["DRYDOCK_ACCESS_AUDIO_TRANSCRIPT"],
    mutate: (draft) => {
      const audio = structuredClone(audioTemplate);
      audio.id = "synthetic-audio";
      audio.configuration.transcript = "";
      audio.connections = [{ targetBlockId: "synthetic-finish", connectionType: "DEFAULT", orderIndex: 0 }];
      audio.nextBlockId = "synthetic-finish";
      const blocks = draft.chapters[0].blocks as DrydockAuthoredBlockInput[];
      blocks[0].connections = [{ targetBlockId: audio.id, connectionType: "DEFAULT", orderIndex: 0 }];
      blocks[0].nextBlockId = audio.id;
      blocks.splice(1, 0, audio);
    },
  },
  {
    id: "asset-snapshot-unavailable",
    expectedIssueCodes: ["DRYDOCK_ASSET_PROOF_INCOMPLETE"],
    mutate: (draft) => {
      delete draft.assets;
    },
  },
  {
    id: "missing-image-asset",
    expectedIssueCodes: ["DRYDOCK_ASSET_REFERENCE_MISSING"],
    mutate: (draft) => {
      appendSyntheticImage(draft);
      draft.assets = [];
    },
  },
  {
    id: "wrong-private-unready-image-asset",
    expectedIssueCodes: ["DRYDOCK_ASSET_MEDIA_TYPE", "DRYDOCK_ASSET_PRIVACY", "DRYDOCK_ASSET_NOT_READY"],
    mutate: (draft) => {
      const image = appendSyntheticImage(draft);
      draft.assets = [
        {
          id: String(image.configuration.assetId),
          mediaType: "AUDIO",
          roles: ["CAPTAIN_ONLY_REFERENCE"],
          variants: [{ processingState: "PROCESSING" }],
        },
      ];
    },
  },
  {
    id: "missing-image-text-alternative",
    expectedIssueCodes: ["DRYDOCK_CONFIGURATION_SCHEMA_INVALID"],
    mutate: (draft) => {
      const image = appendSyntheticImage(draft);
      image.configuration.altText = "";
      draft.assets = [
        {
          id: String(image.configuration.assetId),
          mediaType: "IMAGE",
          roles: [],
          variants: [{ processingState: "READY" }],
        },
      ];
    },
  },
];

const validCases: readonly MutationCase[] = [
  {
    id: "branching-multiple-endings",
    expectedIssueCodes: [],
    mutate: (draft) => {
      const terminal = structuredClone(draft.chapters[0].blocks[1]);
      terminal.id = "synthetic-alternate-finish";
      const choice = structuredClone(choiceTemplate);
      choice.id = "synthetic-opening";
      choice.configuration.choices = [
        { id: "ending-a", label: "First ending", targetBlockId: "synthetic-finish" },
        { id: "ending-b", label: "Second ending", targetBlockId: terminal.id },
      ];
      choice.connections = [
        { targetBlockId: "synthetic-finish", connectionType: "CHOICE", orderIndex: 0 },
        { targetBlockId: terminal.id, connectionType: "CHOICE", orderIndex: 1 },
      ];
      choice.nextBlockId = "synthetic-finish";
      const blocks = draft.chapters[0].blocks as DrydockAuthoredBlockInput[];
      blocks[0] = choice;
      blocks.push(terminal);
    },
  },
  {
    id: "interactive-choice-loop-with-terminal-exit",
    expectedIssueCodes: ["DRYDOCK_PROVIDER_REQUEST_REPEATS_IN_LOOP"],
    mutate: (draft) => {
      const choice = structuredClone(choiceTemplate);
      choice.id = "synthetic-opening";
      choice.configuration.choices = [
        { id: "retry", label: "Try again", targetBlockId: choice.id },
        { id: "continue", label: "Continue", targetBlockId: "synthetic-finish" },
      ];
      choice.connections = [
        { targetBlockId: choice.id, connectionType: "CHOICE", orderIndex: 0 },
        { targetBlockId: "synthetic-finish", connectionType: "CHOICE", orderIndex: 1 },
      ];
      choice.nextBlockId = choice.id;
      (draft.chapters[0].blocks as DrydockAuthoredBlockInput[])[0] = choice;
    },
  },
];

describe("Drydock Phase 2 synthetic invalid Chronicle mutation corpus", () => {
  it("keeps the base synthetic Chronicle valid under full static analysis", () => {
    const result = validateDrydockDraftContracts({ ...baseDraft(), analysisMode: "FULL" });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  for (const mutation of validCases)
    it(`keeps ${mutation.id} valid under full static analysis`, () => {
      const draft = baseDraft();
      mutation.mutate(draft);
      const result = validateDrydockDraftContracts({ ...draft, analysisMode: "FULL" });
      expect(result.valid).toBe(true);
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining([...mutation.expectedIssueCodes]),
      );
      if (!mutation.expectedIssueCodes.length) expect(result.issues).toEqual([]);
    });

  for (const mutation of cases)
    it(`raises its declared alarms for ${mutation.id}`, () => {
      const draft = baseDraft();
      mutation.mutate(draft);
      const codes = validateDrydockDraftContracts({ ...draft, analysisMode: "FULL" }).issues.map((issue) => issue.code);
      expect(codes).toEqual(expect.arrayContaining([...mutation.expectedIssueCodes]));
    });
});
