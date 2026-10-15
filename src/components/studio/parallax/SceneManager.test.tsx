import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SceneManager } from "./SceneManager";
import builtinVersions from "@/parallax/builtin-environments.v1.json";
import { environmentVersionSchema, type EnvironmentRecord } from "@/parallax/environment-contracts";
import { canonicalChecksum } from "@/drydock/canonical";
import { createEnvironmentScene } from "@/parallax/environment-authoring";
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
it("revalidates the freshly opened inactive Scene without overwriting newer content with the gallery snapshot", async () => {
  const previous = environmentVersionSchema.parse(builtinVersions[0]);
  previous.content.id = "room";
  previous.content.origin = "MANUAL";
  previous.reference = {
    environmentId: "room",
    versionId: "room:e1",
    revision: 1,
    checksum: canonicalChecksum(previous.content),
  };
  const current = structuredClone(previous);
  current.content.width = 6;
  current.reference = {
    ...previous.reference,
    versionId: "room:e2",
    revision: 2,
    checksum: canonicalChecksum(current.content),
  };
  const environment: EnvironmentRecord = {
    id: "room",
    ownerAccountId: "synthetic-creator",
    builtin: false,
    current,
    versions: [current, previous],
  };
  const active = createEnvironmentScene("active", "Active Scene", previous);
  const galleryCopy = createEnvironmentScene("other", "Other Scene", previous);
  const fresh = structuredClone(galleryCopy);
  fresh.content.title = "Other Scene, revised";
  fresh.content.entities[0].content = "Newer content saved after this gallery was loaded.";
  const openScene = vi.fn(async () => fresh);
  const replace = vi.fn();
  const item = (draft: SpatialDraft) => ({
    id: draft.content.definitionId,
    revision: 1,
    draft,
    releases: [],
    usageCount: 0,
    updatedAt: "2026-10-15T00:00:00.000Z",
  });
  render(
    <SceneManager
      draft={active}
      items={[item(active), item(galleryCopy)]}
      environments={[environment]}
      revision={1}
      dirty={false}
      disabled={false}
      save={async () => {}}
      refresh={async () => {}}
      api={async () => ({})}
      replace={replace}
      openScene={openScene}
      createScene={async () => {}}
      preview={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Manage Scenes" }));
  const dialog = within(screen.getByRole("dialog", { name: "Environments & Scenes" }));
  fireEvent.click(dialog.getByRole("button", { name: "Review Environment impact" }));
  fireEvent.click(dialog.getByRole("button", { name: "Update and revalidate Other Scene" }));
  await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
  expect(openScene).toHaveBeenCalledWith("other");
  const updated = replace.mock.calls[0][0] as SpatialDraft;
  expect(updated.content.definitionId).toBe("other");
  expect(updated.content.entities[0].content).toBe(fresh.content.entities[0].content);
  expect(dialog.getByRole("textbox", { name: "Rename active Scene" })).toHaveValue(fresh.content.title);
  expect(updated.content.environment?.revision).toBe(2);
  expect(galleryCopy.content.environment?.revision).toBe(1);
  expect(active.content.environment?.revision).toBe(1);
});
