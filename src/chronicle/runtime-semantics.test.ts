import { describe, expect, it } from "vitest";
import type { PublishedBlock, PublishedTaleSnapshot } from "@/chronicle/types";
import {
  chooseCanonicalNext,
  conditionPasses,
  mutateVariables,
  planCanonicalCompletion,
} from "@/chronicle/runtime-semantics";

const block = (id: string, blockType: string, configuration: Record<string, unknown> = {}): PublishedBlock => ({
  id,
  blockType,
  title: id,
  configuration,
  chapterId: "chapter-a",
  orderIndex: 0,
  isEnabled: true,
  nextBlockId: null,
  connections: [],
});

const snapshot = (blocks: PublishedBlock[]): PublishedTaleSnapshot => ({
  schemaVersion: 1,
  tale: {
    id: "synthetic-tale",
    slug: "synthetic-tale",
    title: "Synthetic tale",
    subtitle: null,
    shortDescription: null,
    longDescription: null,
    coverAssetId: null,
    theme: "default",
    visibility: "PRIVATE",
    playerCountMin: 1,
    playerCountMax: 1,
    estimatedDuration: null,
    contentWarnings: null,
  },
  chapters: [
    {
      id: "chapter-a",
      title: "Chapter",
      orderIndex: 0,
      entryBlockId: blocks[0]?.id ?? null,
      completionBlockId: null,
      blocks,
    },
  ],
  assets: [],
  locations: [],
  artifacts: [],
  publishedAt: "2026-08-12T00:00:00.000Z",
});

describe("canonical runtime semantics", () => {
  it("uses the canonical condition and branch selection rules", () => {
    const condition = {
      ...block("condition", "condition", {
        variable: "visits",
        operator: "greaterThan",
        value: 1,
        successTargetBlockId: "yes",
        failureTargetBlockId: "no",
      }),
      connections: [
        { targetBlockId: "yes", connectionType: "SUCCESS", orderIndex: 0 },
        { targetBlockId: "no", connectionType: "FAILURE", orderIndex: 1 },
      ],
    };
    const yes = block("yes", "narrative");
    const no = block("no", "narrative");
    const tale = snapshot([condition, yes, no]);

    expect(conditionPasses(condition, { visits: 2 }, [])).toBe(true);
    expect(chooseCanonicalNext(tale, condition, { visits: 2 }, [])?.id).toBe("yes");
    expect(chooseCanonicalNext(tale, condition, { visits: 1 }, [])?.id).toBe("no");
  });

  it("uses the canonical variable and selected-choice rules without mutation", () => {
    const setVariable = block("set", "setVariable", { variable: "count", operation: "increment", value: 2 });
    const choice = {
      ...block("choice", "choice"),
      connections: [{ targetBlockId: "right", connectionType: "CHOICE", orderIndex: 0 }],
    };
    const right = block("right", "narrative");
    const tale = snapshot([setVariable, choice, right]);
    const variables = { count: 3 };

    expect(mutateVariables(setVariable, variables)).toEqual({ count: 5 });
    expect(variables).toEqual({ count: 3 });
    expect(chooseCanonicalNext(tale, choice, {}, [], "right")?.id).toBe("right");
  });

  it("plans automatic logic, artifact effects, and terminal state from one pure transition", () => {
    const reveal = {
      ...block("reveal", "artifactReveal", { artifactId: "artifact-a" }),
      connections: [{ targetBlockId: "set", connectionType: "DEFAULT", orderIndex: 0 }],
      nextBlockId: "set",
    };
    const set = {
      ...block("set", "setVariable", { variable: "count", operation: "increment", value: 1 }),
      connections: [{ targetBlockId: "finish", connectionType: "DEFAULT", orderIndex: 0 }],
      nextBlockId: "finish",
    };
    const finish = block("finish", "taleComplete");
    const plan = planCanonicalCompletion(
      snapshot([reveal, set, finish]),
      {
        currentBlockId: "reveal",
        variables: { count: 1 },
        inventory: [],
        status: "ACTIVE",
      },
      {},
    );

    expect(plan.state).toEqual({
      currentBlockId: "finish",
      variables: { count: 2 },
      inventory: ["artifact-a"],
      status: "ACTIVE",
    });
    expect(plan.automaticBlockIds).toEqual(["set"]);
    expect(plan.intents.map((intent) => intent.eventType)).toEqual([
      "artifactGranted",
      "blockCompleted",
      "blockEntered",
      "blockCompleted",
      "blockEntered",
    ]);
  });
});
