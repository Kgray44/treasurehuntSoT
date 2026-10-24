import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { canonicalChecksum } from "@/drydock/canonical";
import { SceneManager } from "./SceneManager";
import { createSceneFromEnvironment } from "@/parallax/scene-environment-authoring";
import { createEnvironmentDraft } from "@/parallax/library-lifecycle-contracts";
import { createRoomEnvironment } from "@/parallax/environment-authoring";
import { simulationEnvironments } from "@/parallax/studio-validation";
import type { CompatibleEnvironmentRecord } from "@/parallax/environment-library-compatibility";
import type { SpatialDraft } from "@/parallax/authoring";
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
});
afterEach(() => {
  cleanup();
  for (const [key, descriptor] of [
    ["showModal", originalShow],
    ["close", originalClose],
  ] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
  }
});
function setup() {
  const document = createEnvironmentDraft("shared-room", createRoomEnvironment(simulationEnvironments[0]));
  const previous = {
    reference: { environmentId: document.id, versionId: "room:v1", revision: 1, checksum: canonicalChecksum(document) },
    room: structuredClone(document.room),
  };
  const latest = structuredClone(previous);
  latest.room!.light = "LOW";
  latest.reference = {
    ...latest.reference,
    versionId: "room:v2",
    revision: 2,
    checksum: canonicalChecksum(latest.room),
  };
  const lifecycle = {
    id: document.id,
    revision: 19,
    draft: document,
    saveState: "SAVED" as const,
    archived: false,
    updatedAt: "2026-10-15T00:00:00.000Z",
    lastUsedAt: null,
    usageCount: 2,
    releases: [],
  };
  const environment = {
    representation: "LIFECYCLE_V1" as const,
    id: document.id,
    builtin: false as const,
    ownerAccountId: "synthetic-owner",
    revision: 19,
    saveState: "SAVED" as const,
    archived: false,
    working: document,
    lifecycle,
    versions: [latest, previous],
  } satisfies CompatibleEnvironmentRecord;
  const active = createSceneFromEnvironment("active", "Active Scene", previous);
  const other = createSceneFromEnvironment("other", "Other Scene", previous);
  const item = (draft: SpatialDraft) => ({
    id: draft.content.definitionId,
    revision: 1,
    draft,
    releases: [],
    usageCount: 0,
    updatedAt: lifecycle.updatedAt,
  });
  const props = {
    draft: active,
    items: [item(active), item(other)],
    environments: [environment],
    revision: 1,
    dirty: false,
    disabled: false,
    save: vi.fn(async () => {}),
    refresh: vi.fn(async () => {}),
    replace: vi.fn(),
    openScene: vi.fn(async () => other),
    createScene: vi.fn(async (draft: SpatialDraft) => {
      void draft;
    }),
    duplicateScene: vi.fn(async () => other),
    archiveScene: vi.fn(async () => {}),
    updateEnvironment: vi.fn(async () => other),
    compareScene: vi.fn(async () => ({ sourceTitle: "Active Scene", targetTitle: "Other Scene", differences: [] })),
    editEnvironment: vi.fn(async () => {}),
    newEnvironment: vi.fn(async () => {}),
    preview: vi.fn(),
  };
  return { props, environment, previous, latest, active, other };
}

it("keeps an autosave failure visible inside the open Manager without changing the Scene", async () => {
  const { props } = setup();
  const snapshot = JSON.stringify(props.draft);
  const view = render(<SceneManager {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Manage Scenes" }));
  view.rerender(<SceneManager {...props} saveError="Please wait before trying again." />);
  const manager = screen.getByRole("dialog", { name: "Environments & Scenes" });
  const active = within(manager).getByRole("region", { name: "Active Scene information" });
  expect(within(active).getByRole("alert")).toHaveTextContent("Please wait before trying again.");
  expect(within(manager).getByRole("button", { name: "Save Scene" })).toBeEnabled();
  expect(JSON.stringify(props.draft)).toBe(snapshot);
});
function manager() {
  fireEvent.click(screen.getByRole("button", { name: "Manage Scenes" }));
  return within(screen.getByRole("dialog", { name: "Environments & Scenes" }));
}
it("keeps the fresh inactive Scene title after controlled update rather than restoring stale gallery data", async () => {
  const { props, other, latest } = setup();
  const fresh = structuredClone(other);
  fresh.content.title = "Other Scene, revised";
  fresh.content.entities[0].content = "Newer persisted content";
  fresh.content.environment = latest.reference;
  props.updateEnvironment.mockResolvedValue(fresh);
  render(<SceneManager {...props} />);
  const dialog = manager();
  fireEvent.click(dialog.getByRole("button", { name: "Review Environment impact" }));
  fireEvent.click(dialog.getByRole("button", { name: "Update and revalidate Other Scene" }));
  await waitFor(() => expect(props.updateEnvironment).toHaveBeenCalledWith("other", latest));
  await waitFor(() =>
    expect(dialog.getByRole("textbox", { name: "Rename active Scene" })).toHaveValue(fresh.content.title),
  );
  expect(other.content.title).toBe("Other Scene");
  expect(other.content.environment?.revision).toBe(1);
});
it("creates from the explicitly selected older version and leaves mutable working metadata out of the pin", async () => {
  const { props, previous } = setup();
  render(<SceneManager {...props} />);
  const dialog = manager();
  fireEvent.change(dialog.getByRole("combobox", { name: "Environment source version" }), {
    target: { value: previous.reference.versionId },
  });
  fireEvent.change(dialog.getByRole("textbox", { name: "Scene name" }), { target: { value: "Ordinary Room" } });
  fireEvent.click(dialog.getByRole("button", { name: "Create Scene from baseline" }));
  await waitFor(() => expect(props.createScene).toHaveBeenCalledTimes(1));
  const created = props.createScene.mock.calls[0][0];
  expect(created.content.environment).toEqual(previous.reference);
  expect(created.content.studio?.environment).toEqual(previous.room);
  expect(created.content.studio).not.toHaveProperty("environmentBinding");
});
it("opens the same owned Environment definition while keeping copy policy with the host", async () => {
  const { props, environment } = setup();
  render(<SceneManager {...props} />);
  const dialog = manager();
  fireEvent.click(dialog.getByRole("button", { name: "Edit shared Environment" }));
  await waitFor(() => expect(props.editEnvironment).toHaveBeenCalledWith(environment));
  expect(props.duplicateScene).not.toHaveBeenCalled();
});
it("does not treat a working-only Environment as an immutable Scene source", () => {
  const { props, environment } = setup();
  environment.versions = [];
  render(<SceneManager {...props} />);
  const dialog = manager();
  expect(dialog.getByRole("button", { name: "Create Scene from baseline" })).toBeDisabled();
  expect(dialog.getByRole("combobox", { name: "Environment source version" })).toHaveTextContent(
    "Create an immutable version",
  );
  expect(dialog.getByRole("button", { name: "Edit shared Environment" })).toBeEnabled();
});
it("uses the dedicated duplication port and retains Environment source choice separately", async () => {
  const { props } = setup();
  render(<SceneManager {...props} />);
  const dialog = manager();
  fireEvent.change(dialog.getByRole("combobox", { name: "Scene source" }), { target: { value: "other" } });
  fireEvent.change(dialog.getByRole("textbox", { name: "Scene name" }), { target: { value: "Independent copy" } });
  fireEvent.click(dialog.getByRole("button", { name: "Duplicate Scene" }));
  await waitFor(() => expect(props.duplicateScene).toHaveBeenCalledWith("other", "Independent copy", undefined));
  expect(props.createScene).not.toHaveBeenCalled();
});

it("retains a stable new Scene identity when the save response is lost", async () => {
  const { props } = setup();
  props.createScene.mockRejectedValueOnce(new Error("The save response was lost.")).mockResolvedValueOnce(undefined);
  render(<SceneManager {...props} />);
  const dialog = manager();
  fireEvent.click(dialog.getByRole("button", { name: "Create Scene from baseline" }));
  await dialog.findByRole("alert");
  const first = props.createScene.mock.calls[0][0];
  fireEvent.click(dialog.getByRole("button", { name: "Create Scene from baseline" }));
  await waitFor(() => expect(props.createScene).toHaveBeenCalledTimes(2));
  expect(props.createScene.mock.calls[1][0]).toEqual(first);
});
it("requires deliberate Library membership for a new Environment source while allowing existing Scene duplication", () => {
  const { props, environment } = setup();
  environment.saveState = "WORKING" as never;
  render(<SceneManager {...props} />);
  const dialog = manager();
  expect(dialog.getByRole("button", { name: "Create Scene from baseline" })).toBeDisabled();
  expect(dialog.getByText("Save this Environment to Library before using it for a new Scene.")).toBeVisible();
  fireEvent.change(dialog.getByRole("combobox", { name: "Scene source" }), { target: { value: "other" } });
  expect(dialog.getByRole("button", { name: "Duplicate Scene" })).toBeEnabled();
});

it("keeps a keyboard scroll entry while Scene creation disables its controls", async () => {
  const { props } = setup();
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  props.createScene.mockImplementationOnce(() => pending);
  render(<SceneManager {...props} />);
  const dialog = manager();
  fireEvent.change(dialog.getByRole("textbox", { name: "Scene name" }), { target: { value: "Keyboard Scene" } });
  fireEvent.click(dialog.getByRole("button", { name: "Create Scene from baseline" }));
  await waitFor(() => expect(props.createScene).toHaveBeenCalledTimes(1));
  expect(dialog.getByRole("button", { name: "Close Scene Manager" })).toBeDisabled();
  expect(dialog.getByRole("textbox", { name: "Scene name" })).toBeDisabled();
  const context = dialog.getByRole("region", { name: "Scene editing context" });
  expect(context).toHaveAttribute("tabindex", "0");
  expect(context.tabIndex).toBe(0);
  context.focus();
  expect(context).toHaveFocus();
  expect(context).toHaveTextContent("Editing Scene · independent content");
  finish();
  await waitFor(() => expect(dialog.getByRole("button", { name: "Close Scene Manager" })).toBeEnabled());
});
