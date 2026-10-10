import { describe, it, expect } from "vitest";
import { syntheticSpatialMoment, syntheticBinding, guidedContext } from "./fixtures";
import { spatialMomentSchema, identityTransform, transformSchema } from "./contracts";
import { materializeSpatialVersion, validateSpatialMoment } from "./publication";
import { composeTransform, inverseTransform } from "./transforms";
import { ParallaxLensRuntime } from "./runtime";
import { SyntheticSpatialAdapter } from "./synthetic";
import { evaluateSpatialEvidence } from "./evidence";
import { parseDrydockBlock } from "@/drydock/contracts/parser";
import { projectPlayerBlock } from "@/chronicle/journal-contract";
import type { PublishedBlock } from "@/chronicle/types";

const now = () => new Date("2026-10-10T06:00:00.000Z");
function lab(moment = syntheticSpatialMoment(), surface = identityTransform()) {
  const adapter = new SyntheticSpatialAdapter(surface);
  const runtime = new ParallaxLensRuntime(
    moment,
    syntheticBinding,
    { ...guidedContext(), environment: "DEVICE_LAB" },
    now,
  );
  return { adapter, runtime };
}
describe("Parallax Phase 1 domain and published contract", () => {
  it("pins identity, checksum, attachment, meaning and accessibility", () => {
    const m = syntheticSpatialMoment();
    expect(validateSpatialMoment(m, "spatial-passage")).toEqual(m);
    m.version.entities[0].content = "Mutable replacement";
    expect(() => validateSpatialMoment(m)).toThrow("PARALLAX_VERSION_CHECKSUM_INVALID");
  });
  it("rejects unpinned, cross-passage, unsupported, hidden and executable content", () => {
    const m = syntheticSpatialMoment();
    expect(() => validateSpatialMoment(m, "other-block")).toThrow();
    expect(
      spatialMomentSchema.safeParse({ ...m, attachment: { ...m.attachment, versionChecksum: "a".repeat(64) } }).success,
    ).toBe(false);
    for (const e of [
      { ...m.version.entities[0], visibility: "HIDDEN" },
      { ...m.version.entities[0], script: "fetch('/secret')" },
      { ...m.version.entities[0], coordinateSpace: "SHARED" },
    ])
      expect(spatialMomentSchema.safeParse({ ...m, version: { ...m.version, entities: [e] } }).success).toBe(false);
  });
  it("validates hierarchy, frames, cycles, quaternion and finite meter units", () => {
    const m = syntheticSpatialMoment();
    const e = m.version.entities[0];
    for (const entity of [
      { ...e, anchorId: "absent" },
      { ...e, parentEntityId: e.id, coordinateSpace: "ENTITY_RELATIVE" },
      { ...e, transform: { ...e.transform, position: { x: Infinity, y: 0, z: 0 } } },
      { ...e, coordinateSpace: "DEVICE" },
      { ...e, transform: { ...e.transform, rotation: { x: 0, y: 0, z: 0, w: 2 } } },
    ])
      expect(spatialMomentSchema.safeParse({ ...m, version: { ...m.version, entities: [entity] } }).success).toBe(
        false,
      );
  });
  it("composes rotation/translation/scale with an invertible reference frame", () => {
    const t = { position: { x: 3, y: 2, z: 1 }, rotation: { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 }, scale: 2 };
    const result = composeTransform(t, { ...identityTransform(), position: { x: 1, y: 0, z: 0 } });
    expect(result.position.x).toBeCloseTo(3);
    expect(result.position.y).toBeCloseTo(4);
    const back = composeTransform(inverseTransform(t), t);
    expect(back.position.x).toBeCloseTo(0);
    expect(back.rotation.w).toBeCloseTo(1);
    expect(back.scale).toBe(1);
    const small = { ...identityTransform(), scale: 0.01 };
    expect(inverseTransform(small).scale).toBe(100);
    expect(composeTransform(inverseTransform(small), small).scale).toBe(1);
    expect(() => transformSchema.parse({ ...t, scale: 0 })).toThrow();
  });
  it("runs through the real Drydock parser and released Journal projection", () => {
    const m = syntheticSpatialMoment();
    const block = {
      id: "spatial-passage",
      blockType: "narrative",
      schemaVersion: 2,
      configuration: { heading: "A message", body: "Use the Chronicle Lens." },
      presentation: { spatialMoment: m },
      completion: { mode: "playerConfirmation" },
      connections: [],
      nextBlockId: null,
    };
    const parsed = parseDrydockBlock(block);
    expect(parsed.success).toBe(true);
    const projected = projectPlayerBlock({
      ...block,
      chapterId: "chapter-1",
      title: "A note",
      internalLabel: null,
      creatorNotes: null,
      isEnabled: true,
      orderIndex: 0,
    } as PublishedBlock);
    expect(projected?.presentation.spatialMoment?.version.id).toBe(m.version.id);
    const invalid = structuredClone(block);
    invalid.presentation.spatialMoment.version.entities[0].content = "tampered";
    expect(parseDrydockBlock(invalid).success).toBe(false);
  });
});
describe("Parallax actual runtime and evidence seam", () => {
  it("invokes a version-pinned moment on unsupported hardware without camera acquisition", async () => {
    const runtime = new ParallaxLensRuntime(syntheticSpatialMoment(), syntheticBinding, guidedContext(), now);
    await runtime.open();
    expect(runtime.read().state).toBe("GUIDED_FALLBACK");
    const r = await runtime.interact("captains-note", "INSPECT", "interaction-1");
    expect(r).toMatchObject({ mode: "GUIDED", synthetic: false, authority: "NONAUTHORITATIVE" });
    expect(evaluateSpatialEvidence(r, runtime.moment, syntheticBinding, now())).toMatchObject({
      progressionChanged: false,
      physicalQualification: "NOT_ESTABLISHED",
    });
    await runtime.close();
  });
  it("resolves local anchors once and composes immutable entity identity", async () => {
    const { runtime, adapter } = lab();
    await runtime.open(adapter);
    expect(runtime.read().anchors["desk-anchor"].transform.position.z).toBe(-1);
    expect(adapter.renders).toBe(1);
    const r = await runtime.interact("captains-note", "PICK", "interaction-1");
    expect(r.entityId).toBe("captains-note");
    expect(r.synthetic).toBe(true);
    await runtime.close();
    expect(adapter.active).toBe(false);
  });
  it("places against an authored surface only, increments anchor epoch and rejects stale use", async () => {
    const m = syntheticSpatialMoment();
    const { checksum: _checksum, ...v } = m.version;
    void _checksum;
    v.anchors = [
      {
        id: "desk-anchor",
        kind: "SURFACE_RELATIVE",
        frameId: "surface-frame",
        alignment: "HORIZONTAL",
        transform: { ...identityTransform(), position: { x: 0.25, y: 0, z: 0 } },
      },
    ];
    v.entities[0].coordinateSpace = "SURFACE_RELATIVE";
    m.version = materializeSpatialVersion(v);
    m.attachment.versionChecksum = m.version.checksum;
    const { runtime, adapter } = lab(m);
    await runtime.open(adapter);
    const r = await runtime.interact("captains-note", "PLACE", "place-1");
    expect(r.anchorVersion).toBe(2);
    expect(runtime.read().anchors["desk-anchor"].transform.position.x).toBe(0.25);
    expect(runtime.read().anchors["desk-anchor"].version).toBe(2);
    await runtime.close();
  });
  it("cancels an in-flight placement when tracking is lost", async () => {
    const m = syntheticSpatialMoment();
    const { checksum: _checksum, ...v } = m.version;
    void _checksum;
    v.anchors = [
      {
        id: "desk-anchor",
        kind: "SURFACE_RELATIVE",
        frameId: "surface-frame",
        alignment: "HORIZONTAL",
        transform: identityTransform(),
      },
    ];
    v.entities[0].coordinateSpace = "SURFACE_RELATIVE";
    m.version = materializeSpatialVersion(v);
    m.attachment.versionChecksum = m.version.checksum;
    const { runtime, adapter } = lab(m);
    await runtime.open(adapter);
    const original = runtime.read().anchors;
    let finish!: (pose: ReturnType<typeof identityTransform>) => void;
    adapter.place = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const placement = runtime.interact("captains-note", "PLACE", "interrupted-placement");
    adapter.push({ type: "TRACKING", state: "LOST" });
    finish(identityTransform());
    await expect(placement).rejects.toThrow("PARALLAX_TRACKING_UNSTABLE");
    expect(runtime.read().state).toBe("DEGRADED");
    expect(runtime.read().anchors).toEqual(original);
    await runtime.close();
  });
  it("does not turn tracking loss into anchor rerolls, and requires stable recovery", async () => {
    const { runtime, adapter } = lab();
    await runtime.open(adapter);
    const original = runtime.read().anchors;
    adapter.push({ type: "TRACKING", state: "LOST" });
    await expect(runtime.interact("captains-note", "INSPECT", "lost-1")).rejects.toThrow("PARALLAX_LENS_NOT_READY");
    adapter.push({ type: "TRACKING", state: "NORMAL" });
    adapter.push({ type: "TRACKING", state: "NORMAL" });
    expect(runtime.read().state).toBe("DEGRADED");
    adapter.push({ type: "TRACKING", state: "NORMAL" });
    expect(runtime.read().state).toBe("READY");
    expect(runtime.read().anchors).toEqual(original);
    await runtime.close();
  });
  it("uses truthful fallback when a physical worldspace has no Landfall transform", async () => {
    const m = syntheticSpatialMoment();
    const { checksum: _checksum, ...v } = m.version;
    void _checksum;
    v.anchors = [
      {
        id: "desk-anchor",
        kind: "FIXED_WORLDSPACE",
        frameId: "town-local-frame",
        worldspaceId: "town-world",
        transform: identityTransform(),
      },
    ];
    v.entities[0].coordinateSpace = "WORLDSPACE";
    m.version = materializeSpatialVersion(v);
    m.attachment.versionChecksum = m.version.checksum;
    const { runtime, adapter } = lab(m);
    await runtime.open(adapter);
    expect(runtime.read().mode).toBe("GUIDED");
    expect(adapter.active).toBe(false);
    await runtime.close();
  });
  it("never accepts a simulator in production or records simulation as real evidence", async () => {
    const r = new ParallaxLensRuntime(syntheticSpatialMoment(), syntheticBinding, guidedContext(), now);
    await expect(r.open(new SyntheticSpatialAdapter())).rejects.toThrow("PARALLAX_SIMULATION_FORBIDDEN");
    const { runtime, adapter } = lab();
    await runtime.open(adapter);
    const receipt = await runtime.interact("captains-note", "INSPECT", "simulation-1");
    expect(() => evaluateSpatialEvidence(receipt, runtime.moment, syntheticBinding, now())).toThrow(
      "PARALLAX_SIMULATION_FORBIDDEN",
    );
    await runtime.close();
  });
  it("enforces scope, freshness, operations, replay identity and retry idempotency", async () => {
    const runtime = new ParallaxLensRuntime(syntheticSpatialMoment(), syntheticBinding, guidedContext(), now);
    await runtime.open();
    const receipt = await runtime.interact("captains-note", "INSPECT", "interaction-1");
    expect(await runtime.interact("captains-note", "INSPECT", "interaction-1")).toEqual(receipt);
    await expect(runtime.interact("captains-note", "PICK", "interaction-1")).rejects.toThrow(
      "PARALLAX_IDEMPOTENCY_CONFLICT",
    );
    await expect(runtime.interact("other", "INSPECT", "interaction-2")).rejects.toThrow();
    for (const bad of [
      { ...receipt, actorId: "other" },
      { ...receipt, sessionId: "other" },
      { ...receipt, chronicleVersionId: "other" },
      { ...receipt, entityId: "other" },
      { ...receipt, observedAt: "2026-10-10T05:55:00.000Z" },
      { ...receipt, observedAt: "2026-10-10T06:01:00.000Z" },
    ])
      expect(() => evaluateSpatialEvidence(bad, runtime.moment, syntheticBinding, now())).toThrow();
    await runtime.close();
  });
});
