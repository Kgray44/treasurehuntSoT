import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import * as evidence from "@/parallax/adaptive-authoring";
import { createSpatialDraft } from "@/parallax/authoring";
import { SpatialCanvas } from "./SpatialCanvas";
const engine = vi.hoisted(() => ({
  update: vi.fn(),
  dispose: vi.fn(),
  view: vi.fn(),
  cameraSnapshot: vi.fn(),
  restoreCamera: vi.fn(),
}));
vi.mock("./spatial-workstation", () => ({ createWorkstation: () => engine }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps room discovery cached across playback, receipt and identity-only editor updates", async () => {
  vi.stubGlobal("WebGL2RenderingContext", class {});
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const discover = vi.spyOn(evidence, "syntheticEnvironmentEvidence");
  const draft = createSpatialDraft("cached");
  const props = {
    draft,
    selectedId: draft.content.entities[0].id,
    onSelect: vi.fn(),
    onEdit: vi.fn(),
    onPreset: vi.fn(),
    mode: "GUIDED",
    preview: "EDITOR",
    environmentId: "bedroom",
    timeMs: 0,
    inputs: [],
  };
  const mounted = render(<SpatialCanvas {...props} />);
  await waitFor(() => expect(engine.update).toHaveBeenCalled());
  const updates = engine.update.mock.calls.length;
  mounted.rerender(<SpatialCanvas {...props} />);
  expect(engine.update.mock.calls.length).toBe(updates);
  for (const timeMs of [100, 200, 300]) mounted.rerender(<SpatialCanvas {...props} preview="LENS" timeMs={timeMs} />);
  const renamed = structuredClone(draft);
  renamed.content.entities[0].name = "Renamed";
  mounted.rerender(<SpatialCanvas {...props} draft={renamed} />);
  expect(discover).toHaveBeenCalledTimes(1);
});

it("projects the scene into a replacement renderer when fallback returns to the same READY status", async () => {
  vi.stubGlobal("WebGL2RenderingContext", class {});
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const draft = createSpatialDraft("restored");
  const props = {
    draft,
    selectedId: draft.content.entities[0].id,
    onSelect: vi.fn(),
    onEdit: vi.fn(),
    onPreset: vi.fn(),
    mode: "ENGINEERING",
    preview: "EDITOR",
    environmentId: "bedroom",
    timeMs: 0,
    inputs: [],
  };
  const mounted = render(<SpatialCanvas {...props} />);
  await waitFor(() => expect(engine.update.mock.calls.at(-1)?.[0].objects[0].entity.id).toBe("restored:entity-0"));
  mounted.rerender(<SpatialCanvas {...props} preview="FALLBACK" />);
  const updates = engine.update.mock.calls.length;
  mounted.rerender(<SpatialCanvas {...props} />);
  await waitFor(() => expect(engine.update.mock.calls.length).toBeGreaterThan(updates));
  expect(engine.update.mock.calls.at(-1)![0].objects[0].entity.id).toBe("restored:entity-0");
});
