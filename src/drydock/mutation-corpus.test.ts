import { describe, expect, it } from "vitest";
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

describe("Drydock Phase 2 synthetic invalid Chronicle mutation corpus", () => {
  it("keeps the base synthetic Chronicle valid under full static analysis", () => {
    const result = validateDrydockDraftContracts({ ...baseDraft(), analysisMode: "FULL" });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  for (const mutation of cases)
    it(`raises its declared alarms for ${mutation.id}`, () => {
      const draft = baseDraft();
      mutation.mutate(draft);
      const codes = validateDrydockDraftContracts({ ...draft, analysisMode: "FULL" }).issues.map((issue) => issue.code);
      expect(codes).toEqual(expect.arrayContaining([...mutation.expectedIssueCodes]));
    });
});
