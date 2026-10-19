import { describe, it, expect, vi } from "vitest";
import { ParallaxLensRuntime } from "./runtime";
import { SyntheticSpatialAdapter } from "./synthetic";
import { syntheticSpatialMoment, syntheticBinding, guidedContext } from "./fixtures";
import { createSpatialDraft, draftSchema, editSpatialDraft, changeHistory, undo, redo } from "./authoring";
import { evaluateSpatialScene } from "./behavior";
import { recordAnimationKeyframe, rotationFromDegrees, rotationToDegrees } from "./animation-authoring";
import { materializeSpatialVersion } from "./publication";

function sequence() {
  const draft = createSpatialDraft("sequence", "Floating Compass");
  const entityId = draft.content.entities[0].id;
  draft.content.studio!.animationTracks = [
    {
      id: "position",
      entityId,
      property: "POSITION",
      enabled: true,
      interpolation: "LINEAR",
      keyframes: [
        { id: "p0", atMs: 0, value: { x: 0, y: 1, z: 0 } },
        { id: "p1", atMs: 2000, value: { x: 2, y: 3, z: 0 } },
      ],
    },
    {
      id: "rotation",
      entityId,
      property: "ROTATION",
      enabled: true,
      interpolation: "LINEAR",
      keyframes: [
        { id: "r0", atMs: 0, value: rotationFromDegrees({ x: 0, y: 0, z: 0 }) },
        { id: "r1", atMs: 2000, value: rotationFromDegrees({ x: 0, y: 180, z: 0 }) },
      ],
    },
  ];
  return { draft: draftSchema.parse(draft), entityId };
}
describe("canonical spatial animation", () => {
  it("sends animated transforms through the canonical runtime adapter and cancels playback on close", async () => {
    vi.useFakeTimers();
    try {
      const moment = syntheticSpatialMoment();
      const entityId = moment.version.entities[0].id;
      const { checksum: _checksum, ...content } = moment.version;
      void _checksum;
      content.studio = createSpatialDraft("studio").content.studio;
      content.studio!.layers[0].entityId = entityId;
      content.studio!.animationTracks = [
        {
          id: "motion",
          entityId,
          enabled: true,
          property: "POSITION",
          interpolation: "LINEAR",
          keyframes: [
            { id: "start", atMs: 0, value: { x: 0, y: 0, z: 0 } },
            { id: "end", atMs: 1000, value: { x: 1, y: 0, z: 0 } },
          ],
        },
      ];
      moment.version = materializeSpatialVersion(content);
      moment.attachment.versionChecksum = moment.version.checksum;
      const adapter = new SyntheticSpatialAdapter();
      const rendered: unknown[][] = [];
      adapter.render = async (...args: unknown[]) => {
        rendered.push(args);
      };
      const runtime = new ParallaxLensRuntime(
        moment,
        syntheticBinding,
        { ...guidedContext(), environment: "DEVICE_LAB" },
        () => new Date(),
      );
      await runtime.open(adapter);
      await vi.advanceTimersByTimeAsync(500);
      const last = rendered.at(-1)![0] as { transform: { position: { x: number } } }[];
      expect(last[0].transform.position.x).toBeGreaterThan(0.4);
      expect(last[0].transform.position.x).toBeLessThan(0.6);
      await runtime.close();
      const count = rendered.length;
      await vi.advanceTimersByTimeAsync(2000);
      expect(rendered).toHaveLength(count);
    } finally {
      vi.useRealTimers();
    }
  });
  it("samples actual local transforms without mutating authoring content and rewinds deterministically", () => {
    const { draft, entityId } = sequence(),
      original = structuredClone(draft);
    const half = evaluateSpatialScene(draft.content, [], 1000).states[entityId];
    expect(half.transform.position).toEqual({ x: 1, y: 2, z: 0 });
    expect(half.transform.rotation.y).toBeCloseTo(Math.SQRT1_2);
    expect(half.transform.rotation.w).toBeCloseTo(Math.SQRT1_2);
    expect(evaluateSpatialScene(draft.content, [], 0).states[entityId].transform.position.x).toBe(0);
    expect(evaluateSpatialScene(draft.content, [], 3000).states[entityId].transform.position.x).toBe(2);
    expect(evaluateSpatialScene(draft.content, [], 1000, true).states[entityId].transform).toEqual(
      original.content.entities[0].transform,
    );
    expect(draft).toEqual(original);
  });
  it("retains authored pose until the first frame and supports easing, step and quaternion double cover", () => {
    const { draft, entityId } = sequence(),
      track = draft.content.studio!.animationTracks![0];
    track.keyframes[0].atMs = 500;
    expect(evaluateSpatialScene(draft.content, [], 499).states[entityId].transform.position).toEqual(
      draft.content.entities[0].transform.position,
    );
    track.interpolation = "STEP";
    expect(evaluateSpatialScene(draft.content, [], 1500).states[entityId].transform.position.x).toBe(0);
    track.interpolation = "EASE_IN_OUT";
    expect(evaluateSpatialScene(draft.content, [], 875).states[entityId].transform.position.x).toBeCloseTo(0.3125);
    const rotation = draft.content.studio!.animationTracks![1];
    if (rotation.property === "ROTATION") rotation.keyframes[1].value = { x: 0, y: 0, z: 0, w: -1 };
    expect(evaluateSpatialScene(draft.content, [], 1000).states[entityId].transform.rotation.w).toBeCloseTo(1);
  });
  it("applies visibility events chronologically with keyframes and resets triggered state", () => {
    const { draft, entityId } = sequence();
    draft.content.studio!.animationTracks!.push({
      id: "visibility",
      entityId,
      property: "VISIBILITY",
      enabled: true,
      interpolation: "STEP",
      keyframes: [
        { id: "v0", atMs: 0, value: false },
        { id: "v1", atMs: 6000, value: false },
      ],
    });
    draft.content.studio!.behaviors = [
      {
        id: "reveal",
        trigger: "INSPECT",
        sourceEntityId: entityId,
        targetEntityId: entityId,
        action: "SHOW",
        delayMs: 5000,
      },
    ];
    const inputs = [{ trigger: "INSPECT" as const, entityId, atMs: 0 }];
    expect(evaluateSpatialScene(draft.content, inputs, 4999).states[entityId].visible).toBe(false);
    expect(evaluateSpatialScene(draft.content, inputs, 5000).states[entityId].visible).toBe(true);
    expect(evaluateSpatialScene(draft.content, inputs, 6000).states[entityId].visible).toBe(false);
    expect(evaluateSpatialScene(draft.content, [], 5000).states[entityId].visible).toBe(false);
    expect(evaluateSpatialScene(draft.content, inputs, 4999).events[0].status).toBe("WAITING");
  });
  it("rejects dangling, conflicting, nonunit and unordered tracks", () => {
    const { draft } = sequence();
    for (const corrupt of [
      (d: typeof draft) => {
        d.content.studio!.animationTracks![0].entityId = "missing";
      },
      (d: typeof draft) => {
        d.content.studio!.animationTracks!.push({ ...d.content.studio!.animationTracks![0], id: "conflict" });
      },
      (d: typeof draft) => {
        d.content.studio!.animationTracks![0].keyframes[1].atMs = 0;
      },
      (d: typeof draft) => {
        const t = d.content.studio!.animationTracks![1];
        if (t.property === "ROTATION") t.keyframes[0].value.w = 2;
      },
    ]) {
      const invalid = structuredClone(draft);
      corrupt(invalid);
      expect(draftSchema.safeParse(invalid).success).toBe(false);
    }
  });
  it("preserves historic publication shape and carries tracks through save, duplicate, delete and history", () => {
    const old = createSpatialDraft("old");
    expect(materializeSpatialVersion(old.content).studio).not.toHaveProperty("animationTracks");
    const { draft, entityId } = sequence();
    const reread = draftSchema.parse(JSON.parse(JSON.stringify(draft)));
    expect(materializeSpatialVersion(reread.content)).toEqual(materializeSpatialVersion(draft.content));
    const copy = editSpatialDraft(draft, { type: "DUPLICATE", entityId, newId: "copy" });
    expect(copy.content.studio!.animationTracks!.filter((t) => t.entityId === "copy")).toHaveLength(2);
    const deleted = editSpatialDraft(copy, { type: "DELETE", entityId: "copy" });
    expect(deleted.content.studio!.animationTracks).toEqual(draft.content.studio!.animationTracks);
    const history = changeHistory({ present: draft, past: [], future: [] }, { type: "REPLACE", draft: copy });
    expect(undo(history).present).toEqual(draft);
    expect(redo(undo(history)).present).toEqual(copy);
  });
  it("records one frame per time and forbids adaptive position offsets or locked edits", () => {
    const { draft, entityId } = sequence();
    const recorded = recordAnimationKeyframe(draft, entityId, "POSITION", 1000);
    expect(recordAnimationKeyframe(recorded, entityId, "POSITION", 1000)).toEqual(recorded);
    draft.content.studio!.layers[0].locked = true;
    expect(() => recordAnimationKeyframe(draft, entityId, "SCALE", 0)).toThrow(/Unlock/);
  });
  it.each([
    { x: 15, y: 30, z: -20 },
    { x: 90, y: 0, z: 0 },
    { x: 0, y: 90, z: 0 },
  ])("roundtrips Creator rotation degrees %j", (angles) => {
    const q = rotationFromDegrees(angles),
      roundtrip = rotationFromDegrees(rotationToDegrees(q));
    expect(Math.abs(q.x * roundtrip.x + q.y * roundtrip.y + q.z * roundtrip.z + q.w * roundtrip.w)).toBeCloseTo(1);
  });
});
