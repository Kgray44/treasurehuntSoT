import { afterEach, describe, expect, it, vi } from "vitest";
import { createSpatialDraft, editSpatialDraft } from "./authoring";
import { enableAdaptiveAuthoring, syntheticEnvironmentEvidence } from "./adaptive-authoring";
import { materializeLibraryMoment } from "./library-service";
import { simulationEnvironments } from "./studio-validation";
import { ParallaxLensRuntime, type SpatialRuntimeAdapter } from "./runtime";
import { SyntheticSpatialAdapter } from "./synthetic";
import { guidedContext, syntheticBinding } from "./fixtures";
import type { SceneResolution } from "./adaptive";

const openRuntimes: ParallaxLensRuntime[] = [];
afterEach(async () => {
  await Promise.all(openRuntimes.splice(0).map((r) => r.close()));
});
function moment(two = false) {
  let d = enableAdaptiveAuthoring(createSpatialDraft("runtime-adaptive"));
  if (two) {
    d = editSpatialDraft(d, { type: "DUPLICATE", entityId: d.content.entities[0].id, newId: "second" });
    d.content.adaptive!.revealOrder = d.content.entities.map((e) => e.id);
    d.content.adaptive!.budget.maximumVisibleEntities = 1;
  }
  const m = materializeLibraryMoment(d, "creator", 1);
  m.attachment.storyMomentId = syntheticBinding.blockId;
  return m;
}
describe("adaptive Lens lifecycle and discovery", () => {
  it("recovers anchor loss without rerolling the logical decision", async () => {
    const adapter = new SyntheticSpatialAdapter(undefined, syntheticEnvironmentEvidence(simulationEnvironments[0]));
    const r = new ParallaxLensRuntime(moment(), syntheticBinding, { ...guidedContext(), environment: "DEVICE_LAB" });
    openRuntimes.push(r);
    await r.open(adapter);
    const seed = r.read().resolution!.seed;
    const receipt = r.read().resolutionReceipt!;
    expect(receipt.seed).toBe(seed);
    expect(receipt.entities[0]).toMatchObject({ confidenceBand: "HIGH", scoreBand: "HIGH_MATCH" });
    expect(JSON.stringify(receipt)).not.toMatch(/candidateId|position|rotation|frameId/);
    adapter.push({ type: "ANCHOR_LOST", anchorId: Object.keys(r.read().anchors)[0] });
    await vi.waitFor(() => expect(r.read().state).toBe("GUIDED_FALLBACK"));
    expect(r.read().resolution!.seed).toBe(seed);
    expect(adapter.active).toBe(false);
  });
  it("rechecks cached safety and prevents silent rerolls on reopen", async () => {
    const evidence = syntheticEnvironmentEvidence(simulationEnvironments[0]);
    const cache = new Map<string, SceneResolution>();
    const context = {
      ...guidedContext(),
      environment: "DEVICE_LAB" as const,
      decisionStore: {
        load: (k: string) => cache.get(k) ?? null,
        save: (k: string, v: SceneResolution) => {
          cache.set(k, v);
        },
      },
    };
    const r = new ParallaxLensRuntime(moment(), syntheticBinding, context);
    openRuntimes.push(r);
    await r.open(new SyntheticSpatialAdapter(undefined, evidence));
    const prior = r.read().resolution!;
    const selected = Object.values(prior.placements)[0].candidateId;
    const unsafe = {
      ...evidence,
      candidates: evidence.candidates.map((c) => (c.id === selected ? { ...c, reachMeters: 100 } : c)),
    };
    await r.open(new SyntheticSpatialAdapter(undefined, unsafe));
    expect(r.read().state).toBe("GUIDED_FALLBACK");
    expect(cache.size).toBe(1);
    expect([...cache.values()][0]).toEqual(prior);
    await r.open(new SyntheticSpatialAdapter(undefined, evidence));
    expect(r.read().resolution!.placements).toEqual(prior.placements);
  });
  it("reveals only the current sequential entity and keeps inspected objects out of the renderer budget", async () => {
    const m = moment(true);
    const r = new ParallaxLensRuntime(m, syntheticBinding, { ...guidedContext(), environment: "DEVICE_LAB" });
    openRuntimes.push(r);
    await r.open(new SyntheticSpatialAdapter(undefined, syntheticEnvironmentEvidence(simulationEnvironments[0])));
    expect(r.read().mode).toBe("SIMULATED");
    const [first, second] = m.version.adaptive!.revealOrder;
    expect(r.read().visibleEntityIds).toEqual([first]);
    await r.interact(first, "INSPECT", "inspect-first");
    expect(r.read().visibleEntityIds).toEqual([second]);
    await r.interact(second, "INSPECT", "inspect-second");
    expect(r.read().visibleEntityIds).toEqual([second]);
  });
  it("counts search only after native tracking is ready and retains numeric time on a new authorized instance", async () => {
    let clock = 0;
    const retained = new Map<string, number>();
    const m = moment(),
      evidence = { ...syntheticEnvironmentEvidence(simulationEnvironments[0]), source: "NATIVE_MEASURED" as const };
    const base = new SyntheticSpatialAdapter(undefined, evidence);
    const adapter: SpatialRuntimeAdapter = {
      providerId: "test.native",
      mode: "NATIVE",
      worldTracking: true,
      planePlacement: true,
      start: (c) => base.start(c),
      stop: () => base.stop(),
      resolve: (a) => base.resolve(a),
      place: () => base.place(),
      render: () => base.render(),
      environmentEvidence: () => base.environmentEvidence(),
    };
    const context = {
      ...guidedContext(),
      searchClock: () => clock,
      searchTimeStore: {
        load: (k: string) => retained.get(k) ?? 0,
        save: (k: string, v: number) => {
          retained.set(k, v);
        },
      },
    };
    context.camera = { ...context.camera, support: "SUPPORTED", permission: "GRANTED", availability: "AVAILABLE" };
    const r = new ParallaxLensRuntime(m, syntheticBinding, context);
    openRuntimes.push(r);
    await r.open(adapter);
    const id = m.version.entities[0].id;
    clock = 1000;
    await r.tickDiscovery();
    base.push({ type: "TRACKING", state: "NORMAL" });
    clock = 2000;
    await r.tickDiscovery();
    base.push({ type: "TRACKING", state: "NORMAL" });
    clock = 3000;
    await r.tickDiscovery();
    expect(r.read().discovery![id].meaningfulSeconds).toBe(0);
    base.push({ type: "TRACKING", state: "NORMAL" });
    clock = 4000;
    await r.tickDiscovery();
    expect(r.read().discovery![id].meaningfulSeconds).toBe(1);
    r.updateSearchActivity({ inSearchRegion: false });
    clock = 5000;
    await r.tickDiscovery();
    r.updateSearchActivity({ foreground: true });
    clock = 6000;
    await r.tickDiscovery();
    expect(r.read().discovery![id].meaningfulSeconds).toBe(1);
    await r.close();
    const reopened = new ParallaxLensRuntime(m, syntheticBinding, context);
    openRuntimes.push(reopened);
    await reopened.open();
    expect(reopened.read().discovery![id].meaningfulSeconds).toBe(1);
    expect([...retained.values()].every((n) => typeof n === "number")).toBe(true);
    const other = new ParallaxLensRuntime(m, { ...syntheticBinding, actorId: "other-player" }, context);
    openRuntimes.push(other);
    await other.open();
    expect(other.read().discovery![id].meaningfulSeconds).toBe(0);
  });
});
