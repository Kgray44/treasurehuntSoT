import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SpatialStudio } from "./SpatialStudio";
import { createSpatialDraft } from "@/parallax/authoring";
let calls: Record<string, unknown>[];
beforeEach(() => {
  calls = [];
  sessionStorage.clear();
  localStorage.clear();
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
  expect(
    within(screen.getByRole("region", { name: "Contextual spatial assistance" })).getByText(/AI provider unavailable/),
  ).toBeVisible();
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
  fireEvent.click(screen.getByRole("button", { name: "Open asset Library" }));
  fireEvent.change(screen.getByLabelText("Search spatial assets"), { target: { value: "Letter" } });
  fireEvent.click(screen.getByRole("tab", { name: "Hierarchy" }));
  fireEvent.click(screen.getByRole("tab", { name: "Library" }));
  expect(screen.getByLabelText("Search spatial assets")).toHaveValue("Letter");
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
