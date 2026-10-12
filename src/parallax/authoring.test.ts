import { describe, expect, it, vi, afterEach } from "vitest";
import {
  createSpatialDraft,
  editSpatialDraft,
  worldTransform,
  previewEntityTransform,
  referenceSurfaceFrame,
  changeHistory,
  undo,
  redo,
  forkSpatialDraft,
  presetNames,
  draftSchema,
} from "./authoring";
import { materializeIntent, requestSpatialAI } from "./ai-authoring";
import { materializeSpatialVersion, validateSpatialMoment } from "./publication";
import { validateSpatialAuthoring, simulateSpatialEnvironments, spatialStudioHref } from "./studio-validation";
import { evaluateSpatialBehavior } from "./behavior";
import { syntheticSpatialMoment, syntheticBinding, guidedContext } from "./fixtures";
import { ParallaxLensRuntime } from "./runtime";
import { SyntheticSpatialAdapter } from "./synthetic";
import { composeTransform, inverseTransform } from "./transforms";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe("Parallax creator authoring", () => {
  it.each(presetNames)("materializes editable %s with fallback and a truthful environment census", (name) => {
    const draft = createSpatialDraft("owned", name);
    expect(validateSpatialAuthoring(draft.content).filter((i) => i.severity === "ERROR")).toEqual([]);
    expect(simulateSpatialEnvironments(draft.content)).toHaveLength(10);
    expect(simulateSpatialEnvironments(draft.content).every((e) => e.physicalQualification === "NOT_ESTABLISHED")).toBe(
      true,
    );
    expect(materializeSpatialVersion(draft.content)).toEqual(
      materializeSpatialVersion(JSON.parse(JSON.stringify(draft.content))),
    );
  });
  it("preserves world pose across reparent/unparent and rejects cycles without editing the original", () => {
    let draft = createSpatialDraft("owned");
    const id = draft.content.entities[0].id;
    draft = editSpatialDraft(draft, { type: "DUPLICATE", entityId: id, newId: "child" });
    const before = worldTransform(draft.content, "child");
    const grouped = editSpatialDraft(draft, { type: "PARENT", entityId: "child", parentId: id });
    expect(worldTransform(grouped.content, "child")).toEqual(before);
    expect(
      worldTransform(editSpatialDraft(grouped, { type: "PARENT", entityId: "child", parentId: null }).content, "child"),
    ).toEqual(before);
    expect(() => editSpatialDraft(grouped, { type: "PARENT", entityId: id, parentId: "child" })).toThrow(/itself/);
    expect(draft.content.entities[1].parentEntityId).toBeUndefined();
  });
  it("rejects grouping independently resolved anchor frames without moving either entity", () => {
    let draft = createSpatialDraft("independent");
    const parentId = draft.content.entities[0].id;
    draft = editSpatialDraft(draft, { type: "DUPLICATE", entityId: parentId, newId: "wall-child" });
    draft = editSpatialDraft(draft, { type: "PLACEMENT", entityId: "wall-child", placement: "WALL" });
    const before = structuredClone(draft);
    expect(() => editSpatialDraft(draft, { type: "PARENT", entityId: "wall-child", parentId })).toThrow(
      /same anchor frame/,
    );
    expect(draft).toEqual(before);
  });
  it("applies constrained edits, locks, atomic AI acceptance and undo/redo", () => {
    const draft = createSpatialDraft("owned");
    const entityId = draft.content.entities[0].id;
    const locked = editSpatialDraft(draft, { type: "LAYER", entityId, patch: { locked: true } });
    expect(() => editSpatialDraft(locked, { type: "PLACEMENT", entityId, placement: "WALL" })).toThrow(/Unlock/);
    const ai = materializeIntent(draft, entityId, {
      placement: "WALL",
      content: "A clue",
      alternativeText: "Readable wall clue",
      explanation: "A vertical reference surface.",
    });
    const history = changeHistory({ past: [], present: draft, future: [] }, { type: "REPLACE", draft: ai });
    expect(undo(history).present).toEqual(draft);
    expect(redo(undo(history)).present).toEqual(ai);
    expect(() =>
      materializeIntent(draft, entityId, {
        placement: "WALL",
        content: "A clue",
        alternativeText: "A clue",
        explanation: "ok",
        script: "fetch(secret)",
      }),
    ).toThrow();
    expect(() =>
      editSpatialDraft(draft, {
        type: "TRANSFORM",
        entityId,
        transform: { ...draft.content.entities[0].transform, scale: -1 },
      }),
    ).toThrow();
  });
  it("clears redo after a new branch and gives forks independent immutable lineage", () => {
    const draft = createSpatialDraft("owned");
    const entityId = draft.content.entities[0].id;
    const history = changeHistory(
      { past: [], present: draft, future: [] },
      { type: "DUPLICATE", entityId, newId: "copy" },
    );
    expect(changeHistory(undo(history), { type: "PLACEMENT", entityId, placement: "WALL" }).future).toEqual([]);
    const fork = forkSpatialDraft(draft, "fork");
    expect(fork.content.definitionId).toBe("fork");
    expect(fork.lineage?.definitionId).toBe("owned");
    expect(draft.content.definitionId).toBe("owned");
  });
  it("executes declarative timeline state at exact event-relative deadlines", () => {
    const draft = createSpatialDraft("owned");
    const entityId = draft.content.entities[0].id;
    draft.content.studio!.behaviors = [
      {
        id: "hide",
        trigger: "INSPECT",
        sourceEntityId: entityId,
        delayMs: 500,
        targetEntityId: entityId,
        action: "HIDE",
      },
    ];
    const inputs = [{ trigger: "INSPECT" as const, entityId, atMs: 1000 }];
    expect(evaluateSpatialBehavior(draft.content, inputs, 1499)[entityId].visible).toBe(true);
    expect(evaluateSpatialBehavior(draft.content, inputs, 1500)[entityId].visible).toBe(false);
    expect(
      evaluateSpatialBehavior(draft.content, [{ ...inputs[0], entityId: "unrelated" }], 5000)[entityId].visible,
    ).toBe(true);
    expect(() =>
      draftSchema.parse({
        ...draft,
        content: {
          ...draft.content,
          studio: {
            ...draft.content.studio,
            behaviors: [{ ...draft.content.studio!.behaviors[0], action: "EXECUTE" }],
          },
        },
      }),
    ).toThrow();
  });
  it("rejects invalid geometry and media while pinning Vision Waypoint identities", () => {
    const draft = createSpatialDraft("owned");
    const entityId = draft.content.entities[0].id;
    draft.content.entities[0].transform.scale = 10;
    draft.content.entities[0].widthMeters = 5;
    draft.content.studio!.visionReferences = [
      {
        entityId,
        waypointId: "sibling-waypoint",
        versionId: "waypoint-v2",
        checksum: "a".repeat(64),
        purpose: "RELOCALIZATION",
      },
    ];
    draft.content.studio!.assets = [
      {
        id: "asset",
        entityId,
        kind: "MODEL",
        assetId: "unavailable",
        checksum: "b".repeat(64),
        format: "PNG",
        bytes: 20000000,
        triangles: 90000,
        texturePixels: 0,
        durationSeconds: 0,
        metersPerUnit: 1,
        alternativeText: "Model",
        license: "Creator owned",
        provenance: "CREATOR",
      },
    ];
    expect(validateSpatialAuthoring(draft.content).map((i) => i.code)).toEqual(
      expect.arrayContaining([
        "PARALLAX_SCALE_UNSAFE",
        "PARALLAX_ASSET_FORMAT_INVALID",
        "PARALLAX_ASSET_BUDGET_EXCEEDED",
        "PARALLAX_VISION_PROVIDER_PENDING",
      ]),
    );
    expect(spatialStudioHref("scene:1", entityId, "chronicle", "block")).toContain("definition=scene%3A1");
  });
  it("creates reusable items in the global workspace and private items inside a Chronicle", () => {
    expect(createSpatialDraft("global").scope).toBe("MY_LIBRARY");
    expect(createSpatialDraft("contextual", "Desk Map", "chronicle").scope).toBe("CHRONICLE_ONLY");
  });
  it("keeps surface preset offsets near the selected surface and confines room positions to preview", () => {
    for (const preset of ["Desk Map", "Peeking Letter", "Hidden Wall Message"]) {
      const draft = createSpatialDraft("surface", preset);
      const anchor = draft.content.anchors[0];
      expect(anchor.transform.position).toEqual({ x: 0, y: 0, z: 0.01 });
      const selectedSurface = {
        ...anchor.transform,
        position: { x: 2, y: 3, z: 4 },
      };
      const nativePose = composeTransform(selectedSurface, worldTransform(draft.content, draft.content.entities[0].id));
      expect(nativePose.position).toEqual({ x: 2, y: 3, z: 4.01 });
      const preview = previewEntityTransform(draft.content, draft.content.entities[0].id);
      expect(preview.position.y).toBeCloseTo(preset === "Hidden Wall Message" ? 1.4 : 0.76);
      // The vertical reference is the actual back-wall face, rather than a plane in the room's middle.
      expect(preview.position.z).toBeCloseTo(preset === "Hidden Wall Message" ? -1.93 : -1);
      expect(anchor.transform.position).toEqual({ x: 0, y: 0, z: 0.01 });
    }
    const local = createSpatialDraft("local", "Floating Compass");
    expect(previewEntityTransform(local.content, local.content.entities[0].id)).toEqual(
      worldTransform(local.content, local.content.entities[0].id),
    );
  });
  it("materializes semantic surface placement and converts preview movement back to relative coordinates", () => {
    const draft = createSpatialDraft("placement", "Floating Compass");
    const entityId = draft.content.entities[0].id;
    for (const placement of ["DESK", "WALL"] as const) {
      const placed = editSpatialDraft(draft, { type: "PLACEMENT", entityId, placement });
      const anchor = placed.content.anchors[0];
      expect(anchor.transform.position).toEqual({ x: 0, y: 0, z: 0.01 });
      const original = previewEntityTransform(placed.content, entityId);
      const moved = { ...original, position: { ...original.position, x: original.position.x + 0.2 } };
      const parent = composeTransform(referenceSurfaceFrame(anchor), anchor.transform);
      const edited = editSpatialDraft(placed, {
        type: "TRANSFORM",
        entityId,
        transform: composeTransform(inverseTransform(parent), moved),
      });
      expect(edited.content.entities[0].transform.position.x).toBeCloseTo(0.2);
      expect(previewEntityTransform(edited.content, entityId).position.x).toBeCloseTo(original.position.x + 0.2);
      expect(edited.content.anchors[0].transform).toEqual(anchor.transform);
    }
  });
  it("keeps historical Phase 1 checksum material unchanged", () => {
    const moment = syntheticSpatialMoment();
    expect(validateSpatialMoment(JSON.parse(JSON.stringify(moment)))).toEqual(moment);
    expect(moment.version.studio).toBeUndefined();
  });
  it("preserves audience restrictions when a timeline reveals an object", () => {
    const draft = createSpatialDraft("owned");
    const id = draft.content.entities[0].id;
    draft.content.studio!.layers[0].audience = "RUNTIME_ONLY";
    draft.content.studio!.behaviors = [
      { id: "show", trigger: "SCENE_ENTER", delayMs: 0, targetEntityId: id, action: "SHOW" },
    ];
    const inputs = [{ trigger: "SCENE_ENTER" as const, atMs: 0 }];
    expect(evaluateSpatialBehavior(draft.content, inputs, 0, true)[id].visible).toBe(false);
    expect(evaluateSpatialBehavior(draft.content, inputs, 0, false)[id].visible).toBe(true);
    draft.content.studio!.layers[0].audience = "EDITOR_ONLY";
    expect(evaluateSpatialBehavior(draft.content, inputs, 0, false)[id].visible).toBe(false);
    expect(evaluateSpatialBehavior(draft.content, inputs, 0, true)[id].visible).toBe(true);
  });
  it("keeps editor-only objects out of Lens and preserves fallback content", async () => {
    let draft = createSpatialDraft("owned", "Floating Compass");
    const id = draft.content.entities[0].id;
    draft = editSpatialDraft(draft, { type: "DUPLICATE", entityId: id, newId: "editor-only" });
    draft = editSpatialDraft(draft, { type: "LAYER", entityId: "editor-only", patch: { audience: "EDITOR_ONLY" } });
    const version = materializeSpatialVersion(draft.content);
    const moment = {
      ...syntheticSpatialMoment(),
      definition: {
        id: "owned",
        ownerPersonId: "synthetic-creator",
        title: version.title,
        libraryScope: "MY_LIBRARY" as const,
      },
      version,
    };
    moment.attachment.spatialDefinitionVersionId = version.id;
    moment.attachment.versionChecksum = version.checksum;
    const runtime = new ParallaxLensRuntime(moment, syntheticBinding, guidedContext());
    await runtime.open();
    expect(runtime.read().visibleEntityIds).toEqual([id]);
    await expect(runtime.interact("editor-only", "INSPECT", "bad")).rejects.toThrow(/FORBIDDEN/);
    await runtime.close();
  });
  it("cancels pending behavior timers on runtime close", async () => {
    vi.useFakeTimers();
    const draft = createSpatialDraft("owned", "Floating Compass");
    const id = draft.content.entities[0].id;
    draft.content.studio!.behaviors = [
      { id: "hide", trigger: "TIMER", delayMs: 1000, targetEntityId: id, action: "HIDE" },
    ];
    const version = materializeSpatialVersion(draft.content);
    const original = syntheticSpatialMoment();
    const moment = {
      ...original,
      definition: { ...original.definition, id: "owned" },
      version,
      attachment: { ...original.attachment, spatialDefinitionVersionId: version.id, versionChecksum: version.checksum },
    };
    const changed = vi.fn();
    const runtime = new ParallaxLensRuntime(
      moment,
      syntheticBinding,
      { ...guidedContext(), environment: "DEVICE_LAB" },
      undefined,
      changed,
    );
    await runtime.open(new SyntheticSpatialAdapter());
    await runtime.close();
    const calls = changed.mock.calls.length;
    await vi.advanceTimersByTimeAsync(2000);
    expect(changed).toHaveBeenCalledTimes(calls);
  });
  it("retires the legacy network path even when legacy credentials are configured", async () => {
    vi.stubEnv("PARALLAX_AUTHORING_AI_URL", "https://authoring.example.test/proposal");
    vi.stubEnv("PARALLAX_AUTHORING_AI_TOKEN", "synthetic-token");
    vi.stubEnv("OPENAI_API_KEY", "synthetic-token");
    const draft = createSpatialDraft("owned");
    const before = JSON.stringify(draft);
    const fetcher = vi.fn();
    for (const kind of ["INTENT", "CRITIQUE"] as const)
      expect(await requestSpatialAI(kind, "Move the clue", draft, fetcher)).toMatchObject({
        status: "UNAVAILABLE",
        code: "LEGACY_AI_RETIRED",
      });
    expect(fetcher).not.toHaveBeenCalled();
    expect(JSON.stringify(draft)).toBe(before);
  });
  it("retains deterministic strict intent materialization for canonical phrase controls", () => {
    const draft = createSpatialDraft("owned");
    const proposal = {
      placement: "WALL",
      content: "Read the north wall.",
      alternativeText: "North wall clue.",
      explanation: "A seated-height wall clue.",
    };
    const changed = materializeIntent(draft, draft.content.entities[0].id, proposal);
    expect(changed.content.entities[0].content).toBe(proposal.content);
    expect(draft.content.entities[0].content).not.toBe(proposal.content);
    expect(() =>
      materializeIntent(draft, draft.content.entities[0].id, { ...proposal, execute: "injected" }),
    ).toThrow();
  });
});
