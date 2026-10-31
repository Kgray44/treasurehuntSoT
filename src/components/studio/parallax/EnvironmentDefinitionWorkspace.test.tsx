import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { canonicalChecksum } from "@/drydock/canonical";
import { createEnvironmentDraft } from "@/parallax/library-lifecycle-contracts";
import { createRoomEnvironment } from "@/parallax/environment-authoring";
import { simulationEnvironments } from "@/parallax/studio-validation";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./SpatialCanvas", () => ({ SpatialCanvas: () => null }));
vi.mock("./RoomEnvironmentEditor", () => ({ RoomEnvironmentEditor: () => null }));
vi.mock("./EnvironmentCreateDialog", () => ({ EnvironmentCreateDialog: () => null }));
import { EnvironmentDefinitionWorkspace } from "./EnvironmentDefinitionWorkspace";
beforeEach(() => {
  localStorage.clear();
  push.mockReset();
});
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

it("opens a new Environment only after refreshing the Library and completing the current workspace close", async () => {
  const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
  const closeDialog = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  try {
    const draft = createEnvironmentDraft("source-environment", createRoomEnvironment(simulationEnvironments[0]));
    const copy = createEnvironmentDraft("environment:copy", createRoomEnvironment(simulationEnvironments[0]));
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
    const events: string[] = [];
    let finishClose!: () => void;
    const closing = new Promise<void>((resolve) => {
      finishClose = resolve;
    });
    const onClose = vi.fn(async () => {
      events.push("close-start");
      await closing;
      events.push("close-complete");
    });
    push.mockImplementation(() => events.push("navigate"));
    const api = vi.fn(async (body: Record<string, unknown>) => {
      events.push(String(body.action));
      return { definitionId: copy.id };
    });
    const onRefresh = vi.fn(async () => {
      events.push("refresh");
      return [record, { ...record, id: copy.id, draft: copy }];
    });
    render(
      <EnvironmentDefinitionWorkspace
        record={record}
        accountId="owner"
        api={api}
        csrfToken={() => "synthetic-csrf"}
        onClose={onClose}
        onRefresh={onRefresh}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save as new…" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create independent definition" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(events).toEqual(["SAVE_AS", "refresh", "close-start"]);
    expect(push).not.toHaveBeenCalled();
    finishClose();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/studio/parallax?environment=environment%3Acopy"));
    expect(events).toEqual(["SAVE_AS", "refresh", "close-start", "close-complete", "navigate"]);
  } finally {
    cleanup();
    for (const [name, descriptor] of [
      ["showModal", showModal],
      ["close", closeDialog],
    ] as const) {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    }
  }
});
