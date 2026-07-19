import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PresentationFallbackHandler,
  ResolvedMotionPolicy,
  SceneTargetContract,
  SceneTargetContractV2,
  SceneTimeline,
} from "../core/animation-types";
import { readAnimationMetrics, resetAnimationMetrics } from "../core/metrics";
import { animationOwnerFor, claimAnimationOwnership, releaseAnimationOwnership } from "../core/ownership";
import { readPresentationTelemetry, resetPresentationTelemetry } from "../core/presentation-telemetry";
import { defaultSceneCleanupPolicy } from "../core/final-state-handoff";
import { SceneHostRegistry } from "../hosts/scene-host-registry";
import type { SceneBuildTargetAccess, SceneTargetUseResult } from "../hosts/scene-host-types";

const harness = vi.hoisted(() => {
  type Callback = (() => void) | null;
  const played: string[] = [];
  const rendered: string[] = [];
  const built: string[] = [];
  const killed: string[] = [];
  const timelines: FakeTimeline[] = [];
  const cleanup = vi.fn();
  const reverted = vi.fn();
  const state = {
    contract: undefined as unknown,
    autoComplete: new Set(["opening", "success", "failure"]),
    playThrows: new Set<string>(),
    builderThrows: false,
    cleanupThrows: false,
    revertThrows: false,
    lastMotionPolicy: undefined as unknown,
    lastContextHadRoot: false,
    lastBuildTargetUse: undefined as SceneTargetUseResult<void> | undefined,
    lastOptionalTargetCount: undefined as number | undefined,
    beforeSemanticEmit: undefined as (() => void) | undefined,
    semanticEmitters: [] as Array<(label: string) => void>,
    successLabels: ["semantic-ready", "scene-complete"],
  };

  class FakeTimeline {
    labels: Record<string, number> = { safe: 0.5 };
    private callbacks = new Map<string, Callback>();
    private value = 0;
    private finished = false;
    private emitted = false;

    constructor(
      readonly kind: string,
      private emit?: () => void,
    ) {
      timelines.push(this);
    }

    eventCallback(name: string, callback: Callback) {
      this.callbacks.set(name, callback);
      return this;
    }

    play() {
      played.push(this.kind);
      if (state.playThrows.has(this.kind)) throw new Error(`${this.kind} failed`);
      this.emitOnce();
      if (state.autoComplete.has(this.kind)) queueMicrotask(() => this.complete("onComplete"));
      return this;
    }

    progress(value?: number, suppressEvents?: boolean) {
      if (value === undefined) return this.value;
      this.value = value;
      rendered.push(this.kind);
      this.emitOnce();
      this.callbacks.get("onUpdate")?.();
      if (value === 1 && suppressEvents === false) queueMicrotask(() => this.complete("onComplete"));
      return this;
    }

    complete(name = "onComplete") {
      if (this.finished) return;
      this.finished = true;
      this.value = 1;
      this.callbacks.get("onUpdate")?.();
      this.callbacks.get(name)?.();
    }

    private emitOnce() {
      if (this.emitted) return;
      this.emitted = true;
      state.beforeSemanticEmit?.();
      this.emit?.();
    }

    timeScale() {
      return this;
    }

    pause() {
      return this;
    }

    resume() {
      return this;
    }

    seek() {
      return this;
    }

    reverse() {
      queueMicrotask(() => this.complete("onReverseComplete"));
      return this;
    }

    kill() {
      killed.push(this.kind);
      return this;
    }
  }

  const timeline = (kind: string, emit?: () => void) => new FakeTimeline(kind, emit) as unknown as SceneTimeline;
  const complete = (kind: string) => timelines.findLast((timeline) => timeline.kind === kind)?.complete();
  const definition = () => ({
    name: "player-access",
    reversible: true,
    contract: state.contract,
    buildOpening: (context: {
      addCleanup: (cleanup: () => void) => void;
      emitLabel: (label: string) => void;
      motionPolicy?: unknown;
      root?: HTMLElement;
      targets?: SceneBuildTargetAccess;
    }) => {
      built.push("opening");
      state.lastMotionPolicy = context.motionPolicy;
      state.lastContextHadRoot = "root" in context;
      state.lastOptionalTargetCount = context.targets?.get("optional-panel")?.targets.length;
      state.lastBuildTargetUse = context.targets
        ?.require("panel")
        .one()
        ?.withElement("opacity", (element) => element.setAttribute("data-v2-builder-used", "yes"));
      context.addCleanup(() => {
        cleanup();
        if (state.cleanupThrows) throw new Error("cleanup failed");
      });
      if (state.builderThrows) throw new Error("builder failed");
      state.semanticEmitters.push(context.emitLabel);
      return timeline("opening", () => context.emitLabel("opening-ready"));
    },
    buildIdle: () => {
      built.push("idle");
      return timeline("idle");
    },
    buildSuccess: (context: { emitLabel: (label: string) => void }) => {
      built.push("success");
      state.semanticEmitters.push(context.emitLabel);
      return timeline("success", () => state.successLabels.forEach((label) => context.emitLabel(label)));
    },
    buildFailure: (context: { emitLabel: (label: string) => void }) => {
      built.push("failure");
      return timeline("failure", () => context.emitLabel("failure-readable"));
    },
  });

  return { built, cleanup, complete, definition, killed, played, rendered, reverted, state, timelines };
});

vi.mock("../core/gsap-client", () => ({
  gsap: {
    context: (build: () => void) => {
      build();
      return {
        revert: () => {
          harness.reverted();
          if (harness.state.revertThrows) throw new Error("revert failed");
        },
      };
    },
  },
}));

vi.mock("./scene-registry", () => ({
  getSceneDefinition: () => harness.definition(),
}));

import {
  ANIMATION_SEMANTIC_LABEL_EVENT_NAME,
  AnimationDirector,
  type AnimationSemanticLabelEvent,
  type AnimationSemanticLabelEventDetail,
} from "./AnimationDirector";

const visibleRule = {
  mustBeConnected: true,
  mustHaveNonZeroBox: true,
  mustNotBeDisplayNone: true,
  mustNotBeVisibilityHidden: true,
  minimumEffectiveOpacity: 0.01,
  mustIntersectHost: true,
  mustIntersectViewport: false,
  rejectPageFlipSource: true,
  rejectStaleSceneInstance: true,
} as const;

function contract(overrides: Partial<SceneTargetContract> = {}): SceneTargetContract {
  return {
    version: 1,
    sceneName: "player-access",
    reachability: "production",
    expectedHostKind: "test-host",
    requiredTargets: [
      {
        part: "target",
        required: true,
        cardinality: { min: 1, max: 1 },
        visibility: visibleRule,
        owner: "gsap",
        properties: ["opacity"],
      },
    ],
    optionalTargets: [],
    timeoutMs: 500,
    playbackPolicy: {
      source: "automatic",
      replayable: false,
      allowUserSkip: true,
      userSkipFinalState: "skipped-readable",
      allowPolicySkip: true,
      priority: 50,
    },
    acknowledgmentPolicy: {
      kind: "mandatory",
      acknowledgeOn: ["presented", "presented-fallback", "skipped-by-user"],
      fallbackMustBeReadable: true,
      acknowledgmentOwner: "player-presentation",
    },
    finalStatePolicy: { kind: "reconcile-then-revert", semanticState: "semantic-ready" },
    reducedFallback: "semantic-final-state",
    ...overrides,
  };
}

function rect() {
  return { x: 0, y: 0, width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100, toJSON: () => ({}) };
}

function fixture(targetCount = 1) {
  const root = document.createElement("main");
  root.dataset.sceneHostId = "test-host-id";
  root.dataset.sceneHostKind = "test-host";
  root.getBoundingClientRect = vi.fn(() => rect());
  for (let index = 0; index < targetCount; index += 1) {
    const target = document.createElement("div");
    target.dataset.scenePart = "target";
    target.getBoundingClientRect = vi.fn(() => rect());
    root.append(target);
  }
  document.body.append(root);
  return { root, targets: Array.from(root.querySelectorAll<HTMLElement>("[data-scene-part='target']")) };
}

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

const directors: AnimationDirector[] = [];
function director(mode: "full" | "gentle" | "reduced" = "full") {
  const value = new AnimationDirector(mode);
  directors.push(value);
  return value;
}

function observeSemanticLabels() {
  const events: AnimationSemanticLabelEventDetail[] = [];
  const listener = ((event: Event) => {
    events.push((event as AnimationSemanticLabelEvent).detail);
  }) as EventListener;
  window.addEventListener(ANIMATION_SEMANTIC_LABEL_EVENT_NAME, listener);
  return {
    events,
    stop: () => window.removeEventListener(ANIMATION_SEMANTIC_LABEL_EVENT_NAME, listener),
  };
}

describe("AnimationDirector presentation receipts", () => {
  beforeEach(() => {
    harness.built.length = 0;
    harness.killed.length = 0;
    harness.played.length = 0;
    harness.rendered.length = 0;
    harness.timelines.length = 0;
    harness.cleanup.mockClear();
    harness.reverted.mockClear();
    harness.state.contract = contract();
    harness.state.autoComplete = new Set(["opening", "success", "failure"]);
    harness.state.playThrows.clear();
    harness.state.builderThrows = false;
    harness.state.cleanupThrows = false;
    harness.state.revertThrows = false;
    harness.state.lastMotionPolicy = undefined;
    harness.state.lastContextHadRoot = false;
    harness.state.lastBuildTargetUse = undefined;
    harness.state.lastOptionalTargetCount = undefined;
    harness.state.beforeSemanticEmit = undefined;
    harness.state.semanticEmitters.length = 0;
    harness.state.successLabels = ["semantic-ready", "scene-complete"];
    resetAnimationMetrics();
    resetPresentationTelemetry();
  });

  afterEach(() => {
    directors.splice(0).forEach((value) => value.kill());
    document.body.innerHTML = "";
    resetAnimationMetrics();
    resetPresentationTelemetry();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns a successful receipt with operation result, labels, target evidence, and compatibility fields", async () => {
    const { root } = fixture();
    root.dataset.sceneHostId = "access-host";
    root.dataset.sceneHostKind = "access";
    harness.state.contract = contract({ expectedHostKind: "access" });
    const operation = vi.fn(async () => ({ event: { id: "event-1", sequence: 4 } }));

    const receipt = await director().play("player-access", {
      root,
      hostId: "access-host",
      hostKind: "access",
      requestSource: "operation",
      eventOrActionId: "event-1",
      operation,
    });

    expect(receipt).toMatchObject({
      sceneName: "player-access",
      hostId: "access-host",
      hostKind: "access",
      requestSource: "operation",
      eventOrActionId: "event-1",
      outcome: "presented",
      finalSemanticState: "semantic-ready",
      acknowledgmentAllowed: true,
      cleanup: "completed",
      operationResult: { event: { id: "event-1", sequence: 4 } },
      event: { id: "event-1", sequence: 4 },
    });
    expect(receipt.sceneInstanceId).toBeTruthy();
    expect(receipt.targetReport.requiredSatisfied).toBe(true);
    expect(receipt.semanticLabelsReached).toEqual(["opening-ready", "semantic-ready", "scene-complete"]);
    expect(operation).toHaveBeenCalledOnce();
    expect(readAnimationMetrics().gsap).toBe(0);
  });

  it("dispatches frozen, content-free semantic label events in exact occurrence order", async () => {
    const { root } = fixture();
    const observed = observeSemanticLabels();
    harness.state.successLabels = ["semantic-ready", "pulse", "pulse", "scene-complete"];

    const receipt = await director("gentle").play("player-access", {
      root,
      eventOrActionId: "event-17",
      requestSource: "replay",
      display: {
        chapterTitle: "private chapter title",
        objective: "private objective",
        campaignSecret: "private campaign data",
      },
    });
    observed.stop();

    expect(observed.events.map(({ label }) => label)).toEqual([
      "opening-ready",
      "semantic-ready",
      "pulse",
      "pulse",
      "scene-complete",
    ]);
    expect(observed.events).toHaveLength(5);
    for (const detail of observed.events) {
      expect(Object.keys(detail).sort()).toEqual(
        [
          "version",
          "sceneName",
          "sceneInstanceId",
          "hostId",
          "hostKind",
          "eventOrActionId",
          "requestSource",
          "label",
          "elapsedMs",
          "motionLevel",
        ].sort(),
      );
      expect(detail).toMatchObject({
        version: 1,
        sceneName: "player-access",
        sceneInstanceId: receipt.sceneInstanceId,
        hostId: "test-host-id",
        hostKind: "test-host",
        eventOrActionId: "event-17",
        requestSource: "replay",
        motionLevel: "gentle",
      });
      expect(detail.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(Object.isFrozen(detail)).toBe(true);
    }
    expect(JSON.stringify(observed.events)).not.toContain("private");
    expect(receipt.semanticLabelsReached).toEqual(["opening-ready", "semantic-ready", "pulse", "scene-complete"]);
  });

  it("suppresses semantic labels emitted after abort or a completed instance becomes stale", async () => {
    const { root } = fixture();
    const observed = observeSemanticLabels();
    const abort = new AbortController();
    harness.state.autoComplete.delete("opening");
    const pending = director().play("player-access", { root, signal: abort.signal });
    await waitFor(() => expect(observed.events.map(({ label }) => label)).toEqual(["opening-ready"]));

    abort.abort();
    const aborted = await pending;
    const abortedEmitters = [...harness.state.semanticEmitters];
    abortedEmitters.forEach((emit) => emit("stale-after-abort"));

    expect(aborted.outcome).toBe("aborted");
    expect(observed.events.map(({ label }) => label)).toEqual(["opening-ready"]);

    harness.state.autoComplete.add("opening");
    harness.state.semanticEmitters.length = 0;
    const completed = await director().play("player-access", { root: fixture().root });
    const labelsAtCompletion = observed.events.map(({ label }) => label);
    harness.state.semanticEmitters.forEach((emit) => emit("stale-after-completion"));
    observed.stop();

    expect(completed.outcome).toBe("presented");
    expect(observed.events.map(({ label }) => label)).toEqual(labelsAtCompletion);
  });

  it("keeps semantic label emission safe when no browser window exists", async () => {
    const { root } = fixture();
    harness.state.beforeSemanticEmit = () => {
      harness.state.beforeSemanticEmit = undefined;
      vi.stubGlobal("window", undefined);
    };

    const receipt = await director().play("player-access", { root });
    vi.unstubAllGlobals();

    expect(receipt).toMatchObject({ outcome: "presented" });
    expect(receipt.semanticLabelsReached).toEqual(["opening-ready", "semantic-ready", "scene-complete"]);
  });

  it("requires explicit, agreeing production host identity before preflight", async () => {
    const missing = fixture();
    delete missing.root.dataset.sceneHostId;
    delete missing.root.dataset.sceneHostKind;

    const missingReceipt = await director().play("player-access", { root: missing.root });

    expect(missingReceipt).toMatchObject({
      outcome: "runtime-failed",
      hostKind: "unverified",
      acknowledgmentAllowed: false,
    });
    expect(missingReceipt.targetReport.observations).toEqual([]);
    expect(harness.built).toEqual([]);

    const mismatched = fixture();
    const mismatchedReceipt = await director().play("player-access", {
      root: mismatched.root,
      hostId: "different-host",
      hostKind: "different-kind",
    });
    expect(mismatchedReceipt.outcome).toBe("runtime-failed");
    expect(mismatchedReceipt.acknowledgmentAllowed).toBe(false);
    expect(harness.built).toEqual([]);
  });

  it("does not treat timeline completion without the semantic completion checkpoint as presented", async () => {
    const { root } = fixture();
    harness.state.successLabels = ["semantic-ready"];

    const receipt = await director().play("player-access", { root });

    expect(receipt).toMatchObject({
      outcome: "runtime-failed",
      acknowledgmentAllowed: false,
    });
    expect(receipt.finalSemanticState).toBeUndefined();
    expect(receipt.semanticLabelsReached).toEqual(["opening-ready", "semantic-ready"]);
    expect(harness.reverted).toHaveBeenCalledOnce();
  });

  it("does not invent a final semantic state when the contract declares immediate reversion", async () => {
    const { root } = fixture();
    harness.state.contract = contract({ finalStatePolicy: { kind: "revert-immediately" } });

    const receipt = await director().play("player-access", { root });

    expect(receipt.semanticLabelsReached).toContain("scene-complete");
    expect(receipt.outcome).toBe("runtime-failed");
    expect(receipt.finalSemanticState).toBeUndefined();
    expect(receipt.acknowledgmentAllowed).toBe(false);
  });

  it("fails missing targets before builders, operation, or timelines start", async () => {
    const { root } = fixture(0);
    const operation = vi.fn(async () => "must-not-run");

    const receipt = await director().play("player-access", { root, operation });

    expect(receipt.outcome).toBe("missing-required-target");
    expect(receipt.acknowledgmentAllowed).toBe(false);
    expect(harness.built).toEqual([]);
    expect(harness.played).toEqual([]);
    expect(operation).not.toHaveBeenCalled();
  });

  it("reports duplicate required targets with higher specificity than generic failure", async () => {
    const { root } = fixture(2);

    const receipt = await director().play("player-access", { root });

    expect(receipt.outcome).toBe("duplicate-required-target");
    expect(receipt.targetReport.failures).toContainEqual({ part: "target", code: "duplicate-required-target" });
    expect(harness.built).toEqual([]);
  });

  it("reports ownership rejection and releases no foreign claim", async () => {
    const { root, targets } = fixture();
    claimAnimationOwnership(targets[0], "motion", ["opacity"]);

    const receipt = await director().play("player-access", { root });

    expect(receipt.outcome).toBe("ownership-rejected");
    expect(animationOwnerFor(targets[0], "opacity")).toBe("motion");
    expect(harness.built).toEqual([]);
    releaseAnimationOwnership(targets[0], "motion");
  });

  it("uses an approved fallback only after an explicit readable completion result", async () => {
    const { root } = fixture(0);
    harness.state.contract = contract({
      playbackPolicy: { ...contract().playbackPolicy, allowedFallback: "readable-access" },
    });
    const presentationFallback = vi.fn<PresentationFallbackHandler>(async (context) => {
      expect(context).toMatchObject({ fallback: "readable-access", trigger: "missing-required-target" });
      return { completed: true, readable: true, semanticState: "access-readable" };
    });

    const receipt = await director().play("player-access", { root, presentationFallback });

    expect(receipt).toMatchObject({
      outcome: "presented-fallback",
      fallbackUsed: "readable-access",
      finalSemanticState: "access-readable",
      acknowledgmentAllowed: true,
    });
    expect(presentationFallback).toHaveBeenCalledOnce();
  });

  it("does not infer fallback success from contract metadata alone", async () => {
    const { root } = fixture(0);
    harness.state.contract = contract({
      playbackPolicy: { ...contract().playbackPolicy, allowedFallback: "readable-access" },
    });

    const receipt = await director().play("player-access", { root });

    expect(receipt.outcome).toBe("missing-required-target");
    expect(receipt.fallbackUsed).toBeUndefined();
  });

  it("does not accept an incomplete fallback result as presentation", async () => {
    const { root } = fixture(0);
    harness.state.contract = contract({
      playbackPolicy: { ...contract().playbackPolicy, allowedFallback: "readable-access" },
    });

    const receipt = await director().play("player-access", {
      root,
      presentationFallback: async () => ({ completed: false, readable: true, reason: "not-settled" }),
    });

    expect(receipt.outcome).toBe("missing-required-target");
    expect(receipt.acknowledgmentAllowed).toBe(false);
  });

  it("settles an already-aborted request without preflight side effects", async () => {
    const { root } = fixture();
    const controller = new AbortController();
    const operation = vi.fn(async () => "must-not-run");
    controller.abort();

    const receipt = await director().play("player-access", { root, signal: controller.signal, operation });

    expect(receipt.outcome).toBe("aborted");
    expect(receipt.interruptionReason).toBe("abort-signal");
    expect(receipt.targetReport.observations).toEqual([]);
    expect(harness.built).toEqual([]);
    expect(operation).not.toHaveBeenCalled();
  });

  it("aborts during a timeline and releases runtime and target ownership", async () => {
    const { root, targets } = fixture();
    const controller = new AbortController();
    harness.state.autoComplete.delete("opening");
    const result = director().play("player-access", { root, signal: controller.signal });
    await waitFor(() => expect(harness.played).toContain("opening"));

    controller.abort();
    const receipt = await result;

    expect(receipt.outcome).toBe("aborted");
    expect(receipt.interruptionReason).toBe("abort-signal");
    expect(animationOwnerFor(targets[0], "opacity")).toBeNull();
    expect(readAnimationMetrics().gsap).toBe(0);
    expect(harness.cleanup).toHaveBeenCalledOnce();
  });

  it("records director cancellation as interruption rather than abort", async () => {
    const { root } = fixture();
    harness.state.autoComplete.delete("opening");
    const value = director();
    const result = value.play("player-access", { root });
    await waitFor(() => expect(harness.played).toContain("opening"));

    value.cancel("route exit with private text");
    const receipt = await result;

    expect(receipt.outcome).toBe("interrupted");
    expect(receipt.interruptionReason).toBe("route-exit-with-private-text");
  });

  it("times out a never-settling timeline at the contract boundary", async () => {
    const { root } = fixture();
    harness.state.autoComplete.delete("opening");
    harness.state.contract = contract({ timeoutMs: 25 });

    const receipt = await director().play("player-access", { root });

    expect(receipt.outcome).toBe("timed-out");
    expect(receipt.durationMs).toBeGreaterThanOrEqual(15);
    expect(readAnimationMetrics().gsap).toBe(0);
  });

  it("converts builder exceptions into runtime-failed receipts without starting operations", async () => {
    const { root, targets } = fixture();
    harness.state.builderThrows = true;
    const operation = vi.fn(async () => "must-not-run");

    const receipt = await director().play("player-access", { root, operation });

    expect(receipt.outcome).toBe("runtime-failed");
    expect(operation).not.toHaveBeenCalled();
    expect(animationOwnerFor(targets[0], "opacity")).toBeNull();
  });

  it("converts synchronous timeline runtime failure into a receipt", async () => {
    const { root } = fixture();
    harness.state.playThrows.add("opening");

    const receipt = await director().play("player-access", { root });

    expect(receipt.outcome).toBe("runtime-failed");
    expect(receipt.cleanup).toBe("completed");
    expect(readAnimationMetrics().gsap).toBe(0);
  });

  it("runs the failure timeline and returns runtime-failed when the authoritative operation rejects", async () => {
    const { root } = fixture();

    const receipt = await director().play("player-access", {
      root,
      operation: async () => Promise.reject(new Error("secret server error")),
    });

    expect(receipt.outcome).toBe("runtime-failed");
    expect(receipt.acknowledgmentAllowed).toBe(false);
    expect(harness.played).toContain("failure");
    expect(harness.played).not.toContain("success");
    expect(receipt.semanticLabelsReached).toContain("failure-readable");
  });

  it("records an allowed user skip and settles the declared readable state", async () => {
    const { root } = fixture();
    harness.state.autoComplete.delete("opening");
    const value = director();
    const result = value.play("player-access", { root });
    await waitFor(() => expect(harness.played).toContain("opening"));

    expect(value.skip()).toBe(true);
    const receipt = await result;

    expect(receipt).toMatchObject({
      outcome: "skipped-by-user",
      finalSemanticState: "skipped-readable",
      acknowledgmentAllowed: true,
    });
    expect(harness.rendered).toContain("success");
  });

  it("ignores user skip when the scene policy forbids it", async () => {
    const { root } = fixture();
    harness.state.autoComplete.delete("opening");
    harness.state.contract = contract({
      playbackPolicy: { ...contract().playbackPolicy, allowUserSkip: false },
    });
    const value = director();
    const result = value.play("player-access", { root });
    await waitFor(() => expect(harness.played).toContain("opening"));

    expect(value.skip()).toBe(false);
    harness.complete("opening");
    const receipt = await result;

    expect(receipt.outcome).toBe("presented");
  });

  it("skips deprecated scenes by policy outside development without preflight or operation", async () => {
    const { root } = fixture(0);
    const operation = vi.fn(async () => "must-not-run");
    harness.state.contract = contract({ reachability: "deprecated" });

    const receipt = await director().play("player-access", {
      root,
      requestSource: "automatic",
      operation,
    });

    expect(receipt.outcome).toBe("skipped-by-policy");
    expect(receipt.targetReport.observations).toEqual([]);
    expect(harness.built).toEqual([]);
    expect(operation).not.toHaveBeenCalled();
  });

  it("reports cleanup errors without changing a successful presentation outcome", async () => {
    const { root, targets } = fixture();
    harness.state.cleanupThrows = true;
    harness.state.revertThrows = true;

    const receipt = await director().play("player-access", { root });

    expect(receipt.outcome).toBe("presented");
    expect(receipt.cleanup).toBe("completed-with-errors");
    expect(harness.cleanup).toHaveBeenCalledOnce();
    expect(harness.reverted).toHaveBeenCalledOnce();
    expect(animationOwnerFor(targets[0], "opacity")).toBeNull();
  });

  it("cleans scene callbacks, GSAP context, targets, and metrics exactly once", async () => {
    const { root, targets } = fixture();
    const value = director();

    const receipt = await value.play("player-access", { root });
    value.kill();

    expect(receipt.cleanup).toBe("completed");
    expect(harness.cleanup).toHaveBeenCalledOnce();
    expect(harness.reverted).toHaveBeenCalledOnce();
    expect(animationOwnerFor(targets[0], "opacity")).toBeNull();
    expect(readAnimationMetrics().gsap).toBe(0);
  });

  it("holds a final pose until director teardown while reconcile policy reverts immediately", async () => {
    const holdFixture = fixture();
    harness.state.contract = contract({
      finalStatePolicy: { kind: "hold-until-unmount", semanticState: "held-readable" },
    });
    const holdingDirector = director();
    const held = await holdingDirector.play("player-access", { root: holdFixture.root });

    expect(held.finalSemanticState).toBe("held-readable");
    expect(harness.reverted).not.toHaveBeenCalled();
    expect(animationOwnerFor(holdFixture.targets[0], "opacity")).toBe("gsap");
    holdingDirector.kill();
    expect(harness.reverted).toHaveBeenCalledOnce();
    expect(animationOwnerFor(holdFixture.targets[0], "opacity")).toBeNull();

    harness.reverted.mockClear();
    harness.state.contract = contract();
    const reconcileFixture = fixture();
    const reconciled = await director().play("player-access", { root: reconcileFixture.root });
    expect(reconciled.finalSemanticState).toBe("semantic-ready");
    expect(harness.reverted).toHaveBeenCalledOnce();
  });

  it("passes an explicitly resolved motion policy into the scene context and receipt", async () => {
    const { root } = fixture();
    const policy: ResolvedMotionPolicy = {
      level: "reduced",
      source: { productSetting: "gentle", browserPrefersReduced: true },
      allowSpatialTravel: false,
      allowContinuousAmbientMotion: false,
      allowPageCurl: false,
      allowRiveStateTravel: false,
      allowLottiePlayback: false,
      allowMotionCues: false,
      durationScale: 0.08,
      distanceScale: 0,
      preserveSemanticStaging: true,
    };
    const value = director();
    value.setMotionPolicy(policy);

    const receipt = await value.play("player-access", { root });

    expect(receipt.motionPolicy).toBe(policy);
    expect(harness.state.lastMotionPolicy).toBe(policy);
    expect(value.getSnapshot().mode).toBe("reduced");
  });

  it("uses a registered v2 host, immutable target resolution, atomic claims, and handoff-before-cleanup", async () => {
    const root = document.createElement("main");
    root.getBoundingClientRect = vi.fn(() => rect());
    const target = document.createElement("div");
    target.getBoundingClientRect = vi.fn(() => rect());
    root.append(target);
    document.body.append(root);
    const hosts = new SceneHostRegistry();
    const host = hosts.registerHost({ kind: "access", root });
    const targetHandle = host.registerTarget({
      targetKey: "access-panel",
      part: "target",
      element: target,
      allowedProperties: ["opacity"],
    });
    const v2Contract: SceneTargetContractV2 = {
      version: 2,
      sceneName: "player-access",
      reachability: "production",
      expectedHostKinds: ["access"],
      targets: [
        {
          key: "panel",
          part: "target",
          source: { kind: "host" },
          required: true,
          cardinality: { min: 1, max: 1 },
          visibility: visibleRule,
          owner: "gsap",
          properties: ["opacity"],
        },
      ],
      timeoutMs: 500,
      playbackPolicy: contract().playbackPolicy,
      acknowledgmentPolicy: contract().acknowledgmentPolicy,
      finalStatePolicy: { kind: "commit-final-state", semanticState: "semantic-ready" },
      cleanupPolicy: defaultSceneCleanupPolicy,
      reducedFallback: "semantic-final-state",
    };
    harness.state.contract = v2Contract;
    const authority = Object.freeze({ providerId: hosts.providerId, hosts, ownership: hosts.ownership });
    const value = new AnimationDirector("full", authority);
    directors.push(value);
    const observed = observeSemanticLabels();

    const receipt = await value.play("player-access", {
      root,
      sceneHost: host,
      finalStateRuntime: { commitFinalState: () => undefined },
    });
    observed.stop();

    expect(receipt).toMatchObject({
      outcome: "presented",
      hostId: host.hostId,
      hostKind: "access",
      finalSemanticState: "semantic-ready",
      finalization: {
        finalStatePolicy: "commit-final-state",
        finalStateCommitted: true,
        handoffCompleted: true,
        cleanupCompleted: true,
      },
      targetReport: { requiredSatisfied: true },
    });
    expect(receipt.targetReport.observations[0]?.visibleCount).toBe(1);
    expect(receipt.sceneInstanceId).toContain("player-access-live-1-");
    expect(observed.events).toEqual([
      expect.objectContaining({
        sceneInstanceId: receipt.sceneInstanceId,
        hostId: host.hostId,
        hostKind: "access",
        eventOrActionId: null,
        requestSource: "automatic",
        label: "opening-ready",
      }),
      expect.objectContaining({ label: "semantic-ready" }),
      expect.objectContaining({ label: "scene-complete" }),
    ]);
    expect(harness.state.lastContextHadRoot).toBe(false);
    expect(harness.state.lastBuildTargetUse).toEqual({ status: "applied", value: undefined });
    expect(target).toHaveAttribute("data-v2-builder-used", "yes");
    expect(targetHandle.targetId).toContain(host.hostId);
    expect(target).not.toHaveAttribute("data-animation-owner");
    expect(hosts.snapshot()).toMatchObject({ activeInvocationCount: 0, activeClaimCount: 0 });
    hosts.destroy();
  });

  it("excludes an ownership-conflicted optional v2 target without rejecting required playback", async () => {
    const root = document.createElement("main");
    root.getBoundingClientRect = vi.fn(() => rect());
    const requiredTarget = document.createElement("div");
    const optionalTarget = document.createElement("div");
    requiredTarget.getBoundingClientRect = vi.fn(() => rect());
    optionalTarget.getBoundingClientRect = vi.fn(() => rect());
    root.append(requiredTarget, optionalTarget);
    document.body.append(root);
    const hosts = new SceneHostRegistry();
    const host = hosts.registerHost({ kind: "access", root });
    host.registerTarget({
      targetKey: "access-panel",
      part: "target",
      element: requiredTarget,
      allowedProperties: ["opacity"],
    });
    const optionalHandle = host.registerTarget({
      targetKey: "optional-panel",
      part: "optional-target",
      element: optionalTarget,
      allowedProperties: ["opacity"],
    });
    const conflictingLease = host.claimRuntimeSurface({
      target: optionalHandle,
      element: optionalTarget,
      runtime: "motion",
      properties: ["opacity"],
    });
    expect(conflictingLease.status).toBe("granted");
    const v2Contract: SceneTargetContractV2 = {
      version: 2,
      sceneName: "player-access",
      reachability: "production",
      expectedHostKinds: ["access"],
      targets: [
        {
          key: "panel",
          part: "target",
          source: { kind: "host" },
          required: true,
          cardinality: { min: 1, max: 1 },
          visibility: visibleRule,
          owner: "gsap",
          properties: ["opacity"],
        },
        {
          key: "optional-panel",
          part: "optional-target",
          source: { kind: "host" },
          required: false,
          cardinality: { min: 0, max: 1 },
          visibility: visibleRule,
          owner: "gsap",
          properties: ["opacity"],
        },
      ],
      timeoutMs: 500,
      playbackPolicy: contract().playbackPolicy,
      acknowledgmentPolicy: contract().acknowledgmentPolicy,
      finalStatePolicy: { kind: "commit-final-state", semanticState: "semantic-ready" },
      cleanupPolicy: defaultSceneCleanupPolicy,
      reducedFallback: "semantic-final-state",
    };
    harness.state.contract = v2Contract;
    const authority = Object.freeze({ providerId: hosts.providerId, hosts, ownership: hosts.ownership });
    const value = new AnimationDirector("full", authority);
    directors.push(value);

    const receipt = await value.play("player-access", {
      root,
      sceneHost: host,
      finalStateRuntime: { commitFinalState: () => undefined },
    });

    expect(receipt.outcome).toBe("presented");
    expect(receipt.targetReport.requiredSatisfied).toBe(true);
    expect(receipt.targetReport.observations[1]?.ownershipRejectedCount).toBe(1);
    expect(harness.state.lastOptionalTargetCount).toBe(0);
    if (conflictingLease.status === "granted") conflictingLease.release();
    hosts.destroy();
  });

  it("resolves an identity-only v2 target without conflicting with its Motion lifecycle lease", async () => {
    const root = document.createElement("main");
    root.getBoundingClientRect = vi.fn(() => rect());
    const target = document.createElement("div");
    target.getBoundingClientRect = vi.fn(() => rect());
    root.append(target);
    document.body.append(root);
    const hosts = new SceneHostRegistry();
    const host = hosts.registerHost({ kind: "access", root });
    const targetHandle = host.registerTarget({
      targetKey: "motion-panel",
      part: "target",
      element: target,
      ownerHint: "motion",
      allowedProperties: ["opacity"],
    });
    const motionLease = host.claimRuntimeSurface({
      target: targetHandle,
      element: target,
      runtime: "motion",
      properties: ["opacity"],
    });
    expect(motionLease.status).toBe("granted");
    harness.state.contract = {
      version: 2,
      sceneName: "player-access",
      reachability: "production",
      expectedHostKinds: ["access"],
      targets: [
        {
          key: "panel",
          part: "target",
          source: { kind: "host" },
          required: true,
          identityOnly: true,
          cardinality: { min: 1, max: 1 },
          visibility: visibleRule,
          owner: null,
          properties: [],
        },
      ],
      timeoutMs: 500,
      playbackPolicy: contract().playbackPolicy,
      acknowledgmentPolicy: contract().acknowledgmentPolicy,
      finalStatePolicy: { kind: "commit-final-state", semanticState: "semantic-ready" },
      cleanupPolicy: defaultSceneCleanupPolicy,
      reducedFallback: "semantic-final-state",
    } satisfies SceneTargetContractV2;
    const authority = Object.freeze({ providerId: hosts.providerId, hosts, ownership: hosts.ownership });
    const value = new AnimationDirector("full", authority);
    directors.push(value);

    const receipt = await value.play("player-access", {
      root,
      sceneHost: host,
      finalStateRuntime: { commitFinalState: () => undefined },
    });

    expect(receipt.outcome).toBe("presented");
    expect(receipt.targetReport.requiredSatisfied).toBe(true);
    expect(harness.state.lastBuildTargetUse).toEqual({ status: "denied", reason: "identity-only" });
    expect(hosts.snapshot().activeClaimCount).toBe(1);
    if (motionLease.status === "granted") motionLease.release();
    hosts.destroy();
  });

  it("records and revokes the exact external handoff target only after semantic reconciliation", async () => {
    const sourceRoot = document.createElement("section");
    const destinationRoot = document.createElement("main");
    sourceRoot.getBoundingClientRect = vi.fn(() => rect());
    destinationRoot.getBoundingClientRect = vi.fn(() => rect());
    const target = document.createElement("div");
    target.getBoundingClientRect = vi.fn(() => rect());
    sourceRoot.append(target);
    document.body.append(sourceRoot, destinationRoot);
    const hosts = new SceneHostRegistry();
    const source = hosts.registerHost({ kind: "player-section-enhancement", root: sourceRoot });
    const destination = hosts.registerHost({ kind: "access", root: destinationRoot });
    const targetHandle = source.registerTarget({
      targetKey: "artifact-layout",
      part: "target",
      element: target,
      ownerHint: "motion",
      allowedProperties: ["layout"],
    });
    const motionLease = source.claimRuntimeSurface({
      target: targetHandle,
      element: target,
      runtime: "motion",
      properties: ["layout"],
    });
    const external = source.exportTarget({
      target: targetHandle,
      destinationHostId: destination.hostId,
      allowedProperties: ["layout"],
      lifetime: "handoff",
    });
    harness.state.contract = {
      version: 2,
      sceneName: "player-access",
      reachability: "production",
      expectedHostKinds: ["access"],
      targets: [
        {
          key: "panel",
          part: "target",
          source: { kind: "external", handleKey: "destination" },
          required: true,
          identityOnly: true,
          cardinality: { min: 1, max: 1 },
          visibility: visibleRule,
          owner: null,
          properties: [],
        },
      ],
      timeoutMs: 500,
      playbackPolicy: contract().playbackPolicy,
      acknowledgmentPolicy: contract().acknowledgmentPolicy,
      finalStatePolicy: {
        kind: "reconcile-then-revert",
        semanticState: "semantic-ready",
        handoffTargetKey: "panel",
      },
      cleanupPolicy: defaultSceneCleanupPolicy,
      reducedFallback: "semantic-final-state",
    } satisfies SceneTargetContractV2;
    const authority = Object.freeze({ providerId: hosts.providerId, hosts, ownership: hosts.ownership });
    const value = new AnimationDirector("full", authority);
    directors.push(value);
    const reconcile = vi.fn();
    const cleanupOrder: string[] = [];
    harness.reverted.mockImplementation(() => cleanupOrder.push("temporary-styles"));
    const revokeExternalHandle = hosts.revokeExternalHandle.bind(hosts);
    vi.spyOn(hosts, "revokeExternalHandle").mockImplementation((handle) => {
      cleanupOrder.push("external-handles");
      return revokeExternalHandle(handle);
    });
    const releaseScene = hosts.ownership.releaseScene.bind(hosts.ownership);
    vi.spyOn(hosts.ownership, "releaseScene").mockImplementation((instanceId) => {
      cleanupOrder.push("ownership-claims");
      return releaseScene(instanceId);
    });

    const receipt = await value.play("player-access", {
      root: destinationRoot,
      sceneHost: destination,
      externalTargets: { destination: external },
      finalStateRuntime: { reconcileFinalState: reconcile },
    });

    expect(receipt.outcome).toBe("presented");
    expect(reconcile).toHaveBeenCalledWith("semantic-ready", "panel");
    expect(receipt.finalization).toMatchObject({
      handoffTargetId: external.externalTargetId,
      handoffCompleted: true,
    });
    expect(cleanupOrder).toEqual(["temporary-styles", "external-handles", "ownership-claims"]);
    expect(hosts.snapshot().externalHandleCount).toBe(0);
    expect(hosts.snapshot().activeClaimCount).toBe(1);
    if (motionLease.status === "granted") motionLease.release();
    hosts.destroy();
  });

  it("continues retained handoff cleanup after context revert throws", async () => {
    const sourceRoot = document.createElement("main");
    const destinationRoot = document.createElement("main");
    const target = document.createElement("div");
    sourceRoot.getBoundingClientRect = vi.fn(() => rect());
    destinationRoot.getBoundingClientRect = vi.fn(() => rect());
    target.getBoundingClientRect = vi.fn(() => rect());
    sourceRoot.append(target);
    document.body.append(sourceRoot, destinationRoot);
    const hosts = new SceneHostRegistry();
    const source = hosts.registerHost({ kind: "player-section-enhancement", root: sourceRoot });
    const destination = hosts.registerHost({ kind: "access", root: destinationRoot });
    const targetHandle = source.registerTarget({
      targetKey: "artifact-opacity",
      part: "target",
      element: target,
      ownerHint: "gsap",
      allowedProperties: ["opacity"],
    });
    const baseline = hosts.snapshot();
    const external = source.exportTarget({
      target: targetHandle,
      destinationHostId: destination.hostId,
      allowedProperties: ["opacity"],
      lifetime: "handoff",
    });
    harness.state.contract = {
      version: 2,
      sceneName: "player-access",
      reachability: "production",
      expectedHostKinds: ["access"],
      targets: [
        {
          key: "panel",
          part: "target",
          source: { kind: "external", handleKey: "destination" },
          required: true,
          cardinality: { min: 1, max: 1 },
          visibility: visibleRule,
          owner: "gsap",
          properties: ["opacity"],
        },
      ],
      timeoutMs: 500,
      playbackPolicy: contract().playbackPolicy,
      acknowledgmentPolicy: contract().acknowledgmentPolicy,
      finalStatePolicy: {
        kind: "reconcile-then-revert",
        semanticState: "semantic-ready",
        handoffTargetKey: "panel",
      },
      cleanupPolicy: defaultSceneCleanupPolicy,
      reducedFallback: "semantic-final-state",
    } satisfies SceneTargetContractV2;
    harness.state.revertThrows = true;
    const authority = Object.freeze({ providerId: hosts.providerId, hosts, ownership: hosts.ownership });
    const value = new AnimationDirector("full", authority);
    directors.push(value);

    const receipt = await value.play("player-access", {
      root: destinationRoot,
      sceneHost: destination,
      externalTargets: { destination: external },
      finalStateRuntime: {
        reconcileFinalState: () => Promise.reject(new Error("reconcile failed")),
      },
    });

    expect(receipt).toMatchObject({
      outcome: "presented",
      finalization: {
        handoffTargetId: external.externalTargetId,
        handoffCompleted: false,
      },
    });
    expect(hosts.snapshot()).toMatchObject({
      registeredTargetCount: baseline.registeredTargetCount,
      externalHandleCount: 1,
      activeClaimCount: 1,
      activeInvocationCount: 1,
    });

    value.kill();

    expect(harness.reverted).toHaveBeenCalledOnce();
    expect(hosts.snapshot()).toMatchObject({
      registeredTargetCount: baseline.registeredTargetCount,
      externalHandleCount: baseline.externalHandleCount,
      activeClaimCount: baseline.activeClaimCount,
      activeInvocationCount: baseline.activeInvocationCount,
    });

    value.kill();

    expect(harness.reverted).toHaveBeenCalledOnce();
    expect(hosts.snapshot()).toMatchObject({
      registeredTargetCount: baseline.registeredTargetCount,
      externalHandleCount: baseline.externalHandleCount,
      activeClaimCount: baseline.activeClaimCount,
      activeInvocationCount: baseline.activeInvocationCount,
    });
    hosts.destroy();
  });

  it("serializes queued presentations and returns a receipt for explicit conflicts", async () => {
    const firstFixture = fixture();
    const secondFixture = fixture();
    const operation = deferred<string>();
    const value = director();
    const first = value.play("player-access", { root: firstFixture.root, operation: () => operation.promise });
    const second = value.play("player-access", { root: secondFixture.root });
    await waitFor(() => expect(value.getSnapshot().phase).toBe("await-server"));

    const conflict = await value.play("player-access", { root: fixture().root, queue: false });
    expect(conflict).toMatchObject({
      outcome: "interrupted",
      interruptionReason: "conflicting-scene",
      acknowledgmentAllowed: false,
      cleanup: "completed",
    });
    expect(harness.played.filter((kind) => kind === "opening")).toHaveLength(1);
    operation.resolve("authorized");
    await Promise.all([first, second]);

    expect(harness.played.filter((kind) => kind === "opening")).toHaveLength(2);
    expect(value.getSnapshot().queueDepth).toBe(0);
  });

  it("interrupts active lower-priority playback before a higher-priority scene runs", async () => {
    const lowFixture = fixture();
    const highFixture = fixture();
    harness.state.contract = contract({
      playbackPolicy: { ...contract().playbackPolicy, priority: 10 },
    });
    harness.state.autoComplete.delete("opening");
    const value = director();
    const low = value.play("player-access", { root: lowFixture.root });
    await waitFor(() => expect(harness.played).toContain("opening"));

    harness.state.contract = contract({
      playbackPolicy: { ...contract().playbackPolicy, priority: 90 },
    });
    harness.state.autoComplete.add("opening");
    const high = value.play("chapter-release", { root: highFixture.root, queue: false });
    const lowReceipt = await low;
    const highReceipt = await high;

    expect(lowReceipt).toMatchObject({
      outcome: "interrupted",
      interruptionReason: "higher-priority-scene",
      acknowledgmentAllowed: false,
    });
    expect(highReceipt).toMatchObject({ sceneName: "chapter-release", outcome: "presented" });
    expect(harness.cleanup).toHaveBeenCalledTimes(2);
    expect(harness.reverted).toHaveBeenCalledTimes(2);
    expect(readAnimationMetrics().gsap).toBe(0);
  });

  it("interrupts and reconciles active spatial playback when resolved policy becomes reduced", async () => {
    const { root, targets } = fixture();
    harness.state.autoComplete.delete("opening");
    const value = director("full");
    const result = value.play("player-access", { root });
    await waitFor(() => expect(harness.played).toContain("opening"));

    value.setMotionPolicy({
      level: "reduced",
      source: { productSetting: "full", browserPrefersReduced: true },
      allowSpatialTravel: false,
      allowContinuousAmbientMotion: false,
      allowPageCurl: false,
      allowRiveStateTravel: false,
      allowLottiePlayback: false,
      allowMotionCues: false,
      durationScale: 0.08,
      distanceScale: 0,
      preserveSemanticStaging: true,
    });
    const receipt = await result;

    expect(receipt).toMatchObject({
      outcome: "interrupted",
      interruptionReason: "motion-policy-reduced",
      acknowledgmentAllowed: false,
    });
    expect(value.getSnapshot().mode).toBe("reduced");
    expect(harness.killed).toContain("opening");
    expect(harness.reverted).toHaveBeenCalledOnce();
    expect(animationOwnerFor(targets[0], "opacity")).toBeNull();
    expect(readAnimationMetrics().gsap).toBe(0);
  });

  it("records one structured telemetry event for each returned receipt", async () => {
    const { root } = fixture();

    const receipt = await director().play("player-access", {
      root,
      telemetryContext: { playerSection: "journal" },
    });

    expect(readPresentationTelemetry()).toEqual([
      expect.objectContaining({
        sceneName: receipt.sceneName,
        sceneInstanceId: receipt.sceneInstanceId,
        hostId: "test-host-id",
        hostKind: "test-host",
        route: "/",
        playerSection: "journal",
        outcome: "presented",
        finalSemanticState: "semantic-ready",
        acknowledgmentAllowed: true,
      }),
    ]);
  });

  it("returns a terminal receipt for new work after director destruction", async () => {
    const value = director();
    value.kill();

    const receipt = await value.play("player-access", { root: fixture().root });

    expect(receipt).toMatchObject({
      outcome: "interrupted",
      interruptionReason: "director-killed",
      acknowledgmentAllowed: false,
      cleanup: "completed",
    });
  });
});
