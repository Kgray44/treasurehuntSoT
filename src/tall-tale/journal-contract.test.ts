import { describe, expect, it } from "vitest";
import { blockTypeIds } from "@/tall-tale/block-registry";
import {
  journalContentKinds,
  journalKindForBlock,
  parseJournalPresentation,
  projectPlayerBlock,
  sanitizePlayerObject,
} from "@/tall-tale/journal-contract";
import type { PublishedBlock } from "@/tall-tale/types";

function block(blockType = "narrative"): PublishedBlock {
  return {
    id: `block-${blockType}`,
    chapterId: "chapter-one",
    blockType,
    title: "Published leaf",
    orderIndex: 0,
    configuration: {},
    presentation: {},
    completion: {},
    creatorNotes: "Never serialize this",
    internalLabel: "Internal",
    isEnabled: true,
    schemaVersion: 1,
    nextBlockId: null,
    connections: [],
  };
}

describe("Tall Tale journal contract", () => {
  it("maps every visible Creator block into the shared journal modes and keeps logic blocks nonvisual", () => {
    const mapped = blockTypeIds.map((type) => [type, journalKindForBlock(type)] as const);
    expect(mapped.filter(([, kind]) => kind === null).map(([type]) => type)).toEqual(["condition", "setVariable"]);
    expect(new Set(mapped.flatMap(([, kind]) => (kind ? [kind] : [])))).toEqual(new Set(journalContentKinds));
  });

  it("recursively removes answers, private branches, and Captain-only fields", () => {
    expect(
      sanitizePlayerObject({
        body: "Safe story",
        acceptedAnswers: ["secret"],
        nested: { captainInstruction: "Jump ahead", publicLabel: "Safe label" },
        choices: [{ label: "North", hiddenConsequence: "Private ending", targetBlockId: "north" }],
      }),
    ).toEqual({
      body: "Safe story",
      nested: { publicLabel: "Safe label" },
      choices: [{ label: "North", targetBlockId: "north" }],
    });
  });

  it("exposes only event-released hints and choice connections", () => {
    const source = block("riddle");
    source.configuration = {
      riddleText: "Where moonlight bends",
      hints: ["First bearing", "Second bearing"],
      acceptedAnswers: ["lantern"],
    };
    source.connections = [
      { targetBlockId: "choice-a", connectionType: "CHOICE", orderIndex: 0, label: "North" },
      {
        targetBlockId: "secret-branch",
        connectionType: "CONDITION",
        conditionExpression: "answer == secret",
        orderIndex: 1,
      },
    ];
    expect(projectPlayerBlock(source, { releasedHintCount: 1 })).toMatchObject({
      configuration: { riddleText: "Where moonlight bends", releasedHints: ["First bearing"] },
      connections: [{ targetBlockId: "choice-a", connectionType: "CHOICE", label: "North" }],
    });
  });

  it("normalizes authored presentation values and supplies physical defaults", () => {
    expect(parseJournalPresentation({ spreadMode: "two-page", paperStyle: "salt-stained" }, "location")).toMatchObject({
      spreadMode: "two-page",
      paperStyle: "salt-stained",
      inkStyle: "midnight",
      pageTurnBehavior: "manual",
    });
    expect(parseJournalPresentation({ spreadMode: "invalid" }, "cinematic")).toMatchObject({
      spreadMode: "cinematic",
      pageTemplate: "cinematic",
    });
  });
});
