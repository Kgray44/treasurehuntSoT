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
import { createSpatialDraft, draftSchema } from "@/parallax/authoring";
let calls: Record<string, unknown>[];
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
      return new Response(JSON.stringify(body.action === "SAVE" ? { revision: 2 } : { findings: [] }));
    }),
  );
});
function assistantHTTPFixture(defer = false, create = false) {
  let saved = createSpatialDraft("owned"),
    revision = 1;
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
it("opens Guided mode with canvas/library/timeline and keeps mode changes out of stored truth", async () => {
  render(<SpatialStudio chronicleId="chronicle" definitionId="owned" blockId="block" />);
  await screen.findByRole("heading", { name: "Desk Map", level: 1 });
  expect(screen.getByRole("region", { name: "Spatial canvas" })).toBeVisible();
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
  fireEvent.click(screen.getByRole("button", { name: /Ask Parallax/ }));
  expect(screen.getByRole("region", { name: "Spatial Assistant" })).toBeVisible();
  expect(
    within(screen.getByRole("region", { name: "Spatial Assistant" })).getByText(/Spatial Assistant is unavailable/),
  ).toBeVisible();
  fireEvent.click(screen.getByText("Guided placement controls"));
  expect(screen.getByRole("region", { name: "Contextual spatial assistance" })).toBeVisible();
});
it("records manual transforms as reversible edits and serializes autosave", async () => {
  render(<SpatialStudio chronicleId="chronicle" definitionId="owned" />);
  await screen.findByRole("heading", { name: "Desk Map", level: 1 });
  fireEvent.click(screen.getByText("Transform", { exact: true }));
  fireEvent.change(screen.getByLabelText("Object width in meters"), { target: { value: "0.6" } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(calls.some((c) => c.action === "SAVE")).toBe(true));
  expect(
    (calls.find((c) => c.action === "SAVE")!.draft as ReturnType<typeof createSpatialDraft>).content.entities[0]
      .widthMeters,
  ).toBe(0.6);
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(screen.getByLabelText("Object width in meters")).toHaveValue(0.5);
  fireEvent.click(screen.getByRole("button", { name: "Redo" }));
  expect(screen.getByLabelText("Object width in meters")).toHaveValue(0.6);
});
it("keeps layout switches and panel preferences out of canonical edits and retains tab state", async () => {
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Desk Map", level: 1 });
  fireEvent.click(screen.getByRole("button", { name: "Open Spatial Library" }));
  fireEvent.change(screen.getByLabelText("Search assets"), { target: { value: "Letter" } });
  fireEvent.click(screen.getByRole("button", { name: "Open Scene Hierarchy" }));
  fireEvent.click(screen.getByRole("button", { name: "Open Spatial Library" }));
  expect(screen.getByLabelText("Search assets")).toHaveValue("Letter");
  fireEvent.change(screen.getByLabelText("Workspace layout"), { target: { value: "FOCUS" } });
  expect(screen.queryByRole("complementary", { name: "Spatial Library" })).toBeNull();
  expect(screen.queryByRole("complementary", { name: "Spatial inspector" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Workspace layout"), { target: { value: "BEHAVIOR" } });
  expect(screen.getByRole("tabpanel", { name: "Timeline" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Reset Workspace Layout" }));
  expect(screen.getByLabelText("Workspace layout")).toHaveValue("SPATIAL");
  expect(calls).toEqual([]);
  await waitFor(() =>
    expect(localStorage.getItem("parallax.workspace.v1:synthetic-creator")).toContain('"preset":"SPATIAL"'),
  );
});
it("presents truthful fallback and all ten synthetic environment results", async () => {
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Desk Map", level: 1 });
  fireEvent.change(screen.getByLabelText("Preview", { exact: true }), { target: { value: "FALLBACK" } });
  expect(
    within(screen.getByRole("region", { name: "Spatial canvas" })).getByText(/Read and inspect the same clue here/),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Test in 10 environments" }));
  expect(screen.getByText(/Synthetic previews and physical\/owner acceptance/)).toBeVisible();
  expect(screen.getByRole("button", { name: /Outdoor trail.*GUIDED FALLBACK/ })).toBeVisible();
});
it("keeps a newly saved scene in the URL without losing Chronicle, Passage or history state", async () => {
  window.history.replaceState(
    { syntheticNavigation: "preserved" },
    "",
    "/studio/parallax?chronicle=chronicle&block=block#inspector",
  );
  render(<SpatialStudio chronicleId="chronicle" blockId="block" />);
  await screen.findByRole("heading", { name: "Desk Map", level: 1 });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(calls.some((call) => call.action === "SAVE")).toBe(true));
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
});
it("mounts the real port, previews without saving, installs one acknowledged history change and avoids duplicate autosave", async () => {
  const fixture = assistantHTTPFixture();
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Desk Map", level: 1 });
  fireEvent.click(screen.getByText("Transform", { exact: true }));
  fireEvent.click(screen.getByRole("button", { name: /Ask Parallax/ }));
  const panel = within(screen.getByRole("region", { name: "Spatial Assistant" }));
  fireEvent.change(panel.getByLabelText("Describe your spatial idea"), {
    target: { value: "Make the map smaller without changing its clue." },
  });
  expect(calls).toEqual([]);
  fireEvent.click(panel.getByRole("button", { name: /Send idea/ }));
  await panel.findByRole("button", { name: "Apply all changes" });
  expect(calls.filter((call) => call.action === "AI")).toHaveLength(1);
  expect(screen.getByLabelText("Object width in meters")).toHaveValue(0.5);
  fireEvent.click(panel.getByRole("button", { name: "Proposed scene" }));
  await waitFor(() => expect(screen.getByText(/Review placement preview/)).toBeVisible());
  expect(fixture.readSaved().revision).toBe(1);
  expect(calls.some((call) => call.action === "SAVE" || call.action === "ASSISTANT_APPLY")).toBe(false);
  fireEvent.click(panel.getByRole("button", { name: "Apply all changes" }));
  await panel.findByText(/Reviewed changes are saved/);
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
});
it("rejects a mounted late response after a manual edit and byte-identical undo", async () => {
  const fixture = assistantHTTPFixture(true);
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Desk Map", level: 1 });
  fireEvent.click(screen.getByText("Transform", { exact: true }));
  fireEvent.click(screen.getByRole("button", { name: /Ask Parallax/ }));
  const panel = within(screen.getByRole("region", { name: "Spatial Assistant" }));
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
  fireEvent.click(panel.getByRole("button", { name: /Send idea/ }));
  await panel.findByRole("button", { name: "Apply all changes" });
  expect(Number(calls.filter((call) => call.action === "AI")[1].editorGeneration)).toBeGreaterThan(
    Number(submitted.editorGeneration),
  );
});
it("locates a proposed object in the real preview without erasing it on selection", async () => {
  const fixture = assistantHTTPFixture(false, true);
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Desk Map", level: 1 });
  fireEvent.click(screen.getByRole("button", { name: /Ask Parallax/ }));
  const panel = within(screen.getByRole("region", { name: "Spatial Assistant" }));
  fireEvent.change(panel.getByLabelText("Describe your spatial idea"), { target: { value: "Add a readable note." } });
  fireEvent.click(panel.getByRole("button", { name: /Send idea/ }));
  await panel.findByRole("button", { name: "Apply all changes" });
  fireEvent.click(panel.getByRole("button", { name: "Locate object" }));
  const canvas = within(screen.getByRole("region", { name: "Spatial canvas" }));
  await canvas.findByRole("button", { name: /^Proposed note\./ });
  expect(fixture.readSaved().draft.content.entities).toHaveLength(1);
  expect(screen.getByText(/Review placement preview/)).toBeVisible();
  fireEvent.click(panel.getByRole("button", { name: "View canvas" }));
  await waitFor(() => expect(screen.getByRole("button", { name: /Ask Parallax/ })).toHaveFocus());
  expect(screen.queryByRole("region", { name: "Spatial Assistant" })).not.toBeInTheDocument();
  expect(canvas.getByRole("button", { name: /^Proposed note\./ })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /Ask Parallax/ }));
  fireEvent.click(panel.getByRole("button", { name: "Apply all changes" }));
  await panel.findByText(/Reviewed changes are saved/);
  expect(fixture.readSaved().draft.content.entities).toHaveLength(2);
  expect(screen.getByText(/Reviewed Assistant changes saved/)).toBeVisible();
});
