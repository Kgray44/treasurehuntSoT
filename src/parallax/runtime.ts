import {
  spatialMomentSchema,
  instanceBindingSchema,
  instanceIdSchema,
  receiptSchema,
  identityTransform,
  resolvedTransformSchema,
  type SpatialMoment,
  type InstanceBinding,
  type Transform,
  type InteractionReceipt,
  type Anchor,
} from "./contracts";
import { composeTransform } from "./transforms";
import type { CapabilityState } from "@/sextant/contracts";

export type TrackingState =
  | "INITIALIZING"
  | "MAPPING"
  | "NORMAL"
  | "LIMITED_LOW_LIGHT"
  | "LIMITED_EXCESSIVE_MOTION"
  | "LIMITED_FEATURES"
  | "RELOCALIZING"
  | "INTERRUPTED"
  | "LOST"
  | "UNSUPPORTED";
export type RuntimeMode = "GUIDED" | "NATIVE" | "SIMULATED";
export type SpatialRuntimeEvent =
  | { type: "TRACKING"; state: TrackingState }
  | { type: "ANCHOR_LOST"; anchorId: string };
export interface SpatialRuntimeAdapter {
  readonly providerId: string;
  readonly mode: RuntimeMode;
  readonly worldTracking: boolean;
  readonly planePlacement: boolean;
  start(context: { signal: AbortSignal; emit: (event: SpatialRuntimeEvent) => void }): Promise<void>;
  resolve(anchor: Anchor): Promise<Transform | null>;
  place(alignment: "HORIZONTAL" | "VERTICAL"): Promise<Transform | null>;
  render(
    entities: readonly { id: string; kind: string; content: string; widthMeters: number; transform: Transform }[],
  ): Promise<void>;
  stop(): Promise<void>;
}
export type SpatialContext = {
  camera: CapabilityState;
  worldspace?: { id: string; frameId: string; localFromWorld: Transform };
  replayOnly: boolean;
  environment: "PRODUCTION" | "DEVICE_LAB";
};
export type LensState =
  | "CLOSED"
  | "INITIALIZING"
  | "LEARNING_SPACE"
  | "READY"
  | "INTERACTING"
  | "RELOCALIZING"
  | "DEGRADED"
  | "GUIDED_FALLBACK";
type ResolvedAnchor = { id: string; version: number; transform: Transform };
export type LensSnapshot = {
  state: LensState;
  mode: RuntimeMode;
  tracking: TrackingState;
  guidance: string;
  selectedEntityId: string | null;
  inspectedEntityId: string | null;
  anchors: Readonly<Record<string, ResolvedAnchor>>;
};
const guidance: Record<TrackingState, string> = {
  INITIALIZING: "Opening the Chronicle Lens…",
  MAPPING: "Move your device slowly to learn the space.",
  NORMAL: "Choose an object to inspect.",
  LIMITED_LOW_LIGHT: "More light may help. Guided View is always available.",
  LIMITED_EXCESSIVE_MOTION: "Hold your device steady for a moment.",
  LIMITED_FEATURES: "Try a surface with more detail, or open Guided View.",
  RELOCALIZING: "Finding the same objects again…",
  INTERRUPTED: "The Lens paused. Return to this passage to continue.",
  LOST: "This device lost its place. Open Guided View or try again.",
  UNSUPPORTED: "This device uses Guided View for this spatial moment.",
};

export class GuidedSpatialAdapter implements SpatialRuntimeAdapter {
  readonly providerId = "parallax.guided.v1";
  readonly mode = "GUIDED" as const;
  readonly worldTracking = false;
  readonly planePlacement = false;
  async start() {}
  async resolve() {
    return identityTransform();
  }
  async place() {
    return null;
  }
  async render() {}
  async stop() {}
}

/** Presentation/interaction only. No progression event, inventory grant or shared scene is written here. */
export class ParallaxLensRuntime {
  readonly moment: SpatialMoment;
  readonly binding: InstanceBinding;
  readonly instanceId: string;
  private adapter: SpatialRuntimeAdapter = new GuidedSpatialAdapter();
  private abort = new AbortController();
  private epoch = 0;
  private normalSamples = 0;
  private interactionPending = false;
  private readonly ledger = new Map<string, InteractionReceipt>();
  private snapshot: LensSnapshot = {
    state: "CLOSED",
    mode: "GUIDED",
    tracking: "UNSUPPORTED",
    guidance: guidance.UNSUPPORTED,
    selectedEntityId: null,
    inspectedEntityId: null,
    anchors: {},
  };
  constructor(
    input: unknown,
    binding: InstanceBinding,
    private readonly context: SpatialContext,
    private readonly now: () => Date = () => new Date(),
    private readonly changed: (snapshot: LensSnapshot) => void = () => {},
  ) {
    this.moment = spatialMomentSchema.parse(structuredClone(input));
    const freeze = (value: unknown): void => {
      if (value && typeof value === "object") {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
      }
    };
    freeze(this.moment);
    this.binding = Object.freeze(instanceBindingSchema.parse(binding));
    if (this.moment.attachment.storyMomentId !== binding.blockId) throw new Error("PARALLAX_ATTACHMENT_BLOCK_MISMATCH");
    this.instanceId = instanceIdSchema.parse(`instance:${this.moment.attachment.id}:${binding.runId}`);
  }
  read(): LensSnapshot {
    return structuredClone(this.snapshot);
  }
  private update(patch: Partial<LensSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.changed(this.read());
  }
  private usableCamera() {
    const c = this.context.camera;
    return (
      c.support === "SUPPORTED" &&
      c.permission === "GRANTED" &&
      c.availability === "AVAILABLE" &&
      c.lifecycle !== "SUSPENDED"
    );
  }
  async open(candidate?: SpatialRuntimeAdapter) {
    await this.close();
    const epoch = ++this.epoch;
    this.abort = new AbortController();
    if (candidate?.mode === "SIMULATED" && this.context.environment !== "DEVICE_LAB")
      throw new Error("PARALLAX_SIMULATION_FORBIDDEN");
    this.adapter =
      candidate &&
      (candidate.mode === "SIMULATED" ||
        (candidate.mode === "NATIVE" && candidate.worldTracking && this.usableCamera()))
        ? candidate
        : new GuidedSpatialAdapter();
    this.update({
      state: "INITIALIZING",
      mode: this.adapter.mode,
      tracking: "INITIALIZING",
      guidance: guidance.INITIALIZING,
      anchors: {},
    });
    try {
      await this.adapter.start({
        signal: this.abort.signal,
        emit: (e) => {
          if (epoch === this.epoch && !this.abort.signal.aborted) this.onEvent(e);
        },
      });
      if (epoch !== this.epoch) return;
      const anchors: Record<string, ResolvedAnchor> = {};
      for (const a of this.moment.version.anchors) {
        let t: Transform | null;
        if (this.adapter.mode === "GUIDED") t = identityTransform();
        else if (a.kind === "FIXED_WORLDSPACE") {
          const w = this.context.worldspace;
          t =
            w && w.id === a.worldspaceId && w.frameId === a.frameId
              ? composeTransform(w.localFromWorld, a.transform)
              : null;
        } else t = await this.adapter.resolve(a);
        if (epoch !== this.epoch) return;
        if (!t) {
          await this.useGuidedView();
          return;
        }
        anchors[a.id] = { id: a.id, version: 1, transform: resolvedTransformSchema.parse(t) };
      }
      this.update({
        anchors,
        state:
          this.adapter.mode === "GUIDED"
            ? "GUIDED_FALLBACK"
            : this.normalSamples >= 3 || this.adapter.mode === "SIMULATED"
              ? "READY"
              : "LEARNING_SPACE",
        guidance: this.adapter.mode === "GUIDED" ? guidance.UNSUPPORTED : guidance.NORMAL,
      });
      await this.draw();
    } catch {
      if (epoch === this.epoch) await this.useGuidedView();
    }
  }
  private onEvent(e: SpatialRuntimeEvent) {
    if (e.type === "TRACKING" && e.state === "INTERRUPTED") {
      void this.useGuidedView();
      return;
    }
    if (e.type === "ANCHOR_LOST") {
      this.normalSamples = 0;
      this.update({ state: "RELOCALIZING", tracking: "RELOCALIZING", guidance: guidance.RELOCALIZING });
      return;
    }
    if (e.state === "NORMAL") {
      if (++this.normalSamples >= 3)
        this.update({
          state: Object.keys(this.snapshot.anchors).length ? "READY" : "LEARNING_SPACE",
          tracking: e.state,
          guidance: guidance.NORMAL,
        });
    } else {
      this.normalSamples = 0;
      this.update({
        state:
          e.state === "INITIALIZING" || e.state === "MAPPING"
            ? "LEARNING_SPACE"
            : e.state === "RELOCALIZING"
              ? "RELOCALIZING"
              : "DEGRADED",
        tracking: e.state,
        guidance: guidance[e.state],
      });
    }
  }
  async useGuidedView() {
    const epoch = ++this.epoch;
    this.abort.abort();
    await this.adapter.stop().catch(() => undefined);
    if (epoch !== this.epoch) return;
    this.abort = new AbortController();
    this.adapter = new GuidedSpatialAdapter();
    const anchors = Object.fromEntries(
      this.moment.version.anchors.map((a) => [
        a.id,
        { id: a.id, version: this.snapshot.anchors[a.id]?.version ?? 1, transform: identityTransform() },
      ]),
    );
    this.update({
      state: "GUIDED_FALLBACK",
      mode: "GUIDED",
      tracking: "UNSUPPORTED",
      guidance: guidance.UNSUPPORTED,
      anchors,
    });
  }
  async updateDeviceContext(camera: CapabilityState) {
    this.context.camera = camera;
    if (this.adapter.mode === "NATIVE" && !this.usableCamera()) await this.useGuidedView();
  }
  private async draw() {
    const transforms = new Map<string, Transform>();
    const resolve = (id: string): Transform => {
      const found = transforms.get(id);
      if (found) return found;
      const e = this.moment.version.entities.find((x) => x.id === id)!;
      const t = composeTransform(
        e.parentEntityId ? resolve(e.parentEntityId) : this.snapshot.anchors[e.anchorId].transform,
        e.transform,
      );
      transforms.set(id, t);
      return t;
    };
    await this.adapter.render(
      this.moment.version.entities.map((e) => ({
        id: e.id,
        kind: e.kind,
        content: e.content,
        widthMeters: e.widthMeters,
        transform: resolve(e.id),
      })),
    );
  }
  async interact(
    entityId: string,
    type: InteractionReceipt["interactionType"],
    key: string,
  ): Promise<InteractionReceipt> {
    if (this.interactionPending) throw new Error("PARALLAX_INTERACTION_BUSY");
    const prior = this.ledger.get(key);
    if (prior) {
      if (prior.entityId !== entityId || prior.interactionType !== type)
        throw new Error("PARALLAX_IDEMPOTENCY_CONFLICT");
      return structuredClone(prior);
    }
    if (!["READY", "GUIDED_FALLBACK", "INTERACTING"].includes(this.snapshot.state))
      throw new Error("PARALLAX_LENS_NOT_READY");
    const entity = this.moment.version.entities.find((e) => e.id === entityId);
    if (!entity || !entity.interactions.includes(type)) throw new Error("PARALLAX_INTERACTION_FORBIDDEN");
    const anchor = this.snapshot.anchors[entity.anchorId];
    if (!anchor) throw new Error("PARALLAX_ANCHOR_UNRESOLVED");
    const epoch = this.epoch;
    this.interactionPending = true;
    this.update({ state: "INTERACTING" });
    try {
      if (type === "PLACE" && this.adapter.mode !== "GUIDED") {
        const a = this.moment.version.anchors.find((x) => x.id === entity.anchorId)!;
        if (a.kind !== "SURFACE_RELATIVE") {
          this.update({ state: "READY" });
          throw new Error("PARALLAX_PLACEMENT_NOT_AUTHORED");
        }
        const pose = await this.adapter.place(a.alignment);
        if (epoch !== this.epoch) throw new Error("PARALLAX_INTERACTION_CANCELLED");
        if (!pose) {
          this.update({ state: "READY" });
          throw new Error("PARALLAX_NO_SAFE_SURFACE");
        }
        if (this.snapshot.state !== "INTERACTING" && this.snapshot.state !== "READY")
          throw new Error("PARALLAX_TRACKING_UNSTABLE");
        const original = { transform: anchor.transform, version: anchor.version };
        anchor.transform = composeTransform(pose, a.transform);
        anchor.version++;
        try {
          await this.draw();
        } catch (error) {
          Object.assign(anchor, original);
          await this.useGuidedView();
          throw error;
        }
      }
      if (epoch !== this.epoch) throw new Error("PARALLAX_INTERACTION_CANCELLED");
      if (this.snapshot.state !== "INTERACTING" && this.snapshot.state !== "READY")
        throw new Error("PARALLAX_TRACKING_UNSTABLE");
      const { runId: _runId, ...binding } = this.binding;
      void _runId;
      const r = receiptSchema.parse({
        ...binding,
        schemaVersion: 1,
        interactionId: key,
        idempotencyKey: key,
        instanceId: this.instanceId,
        spatialDefinitionVersionId: this.moment.version.id,
        versionChecksum: this.moment.version.checksum,
        entityId,
        interactionType: type,
        anchorId: entity.anchorId,
        anchorVersion: anchor.version,
        observedAt: this.now().toISOString(),
        mode: this.adapter.mode,
        providerId: this.adapter.providerId,
        synthetic: this.adapter.mode === "SIMULATED",
        authority: "NONAUTHORITATIVE",
      });
      this.ledger.set(key, r);
      this.update({
        state: this.adapter.mode === "GUIDED" ? "GUIDED_FALLBACK" : "READY",
        selectedEntityId: entityId,
        ...(type === "INSPECT" ? { inspectedEntityId: entityId } : {}),
      });
      return structuredClone(r);
    } finally {
      this.interactionPending = false;
      if (this.epoch === epoch && this.snapshot.state === "INTERACTING")
        this.update({ state: this.adapter.mode === "GUIDED" ? "GUIDED_FALLBACK" : "READY" });
    }
  }
  async close() {
    const epoch = ++this.epoch;
    this.abort.abort();
    this.normalSamples = 0;
    await this.adapter.stop().catch(() => undefined);
    if (epoch !== this.epoch) return;
    this.update({ state: "CLOSED", anchors: {}, selectedEntityId: null, inspectedEntityId: null });
  }
}
