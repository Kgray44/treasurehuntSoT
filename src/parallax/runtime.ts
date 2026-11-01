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
import { evaluateSpatialScene, runtimePresentableEntityIds, type SpatialInput } from "./behavior";
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
import { createSceneDelivery, type SceneDelivery } from "./scene-delivery";
import type { SpatialVersion } from "./contracts";

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
export type RuntimeMode = "GUIDED" | "NATIVE" | "BROWSER" | "SIMULATED";
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
    scene?: SpatialVersion;
  }): Promise<void>;
  resolve(anchor: Anchor): Promise<Transform | null>;
  place(alignment: "HORIZONTAL" | "VERTICAL", anchor?: Anchor): Promise<Transform | null>;
  render(
    entities: readonly {
      id: string;
      kind: string;
      content: string;
      widthMeters: number;
      transform: Transform;
      opacity?: number;
    }[],
  ): Promise<void>;
  stop(): Promise<void>;
  supportsScene?(scene: SpatialVersion): boolean;
  renderScene?(scene: SceneDelivery): Promise<void>;
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
  motionPreference?: () => "full" | "gentle" | "reduced";
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
  private renderedBehaviorAt = 0;
  private spatialInputs: SpatialInput[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private renderTail: Promise<void> = Promise.resolve();
  private cinematicTake = 0;
  private animationTimer: ReturnType<typeof setTimeout> | undefined;
  private animationGeneration = 0;
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
    this.renderedBehaviorAt = 0;
    this.cinematicTake = Math.floor(Math.random() * 2147483647);
    this.spatialInputs = [
      { trigger: "SCENE_ENTER", atMs: 0 },
      { trigger: "TIMER", atMs: 0 },
    ];
    if (candidate?.mode === "SIMULATED" && this.context.environment !== "DEVICE_LAB")
      throw new Error("PARALLAX_SIMULATION_FORBIDDEN");
    this.adapter =
      candidate &&
      (!candidate.supportsScene || candidate.supportsScene(this.moment.version)) &&
      (!this.moment.version.entities.some((e) => e.element?.enabled) || !!candidate.renderScene) &&
      (candidate.mode === "SIMULATED" ||
        (["NATIVE", "BROWSER"].includes(candidate.mode) && candidate.worldTracking && this.usableCamera()))
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
      if (this.adapter.mode === "BROWSER" && (!this.adapter.worldTracking || !this.usableCamera()))
        throw new Error("Browser AR requires an active authorized camera and world-tracking provider.");
      await this.adapter.start({
        signal: this.abort.signal,
        sceneIdentity: { versionChecksum: this.moment.version.checksum, instanceId: this.instanceId },
        scene: this.moment.version,
        emit: (e) => {
          if (epoch === this.epoch && !this.abort.signal.aborted) this.onEvent(e);
        },
      });
      if (epoch !== this.epoch) return;
      const anchors: Record<string, ResolvedAnchor> = {};
      if (this.adapter.mode === "BROWSER" && this.moment.version.adaptive)
        throw new Error(
          "Browser tracking currently requires a room-aligned authored scene. Adaptive physical surface evidence is not available.",
        );
      if (this.moment.version.adaptive && this.adapter.mode !== "GUIDED") {
        const evidence = await this.adapter.environmentEvidence?.();
        if (epoch !== this.epoch) return;
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
        } else if (this.adapter.mode === "BROWSER") t = await this.adapter.resolve(a);
        else if (a.kind === "FIXED_WORLDSPACE") {
          const w = this.context.worldspace;
          t =
            w && w.id === a.worldspaceId && w.frameId === a.frameId
              ? composeTransform(w.localFromWorld, a.transform)
              : null;
        } else t = await this.adapter.resolve(a);
        if (epoch !== this.epoch) return;
        if (!t) {
          if (this.adapter.mode === "BROWSER")
            throw new Error("Room alignment must be completed before opening this spatial scene.");
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
      if (epoch !== this.epoch) return;
      this.scheduleBehavior();
      this.updateSearchActivity({
        lensOpen: true,
        foreground: true,
        permission: true,
        tracking: this.snapshot.state === "READY" || this.snapshot.mode === "GUIDED",
        inSearchRegion: true,
      });
    } catch (cause) {
      if (epoch === this.epoch) await this.presentationFailure(cause);
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
    if (e.type === "TRACKING" && e.state === "INTERRUPTED" && this.adapter.mode !== "BROWSER") {
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
  /** Browser AR attempts remain explicit. A failed or interrupted attempt never silently becomes Guided. */
  private async presentationFailure(cause?: unknown) {
    if (this.adapter.mode !== "BROWSER") return this.useGuidedView({ cause });
    const epoch = this.epoch;
    clearTimeout(this.animationTimer);
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.normalSamples = 0;
    this.updateSearchActivity({ tracking: false });
    await this.adapter.stop().catch(() => undefined);
    if (epoch !== this.epoch) return;
    this.update({
      state: "DEGRADED",
      tracking: "LOST",
      guidance:
        cause instanceof Error
          ? cause.message
          : "Browser tracking stopped. Restart and align again, or choose Guided View.",
      anchors: {},
      visibleEntityIds: [],
    });
  }
  async useGuidedView(options: { inspection?: InteractionReceipt; cause?: unknown } = {}) {
    if (this.snapshot.state === "CLOSED") return;
    const parsed = receiptSchema.safeParse(options.inspection);
    const inspection = parsed.success ? parsed.data : undefined;
    const retained = inspection && this.ledger.get(inspection.idempotencyKey);
    const inspectedEntityId =
      retained?.interactionType === "INSPECT" &&
      retained.entityId === inspection?.entityId &&
      retained.instanceId === this.instanceId &&
      retained.versionChecksum === this.moment.version.checksum &&
      JSON.stringify(retained) === JSON.stringify(inspection)
        ? retained.entityId
        : null;
    clearTimeout(this.animationTimer);
    this.timers.forEach(clearTimeout);
    this.timers = [];
    const epoch = ++this.epoch;
    this.abort.abort();
    this.renderTail = Promise.resolve();
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
      guidance:
        options.cause instanceof Error && options.cause.message === "PARALLAX_NATIVE_OPACITY_UNSUPPORTED"
          ? "This companion cannot preview opacity animation. Guided View keeps the clue available; update the companion to preview fading."
          : guidance.UNSUPPORTED,
      anchors,
    });
    await this.draw();
    if (epoch !== this.epoch) return;
    if (inspectedEntityId && this.snapshot.visibleEntityIds.includes(inspectedEntityId))
      this.update({ selectedEntityId: inspectedEntityId, inspectedEntityId });
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
    if (
      Object.values(states).some((s) => s.recovery === "GUIDED") &&
      !["GUIDED", "BROWSER"].includes(this.snapshot.mode)
    )
      await this.useGuidedView();
  }
  async reveal() {
    await this.useGuidedView();
  }
  async updateDeviceContext(camera: CapabilityState) {
    this.context.camera = camera;
    if (["NATIVE", "BROWSER"].includes(this.adapter.mode) && !this.usableCamera()) await this.useGuidedView();
  }
  private presentation(elapsed = this.now().getTime() - this.startedAt) {
    const { states } = evaluateSpatialScene(
      this.moment.version,
      this.spatialInputs,
      elapsed,
      false,
      { take: this.cinematicTake, motion: this.context.motionPreference?.() },
    );
    const adaptive = this.moment.version.adaptive;
    const currentReveal = adaptive?.revealOrder.find((id) => !this.discovered.has(id)) ?? adaptive?.revealOrder.at(-1);
    const presentable = runtimePresentableEntityIds(this.moment.version);
    const visible = this.moment.version.entities.filter((entity) =>
      this.snapshot.mode === "GUIDED"
        ? presentable.has(entity.id)
        : presentable.has(entity.id) &&
          states[entity.id].visible &&
          states[entity.id].opacity !== 0 &&
          (!currentReveal || !adaptive?.revealOrder.includes(entity.id) || entity.id === currentReveal),
    );
    return { visible, states, highlightedEntityIds: visible.filter((entity) => states[entity.id].highlighted).map((entity) => entity.id) };
  }
  private draw(): Promise<void> {
    if (this.adapter.mode === "BROWSER" && !Object.keys(this.snapshot.anchors).length) return Promise.resolve();
    const epoch = this.epoch,
      adapter = this.adapter,
      signal = this.abort.signal;
    const current = () => epoch === this.epoch && !signal.aborted;
    const render = this.renderTail.then(async () => {
      // A staged model can outlive stop or reopen. Obsolete work never observes
      // a later session's anchors or adapter, and close does not wait on it.
      while (current()) {
        const { visible, states, highlightedEntityIds } = this.presentation();
        const visibleEntityIds = visible.map((entity) => entity.id);
        this.update({ visibleEntityIds, highlightedEntityIds });
        if (!current()) return;
        const transforms = new Map<string, Transform>();
        const resolve = (id: string): Transform => {
          const found = transforms.get(id);
          if (found) return found;
          const entity = this.moment.version.entities.find((candidate) => candidate.id === id)!;
          const transform = composeTransform(
            entity.parentEntityId ? resolve(entity.parentEntityId) : this.snapshot.anchors[entity.anchorId].transform,
            states[id].transform,
          );
          transforms.set(id, transform);
          return transform;
        };
        // Hidden parents still contribute their canonical transforms.
        for (const entity of this.moment.version.entities) resolve(entity.id);
        if (adapter.renderScene && (adapter.mode === "NATIVE" || this.moment.version.entities.some((e) => e.element?.enabled))) {
          await adapter.renderScene(
            createSceneDelivery({
              version: this.moment.version,
              instanceId: this.instanceId,
              playthroughId: this.binding.sessionId,
              blockId: this.binding.blockId,
              transforms,
              visibleEntityIds,
              opacityByEntityId: new Map(Object.entries(states).map(([id, state]) => [id, state.opacity ?? 1])),
              elapsedMs: this.now().getTime() - this.startedAt,
              reducedMotion: typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
            }),
          );
        } else {
          await adapter.render(
            visible.map((entity) => ({
              id: entity.id,
              kind: entity.kind,
              content: entity.content,
              widthMeters: entity.widthMeters,
              ...(states[entity.id].opacity !== undefined ? { opacity: states[entity.id].opacity } : {}),
              transform: resolve(entity.id),
            })),
          );
        }
        if (!current()) return;
        const latestAt = this.now().getTime() - this.startedAt;
        const latest = this.presentation(latestAt);
        const signature = (view: typeof latest) => JSON.stringify([
          view.visible.map((entity) => [entity.id, view.states[entity.id].transform, view.states[entity.id].opacity]),
          view.highlightedEntityIds,
        ]);
        if (signature({ visible, states, highlightedEntityIds }) === signature(latest)) {
          this.renderedBehaviorAt = latestAt;
          return;
        }
      }
    });
    this.renderTail = render.catch(() => undefined);
    return render;
  }
  private scheduleBehavior() {
    clearTimeout(this.animationTimer);
    const animationGeneration = ++this.animationGeneration;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    const epoch = this.epoch;
    const elapsed = this.now().getTime() - this.startedAt;
    const lastFrame = Math.max(
      0,
      ...(this.moment.version.studio?.animationTracks ?? [])
        .filter((t) => t.enabled)
        .flatMap((t) => t.keyframes.map((f) => f.atMs)),
    );
    const animate = () => {
      if (
        epoch !== this.epoch ||
        animationGeneration !== this.animationGeneration ||
        this.abort.signal.aborted ||
        this.snapshot.mode === "GUIDED"
      )
        return;
      this.animationTimer = setTimeout(async () => {
        if (epoch !== this.epoch || animationGeneration !== this.animationGeneration || this.abort.signal.aborted)
          return;
        try {
          await this.draw();
          if (this.now().getTime() - this.startedAt < lastFrame) animate();
        } catch (cause) {
          if (epoch === this.epoch) await this.presentationFailure(cause);
        }
      }, 33);
    };
    if (lastFrame > elapsed) animate();
    const due = new Set(
      (this.moment.version.studio?.behaviors ?? [])
        .flatMap((b) =>
          this.spatialInputs
            .filter((i) => i.trigger === b.trigger && (!b.sourceEntityId || i.entityId === b.sourceEntityId))
            .map((i) => i.atMs + b.delayMs),
        )
        .filter((t) => t > this.renderedBehaviorAt),
    );
    for (const time of due)
      this.timers.push(
        setTimeout(
          () => {
            if (epoch === this.epoch && !this.abort.signal.aborted)
              void this.draw().catch((cause) => {
                if (epoch === this.epoch) return this.presentationFailure(cause);
              });
          },
          Math.max(0, time - elapsed + 1),
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
        const pose = await this.adapter.place(a.alignment, a);
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
          if (epoch === this.epoch) {
            Object.assign(anchor, original);
            await this.presentationFailure(error);
          }
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
      if (epoch !== this.epoch) throw new Error("PARALLAX_INTERACTION_CANCELLED");
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
    this.renderTail = Promise.resolve();
    this.timers.forEach(clearTimeout);
    clearTimeout(this.animationTimer);
    this.timers = [];
    this.normalSamples = 0;
    this.interactionPending = false;
    this.update({
      state: "CLOSED",
      anchors: {},
      selectedEntityId: null,
      inspectedEntityId: null,
      visibleEntityIds: [],
      highlightedEntityIds: [],
    });
    await this.adapter.stop().catch(() => undefined);
    if (epoch !== this.epoch) return;
    this.update({
      state: "CLOSED",
      anchors: {},
      selectedEntityId: null,
      inspectedEntityId: null,
      visibleEntityIds: [],
      highlightedEntityIds: [],
    });
  }
}
