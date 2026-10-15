import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { syntheticSpatialMoment, syntheticBinding, guidedContext } from "./fixtures";
import { identityTransform } from "./contracts";
import { materializeSpatialVersion } from "./publication";
import {
  catalogModelReference,
  createSceneDelivery,
  encodeSceneDelivery,
  sceneDeliverySchema,
  sceneRequirements,
  supportsSceneDelivery,
} from "./scene-delivery";
import { nativeSceneSchema, sceneDigest } from "./scene-transfer";
import { NativeSpatialAdapter } from "./native";
import { ParallaxLensRuntime } from "./runtime";
import fixtures from "../../tests/fixtures/parallax/native-delivery-v2.json";
import { emptyStudioContent } from "./studio-contracts";

function modelScene() {
  const m = syntheticSpatialMoment();
  const { checksum: _checksum, ...v } = m.version;
  void _checksum;
  v.entities[0].element = {
    kind: "PHYSICAL_ASSET",
    enabled: true,
    modelId: "brass-compass",
    packageVersion: "1.0.0",
    articulation: 0,
  };
  const version = materializeSpatialVersion(v);
  return { ...m, version, attachment: { ...m.attachment, versionChecksum: version.checksum } };
}
function delivery() {
  const m = modelScene();
  return createSceneDelivery({
    version: m.version,
    instanceId: "instance:model:run",
    playthroughId: "voyage",
    blockId: "block",
    transforms: new Map(m.version.entities.map((e) => [e.id, identityTransform()])),
    visibleEntityIds: m.version.entities.map((e) => e.id),
    elapsedMs: 0,
  });
}
afterEach(() => {
  delete window.LandfallNative;
});
describe("NCL-01 universal scene delivery", () => {
  for (const c of fixtures.sceneCases)
    it(`shared boundary: ${c.name}`, () => {
      expect(sceneDeliverySchema.safeParse(c.scene).success).toBe(c.accepted);
    });
  it("binds original catalog bytes, scale, pivot-independent transforms and released scene revision", () => {
    for (const id of ["treasure-chest", "brass-compass"] as const) {
      const ref = catalogModelReference(id, "voyage", "block", "a".repeat(64));
      const bytes = readFileSync(`public/parallax/sc02/models/${id}.glb`);
      expect(bytes.byteLength).toBe(ref.byteLength);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(ref.sha256);
      expect(ref.url).toBe(
        `/api/player/playthroughs/voyage/parallax/assets/${id}?block=block&versionChecksum=${"a".repeat(64)}`,
      );
      expect(ref.sourceWidthMeters).toBe(id === "treasure-chest" ? 0.8 : 0.16);
    }
    const scene = delivery();
    expect(scene.entities[0].model?.sha256).toHaveLength(64);
    expect(scene.entities[0].transform).toEqual(identityTransform());
    expect(new TextDecoder().decode(encodeSceneDelivery(scene))).not.toContain("data:");
    expect(nativeSceneSchema.safeParse(scene).success).toBe(false);
  });
  it("rejects stale asset revisions, corrupt identity, missing parents, cycles and undeclared model needs", () => {
    const source = delivery();
    for (const mutate of [
      (s: typeof source) => {
        s.entities[0].model!.sha256 = "0".repeat(64);
      },
      (s: typeof source) => {
        s.entities[0].model!.url = s.entities[0].model!.url.replace(s.identity.versionChecksum, "b".repeat(64));
      },
      (s: typeof source) => {
        s.entities[0].parentEntityId = "missing";
      },
      (s: typeof source) => {
        s.entities[0].parentEntityId = s.entities[0].id;
      },
      (s: typeof source) => {
        s.requirements = [];
      },
    ]) {
      const invalid = structuredClone(source);
      mutate(invalid);
      expect(sceneDeliverySchema.safeParse(invalid).success).toBe(false);
    }
    expect(sceneDeliverySchema.parse({ ...source, entities: [] }).entities).toEqual([]);
  });
  it("preserves authored effect/timeline semantics while capability gating unimplemented presentations", () => {
    const m = modelScene();
    expect(supportsSceneDelivery(m.version, ["WORLD_TRACKING", "PLANE_PLACEMENT", "MODEL_GLB"])).toBe(true);
    m.version.entities[0].element = {
      enabled: true,
      kind: "SPATIAL_AUDIO",
      sound: "WIND",
      gain: 0.2,
      refDistance: 1,
      maxDistance: 5,
      rolloff: 1,
    };
    expect(sceneRequirements(m.version)).toContain("SPATIAL_AUDIO");
    expect(supportsSceneDelivery(m.version, ["WORLD_TRACKING", "PLANE_PLACEMENT", "MODEL_GLB"])).toBe(false);
    const highlighted = modelScene();
    highlighted.version.studio ??= emptyStudioContent();
    highlighted.version.studio!.behaviors.push({
      id: "highlight",
      trigger: "INSPECT",
      sourceEntityId: highlighted.version.entities[0].id,
      targetEntityId: highlighted.version.entities[0].id,
      delayMs: 0,
      action: "HIGHLIGHT",
    });
    expect(sceneRequirements(highlighted.version)).toContain("HIGHLIGHT");
  });
  it("keeps the v2 surface frame independent of a mixed scene's contents", async () => {
    window.LandfallNative = {
      version: 1,
      platform: "ANDROID",
      request: async (message) => {
        const { operation, payload } = JSON.parse(message);
        if (operation === "SPATIAL_STATE")
          return {
            supported: true,
            permission: "GRANTED",
            sceneTransferVersion: 1,
            sceneDeliveryVersions: [1, 2],
            capabilities: ["WORLD_TRACKING", "PLANE_PLACEMENT", "MODEL_GLB"],
          };
        if (operation === "SPATIAL_START")
          return { accepted: true, sceneTransferVersion: 2, sessionId: payload.sessionId, epoch: payload.epoch };
        if (operation === "SPATIAL_PLACE") return { pose: identityTransform() };
        return { accepted: true };
      },
    };
    const adapter = new NativeSpatialAdapter();
    await adapter.discover();
    await adapter.start({
      signal: new AbortController().signal,
      emit: () => {},
      sceneIdentity: { instanceId: "instance:mixed:run", versionChecksum: "a".repeat(64) },
    });
    expect(await adapter.place("HORIZONTAL")).toEqual(identityTransform());
    expect(
      await adapter.resolve({
        id: "surface",
        kind: "SURFACE_RELATIVE",
        frameId: "surface-frame",
        alignment: "HORIZONTAL",
        transform: identityTransform(),
      }),
    ).toEqual(identityTransform());
    await adapter.stop();
  });
  it("negotiates v2 and commits only bounded reference metadata; matching native intent stays nonauthoritative", async () => {
    let identity: Record<string, unknown> = {},
      encoded = "",
      expectedDigest = "";
    const request = vi.fn(async (message: string) => {
      expect(new TextEncoder().encode(message).byteLength).toBeLessThanOrEqual(16384);
      const { operation, payload } = JSON.parse(message);
      if (operation === "SPATIAL_STATE")
        return {
          supported: true,
          permission: "GRANTED",
          sceneTransferVersion: 1,
          sceneDeliveryVersions: [1, 2],
          capabilities: ["WORLD_TRACKING", "PLANE_PLACEMENT", "MODEL_GLB"],
        };
      if (operation === "SPATIAL_START") {
        identity = payload;
        return { accepted: true, sceneTransferVersion: 2, sessionId: payload.sessionId, epoch: payload.epoch };
      }
      if (operation === "SPATIAL_SCENE_BEGIN") {
        encoded = "";
        expectedDigest = payload.digest;
        expect(payload.sceneTransferVersion).toBe(2);
      }
      if (operation === "SPATIAL_SCENE_CHUNK") encoded += atob(payload.data);
      if (operation === "SPATIAL_SCENE_COMMIT")
        expect(await sceneDigest(Uint8Array.from(encoded, (c) => c.charCodeAt(0)))).toBe(expectedDigest);
      return { accepted: true };
    });
    window.LandfallNative = { version: 1, platform: "IOS", request };
    const adapter = new NativeSpatialAdapter();
    await adapter.discover();
    const camera = {
      ...guidedContext().camera,
      support: "SUPPORTED" as const,
      availability: "AVAILABLE" as const,
      permission: "GRANTED" as const,
    };
    const runtime = new ParallaxLensRuntime(modelScene(), syntheticBinding, { ...guidedContext(), camera });
    await runtime.open(adapter);
    for (let i = 0; i < 3; i++)
      window.dispatchEvent(
        new CustomEvent("landfall-native-event", {
          detail: { type: "parallax-tracking", state: "NORMAL", sessionId: identity.sessionId, epoch: identity.epoch },
        }),
      );
    expect(runtime.read().mode).toBe("NATIVE");
    expect(sceneDeliverySchema.parse(JSON.parse(encoded)).identity.versionChecksum).toBe(modelScene().version.checksum);
    const receipt = await runtime.interact(modelScene().version.entities[0].id, "INSPECT", "inspect-model");
    expect(receipt.authority).toBe("NONAUTHORITATIVE");
    expect(receipt.versionChecksum).toBe(modelScene().version.checksum);
    await runtime.close();
  });
  it("keeps unsupported/old native models in the existing Guided experience", async () => {
    window.LandfallNative = { version: 1, platform: "ANDROID", request: vi.fn(async () => ({ accepted: true })) };
    const runtime = new ParallaxLensRuntime(modelScene(), syntheticBinding, guidedContext());
    await runtime.open(new NativeSpatialAdapter());
    expect(runtime.read().state).toBe("GUIDED_FALLBACK");
    expect(window.LandfallNative.request).not.toHaveBeenCalled();
    await runtime.close();
  });
});
