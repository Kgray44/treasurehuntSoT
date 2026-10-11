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
import { evaluateSpatialBehavior, type SpatialInput } from "./behavior";
import type { CapabilityState } from "@/sextant/contracts";
import {
  resolveAdaptiveScene,
  revalidateAdaptiveScene,
  minimizedResolutionReceipt,
  resolutionIdentity,
  type EnvironmentEvidence,
  type SceneResolution,
} from "./adaptive";
import { DiscoveryAssistance, type DiscoveryState, type SearchActivity } from "./discovery";

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
const bindingCrew = (binding: InstanceBinding) => binding.sessionId;
export type RuntimeMode = "GUIDED" | "NATIVE" | "SIMULATED";
export type SpatialRuntimeEvent =
  | { type: "TRACKING"; state: TrackingState }
  | { type: "ANCHOR_LOST"; anchorId: string };
export interface SpatialRuntimeAdapter {
  readonly providerId: string;
  readonly mode: RuntimeMode;
  readonly worldTracking: boolean;
  readonly planePlacement: boolean;
  start(context: {
    signal: AbortSignal;
    emit: (event: SpatialRuntimeEvent) => void;
    sceneIdentity?: { versionChecksum: string; instanceId: string };
  }): Promise<void>;
  resolve(anchor: Anchor): Promise<Transform | null>;
  place(alignment: "HORIZONTAL" | "VERTICAL"): Promise<Transform | null>;
  render(
    entities: readonly { id: string; kind: string; content: string; widthMeters: number; transform: Transform }[],
  ): Promise<void>;
  stop(): Promise<void>;
  environmentEvidence?(): Promise<EnvironmentEvidence | null>;
}
export type SpatialContext = {
  camera: CapabilityState;
  worldspace?: { id: string; frameId: string; localFromWorld: Transform };
  replayOnly: boolean;
  environment: "PRODUCTION" | "DEVICE_LAB";
  decisionStore?: {
    load: (key: string) => SceneResolution | null;
    save: (key: string, value: SceneResolution) => void;
  };
  searchClock?: () => number;
  searchTimeStore?: { load: (key: string) => number; save: (key: string, seconds: number) => void };
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
  visibleEntityIds: string[];
  highlightedEntityIds: string[];
  discovery?: Record<string, DiscoveryState>;
  resolution?: SceneResolution;
  resolutionReceipt?: ReturnType<typeof minimizedResolutionReceipt>;
  activeDiscoveryEntityId?: string;
  trackingRecovered?: boolean;
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
  private startedAt = 0;
  private spatialInputs: SpatialInput[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private readonly ledger = new Map<string, InteractionReceipt>();
  private readonly assistance = new Map<string, DiscoveryAssistance>();
  private resolution: SceneResolution | null = null;
  private discovered = new Set<string>();
  private resolutionKey = "";
  private trackingInterrupted = false;
  private searchInRegion = true;
  private snapshot: LensSnapshot = {
    state: "CLOSED",
    mode: "GUIDED",
    tracking: "UNSUPPORTED",
    guidance: guidance.UNSUPPORTED,
    selectedEntityId: null,
    inspectedEntityId: null,
    anchors: {},
    visibleEntityIds: [],
    highlightedEntityIds: [],
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
    for (const p of this.moment.version.adaptive?.discovery ?? [])
      this.assistance.set(
        p.entityId,
        new DiscoveryAssistance(p, this.context.searchTimeStore?.load(this.searchTimeKey(p.entityId))),
      );
  }
  private searchTimeKey(entityId: string) {
    return JSON.stringify([this.binding.actorId, this.instanceId, this.moment.version.checksum, entityId]);
  }
  private searchNow() {
    return this.context.searchClock?.() ?? this.now().getTime();
  }
  private activeDiscoveryEntityId() {
    const a = this.moment.version.adaptive;
    return (
      a?.revealOrder.find((id) => !this.discovered.has(id)) ??
      a?.discovery.find((p) => p.mandatory && !this.discovered.has(p.entityId))?.entityId
    );
  }
  read(): LensSnapshot {
    const snapshot = structuredClone(this.snapshot);
    if (snapshot.resolution) snapshot.resolutionReceipt = minimizedResolutionReceipt(snapshot.resolution);
    return snapshot;
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
    this.startedAt = this.now().getTime();
    this.spatialInputs = [
      { trigger: "SCENE_ENTER", atMs: 0 },
      { trigger: "TIMER", atMs: 0 },
    ];
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
        sceneIdentity: { versionChecksum: this.moment.version.checksum, instanceId: this.instanceId },
        emit: (e) => {
          if (epoch === this.epoch && !this.abort.signal.aborted) this.onEvent(e);
        },
      });
      if (epoch !== this.epoch) return;
      const anchors: Record<string, ResolvedAnchor> = {};
      if (this.moment.version.adaptive && this.adapter.mode !== "GUIDED") {
        const evidence = await this.adapter.environmentEvidence?.();
        if (!evidence || (evidence.source === "SIMULATED" && this.context.environment !== "DEVICE_LAB")) {
          await this.useGuidedView();
          return;
        }
        const v = this.moment.version;
        const identity = resolutionIdentity(v.placementPolicy, {
          definitionId: v.definitionId,
          versionId: v.id,
          versionChecksum: v.checksum,
          crewId: bindingCrew(this.binding),
          runId: this.binding.runId,
          actorId: this.binding.actorId,
          lifecycleId: v.adaptive!.lifecycle === "DEFINITION" ? v.definitionId : this.binding.runId,
          variant: v.adaptive!.variant,
        });
        const previousKey = this.resolutionKey;
        this.resolutionKey = JSON.stringify([identity.logicalIdentity, evidence.source, evidence.frameId]);
        const cached = this.context.decisionStore?.load(this.resolutionKey);
        const prior = cached ?? (previousKey === this.resolutionKey ? this.resolution : null);
        const resolved =
          prior && prior.versionChecksum === v.checksum
            ? revalidateAdaptiveScene(v, evidence, prior)
            : resolveAdaptiveScene(v, evidence, this.binding.resolutionSeed ?? identity.seed, v.checksum);
        if (!resolved) {
          this.resolution = prior;
          if (prior)
            this.update({
              resolution: {
                ...prior,
                status: "GUIDED_FALLBACK",
                quality: "NO_VALID_PLACEMENT",
                placements: {},
                diagnostics: [{ entityId: "scene", constraints: ["CACHED_PLACEMENT_NO_LONGER_VALID"] }],
              },
            });
          await this.useGuidedView();
          return;
        }
        this.resolution = resolved;
        if (this.resolution.status !== "RESOLVED") {
          this.update({ resolution: this.resolution });
          await this.useGuidedView();
          return;
        }
        this.context.decisionStore?.save(this.resolutionKey, this.resolution);
        this.update({ resolution: this.resolution });
      }
      for (const a of this.moment.version.anchors) {
        let t: Transform | null;
        if (this.adapter.mode === "GUIDED") t = identityTransform();
        else if (this.resolution && this.moment.version.adaptive) {
          const root = this.moment.version.entities.find((e) => e.anchorId === a.id && !e.parentEntityId);
          t = root ? (this.resolution.placements[root.id]?.transform ?? null) : null;
        } else if (a.kind === "FIXED_WORLDSPACE") {
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
      this.scheduleBehavior();
      this.updateSearchActivity({
        lensOpen: true,
        foreground: true,
        permission: true,
        tracking: this.snapshot.state === "READY" || this.snapshot.mode === "GUIDED",
        inSearchRegion: true,
      });
    } catch {
      if (epoch === this.epoch) await this.useGuidedView();
    }
  }
  private onEvent(e: SpatialRuntimeEvent) {
    this.updateSearchActivity({ tracking: false });
    if (e.type === "ANCHOR_LOST" || (e.type === "TRACKING" && e.state !== "NORMAL")) this.trackingInterrupted = true;
    if (
      this.moment.version.adaptive &&
      (e.type === "ANCHOR_LOST" || (e.type === "TRACKING" && ["LOST", "RELOCALIZING", "INTERRUPTED"].includes(e.state)))
    ) {
      void this.useGuidedView();
      return;
    }
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
      if (this.snapshot.state === "READY") {
        this.updateSearchActivity({ tracking: true });
        if (this.trackingInterrupted) this.update({ trackingRecovered: true });
      }
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
    this.timers.forEach(clearTimeout);
    this.timers = [];
    const epoch = ++this.epoch;
    this.abort.abort();
    this.normalSamples = 0;
    this.interactionPending = false;
    this.update({
      state: "DEGRADED",
      tracking: "INTERRUPTED",
      guidance: guidance.INTERRUPTED,
      selectedEntityId: null,
      inspectedEntityId: null,
    });
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
    await this.draw();
    this.updateSearchActivity({ lensOpen: true, permission: true, tracking: true, inSearchRegion: true });
  }
  updateSearchActivity(activity: Partial<SearchActivity>) {
    const atMs = this.searchNow();
    if (activity.inSearchRegion !== undefined) this.searchInRegion = activity.inSearchRegion;
    const activeEntity = this.activeDiscoveryEntityId();
    for (const [id, assistance] of this.assistance) {
      assistance.updateActivity(activity, atMs);
      assistance.updateActivity({ inSearchRegion: id === activeEntity && this.searchInRegion }, atMs);
      assistance.setConfidence(
        this.resolution?.placements[id]?.confidence ?? (this.snapshot.mode === "GUIDED" ? 1 : 0),
      );
    }
    if (this.assistance.size)
      this.update({
        activeDiscoveryEntityId: activeEntity,
        discovery: Object.fromEntries([...this.assistance].map(([id, a]) => [id, a.read()])),
      });
  }
  async tickDiscovery() {
    const states = Object.fromEntries([...this.assistance].map(([id, a]) => [id, a.tick(this.searchNow())]));
    for (const [id, state] of Object.entries(states))
      this.context.searchTimeStore?.save(this.searchTimeKey(id), state.meaningfulSeconds);
    this.update({ discovery: states });
    if (Object.values(states).some((s) => s.recovery === "GUIDED") && this.snapshot.mode !== "GUIDED")
      await this.useGuidedView();
  }
  async reveal() {
    await this.useGuidedView();
  }
  async updateDeviceContext(camera: CapabilityState) {
    this.context.camera = camera;
    if (this.adapter.mode === "NATIVE" && !this.usableCamera()) await this.useGuidedView();
  }
  private async draw() {
    const states = evaluateSpatialBehavior(
      this.moment.version,
      this.spatialInputs,
      this.now().getTime() - this.startedAt,
    );
    const a = this.moment.version.adaptive;
    const currentReveal = a?.revealOrder.find((id) => !this.discovered.has(id)) ?? a?.revealOrder.at(-1);
    const visible = this.moment.version.entities.filter((e) =>
      this.snapshot.mode === "GUIDED"
        ? this.moment.version.studio?.layers.find((l) => l.entityId === e.id)?.audience !== "EDITOR_ONLY"
        : states[e.id].visible && (!currentReveal || !a?.revealOrder.includes(e.id) || e.id === currentReveal),
    );
    this.update({
      visibleEntityIds: visible.map((e) => e.id),
      highlightedEntityIds: visible.filter((e) => states[e.id].highlighted).map((e) => e.id),
    });
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
      visible.map((e) => ({
        id: e.id,
        kind: e.kind,
        content: e.content,
        widthMeters: e.widthMeters,
        transform: resolve(e.id),
      })),
    );
  }
  private scheduleBehavior() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    const epoch = this.epoch;
    const elapsed = this.now().getTime() - this.startedAt;
    const due = new Set(
      (this.moment.version.studio?.behaviors ?? [])
        .flatMap((b) =>
          this.spatialInputs
            .filter((i) => i.trigger === b.trigger && (!b.sourceEntityId || i.entityId === b.sourceEntityId))
            .map((i) => i.atMs + b.delayMs),
        )
        .filter((t) => t > elapsed),
    );
    for (const time of due)
      this.timers.push(
        setTimeout(
          () => {
            if (epoch === this.epoch && !this.abort.signal.aborted) void this.draw().catch(() => this.useGuidedView());
          },
          time - elapsed + 1,
        ),
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
    const layer = this.moment.version.studio?.layers.find((l) => l.entityId === entityId);
    if (!this.snapshot.visibleEntityIds.includes(entityId) || layer?.selectable === false)
      throw new Error("PARALLAX_INTERACTION_FORBIDDEN");
    const anchor = this.snapshot.anchors[entity.anchorId];
    if (!anchor) throw new Error("PARALLAX_ANCHOR_UNRESOLVED");
    const epoch = this.epoch;
    this.interactionPending = true;
    this.update({ state: "INTERACTING" });
    try {
      if (type === "PLACE" && this.adapter.mode !== "GUIDED") {
        if (this.moment.version.adaptive) throw new Error("PARALLAX_ADAPTIVE_PLACEMENT_STABLE");
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
      const { sessionId, chronicleVersionId, blockId, actorId } = this.binding;
      const binding = { sessionId, chronicleVersionId, blockId, actorId };
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
      this.discovered.add(entityId);
      this.updateSearchActivity({});
      this.spatialInputs.push({ trigger: type, entityId, atMs: this.now().getTime() - this.startedAt });
      await this.draw();
      this.scheduleBehavior();
      this.update({
        state: this.adapter.mode === "GUIDED" ? "GUIDED_FALLBACK" : "READY",
        selectedEntityId: entityId,
        ...(type === "INSPECT" ? { inspectedEntityId: entityId } : {}),
      });
      return structuredClone(r);
    } finally {
      if (this.epoch === epoch) this.interactionPending = false;
      if (this.epoch === epoch && this.snapshot.state === "INTERACTING")
        this.update({ state: this.adapter.mode === "GUIDED" ? "GUIDED_FALLBACK" : "READY" });
    }
  }
  async close() {
    this.updateSearchActivity({ lensOpen: false, tracking: false });
    for (const [id, assistance] of this.assistance)
      this.context.searchTimeStore?.save(this.searchTimeKey(id), assistance.read().meaningfulSeconds);
    const epoch = ++this.epoch;
    this.abort.abort();
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.normalSamples = 0;
    this.interactionPending = false;
    this.update({ state: "CLOSED", anchors: {}, selectedEntityId: null, inspectedEntityId: null });
    await this.adapter.stop().catch(() => undefined);
    if (epoch !== this.epoch) return;
    this.update({ state: "CLOSED", anchors: {}, selectedEntityId: null, inspectedEntityId: null });
  }
}
