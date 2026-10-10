import { afterEach, describe, expect, it, vi } from "vitest";
import fixtures from "../../tests/fixtures/parallax/native-boundary-v1.json";
import { nativeSceneSchema, sceneTransferLimits, encodeScene, sceneChunks, sceneDigest } from "./scene-transfer";
import { authoredTransformSchema, identityTransform } from "./contracts";
import { composeTransform } from "./transforms";
import { NativeSpatialAdapter } from "./native";
import { landfallNativeRequest } from "@/landfall/native-bridge";
import { ParallaxLensRuntime } from "./runtime";
import { guidedContext, syntheticBinding, syntheticSpatialMoment } from "./fixtures";
import { materializeSpatialVersion, validateSpatialMoment } from "./publication";
import { canonicalJson, DRYDOCK_MAX_CANONICAL_BYTES } from "@/drydock/canonical";
afterEach(() => {
  delete window.LandfallNative;
});
function transport(fail?: string) {
  const scenes: unknown[] = [];
  let buffer = "",
    begin: Record<string, unknown> = {},
    identity: Record<string, unknown> = {};
  const request = vi.fn(async (message: string) => {
    expect(new TextEncoder().encode(message).length).toBeLessThanOrEqual(16384);
    const { operation, payload } = JSON.parse(message);
    if (operation === fail) return { accepted: false };
    if (operation === "SPATIAL_PERMISSION") return { supported: true, permission: "GRANTED", sceneTransferVersion: 1 };
    if (operation === "SPATIAL_START") {
      identity = payload;
      return { accepted: true, sceneTransferVersion: 1, sessionId: payload.sessionId, epoch: payload.epoch };
    }
    if (operation === "SPATIAL_SCENE_BEGIN") {
      begin = payload;
      buffer = "";
    }
    if (operation === "SPATIAL_SCENE_CHUNK") buffer += atob(payload.data);
    if (operation === "SPATIAL_SCENE_COMMIT") {
      const bytes = Uint8Array.from(buffer, (c) => c.charCodeAt(0));
      expect(bytes.length).toBe(begin.totalBytes);
      expect(await sceneDigest(bytes)).toBe(begin.digest);
      scenes.push(JSON.parse(new TextDecoder().decode(bytes)));
    }
    return { accepted: true };
  });
  window.LandfallNative = { version: 1, platform: "ANDROID", request };
  const event = (detail: object) =>
    window.dispatchEvent(
      new CustomEvent("landfall-native-event", {
        detail: { sessionId: identity.sessionId, epoch: identity.epoch, ...detail },
      }),
    );
  return {
    request,
    scenes,
    event,
    get identity() {
      return { ...identity };
    },
  };
}
describe("shared native boundary v1 (D0 transport, native fixtures are separately executed)", () => {
  it("freezes bounds from the same fixture", () => {
    expect({ ...sceneTransferLimits, version: undefined }).toEqual({ ...fixtures.limits, version: undefined });
  });
  for (const c of fixtures.sceneCases)
    it(c.name, () => {
      expect(nativeSceneSchema.safeParse(c.scene).success).toBe(c.accepted);
    });
  for (const c of fixtures.authoredScales)
    it(`authored scale ${c.scale}`, () => {
      expect(authoredTransformSchema.safeParse({ ...identityTransform(), scale: c.scale }).success).toBe(c.accepted);
    });
  for (const c of fixtures.sizeCases)
    it(`streams ${c.count} entities / ${c.content.length} UTF-16 units`, async () => {
      const host = transport(),
        adapter = new NativeSpatialAdapter();
      await adapter.start({
        signal: new AbortController().signal,
        emit: () => {},
        sceneIdentity: { versionChecksum: "a".repeat(64), instanceId: "test" },
      });
      const entities = Array.from({ length: c.count }, (_, i) => ({
        id: `e-${i}`,
        kind: "TEXT",
        content: c.content,
        widthMeters: 0.25,
        transform: identityTransform(),
      }));
      await adapter.render(entities);
      expect(host.scenes).toEqual([
        { schemaVersion: 1, transformKind: "RESOLVED_LOCAL_V1", coordinateFrame: "LOCAL_Y_UP_NEGATIVE_Z", entities },
      ]);
      expect(host.request.mock.calls.some(([m]) => JSON.parse(m).operation === "SPATIAL_RENDER")).toBe(false);
      await adapter.stop();
    });
  it("counts envelope UTF-8 bytes at the 16 KiB boundary", async () => {
    transport();
    const payload = { text: "界".repeat(5400) };
    await expect(landfallNativeRequest("SPATIAL_RENDER", payload)).resolves.toBeDefined();
    await expect(landfallNativeRequest("SPATIAL_RENDER", { text: "界".repeat(5500) })).rejects.toThrow(
      "REQUEST_TOO_LARGE",
    );
    const overhead = new TextEncoder().encode(
      JSON.stringify({ version: 1, id: "a".repeat(36), operation: "SPATIAL_RENDER", payload: { text: "" } }),
    ).length;
    await expect(
      landfallNativeRequest("SPATIAL_RENDER", { text: "a".repeat(16384 - overhead) }),
    ).resolves.toBeDefined();
    await expect(landfallNativeRequest("SPATIAL_RENDER", { text: "a".repeat(16385 - overhead) })).rejects.toThrow(
      "REQUEST_TOO_LARGE",
    );
  });
  it("retains historical checksums and the separate 32 KiB canonical publication limit", () => {
    const historical = syntheticSpatialMoment();
    expect(validateSpatialMoment(historical)).toEqual(historical);
    const { checksum: _checksum, ...content } = historical.version;
    void _checksum;
    const entities = Array.from({ length: 8 }, (_, i) => ({
      ...content.entities[0],
      id: `e-${i}`,
      content: "a".repeat(2000),
      alternativeText: "Clue",
    }));
    const version = materializeSpatialVersion({ ...content, entities });
    expect(new TextEncoder().encode(canonicalJson(version)).length).toBeLessThan(DRYDOCK_MAX_CANONICAL_BYTES);
    const moment = {
      ...historical,
      version,
      attachment: { ...historical.attachment, versionChecksum: version.checksum },
    };
    expect(validateSpatialMoment(moment)).toEqual(moment);
    expect(
      encodeScene(
        entities.map((e) => ({
          id: e.id,
          kind: e.kind,
          content: e.content,
          widthMeters: e.widthMeters,
          transform: e.transform,
        })),
      ).length,
    ).toBeGreaterThan(16384);
    expect(() =>
      canonicalJson({
        ...content,
        entities: Array.from({ length: 32 }, (_, i) => ({ ...entities[0], id: `e-${i}` })),
      }),
    ).toThrow();
  });
  it("older companions remain Guided-only", async () => {
    window.LandfallNative = {
      version: 1,
      platform: "IOS",
      request: async () => ({ supported: true, permission: "GRANTED" }),
    };
    expect((await new NativeSpatialAdapter().discover()).supported).toBe(false);
  });
  it("aborts failed transfers without activating a partial scene", async () => {
    const host = transport("SPATIAL_SCENE_CHUNK"),
      adapter = new NativeSpatialAdapter();
    await adapter.start({
      signal: new AbortController().signal,
      emit: () => {},
      sceneIdentity: { versionChecksum: "a".repeat(64), instanceId: "test" },
    });
    await expect(
      adapter.render([
        { id: "e", kind: "TEXT", content: "a".repeat(2000), widthMeters: 1, transform: identityTransform() },
      ]),
    ).rejects.toThrow();
    expect(host.scenes).toEqual([]);
    expect(host.request.mock.calls.some(([m]) => JSON.parse(m).operation === "SPATIAL_SCENE_ABORT")).toBe(true);
    await adapter.stop();
  });
  it("close during an in-flight chunk rejects late commit and permits a fresh reopen", async () => {
    const host = transport(),
      base = window.LandfallNative!.request;
    let resume: (() => void) | undefined;
    window.LandfallNative!.request = async (message) => {
      if (JSON.parse(message).operation === "SPATIAL_SCENE_CHUNK")
        await new Promise<void>((resolve) => {
          resume = resolve;
        });
      return base(message);
    };
    const adapter = new NativeSpatialAdapter(),
      controller = new AbortController();
    await adapter.start({
      signal: controller.signal,
      emit: () => {},
      sceneIdentity: { versionChecksum: "a".repeat(64), instanceId: "test" },
    });
    const pending = adapter.render([
      { id: "e", kind: "TEXT", content: "clue", widthMeters: 1, transform: identityTransform() },
    ]);
    const rejected = expect(pending).rejects.toThrow();
    await vi.waitFor(() => expect(resume).toBeDefined());
    controller.abort();
    resume!();
    await rejected;
    expect(host.scenes).toHaveLength(0);
    await adapter.start({
      signal: new AbortController().signal,
      emit: () => {},
      sceneIdentity: { versionChecksum: "a".repeat(64), instanceId: "test" },
    });
    await adapter.stop();
  });
  it("permission loss and double interruption block native intent immediately", async () => {
    const host = transport(),
      selected = vi.fn(),
      adapter = new NativeSpatialAdapter(selected),
      runtime = new ParallaxLensRuntime(syntheticSpatialMoment(), syntheticBinding, guidedContext());
    await runtime.updateDeviceContext(await adapter.authorize());
    await runtime.open(adapter);
    for (let i = 0; i < 3; i++) host.event({ type: "parallax-tracking", state: "NORMAL" });
    await runtime.updateDeviceContext({ ...guidedContext().camera, permission: "DENIED" });
    host.event({ type: "parallax-tracking", state: "INTERRUPTED" });
    host.event({ type: "parallax-tracking", state: "INTERRUPTED" });
    host.event({ type: "parallax-interaction", entityId: "captains-note", interactionType: "PICK" });
    expect(selected).not.toHaveBeenCalled();
    expect(runtime.read().mode).toBe("GUIDED");
    await runtime.close();
  });
  it("composes nested authored transforms and rejects unsafe effective geometry and nonfinite values", () => {
    const t = composeTransform({ ...identityTransform(), scale: 2 }, { ...identityTransform(), scale: 6 });
    expect(t.scale).toBe(12);
    const nested = composeTransform(t, { ...identityTransform(), scale: 10 });
    expect(nested.scale).toBe(120);
    const entity = { id: "e", kind: "TEXT" as const, content: "safe", widthMeters: 0.25, transform: nested };
    expect(() => encodeScene([entity])).not.toThrow();
    for (const scale of [NaN, Infinity, 0, 1000])
      expect(() => encodeScene([{ ...entity, transform: { ...nested, scale } }])).toThrow();
    expect(sceneChunks(encodeScene([entity]))).toHaveLength(1);
  });
  it("Open → Back → Guided → Reopen → Pick/Inspect → Close → Reopen fences old events", async () => {
    const host = transport(),
      picked = vi.fn(),
      adapter = new NativeSpatialAdapter(picked),
      runtime = new ParallaxLensRuntime(syntheticSpatialMoment(), syntheticBinding, guidedContext());
    await runtime.updateDeviceContext(await adapter.authorize());
    await runtime.open(adapter);
    const old = host.identity;
    for (let i = 0; i < 3; i++) host.event({ type: "parallax-tracking", state: "NORMAL" });
    expect(runtime.read().state).toBe("READY");
    host.event({ type: "parallax-tracking", state: "INTERRUPTED" });
    expect(runtime.read().state).toBe("DEGRADED");
    await expect(runtime.interact("captains-note", "PICK", "late")).rejects.toThrow("NOT_READY");
    await vi.waitFor(() => expect(runtime.read().mode).toBe("GUIDED"));
    await runtime.open(adapter);
    expect(host.identity.sessionId).not.toBe(old.sessionId);
    host.event({
      type: "parallax-interaction",
      entityId: "captains-note",
      interactionType: "PICK",
      sessionId: old.sessionId,
      epoch: old.epoch,
    });
    expect(picked).not.toHaveBeenCalled();
    for (let i = 0; i < 3; i++) host.event({ type: "parallax-tracking", state: "NORMAL" });
    for (const type of ["PICK", "INSPECT"] as const)
      expect((await runtime.interact("captains-note", type, type)).mode).toBe("NATIVE");
    await runtime.close();
    host.event({ type: "parallax-interaction", entityId: "captains-note", interactionType: "INSPECT" });
    expect(picked).not.toHaveBeenCalled();
    await runtime.open(adapter);
    expect(runtime.read().state).toBe("LEARNING_SPACE");
    await runtime.close();
  });
});
