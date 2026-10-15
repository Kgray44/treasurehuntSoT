import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createSpatialDraft } from "@/parallax/authoring";
import type { SpatialLibraryRecord } from "@/parallax/library-service";
import { SpatialLibrary } from "./SpatialLibrary";

afterEach(cleanup);

function effect(id: string, title: string, readOnly = false): SpatialLibraryRecord {
  const draft = createSpatialDraft(id);
  draft.content.title = title;
  draft.category = "EFFECT";
  return {
    id,
    draft,
    revision: 1,
    releases: [],
    usageCount: 0,
    updatedAt: "2026-10-15T12:00:00.000Z",
    readOnly,
  };
}

function showEffect(record: SpatialLibraryRecord) {
  const onOpenScene = vi.fn();
  render(
    <SpatialLibrary
      initialKind="EFFECTS"
      items={[record]}
      environments={[]}
      busy={false}
      onInsert={vi.fn()}
      onDragPreset={vi.fn()}
      onInsertSavedComposition={vi.fn()}
      onOpenScene={onOpenScene}
      onDuplicateScene={vi.fn()}
      onUpdateScene={vi.fn()}
      onArchiveScene={vi.fn()}
      onManageEnvironment={vi.fn()}
      onPublishSaved={vi.fn()}
      onPublishEnvironment={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: `Inspect ${record.draft.content.title}` }));
  return { onOpenScene, details: within(screen.getByRole("complementary", { name: `${record.draft.content.title} details` })) };
}

it("opens an owned saved effect for publication from Effects", () => {
  const record = effect("owned-mist", "Owned mist");
  const { onOpenScene, details } = showEffect(record);
  expect(details.getByRole("button", { name: "Publish to Community" })).not.toBeNull();
  fireEvent.click(details.getByRole("button", { name: "Open effect" }));
  expect(onOpenScene).toHaveBeenCalledWith(record);
});

it("views an installed effect as read-only without offering republication", () => {
  const record = effect("installed-mist", "Installed mist", true);
  const { onOpenScene, details } = showEffect(record);
  expect(details.queryByRole("button", { name: "Publish to Community" })).toBeNull();
  fireEvent.click(details.getByRole("button", { name: "View effect" }));
  expect(onOpenScene).toHaveBeenCalledWith(record);
});
