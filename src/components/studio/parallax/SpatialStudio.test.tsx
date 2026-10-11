import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SpatialStudio } from "./SpatialStudio";
import { createSpatialDraft } from "@/parallax/authoring";
let calls: Record<string, unknown>[];
beforeEach(() => {
  calls = [];
  sessionStorage.clear();
  const draft = createSpatialDraft("owned", "Desk Map", "chronicle");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options) => {
      if (!options?.method)
        return new Response(
          JSON.stringify({
            csrfToken: "synthetic-csrf",
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
  expect(screen.getByRole("region", { name: "Behavior timeline" })).toBeVisible();
  const before = calls.length;
  fireEvent.change(screen.getByLabelText("Authoring mode"), { target: { value: "ENGINEERING" } });
  expect(screen.getByLabelText("Position x")).toBeVisible();
  expect(calls).toHaveLength(before);
  fireEvent.change(screen.getByLabelText("Authoring mode"), { target: { value: "GUIDED" } });
  expect(screen.queryByLabelText("Position x")).toBeNull();
  expect(screen.getByText(/AI provider unavailable/)).toBeVisible();
});
it("records manual transforms as reversible edits and serializes autosave", async () => {
  render(<SpatialStudio chronicleId="chronicle" definitionId="owned" />);
  await screen.findByRole("heading", { name: "Desk Map", level: 1 });
  fireEvent.change(screen.getByLabelText("Object width in meters"), { target: { value: "0.6" } });
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() => expect(calls.some((c) => c.action === "SAVE")).toBe(true));
  expect(
    (calls.find((c) => c.action === "SAVE")!.draft as ReturnType<typeof createSpatialDraft>).content.entities[0]
      .widthMeters,
  ).toBe(0.6);
  fireEvent.click(screen.getByRole("button", { name: "Undo", exact: true }));
  expect(screen.getByLabelText("Object width in meters")).toHaveValue(0.5);
  fireEvent.click(screen.getByRole("button", { name: "Redo", exact: true }));
  expect(screen.getByLabelText("Object width in meters")).toHaveValue(0.6);
});
it("presents truthful fallback and all ten synthetic environment results", async () => {
  render(<SpatialStudio definitionId="owned" />);
  await screen.findByRole("heading", { name: "Desk Map", level: 1 });
  fireEvent.change(screen.getByLabelText("Preview", { exact: true }), { target: { value: "FALLBACK" } });
  expect(
    within(screen.getByRole("region", { name: "Spatial canvas" })).getByText(/Read and inspect the same clue here/),
  ).toBeVisible();
  expect(screen.getByText(/Synthetic previews and physical\/owner acceptance/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Test in 10 environments" }));
  expect(screen.getByRole("button", { name: /Outdoor trail.*GUIDED FALLBACK/ })).toBeVisible();
});
