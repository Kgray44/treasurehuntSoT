import { describe, expect, it } from "vitest";
import type { PlayerJournalBlock, PlayerJournalProjection } from "@/chronicle/journal-contract";
import {
  buildChronicleJournalPages,
  pageIndexForJournalBlock,
  pageIndexForReadingState,
} from "@/chronicle/journal-page-model";

function visibleBlock(id: string, spreadMode: "right" | "two-page" = "right"): PlayerJournalBlock {
  return {
    id,
    chapterId: "chapter-one",
    blockType: id === "map" ? "location" : "narrative",
    journalKind: id === "map" ? "map" : "story",
    title: id,
    orderIndex: id === "map" ? 1 : 0,
    configuration: { body: `Body for ${id}` },
    presentation: {
      spreadMode,
      pageTemplate: "weathered",
      paperStyle: "weathered",
      inkStyle: "midnight",
      transitionIn: "ink-settle",
      transitionOut: "page-turn",
      pageTurnBehavior: "manual",
    },
    connections: [],
    progress: id === "map" ? "active" : "completed",
    releasedAt: "2026-07-18T00:00:00.000Z",
    completedAt: id === "map" ? null : "2026-07-18T00:01:00.000Z",
    selectedTargetId: null,
  };
}

const journal: PlayerJournalProjection = {
  mode: "active",
  currentChapterId: "chapter-one",
  currentBlockId: "map",
  chapters: [
    {
      id: "chapter-one",
      title: "The First Bearing",
      subtitle: "A moonlit route",
      orderIndex: 0,
      blocks: [visibleBlock("story"), visibleBlock("map", "two-page")],
    },
  ],
};

describe("Chronicle journal page model", () => {
  it("builds stable physical leaves, expands authored spreads, and closes on an even page count", () => {
    const pages = buildChronicleJournalPages(journal, {
      title: "The Moon Chart",
      subtitle: "A development voyage",
      versionLabel: "1.0",
      publishedAt: "2026-07-18T00:00:00.000Z",
      completedAt: null,
    });
    expect(pages.map((page) => page.id)).toContain("block:map:primary");
    expect(pages.map((page) => page.id)).toContain("block:map:secondary");
    expect(new Set(pages.map((page) => page.id)).size).toBe(pages.length);
    expect(pages.length % 2).toBe(0);
    expect(pageIndexForJournalBlock(pages, "map")).toBe(pages.findIndex((page) => page.id === "block:map:primary"));
  });

  it("restores a Player reading page separately from the live objective", () => {
    const pages = buildChronicleJournalPages(journal, {
      title: "The Moon Chart",
      subtitle: null,
      versionLabel: "1.0",
      publishedAt: null,
      completedAt: null,
    });
    expect(pageIndexForReadingState(pages, "block:story:primary", "map")).toBe(
      pages.findIndex((page) => page.id === "block:story:primary"),
    );
    expect(pageIndexForReadingState(pages, "missing-page", "map")).toBe(pageIndexForJournalBlock(pages, "map"));
  });

  it("marks historical editions without changing their released block content", () => {
    const pages = buildChronicleJournalPages(
      { ...journal, mode: "historical" },
      {
        title: "The Moon Chart",
        subtitle: null,
        versionLabel: "1.0",
        publishedAt: "2026-07-18T00:00:00.000Z",
        completedAt: "2026-07-18T01:00:00.000Z",
      },
    );
    expect(pages.find((page) => page.id === "journal-edition")?.title).toBe("Preserved voyage");
    expect(pages.find((page) => page.id === "block:story:primary")?.block?.configuration.body).toBe("Body for story");
  });
});
