import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { canonicalChecksum } from "@/drydock/canonical";
import { createEnvironmentDraft } from "@/parallax/library-lifecycle-contracts";
import { createRoomEnvironment } from "@/parallax/environment-authoring";
import { simulationEnvironments } from "@/parallax/studio-validation";
vi.mock("./SpatialCanvas", () => ({ SpatialCanvas: () => null }));
vi.mock("./RoomEnvironmentEditor", () => ({ RoomEnvironmentEditor: () => null }));
vi.mock("./EnvironmentCreateDialog", () => ({ EnvironmentCreateDialog: () => null }));
import { EnvironmentDefinitionWorkspace } from "./EnvironmentDefinitionWorkspace";
beforeEach(() => localStorage.clear());
afterEach(cleanup);
it("keeps optional base light in Environment history and saves it through the existing working writer", async () => {
  const draft = createEnvironmentDraft("lighting-workspace", createRoomEnvironment(simulationEnvironments[0]));
  const record = {
    id: draft.id,
    revision: 1,
    draft,
    saveState: "WORKING" as const,
    archived: false,
    updatedAt: "2026-10-15T00:00:00.000Z",
    lastUsedAt: null,
    usageCount: 0,
    releases: [],
  };
  const checksum = canonicalChecksum(draft);
  const api = vi.fn(async (body: Record<string, unknown>) => {
    void body;
    return { revision: 2 };
  });
  const close = vi.fn(async () => {});
  render(
    <EnvironmentDefinitionWorkspace
      record={record}
      accountId="owner"
      api={api}
      csrfToken={() => "synthetic-csrf"}
      onClose={close}
      onRefresh={async () => [record]}
    />,
  );
  const light = screen.getByRole("combobox", { name: "Base preview lighting" });
  expect(light).toHaveValue("NORMAL");
  expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  fireEvent.change(light, { target: { value: "LOW" } });
  expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(light).toHaveValue("NORMAL");
  fireEvent.click(screen.getByRole("button", { name: "Redo" }));
  expect(light).toHaveValue("LOW");
  fireEvent.click(screen.getByRole("button", { name: "Back to scene" }));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(api).toHaveBeenCalledWith(
    expect.objectContaining({
      action: "ENVIRONMENT_SAVE",
      revision: 1,
      document: expect.objectContaining({ id: draft.id, room: expect.objectContaining({ light: "LOW" }) }),
    }),
  );
  expect(canonicalChecksum(draft)).toBe(checksum);
  expect(draft.room).not.toHaveProperty("light");
});
