import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { AnimationProvider } from "@/animation/director/AnimationProvider";
import * as evidence from "@/parallax/adaptive-authoring";
import { createSpatialDraft } from "@/parallax/authoring";
import { SpatialCanvas } from "./SpatialCanvas";
import { projectLegacyEnvironmentPreview } from "@/parallax/legacy-environment-preview";
import { environmentVersionSchema } from "@/parallax/legacy-scene-environment-contracts";
import legacyBuiltins from "@/parallax/builtin-environments.v1.json";
import { createRoomEnvironment } from "@/parallax/environment-authoring";
import { simulationEnvironments } from "@/parallax/studio-validation";
const engine = vi.hoisted(() => ({
  update: vi.fn(),
  dispose: vi.fn(),
  view: vi.fn(),
  cameraSnapshot: vi.fn(),
  restoreCamera: vi.fn(),
  stopAudio: vi.fn(),
  previewCatalogDropPoint: vi.fn(),
}));
vi.mock("./spatial-workstation", () => ({ createWorkstation: () => engine }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("keeps room discovery cached across playback, receipt and identity-only editor updates", async () => {
  vi.stubGlobal("WebGL2RenderingContext", class {});
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
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
  const mounted = render(<SpatialCanvas {...props} />, { wrapper: AnimationProvider });
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
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
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
  const mounted = render(<SpatialCanvas {...props} />, { wrapper: AnimationProvider });
  await waitFor(() => expect(engine.update.mock.calls.at(-1)?.[0].objects[0].entity.id).toBe("restored:entity-0"));
  mounted.rerender(<SpatialCanvas {...props} preview="FALLBACK" />);
  const updates = engine.update.mock.calls.length;
  mounted.rerender(<SpatialCanvas {...props} />);
  await waitFor(() => expect(engine.update.mock.calls.length).toBeGreaterThan(updates));
  expect(engine.update.mock.calls.at(-1)![0].objects[0].entity.id).toBe("restored:entity-0");
});

it("passes the pinned legacy room and its exact surfaces to the existing renderer", async () => {
  vi.stubGlobal("WebGL2RenderingContext", class {});
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const version = environmentVersionSchema.parse(legacyBuiltins[0]);
  version.content.fixtures = [
    {
      id: "only-fixture",
      name: "Exact table",
      kind: "FURNITURE",
      position: { x: 0, y: 0.5, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      color: "#123456",
    },
  ];
  const environmentOverride = projectLegacyEnvironmentPreview(version);
  const draft = createSpatialDraft("legacy-canvas");
  draft.content.environment = version.reference;
  render(
    <SpatialCanvas
      draft={draft}
      selectedId={null}
      onSelect={vi.fn()}
      onEdit={vi.fn()}
      onPreset={vi.fn()}
      mode="ENGINEERING"
      preview="EDITOR"
      environmentId={environmentOverride.id}
      environmentOverride={environmentOverride}
      timeMs={0}
      inputs={[]}
    />,
    { wrapper: AnimationProvider },
  );
  await waitFor(() => expect(engine.update.mock.calls.at(-1)?.[0].environment.id).toBe(environmentOverride.id));
  const state = engine.update.mock.calls.at(-1)![0];
  expect(state.environment.fixtures).toEqual(version.content.fixtures);
  expect(state.environment).not.toHaveProperty("features");
  expect(state.candidates).toEqual(version.content.evidence.candidates);
  expect(draft.content.studio).not.toHaveProperty("environment");
});

it("previews changed rich-room geometry from the displayed proposal rather than the committed room", async () => {
  vi.stubGlobal("WebGL2RenderingContext", class {});
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const draft = createSpatialDraft("room-proposal");
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  const props = {
    draft,
    selectedId: null,
    onSelect: vi.fn(),
    onEdit: vi.fn(),
    onPreset: vi.fn(),
    mode: "ENGINEERING",
    preview: "EDITOR",
    environmentId: draft.content.studio!.environment.id,
    timeMs: 0,
    inputs: [],
  };
  const mounted = render(<SpatialCanvas {...props} />, { wrapper: AnimationProvider });
  const proposal = structuredClone(draft);
  proposal.content.studio!.environment!.features.find((feature) => feature.classification === "BED")!.position.z += 0.2;
  mounted.rerender(<SpatialCanvas {...props} draft={proposal} />);
  await waitFor(() =>
    expect(engine.update.mock.calls.at(-1)?.[0].environment.features).toEqual(
      proposal.content.studio!.environment!.features,
    ),
  );
  expect(engine.update.mock.calls.at(-1)![0].environment.features).not.toEqual(
    draft.content.studio!.environment!.features,
  );
});
