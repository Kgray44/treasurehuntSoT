import { describe, expect, it } from "vitest";
import { createSpatialDraft, draftSchema, changeHistory, undo, redo } from "./authoring";
import { createMotionTrack, recordAnimationKeyframe } from "./animation-authoring";
import { evaluateSpatialScene } from "./behavior";
import { materializeSpatialVersion } from "./publication";
import { animationTrackSchema } from "./studio-contracts";
import { ParallaxLensRuntime } from "./runtime";
import { SyntheticSpatialAdapter } from "./synthetic";
import { syntheticSpatialMoment, syntheticBinding, guidedContext } from "./fixtures";

describe("canonical opacity animation", () => {
  it("explains unsupported native opacity and keeps Guided clues available", async () => {
    const moment = syntheticSpatialMoment(),
      id = moment.version.entities[0].id;
    const { checksum, ...content } = moment.version;
    expect(materializeSpatialVersion(content).checksum).toBe(checksum);
    content.studio = createSpatialDraft("opacity-fallback").content.studio;
    content.studio!.layers[0].entityId = id;
    content.studio!.animationTracks = [
      {
        id: "fade",
        entityId: id,
        enabled: true,
        property: "OPACITY",
        interpolation: "LINEAR",
        keyframes: [{ id: "zero", atMs: 0, value: 0 }],
      },
    ];
    moment.version = materializeSpatialVersion(content);
    moment.attachment.versionChecksum = moment.version.checksum;
    const adapter = new SyntheticSpatialAdapter();
    adapter.render = async () => {
      throw new Error("PARALLAX_NATIVE_OPACITY_UNSUPPORTED");
    };
    const runtime = new ParallaxLensRuntime(moment, syntheticBinding, {
      ...guidedContext(),
      environment: "DEVICE_LAB",
    });
    await runtime.open(adapter);
    expect(runtime.read().mode).toBe("GUIDED");
    expect(runtime.read().guidance).toContain("cannot preview opacity animation");
    expect(runtime.read().visibleEntityIds).toContain(id);
    await runtime.close();
  });
  it("interpolates the entity material factor while authoring retains its original material", () => {
    const original = createSpatialDraft("fade", "Floating Compass"),
      id = original.content.entities[0].id;
    const draft = createMotionTrack(original, id, "OPACITY", 0);
    expect(evaluateSpatialScene(draft.content, [], 0).states[id].opacity).toBe(1);
    expect(evaluateSpatialScene(draft.content, [], 1000).states[id].opacity).toBe(0.5);
    expect(evaluateSpatialScene(draft.content, [], 2000).states[id].opacity).toBe(0);
    expect(evaluateSpatialScene(draft.content, [], 2000, true).states[id].opacity).toBeUndefined();
    expect(draft.content.entities).toEqual(original.content.entities);
    const recorded = recordAnimationKeyframe(draft, id, "OPACITY", 1000);
    expect(recorded.content.studio!.animationTracks![0].keyframes[1].value).toBe(0.5);
    draft.content.studio!.animationTracks![0].enabled = false;
    expect(evaluateSpatialScene(draft.content, [], 1000).states[id].opacity).toBeUndefined();
  });
  it("keeps the exact old publication shape and supports history/save of bounded opacity tracks", () => {
    const original = createSpatialDraft("fade-history", "Floating Compass"),
      id = original.content.entities[0].id;
    const before = materializeSpatialVersion(original.content);
    const next = createMotionTrack(original, id, "OPACITY", 0);
    const history = changeHistory({ present: original, past: [], future: [] }, { type: "REPLACE", draft: next });
    expect(undo(history).present).toEqual(original);
    expect(redo(undo(history)).present).toEqual(next);
    expect(materializeSpatialVersion(original.content)).toEqual(before);
    expect(draftSchema.parse(JSON.parse(JSON.stringify(next)))).toEqual(next);
    const track = next.content.studio!.animationTracks![0];
    for (const value of [-0.1, 1.1, Infinity, true, "0.5", null])
      expect(animationTrackSchema.safeParse({ ...track, keyframes: [{ id: "invalid", atMs: 0, value }] }).success).toBe(
        false,
      );
  });
});
