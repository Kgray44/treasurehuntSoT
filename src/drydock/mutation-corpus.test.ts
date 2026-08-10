import { describe, expect, it } from "vitest";
import fixture from "../../tests/fixtures/drydock/phase2-synthetic-chronicle.json";
import type { DrydockAuthoredBlockInput } from "@/drydock/contracts/model";
import { validateDrydockDraftContracts, type DrydockDraftContractInput } from "@/drydock/incremental";

type MutationCase = {
  id: string;
  expectedIssueCodes: readonly string[];
  mutate: (draft: DrydockDraftContractInput) => void;
};

const baseDraft = (): DrydockDraftContractInput => structuredClone(fixture) as DrydockDraftContractInput;

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
