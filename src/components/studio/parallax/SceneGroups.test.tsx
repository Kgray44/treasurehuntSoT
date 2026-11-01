import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createSpatialDraft } from "@/parallax/authoring";
import { createRoomEnvironment } from "@/parallax/environment-authoring";
import { simulationEnvironments } from "@/parallax/studio-validation";
import { GroupMembershipDialog } from "./SceneGroups";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function fixture(environmentEditing: boolean) {
  const draft = createSpatialDraft("synthetic-dialog-mode");
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments.find((p) => p.id === "bedroom")!);
  const feature = draft.content.studio!.environment.features.find((f) => f.classification === "DESK")!;
  const group = {
    id: "mixed",
    name: "Mixed group",
    members: [
      { kind: "ASSET" as const, id: draft.content.entities[0].id },
      { kind: "ROOM_FEATURE" as const, id: feature.id },
    ],
  };
  const save = vi.fn();
  render(
    <GroupMembershipDialog
      draft={draft}
      group={group}
      creating={false}
      environmentEditing={environmentEditing}
      onSave={save}
      onCancel={vi.fn()}
    />,
  );
  return { save, feature };
}
it("disables room membership outside environment edit mode and preserves it when clearing asset selection", () => {
  const { save, feature } = fixture(false);
  expect(screen.getByRole("checkbox", { name: feature.name })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Select all room features" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
  fireEvent.click(screen.getByRole("button", { name: "Save group" }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ members: [{ kind: "ROOM_FEATURE", id: feature.id }] }));
});
it("allows room membership changes only when environment editing is active", () => {
  const { save, feature } = fixture(true);
  const check = screen.getByRole("checkbox", { name: feature.name });
  expect(check).toBeEnabled();
  fireEvent.click(check);
  fireEvent.click(screen.getByRole("button", { name: "Save group" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ members: [{ kind: "ASSET", id: "synthetic-dialog-mode:entity-0" }] }),
  );
});
