import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExperienceSectionPages } from "./ExperienceSectionPages";
import { emptyJournalReadingState, type PlayerJournalBlock } from "@/tall-tale/journal-contract";

function block(
  id: string,
  journalKind: PlayerJournalBlock["journalKind"],
  configuration: PlayerJournalBlock["configuration"],
): PlayerJournalBlock {
  return {
    id,
    chapterId: "chapter-one",
    blockType: journalKind,
    journalKind,
    title: `${journalKind} leaf`,
    orderIndex: 0,
    configuration,
    presentation: {},
    connections: [],
    progress: "released",
    releasedAt: "2026-07-18T12:00:00.000Z",
    completedAt: null,
    selectedTargetId: null,
  };
}

const mapBlock = block("map-one", "map", { description: "Follow the eastern shoal.", mapX: 42, mapY: 38 });
const artifactBlock = block("artifact-one", "artifact", {
  description: "A compass that points toward remembered promises.",
  assetId: "asset-one",
});
const messageBlock = block("message-one", "message", {
  body: "Meet me where the lanterns touch the tide.",
  signature: "The Captain",
});
const journal = {
  mode: "active" as const,
  currentChapterId: "chapter-one",
  currentBlockId: mapBlock.id,
  chapters: [
    {
      id: "chapter-one",
      title: "The First Bearing",
      subtitle: null,
      orderIndex: 0,
      blocks: [mapBlock, artifactBlock, messageBlock],
    },
  ],
};
const assets = [
  {
    id: "asset-one",
    displayName: "Recovered compass",
    description: "An engraved brass compass",
    mediaType: "image/png",
    url: "/api/media/asset-one",
  },
];

describe("Experience section pages", () => {
  afterEach(cleanup);

  it("renders a full map with selectable released markers and chart scale", () => {
    const onReadingChange = vi.fn();
    render(
      <ExperienceSectionPages
        section="map"
        journal={journal}
        assets={assets}
        reading={emptyJournalReadingState}
        onReadingChange={onReadingChange}
        onOpenInBook={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Map" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Map zoom" })).toHaveValue("1");
    fireEvent.click(screen.getByRole("button", { name: "map leaf, released" }));
    expect(onReadingChange).toHaveBeenCalledWith({ mapSelectedId: "map-one" });
  });

  it("renders the artifact gallery and opens the selected story annotation", () => {
    const onOpenInBook = vi.fn();
    render(
      <ExperienceSectionPages
        section="artifacts"
        journal={journal}
        assets={assets}
        reading={emptyJournalReadingState}
        onReadingChange={vi.fn()}
        onOpenInBook={onOpenInBook}
      />,
    );

    expect(screen.getByRole("heading", { name: "Artifacts" })).toBeInTheDocument();
    expect(screen.getAllByAltText("An engraved brass compass")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Open story annotation in Chapters" }));
    expect(onOpenInBook).toHaveBeenCalledWith(artifactBlock);
  });

  it("records a message as selected and read", () => {
    const onReadingChange = vi.fn();
    render(
      <ExperienceSectionPages
        section="messages"
        journal={journal}
        assets={assets}
        reading={emptyJournalReadingState}
        onReadingChange={onReadingChange}
        onOpenInBook={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Messages" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /message leaf/i }));
    expect(onReadingChange).toHaveBeenCalledWith({ messageSelectedId: "message-one", readMessageIds: ["message-one"] });
  });

  it("does not leak unreleased names into empty section states", () => {
    render(
      <ExperienceSectionPages
        section="artifacts"
        journal={{ ...journal, chapters: [{ ...journal.chapters[0], blocks: [] }] }}
        assets={[]}
        reading={emptyJournalReadingState}
        onReadingChange={vi.fn()}
        onOpenInBook={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "The artifact cases are still sealed" })).toBeInTheDocument();
    expect(screen.queryByText("artifact leaf")).not.toBeInTheDocument();
  });
});
