import { describe, expect, it } from "vitest";
import { buildCaptainProgressMap, deriveCaptainConsoleCommands } from "./command-console";
import type { PublishedTaleSnapshot } from "@/chronicle/types";

const snapshot = {
  chapters: [
    {
      id: "chapter-1",
      title: "First Light",
      blocks: [
        { id: "block-1", title: "Harbor Gate", blockType: "riddle", configuration: {}, connections: [] },
        {
          id: "block-2",
          title: "Moon Path",
          blockType: "choice",
          configuration: {},
          connections: [{ targetBlockId: "block-3", connectionType: "OPTIONAL", orderIndex: 0 }],
        },
        { id: "block-3", title: "Hidden Cove", blockType: "riddle", configuration: {}, connections: [] },
      ],
    },
  ],
} as unknown as PublishedTaleSnapshot;

describe("Helm Phase 3 command console derivation", () => {
  it("offers only actions that the authoritative current state permits", () => {
    const commands = deriveCaptainConsoleCommands({
      lifecycle: "ACTIVE",
      captainAuthorityState: "ASSIGNED",
      currentBlockId: "block-2",
      pendingVerification: null,
      hintCount: 0,
      releasedHintCount: 0,
      priorPassageId: null,
    });
    expect(commands.map((command) => command.id)).toEqual(["PAUSE_VOYAGE", "REPLAY_PRESENTATION", "MOVE_TO_PASSAGE"]);
    expect(commands).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: "RELEASE_NEXT_HINT" })]));
  });

  it("adds governed approval and hint choices only while their canonical sources are pending or available", () => {
    const commands = deriveCaptainConsoleCommands({
      lifecycle: "ACTIVE",
      captainAuthorityState: "ASSIGNED",
      currentBlockId: "block-2",
      pendingVerification: { providerType: "captainManual" },
      hintCount: 2,
      releasedHintCount: 1,
      priorPassageId: "block-1",
    });
    expect(commands.map((command) => command.id)).toEqual(
      expect.arrayContaining([
        "APPROVE_VERIFICATION",
        "REJECT_VERIFICATION",
        "OVERRIDE_VERIFICATION",
        "RELEASE_NEXT_HINT",
        "RESTORE_PRIOR_PASSAGE",
      ]),
    );
    expect(commands.find((command) => command.id === "APPROVE_VERIFICATION")).toMatchObject({
      risk: "HIGH",
      requiresConfirmation: true,
      playersSeeResult: true,
    });
  });

  it("removes command authority from terminal and vacant-Captain Voyages", () => {
    expect(
      deriveCaptainConsoleCommands({
        lifecycle: "COMPLETED",
        captainAuthorityState: "ASSIGNED",
        currentBlockId: "block-2",
        pendingVerification: null,
        hintCount: 2,
        releasedHintCount: 0,
        priorPassageId: "block-1",
      }),
    ).toEqual([]);
    expect(
      deriveCaptainConsoleCommands({
        lifecycle: "ACTIVE",
        captainAuthorityState: "VACANT",
        currentBlockId: "block-2",
        pendingVerification: { providerType: "captainManual" },
        hintCount: 2,
        releasedHintCount: 0,
        priorPassageId: "block-1",
      }),
    ).toEqual([]);
  });

  it("projects Captain operational graph state without Creator notes or Player-private values", () => {
    const map = buildCaptainProgressMap({
      snapshot,
      currentBlockId: "block-2",
      lifecycle: "PAUSED",
      events: [{ blockId: "block-1", eventType: "blockCompleted", sequence: 2 }],
    });
    expect(map.map((node) => [node.id, node.state])).toEqual([
      ["block-1", "COMPLETED"],
      ["block-2", "CURRENT"],
      ["block-3", "BLOCKED"],
    ]);
    expect(JSON.stringify(map)).not.toMatch(/creatorNotes|PRIVATE_PLAYER|acceptedAnswer/i);
  });

  it("marks the optional destination rather than the Passage that offers it", () => {
    const map = buildCaptainProgressMap({
      snapshot,
      currentBlockId: "block-1",
      lifecycle: "ACTIVE",
      events: [],
    });
    expect(map.map((node) => [node.id, node.state])).toEqual([
      ["block-1", "CURRENT"],
      ["block-2", "UPCOMING"],
      ["block-3", "OPTIONAL"],
    ]);
  });
});
