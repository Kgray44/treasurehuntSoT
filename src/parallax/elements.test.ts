// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as T from "three";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { physicalAssets } from "./asset-catalog";
import { createPremiumModel, setModelArticulation } from "./assets/models";
import {
  createSpatialDraft,
  draftSchema,
  editSpatialDraft,
  changeHistory,
  undo,
  redo,
  previewEntityTransform,
} from "./authoring";
import {
  insertSpatialElement,
  effectPresets,
  compositionPresets,
  extractComposition,
  insertSavedComposition,
} from "./element-authoring";
import { spatialElementSchema, elementEnvelope } from "./element-contracts";
import { inspectGlb } from "@/community/artifacts";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { canonicalChecksum } from "@/drydock/canonical";
import { validateSpatialAuthoring } from "./studio-validation";

describe("SC-02 original asset package", () => {
  it.each(physicalAssets)(
    "$id has finite detailed meshes, material normals, declared scale and a bottom-center pivot",
    (asset) => {
      const model = createPremiumModel(asset.id);
      model.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(model),
        size = box.getSize(new T.Vector3());
      size.toArray().forEach((value, i) => expect(value).toBeCloseTo(asset.dimensions[i], 4));
      expect(box.min.y).toBeCloseTo(0, 5);
      let triangles = 0;
      const resources = new Set<T.Material>();
      model.traverse((o) => {
        if (o instanceof T.Mesh) {
          const g = o.geometry;
          triangles += (g.index?.count ?? g.attributes.position.count) / 3;
          expect([...g.attributes.position.array].every(Number.isFinite)).toBe(true);
          expect([...g.attributes.normal.array].every(Number.isFinite)).toBe(true);
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            expect(m).toBeInstanceOf(T.MeshStandardMaterial);
            resources.add(m);
          }
          g.dispose();
        }
      });
      expect(triangles).toBeGreaterThan(250);
      expect(triangles).toBeLessThanOrEqual(50000);
      resources.forEach((m) => m.dispose());
    },
  );
  it("ships 30 distinct GLBs with current hashes and the existing Harborlight structural inspection", () => {
    const manifest = JSON.parse(readFileSync("public/parallax/sc02/manifest.json", "utf8"));
    expect(manifest.assets).toHaveLength(30);
    const hashes = new Set();
    for (const a of manifest.assets) {
      const bytes = readFileSync(`public/parallax/sc02/${a.path}`);
      expect(bytes.length).toBe(a.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(a.sha256);
      hashes.add(a.sha256);
      expect(inspectGlb(bytes)).toBeTruthy();
    }
    expect(hashes.size).toBe(30);
  });
  it.each(physicalAssets)("$id GLB actually decodes to finite transformed bounds", async (asset) => {
    const bytes = readFileSync(`public/parallax/sc02/models/${asset.id}.glb`);
    const loader = new GLTFLoader();
    loader.register(() => ({ name: "SC02_GEOMETRY_ONLY", loadTexture: () => Promise.resolve(new T.Texture()) }));
    const loaded = await loader.parseAsync(Uint8Array.from(bytes).buffer, "");
    const box = new T.Box3().setFromObject(loaded.scene);
    expect(box.min.toArray().every(Number.isFinite)).toBe(true);
    box
      .getSize(new T.Vector3())
      .toArray()
      .forEach((n, i) => expect(n).toBeCloseTo(asset.dimensions[i], 4));
  });
  it.each(["hinged-door", "opening-drawer", "articulated-chest"] as const)(
    "%s changes its actual mesh pose around an authored pivot",
    (id) => {
      const model = createPremiumModel(id),
        pivot = model.getObjectByName("articulation")!;
      expect(pivot).toBeTruthy();
      const old = pivot.matrix.clone();
      setModelArticulation(model, id, 1);
      pivot.updateMatrix();
      expect(pivot.matrix.equals(old)).toBe(false);
    },
  );
});
describe("canonical element persistence and simulation", () => {
  it.each([...physicalAssets, ...effectPresets, ...compositionPresets])(
    "$id roundtrips without a second scene store",
    (item) => {
      const draft = insertSpatialElement(createSpatialDraft("scene"), item.id, "placed");
      const saved = draftSchema.parse(JSON.parse(JSON.stringify(draft)));
      expect(saved).toEqual(draft);
      const errors = validateSpatialAuthoring(saved.content).filter((f) => f.severity === "ERROR");
      if (item.id === "decorative-vase")
        expect(errors.map((e) => e.code)).toEqual(["PARALLAX_MODEL_VISUAL_REPAIR_REQUIRED"]);
      else expect(errors).toEqual([]);
      expect(saved.content.entities.at(-1)?.element).toBeTruthy();
    },
  );
  it("retains historical checksum material when optional elements are absent", () => {
    const old = createSpatialDraft("old");
    expect(old.content.entities.every((e) => !Object.hasOwn(e, "element"))).toBe(true);
    expect(canonicalChecksum(draftSchema.parse(old))).toBe(canonicalChecksum(old));
  });
  it("keeps a physical model upright on the existing horizontal placement frame", () => {
    const draft = insertSpatialElement(createSpatialDraft("surface"), "lantern", "lantern");
    const placed = editSpatialDraft(draft, { type: "PLACEMENT", entityId: "lantern", placement: "DESK" });
    expect(previewEntityTransform(placed.content, "lantern").rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    expect(previewEntityTransform(placed.content, "lantern").position.y).toBe(0.75);
  });
  it("extracts a dependency-closed editable prefab and inserts two distinct instances", () => {
    const input = insertSpatialElement(createSpatialDraft("scene"), "ghostly-presence", "ghost");
    expect(input.category).toBe("MOMENT");
    expect(input.tags).not.toContain("composition");
    const prefab = extractComposition(input, "ghost", "prefab");
    expect(prefab.content.entities).toHaveLength(5);
    expect(prefab.scope).toBe("MY_LIBRARY");
    const first = insertSavedComposition(createSpatialDraft("target"), prefab, "first");
    const second = insertSavedComposition(first, prefab, "second");
    expect(second.content.entities).toHaveLength(11);
    expect(new Set(second.content.entities.map((e) => e.id)).size).toBe(11);
    expect(second.content.entities.find((e) => e.id === "second:e1")?.parentEntityId).toBe("second:e0");
    expect(draftSchema.parse(JSON.parse(JSON.stringify(second)))).toEqual(second);
  });
  it("edits, duplicates, deletes and undoes individual composition constituents", () => {
    const draft = insertSpatialElement(createSpatialDraft("scene"), "ghostly-presence", "ghost"),
      child = draft.content.entities.at(-1)!;
    let history = { past: [] as (typeof draft)[], present: draft, future: [] as (typeof draft)[] };
    history = changeHistory(history, {
      type: "CONTENT",
      entityId: child.id,
      patch: { element: { ...child.element!, enabled: false } },
    });
    expect(undo(history).present).toEqual(draft);
    expect(redo(undo(history)).present).toEqual(history.present);
    const duplicated = editSpatialDraft(draft, { type: "DUPLICATE", entityId: child.id, newId: "copy" });
    expect(duplicated.content.entities.at(-1)?.element).toEqual(child.element);
    expect(editSpatialDraft(duplicated, { type: "DELETE", entityId: "copy" }).content.entities).toEqual(
      draft.content.entities,
    );
  });
  it("envelopes seek, cancel and loop deterministically", () => {
    const e = spatialElementSchema.parse({
      ...effectPresets[0].element,
      playback: { startMs: 1000, durationMs: 4000, fadeInMs: 1000, fadeOutMs: 1000, loop: false },
    });
    expect([0, 1000, 1500, 2500, 4500, 5000].map((t) => elementEnvelope(e, t))).toEqual([0, 0, 0.5, 1, 0.5, 0]);
    expect(elementEnvelope({ ...e, enabled: false }, 2500)).toBe(0);
    expect(elementEnvelope(e, 0, true)).toBe(1);
    expect(elementEnvelope({ ...e, playback: { ...e.playback!, loop: true } }, 5500)).toBe(0.5);
  });
  it("rejects unbounded effects, arbitrary models, scripts, NaN and external audio", () => {
    for (const patch of [
      { count: 513 },
      { radius: Infinity },
      { seed: -1 },
      { url: "https://untrusted.test/audio" },
      { shader: "void main(){}" },
    ])
      expect(
        spatialElementSchema.safeParse({ ...effectPresets.find((p) => p.id === "magic")!.element, ...patch }).success,
      ).toBe(false);
    expect(
      spatialElementSchema.safeParse({ kind: "PHYSICAL_ASSET", modelId: "remote", enabled: true, articulation: 0 })
        .success,
    ).toBe(false);
  });
});
