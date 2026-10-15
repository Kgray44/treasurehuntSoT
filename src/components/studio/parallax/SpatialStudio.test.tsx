import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render as renderUI, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import { webcrypto } from "node:crypto";
import {
  assistantSceneDigest,
  materializeAssistantProposal,
  type AssistantProposal,
} from "@/parallax/spatial-assistant";
import type { SpatialDraft } from "@/parallax/authoring";
import { SpatialStudio } from "./SpatialStudio";
import { createRoomEnvironment } from "@/parallax/environment-authoring";
import { simulationEnvironments } from "@/parallax/studio-validation";
import * as sceneChecks from "@/parallax/studio-validation";
import { createSpatialDraft, draftSchema } from "@/parallax/authoring";
let calls: Record<string, unknown>[];

it("offers an explicit Environment copy before editing a pinned Scene room", async () => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value() {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value() {
        this.open = false;
      },
    },
  });
  const originalFetch = globalThis.fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      const response = await originalFetch(url, options);
      if (options?.method) return response;
      const data = await response.json();
      const scene = data.items[0].draft as SpatialDraft;
      scene.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
      scene.content.environment = {
        environmentId: "released-room",
        versionId: "released-room:v1",
        revision: 1,
        checksum: "a".repeat(64),
      };
      return Response.json(data);
    }),
  );
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Parallax", level: 1 });
  fireEvent.click(screen.getByRole("button", { name: "Edit room features" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText(/This Scene keeps its released Environment unchanged/)).toBeVisible();
  expect(within(dialog).getByRole("combobox", { name: "Type" })).toHaveValue("ENVIRONMENT");
  expect(screen.queryByRole("button", { name: "Finish environment editing" })).toBeNull();
  expect(calls.some((call) => call.action === "SAVE_AS" || call.action === "SAVE")).toBe(false);
});
const render = (ui: ReactElement) => renderUI(ui, { wrapper: AnimationProvider });
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  calls = [];
  sessionStorage.clear();
  localStorage.clear();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("innerWidth", 1920);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  const draft = createSpatialDraft("owned", "Desk Map", "chronicle");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options) => {
      if (!options?.method)
        return new Response(
          JSON.stringify({
            csrfToken: "synthetic-csrf",
            layoutScope: "synthetic-creator",
            aiAvailable: false,
            aiConfigured: false,
            aiUsage: {
              enabled: false,
              advancedEnabled: false,
              allowance: 500,
              used: 0,
              remaining: 500,
              resetAt: "2026-11-01T00:00:00.000Z",
              source: "INHERITED",
              nearingLimit: false,
            },
            items: [
              { id: "owned", revision: 1, draft, releases: [], usageCount: 0, updatedAt: new Date().toISOString() },
            ],
            chronicle: {
              id: "chronicle",
              title: "Synthetic Chronicle",
              autosaveVersion: 1,
              blocks: [{ id: "block", title: "Passage", spatialMoment: null }],
            },
          }),
        );
      const body = JSON.parse(options.body);
      calls.push(body);
      if (body.action === "ENVIRONMENT_CATALOG") return Response.json({ catalog: [] });
      return new Response(JSON.stringify(body.action === "SAVE" ? { revision: 2 } : { findings: [] }));
    }),
  );
});
function assistantHTTPFixture(defer = false, create = false) {
  let saved = createSpatialDraft("owned"),
    revision = 1;
  saved.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  saved = draftSchema.parse(saved);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  if (!defer) release();
  const usage = {
    enabled: true,
    advancedEnabled: false,
    allowance: 500,
    used: 0,
    remaining: 500,
    resetAt: "2026-11-01T00:00:00.000Z",
    source: "INHERITED",
    nearingLimit: false,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options) => {
      if (!options?.method)
        return new Response(
          JSON.stringify({
            csrfToken: "synthetic-csrf",
            layoutScope: "synthetic-creator",
            aiAvailable: true,
            aiConfigured: true,
            aiUsage: usage,
            chronicle: null,
            items: [
              { id: "owned", revision, draft: saved, releases: [], usageCount: 0, updatedAt: new Date().toISOString() },
            ],
          }),
        );
      const body = JSON.parse(options.body);
      calls.push(body);
      if (body.action === "ENVIRONMENT_CATALOG") return Response.json({ catalog: [] });
      if (body.action === "SAVE") {
        if (body.revision !== revision)
          return new Response(JSON.stringify({ error: "Synthetic stale revision", code: "DRAFT_CONFLICT" }), {
            status: 409,
          });
        saved = body.draft;
        revision += 1;
        return new Response(JSON.stringify({ revision }));
      }
      if (body.action === "AI") {
        await gate;
        const proposal: AssistantProposal = {
          schemaVersion: 1,
          requestId: body.requestId,
          definitionId: body.draft.content.definitionId,
          sceneRevision: body.revision,
          editorGeneration: body.editorGeneration,
          sceneDigest: await assistantSceneDigest(body.draft),
          intentType: "EDIT",
          summary: "Make the map smaller",
          clarification: null,
          assumptions: [],
          unsupportedCapabilities: [],
          warnings: [],
          accessibilityNotes: [],
          creatorExplanation: "A readable smaller map, with its original clue text preserved.",
          operations: create
            ? [
                {
                  id: "create-note",
                  type: "CREATE",
                  entityId: "proposed-note",
                  name: "Proposed note",
                  kind: "TEXT",
                  content: "A synthetic note for review",
                  alternativeText: "A readable note in Guided View",
                  widthMeters: 0.3,
                  placement: "DESK",
                  position: { x: 0, y: 0, z: 0 },
                  scale: 1,
                  explanation: "Add a supported readable note.",
                  dependsOn: [],
                },
                {
                  id: "room-placement",
                  type: "ROOM_PLACEMENT",
                  entityId: "proposed-note",
                  classification: "DESK",
                  targetFeatureId: "reference-desk",
                  nearFeatureId: null,
                  explanation: "Use a clear fitting area on the authored desk.",
                  dependsOn: ["create-note"],
                },
              ]
            : [
                {
                  id: "resize",
                  type: "CONTENT",
                  entityId: body.draft.content.entities[0].id,
                  name: null,
                  content: null,
                  alternativeText: null,
                  widthMeters: 0.3,
                  interactions: null,
                  explanation: "Reduce the map width.",
                  dependsOn: [],
                },
              ],
        };
        return new Response(
          JSON.stringify({ status: "PROPOSED", proposal, usage: { ...usage, used: 1, remaining: 499 } }),
        );
      }
      if (body.action === "ASSISTANT_APPLY") {
        saved = await materializeAssistantProposal(saved, revision, body.proposal, body.selectedOperationIds);
        revision += 1;
        return new Response(JSON.stringify({ status: "SAVED", draft: saved, revision }));
      }
      return new Response(JSON.stringify({ findings: [] }));
    }),
  );
  return { release, readSaved: () => ({ draft: saved, revision }) };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
// Full workstation integration cases include multiple renders and async edit acknowledgements.
// Actual user-facing latency remains qualified by the production browser contracts.
it("opens Guided mode with canvas/library/timeline and keeps mode changes out of stored truth", async () => {
  render(<SpatialStudio chronicleId="chronicle" definitionId="owned" blockId="block" />);
  await screen.findByRole("heading", { name: "Parallax", level: 1 });
  expect(screen.getByLabelText("Spatial canvas", { exact: true })).toBeVisible();
  expect(screen.getByRole("region", { name: "Bottom workstation dock" })).toBeVisible();
  fireEvent.click(screen.getByRole("tab", { name: "Timeline" }));
  expect(screen.getByRole("tabpanel", { name: "Timeline" })).toBeVisible();
  const before = calls.length;
  fireEvent.change(screen.getByLabelText("Authoring mode"), { target: { value: "ENGINEERING" } });
  expect(screen.getByLabelText("Position x")).toBeVisible();
  expect(calls).toHaveLength(before);
  fireEvent.change(screen.getByLabelText("Authoring mode"), { target: { value: "GUIDED" } });
  expect(screen.queryByLabelText("Position x")).toBeNull();
  expect(screen.getByText(/AI unavailable · phrase rules/)).toBeVisible();
  fireEvent.click(screen.getByLabelText("Ask Parallax", { selector: "button", exact: true }));
  expect(screen.getByLabelText("Spatial Assistant", { exact: true })).toBeVisible();
  expect(
    within(screen.getByLabelText("Spatial Assistant", { exact: true })).getByText(/Spatial Assistant is unavailable/),
  ).toBeVisible();
  expect(screen.queryByText("Guided placement controls")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Edit room features" })).toBeVisible();
}, 30000);
it("records manual transforms as reversible edits and serializes autosave", async () => {
  render(<SpatialStudio chronicleId="chronicle" definitionId="owned" />);
  await screen.findByRole("heading", { name: "Parallax", level: 1 });
  fireEvent.click(screen.getByText("Transform", { exact: true }));
  fireEvent.change(screen.getByLabelText("Object width in meters"), { target: { value: "0.6" } });
  await waitFor(() => expect(calls.some((c) => c.action === "SAVE")).toBe(true), { timeout: 3000 });
  expect(
    (calls.find((c) => c.action === "SAVE")!.draft as ReturnType<typeof createSpatialDraft>).content.entities[0]
      .widthMeters,
  ).toBe(0.6);
  fireEvent.click(screen.getByLabelText("Undo", { selector: "button", exact: true }));
  expect(screen.getByLabelText("Object width in meters")).toHaveValue(0.5);
  fireEvent.click(screen.getByLabelText("Redo", { selector: "button", exact: true }));
  expect(screen.getByLabelText("Object width in meters")).toHaveValue(0.6);
}, 30000);
it("keeps layout switches and panel preferences out of canonical edits and retains tab state", async () => {
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Parallax", level: 1 });
  fireEvent.click(screen.getByLabelText("Open Library", { selector: "button", exact: true }));
  fireEvent.change(screen.getByLabelText("Search assets"), { target: { value: "Letter" } });
  fireEvent.click(screen.getByLabelText("Open Scene Hierarchy", { selector: "button", exact: true }));
  fireEvent.click(screen.getByLabelText("Open Library", { selector: "button", exact: true }));
  expect(screen.getByLabelText("Search assets")).toHaveValue("Letter");
  fireEvent.click(screen.getByRole("tab", { name: "Environments", exact: true }));
  fireEvent.click(screen.getByLabelText("Open Scene Hierarchy", { selector: "button", exact: true }));
  fireEvent.click(screen.getByLabelText("Open Library", { selector: "button", exact: true }));
  expect(screen.getByRole("tab", { name: "Environments", exact: true })).toHaveAttribute("aria-selected", "true");
  fireEvent.change(screen.getByLabelText("Workspace layout"), { target: { value: "FOCUS" } });
  expect(screen.queryByRole("complementary", { name: "Spatial Library" })).toBeNull();
  expect(screen.queryByRole("complementary", { name: "Spatial inspector" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Workspace layout"), { target: { value: "BEHAVIOR" } });
  expect(screen.getByRole("tabpanel", { name: "Timeline" })).toBeVisible();
  fireEvent.click(screen.getByLabelText("Reset Workspace Layout", { selector: "button", exact: true }));
  expect(screen.getByLabelText("Workspace layout")).toHaveValue("SPATIAL");
  expect(calls.filter((call) => call.action !== "ENVIRONMENT_CATALOG")).toEqual([]);
  await waitFor(() =>
    expect(localStorage.getItem("parallax.workspace.v1:synthetic-creator")).toContain('"preset":"SPATIAL"'),
  );
}, 30000);
it("presents truthful fallback and all ten synthetic environment results", async () => {
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Parallax", level: 1 });
  fireEvent.change(screen.getByLabelText("Preview", { exact: true }), { target: { value: "FALLBACK" } });
  expect(
    within(screen.getByLabelText("Spatial canvas", { exact: true })).getByText(/Read and inspect the same clue here/),
  ).toBeVisible();
  fireEvent.click(screen.getByText("Test in 10 environments", { selector: "button", exact: true }));
  expect(screen.getByText(/Synthetic previews and physical\/owner acceptance/)).toBeVisible();
  expect(screen.getByRole("button", { name: /Outdoor trail.*GUIDED FALLBACK/ })).toBeVisible();
}, 30000);
it("keeps a newly saved scene in the URL without losing Chronicle, Passage or history state", async () => {
  window.history.replaceState(
    { syntheticNavigation: "preserved" },
    "",
    "/studio/parallax?chronicle=chronicle&block=block#inspector",
  );
  render(<SpatialStudio chronicleId="chronicle" blockId="block" />);
  await screen.findByRole("heading", { name: "Parallax", level: 1 });
  await waitFor(() => expect(calls.some((call) => call.action === "SAVE")).toBe(true), { timeout: 3000 });
  const saved = calls.find((call) => call.action === "SAVE")!;
  const savedDraft = draftSchema.parse(saved.draft);
  await waitFor(() =>
    expect(new URL(window.location.href).searchParams.get("definition")).toBe(savedDraft.content.definitionId),
  );
  const url = new URL(window.location.href);
  expect(url.searchParams.get("chronicle")).toBe("chronicle");
  expect(url.searchParams.get("block")).toBe("block");
  expect(url.hash).toBe("#inspector");
  expect(window.history.state).toEqual({ syntheticNavigation: "preserved" });
}, 30000);
it("mounts the real port, previews without saving, installs one acknowledged history change and avoids duplicate autosave", async () => {
  const fixture = assistantHTTPFixture();
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Parallax", level: 1 });
  fireEvent.click(screen.getByText("Transform", { exact: true }));
  fireEvent.click(screen.getByLabelText("Ask Parallax", { selector: "button", exact: true }));
  const panel = within(screen.getByLabelText("Spatial Assistant", { exact: true }));
  fireEvent.change(panel.getByLabelText("Describe your spatial idea"), {
    target: { value: "Make the map smaller without changing its clue." },
  });
  expect(calls.filter((call) => call.action !== "ENVIRONMENT_CATALOG")).toEqual([]);
  fireEvent.click(panel.getByRole("button", { name: /Send idea/ }));
  await panel.findByRole("button", { name: "Apply all changes" }, { timeout: 5000 });
  expect(calls.filter((call) => call.action === "AI")).toHaveLength(1);
  expect(screen.getByLabelText("Object width in meters")).toHaveValue(0.5);
  fireEvent.click(panel.getByRole("button", { name: "Proposed scene" }));
  await waitFor(() => expect(screen.getByText(/Review placement preview/)).toBeVisible());
  expect(fixture.readSaved().revision).toBe(1);
  expect(calls.some((call) => call.action === "SAVE" || call.action === "ASSISTANT_APPLY")).toBe(false);
  fireEvent.click(panel.getByRole("button", { name: "Apply all changes" }));
  await panel.findByText(/Reviewed changes are saved/, {}, { timeout: 5000 });
  expect(screen.getByLabelText("Object width in meters")).toHaveValue(0.3);
  expect(fixture.readSaved().revision).toBe(2);
  expect(calls.filter((call) => call.action === "ASSISTANT_APPLY")).toHaveLength(1);
  await new Promise((resolve) => setTimeout(resolve, 900));
  expect(calls.filter((call) => call.action === "SAVE")).toHaveLength(0);
  fireEvent.click(panel.getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(screen.getByLabelText("Object width in meters")).toHaveValue(0.5));
  fireEvent.click(panel.getByRole("button", { name: "Redo" }));
  await waitFor(() => expect(screen.getByLabelText("Object width in meters")).toHaveValue(0.3));
  expect(calls.filter((call) => call.action === "ASSISTANT_APPLY")).toHaveLength(1);
}, 30000);
it("rejects a mounted late response after a manual edit and byte-identical undo", async () => {
  const fixture = assistantHTTPFixture(true);
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Parallax", level: 1 });
  fireEvent.click(screen.getByText("Transform", { exact: true }));
  fireEvent.click(screen.getByLabelText("Ask Parallax", { selector: "button", exact: true }));
  const panel = within(screen.getByLabelText("Spatial Assistant", { exact: true }));
  fireEvent.change(panel.getByLabelText("Describe your spatial idea"), { target: { value: "Make the map smaller." } });
  fireEvent.click(panel.getByRole("button", { name: /Send idea/ }));
  await waitFor(() => expect(calls.some((call) => call.action === "AI")).toBe(true));
  const submitted = calls.find((call) => call.action === "AI")!;
  fireEvent.change(screen.getByLabelText("Object width in meters"), { target: { value: "0.6" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Undo" })[0]);
  expect(screen.getByLabelText("Object width in meters")).toHaveValue(0.5);
  fixture.release();
  await panel.findByText(/scene has changed/);
  expect(panel.queryByRole("button", { name: "Apply all changes" })).toBeNull();
  expect(calls.some((call) => call.action === "ASSISTANT_APPLY")).toBe(false);
  expect(fixture.readSaved().draft).toEqual(submitted.draft as SpatialDraft);
  fireEvent.change(panel.getByLabelText("Describe your spatial idea"), { target: { value: "Make the map smaller." } });
  fireEvent.click(panel.getByRole("button", { name: /Send idea/ }));
  await panel.findByRole("button", { name: "Apply all changes" }, { timeout: 5000 });
  expect(Number(calls.filter((call) => call.action === "AI")[1].editorGeneration)).toBeGreaterThan(
    Number(submitted.editorGeneration),
  );
}, 30000);
it("locates a proposed object in the real preview without erasing it on selection", async () => {
  const fixture = assistantHTTPFixture(false, true);
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Parallax", level: 1 });
  fireEvent.click(screen.getByLabelText("Ask Parallax", { selector: "button", exact: true }));
  const panel = within(screen.getByLabelText("Spatial Assistant", { exact: true }));
  fireEvent.change(panel.getByLabelText("Describe your spatial idea"), { target: { value: "Add a readable note." } });
  fireEvent.click(panel.getByRole("button", { name: /Send idea/ }));
  await panel.findByRole("button", { name: "Apply all changes" }, { timeout: 5000 });
  fireEvent.click(panel.getAllByRole("button", { name: "Locate object" })[0]);
  const canvas = within(screen.getByLabelText("Spatial canvas", { exact: true }));
  await canvas.findByRole("button", { name: /^Proposed note\./ });
  expect(fixture.readSaved().draft.content.entities).toHaveLength(1);
  expect(screen.getByText(/Review placement preview/)).toBeVisible();
  fireEvent.click(panel.getByRole("button", { name: "View canvas" }));
  await waitFor(() => expect(screen.getByLabelText("Ask Parallax", { selector: "button", exact: true })).toHaveFocus());
  expect(screen.queryByRole("region", { name: "Spatial Assistant" })).not.toBeInTheDocument();
  expect(canvas.getByRole("button", { name: /^Proposed note\./ })).toBeVisible();
  fireEvent.click(screen.getByLabelText("Ask Parallax", { selector: "button", exact: true }));
  fireEvent.click(panel.getByRole("button", { name: "Apply all changes" }));
  await panel.findByText(/Reviewed changes are saved/, {}, { timeout: 5000 });
  expect(fixture.readSaved().draft.content.entities).toHaveLength(2);
  expect(screen.getByText(/Reviewed Assistant changes saved/)).toBeVisible();
}, 30000);
it("keeps graph rows asset-only with one duplication and lock toolbar", async () => {
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Parallax", level: 1 });
  fireEvent.click(screen.getByLabelText("Open Scene Hierarchy", { selector: "button", exact: true }));
  const graph = screen.getByLabelText("Scene graph", { exact: true });
  const rows = graph.querySelectorAll("li");
  expect(rows).toHaveLength(1);
  expect(within(rows[0]).getAllByRole("button")).toHaveLength(1);
  fireEvent.click(within(rows[0]).getByRole("button"));
  const toolbar = within(graph).getByRole("toolbar", { name: "Scene graph object actions" });
  expect(within(toolbar).getByLabelText("Remove object", { exact: true })).toBeDisabled();
  fireEvent.click(within(toolbar).getByLabelText("Duplicate object", { exact: true }));
  expect(graph.querySelectorAll("li")).toHaveLength(2);
  fireEvent.click(within(toolbar).getByLabelText("Lock object", { exact: true }));
  expect(within(toolbar).getByLabelText("Duplicate object", { exact: true })).toBeDisabled();
  fireEvent.click(within(toolbar).getByLabelText("Unlock object", { exact: true }));
  expect(within(toolbar).getByLabelText("Duplicate object", { exact: true })).toBeEnabled();
}, 30000);

it("restores focus and history after graph keyboard hide and toolbar removal", async () => {
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Parallax", level: 1 });
  fireEvent.click(screen.getByLabelText("Open Scene Hierarchy", { selector: "button", exact: true }));
  const undo = screen.getByLabelText("Undo", { selector: "button", exact: true });
  const graph = screen.getByLabelText("Scene graph", { exact: true });
  fireEvent.click(within(graph.querySelectorAll("li")[0]).getByRole("button"));
  const toolbar = within(graph).getByRole("toolbar", { name: "Scene graph object actions" });
  fireEvent.click(within(toolbar).getByLabelText("Duplicate object", { exact: true }));
  const row = within(graph.querySelectorAll("li")[1]).getByRole("button");
  row.focus();
  fireEvent.keyDown(row, { key: "F10", shiftKey: true });
  const menu = screen.getByLabelText("Desk Map copy actions", { exact: true });
  expect(menu).toBeVisible();
  fireEvent.click(within(menu).getByText("Hide object", { exact: true }));
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(row).toHaveFocus();
  expect(within(toolbar).getByLabelText("Show object", { exact: true })).toBeEnabled();
  fireEvent.click(undo);
  expect(within(toolbar).getByLabelText("Hide object", { exact: true })).toBeEnabled();
  fireEvent.click(within(toolbar).getByLabelText("Remove object", { exact: true }));
  expect(graph.querySelectorAll("li")).toHaveLength(1);
  fireEvent.click(undo);
  expect(graph.querySelectorAll("li")).toHaveLength(2);
}, 30000);

it("flushes edits before Drydock validation and keeps the completed feedback", async () => {
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Parallax", level: 1 });
  fireEvent.change(screen.getByLabelText("Object name"), { target: { value: "Reviewed map" } });
  fireEvent.click(screen.getByText("Scene actions", { exact: true }));
  fireEvent.click(screen.getByText("Validate in Drydock", { selector: "button", exact: true }));
  await screen.findByText(/Drydock spatial checks complete/);
  expect(
    calls.filter((call) => call.action === "SAVE" || call.action === "VALIDATE").map((call) => call.action),
  ).toEqual(["SAVE", "VALIDATE"]);
  expect((calls.find((call) => call.action === "VALIDATE")!.draft as SpatialDraft).content.entities[0].name).toBe(
    "Reviewed map",
  );
}, 30000);

it("renames a graph asset with F2 as one undoable edit and cancels with Escape", async () => {
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Parallax", level: 1 });
  fireEvent.click(screen.getByLabelText("Open Scene Hierarchy", { selector: "button", exact: true }));
  const graph = screen.getByLabelText("Scene graph", { exact: true });
  const row = within(graph.querySelector("li")!).getByRole("button");
  fireEvent.keyDown(row, { key: "F2" });
  const input = within(graph).getByRole("textbox", { name: "Rename Desk Map" });
  fireEvent.change(input, { target: { value: "North clue" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(within(graph).getByText("North clue")).toBeVisible();
  fireEvent.click(screen.getByLabelText("Undo", { selector: "button", exact: true }));
  expect(within(graph).getByText("Desk Map", { exact: true })).toBeVisible();
  fireEvent.keyDown(within(graph.querySelector("li")!).getByRole("button"), { key: "F2" });
  fireEvent.change(within(graph).getByRole("textbox", { name: "Rename Desk Map" }), { target: { value: "Discarded" } });
  fireEvent.keyDown(within(graph).getByRole("textbox", { name: "Rename Desk Map" }), { key: "Escape" });
  expect(within(graph).getByText("Desk Map", { exact: true })).toBeVisible();
}, 30000);

it("does not rerun the ten-room diagnostic preview when changing workstation controls", async () => {
  const simulate = vi.spyOn(sceneChecks, "simulateSpatialEnvironments");
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Parallax", level: 1 });
  const initial = simulate.mock.calls.length;
  fireEvent.click(screen.getByRole("tab", { name: "Diagnostics" }));
  expect(simulate.mock.calls.length).toBe(initial + 1);
  fireEvent.click(screen.getByRole("tab", { name: "Timeline" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Authoring mode" }), {
    target: { value: "ENGINEERING" },
  });
  fireEvent.click(screen.getByRole("tab", { name: "Simulation" }));
  expect(simulate.mock.calls.length).toBe(initial + 1);
  simulate.mockRestore();
}, 30000);

it("adds a Library exclusion tool to the visible environment and selects its shared editing controls", async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Parallax", level: 1 });
  fireEvent.click(screen.getByLabelText("Open Library", { selector: "button", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Inspect Exclusion Zone", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Add to active Scene", exact: true }));
  expect(screen.getByRole("button", { name: "Finish environment editing" })).toBeVisible();
  const editor = screen.getByRole("region", { name: "Room feature editor" });
  expect((within(editor).getByRole("combobox", { name: "Room feature" }) as HTMLSelectElement).value).toMatch(/^zone-/);
  await waitFor(() => expect(calls.some((call) => call.action === "SAVE")).toBe(true), { timeout: 3000 });
  const saved = calls.find((call) => call.action === "SAVE")!.draft as SpatialDraft;
  expect(saved.content.studio!.environment!.features.some((f) => f.classification === "EXCLUSION_ZONE")).toBe(true);
  expect(saved.content.entities).toHaveLength(1);
}, 30000);
