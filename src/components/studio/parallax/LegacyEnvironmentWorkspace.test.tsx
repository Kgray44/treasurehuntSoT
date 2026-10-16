import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { canonicalChecksum } from "@/drydock/canonical";
import { createLegacyEnvironmentWorking } from "@/parallax/legacy-environment-working-contracts";
import { environmentVersionSchema } from "@/parallax/legacy-scene-environment-contracts";
import builtins from "@/parallax/builtin-environments.v1.json";
import { LegacyEnvironmentWorkspace } from "./LegacyEnvironmentWorkspace";
import { journalWorking } from "./working-recovery";
beforeEach(() => localStorage.clear());
afterEach(cleanup);
function initial() {
  const source = environmentVersionSchema.parse(builtins[0]);
  const working = createLegacyEnvironmentWorking(
    { ...source.content, id: "owned-room", name: "Owned shared room", origin: "MANUAL" },
    source.reference,
    {
      operationId: "copy-room",
      sourceDefinitionId: source.reference.environmentId,
      sourceRevision: 0,
      requestDigest: "a".repeat(64),
    },
  );
  return {
    working,
    revision: 1,
    contentChecksum: canonicalChecksum(working.content),
    saveState: "WORKING" as const,
    archived: false,
  };
}
it("saves working edits separately and creates a release only through the explicit reviewed operation", async () => {
  const state = initial(),
    original = JSON.stringify(state);
  let currentWorking = state.working;
  const api = vi.fn(async (raw: unknown) => {
    const request = raw as { action: string; document?: typeof state.working };
    if (request.document) currentWorking = request.document;
    if (request.action === "LEGACY_ENVIRONMENT_SAVE")
      return {
        ...state,
        working: request.document,
        revision: 2,
        contentChecksum: canonicalChecksum(request.document!.content),
      };
    if (request.action === "LEGACY_ENVIRONMENT_RELEASE")
      return {
        ...state,
        working: currentWorking,
        contentChecksum: canonicalChecksum(currentWorking.content),
        revision: 3,
        version: {
          reference: {
            environmentId: state.working.id,
            versionId: "opaque-release",
            revision: 1,
            checksum: canonicalChecksum(currentWorking.content),
          },
          content: currentWorking.content,
        },
      };
    throw new Error("Unexpected writer");
  });
  render(
    <LegacyEnvironmentWorkspace
      initial={state}
      accountId="owner"
      api={api}
      onClose={async () => {}}
      onRefresh={async () => state}
    />,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Environment name" }), {
    target: { value: "Changed working room" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save working Environment" }));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Working Environment saved"));
  expect(api.mock.calls[0][0]).toMatchObject({
    action: "LEGACY_ENVIRONMENT_SAVE",
    revision: 1,
    document: { content: { name: "Changed working room" } },
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Create immutable Environment version" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Create immutable Environment version" }));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  const saved = (api.mock.calls[0][0] as { document: typeof state.working }).document;
  expect(api.mock.calls[1][0]).toMatchObject({
    action: "LEGACY_ENVIRONMENT_RELEASE",
    definitionId: state.working.id,
    revision: 2,
    contentChecksum: canonicalChecksum(saved.content),
  });
  expect(JSON.stringify(state)).toBe(original);
});
it("restores a retained payload against its original CAS instead of overwriting a newer server revision", async () => {
  const state = { ...initial(), revision: 20 },
    retained = structuredClone(state.working);
  retained.content.name = "Retained local edit";
  journalWorking("owner", retained.id, retained, 19);
  const api = vi.fn(async (raw: unknown) => {
    void raw;
    throw new Error("This working Environment changed in another editor.");
  });
  render(
    <LegacyEnvironmentWorkspace
      initial={state}
      accountId="owner"
      api={api}
      onClose={async () => {}}
      onRefresh={async () => state}
    />,
  );
  await screen.findByRole("region", { name: "Environment recovery" });
  fireEvent.click(screen.getByRole("button", { name: "Restore retained edits" }));
  fireEvent.click(screen.getByRole("button", { name: "Save working Environment" }));
  await waitFor(() => expect(api).toHaveBeenCalled());
  expect(api.mock.calls[0][0]).toMatchObject({
    action: "LEGACY_ENVIRONMENT_SAVE",
    revision: 19,
    document: { content: { name: "Retained local edit" } },
  });
  expect(state.working.content.name).toBe("Owned shared room");
  expect(await screen.findByRole("alert")).toHaveTextContent("changed in another editor");
});
