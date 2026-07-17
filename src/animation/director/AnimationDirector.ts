"use client";

import type {
  AnimationSceneName,
  DirectorSnapshot,
  MotionMode,
  PlaySceneOptions,
  SceneBuildContext,
  SceneTimeline,
} from "../core/animation-types";
import { AnimationCancelledError } from "../core/animation-types";
import { changeMountedMetric } from "../core/metrics";
import { claimSceneTargets } from "../core/ownership";
import { observeDocumentVisibility } from "../core/visibility";
import { gsap } from "../core/gsap-client";
import { getSceneDefinition } from "./scene-registry";

const initialSnapshot = (mode: MotionMode): DirectorSnapshot => ({
  isPlaying: false,
  isPaused: false,
  scene: null,
  label: "idle",
  progress: 0,
  speed: 1,
  mode,
  phase: "idle",
  queueDepth: 0,
  error: null,
});

export class AnimationDirector {
  private snapshot: DirectorSnapshot;
  private listeners = new Set<() => void>();
  private currentTimeline: SceneTimeline | null = null;
  private currentResolve: (() => void) | null = null;
  private cleanups: Array<() => void> = [];
  private tail: Promise<unknown> = Promise.resolve();
  private cancelled = false;
  private skipRequested = false;
  private userPaused = false;
  private visibilityCleanup: () => void;
  private destroyed = false;
  private cancelWait: (() => void) | null = null;

  constructor(mode: MotionMode = "full") {
    this.snapshot = initialSnapshot(mode);
    this.visibilityCleanup = observeDocumentVisibility((visible) => {
      if (!this.currentTimeline) return;
      if (!visible) this.currentTimeline.pause();
      else if (!this.userPaused && this.snapshot.phase !== "await-server") this.currentTimeline.resume();
    });
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  private update(patch: Partial<DirectorSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  setMode(mode: MotionMode) {
    this.update({ mode });
  }

  setSpeed(multiplier: number) {
    const speed = Math.min(2, Math.max(0.25, multiplier));
    this.currentTimeline?.timeScale(speed);
    this.update({ speed });
  }

  pause() {
    this.userPaused = true;
    this.currentTimeline?.pause();
    this.update({ isPaused: true });
  }

  resume() {
    this.userPaused = false;
    this.currentTimeline?.resume();
    this.update({ isPaused: false });
  }

  seek(labelOrProgress: string | number) {
    const timeline = this.currentTimeline;
    if (!timeline) return;
    if (typeof labelOrProgress === "number") timeline.progress(Math.max(0, Math.min(1, labelOrProgress)));
    else if (timeline.labels[labelOrProgress] !== undefined) timeline.seek(labelOrProgress);
    this.update({
      progress: timeline.progress(),
      label: typeof labelOrProgress === "string" ? labelOrProgress : this.snapshot.label,
    });
  }

  reverse() {
    const scene = this.snapshot.scene;
    if (!scene || !getSceneDefinition(scene).reversible || !this.currentTimeline) return false;
    this.currentTimeline.reverse();
    return true;
  }

  skip() {
    this.skipRequested = true;
    if (!this.currentTimeline) return;
    this.currentTimeline.progress(1, false);
  }

  cancel(reason = "cancelled") {
    this.cancelled = true;
    this.cancelWait?.();
    this.currentTimeline?.kill();
    this.currentResolve?.();
    this.update({ error: reason, isPlaying: false, isPaused: false, phase: "idle", label: "cancelled" });
  }

  kill() {
    this.destroyed = true;
    this.cancel("director-killed");
    this.visibilityCleanup();
    this.finishCleanup();
    this.listeners.clear();
  }

  play<T = void>(name: AnimationSceneName, options: PlaySceneOptions<T>): Promise<T | undefined> {
    if (this.destroyed) return Promise.reject(new AnimationCancelledError("Animation director has been killed."));
    if (options.queue === false && (this.snapshot.isPlaying || this.snapshot.queueDepth > 0)) {
      return Promise.reject(new Error("A conflicting cinematic scene is already active."));
    }
    this.update({ queueDepth: this.snapshot.queueDepth + 1 });
    const scheduled = this.tail
      .catch(() => undefined)
      .then(async () => {
        this.update({ queueDepth: Math.max(0, this.snapshot.queueDepth - 1) });
        return this.execute(name, options);
      });
    this.tail = scheduled.catch(() => undefined);
    return scheduled;
  }

  private async execute<T>(name: AnimationSceneName, options: PlaySceneOptions<T>): Promise<T | undefined> {
    const definition = getSceneDefinition(name);
    this.cancelled = false;
    this.skipRequested = false;
    this.userPaused = false;
    this.update({
      isPlaying: true,
      isPaused: false,
      scene: name,
      label: "scene-start",
      progress: 0,
      phase: "opening",
      error: null,
    });
    const operation = options.operation?.().then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    let operationSettled = false;
    void operation?.then(() => (operationSettled = true));

    const cleanupOwnership = claimSceneTargets(options.root, "[data-gsap-owned]", "gsap", [
      "transform",
      "opacity",
      "filter",
      "clip-path",
      "geometry",
    ]);
    this.cleanups.push(cleanupOwnership);
    const sceneContext: SceneBuildContext = {
      root: options.root,
      mode: this.snapshot.mode,
      sceneName: name,
      display: options.display ?? {},
      emitLabel: (label) => this.update({ label }),
      addCleanup: (cleanup) => this.cleanups.push(cleanup),
    };
    let opening!: SceneTimeline;
    let success!: SceneTimeline;
    let failure: SceneTimeline | undefined;
    let idle: SceneTimeline | undefined;
    const gsapContext = gsap.context(() => {
      opening = definition.buildOpening(sceneContext);
      success = definition.buildSuccess(sceneContext);
      failure = definition.buildFailure?.(sceneContext);
      idle = definition.buildIdle?.(sceneContext);
    }, options.root);
    this.cleanups.push(() => gsapContext.revert());

    try {
      await this.runTimeline(opening, "opening");
      this.throwIfCancelled();
      let result: T | undefined;
      if (operation) {
        this.update({ phase: "await-server", label: "await-server", progress: 1 });
        if (!operationSettled && idle) this.startIdle(idle);
        const cancelled = new Promise<{ cancelled: true }>((resolve) => {
          this.cancelWait = () => resolve({ cancelled: true });
        });
        const settled = await Promise.race([operation, cancelled]);
        this.cancelWait = null;
        this.stopIdle();
        this.throwIfCancelled();
        if ("cancelled" in settled) throw new AnimationCancelledError();
        if (!settled.ok) {
          this.update({ phase: "failure", label: "failure-branch" });
          if (failure) await this.runTimeline(failure, "failure");
          throw settled.error;
        }
        result = settled.value;
      }
      this.update({ phase: "success", label: "success-branch", progress: 0 });
      if (this.skipRequested) success.progress(1, true);
      else await this.runTimeline(success, "success");
      this.throwIfCancelled();
      return result;
    } catch (error) {
      if (!(error instanceof AnimationCancelledError)) {
        this.update({ error: error instanceof Error ? error.message : "Animation failed" });
      }
      throw error;
    } finally {
      this.currentTimeline?.kill();
      this.currentTimeline = null;
      this.currentResolve = null;
      this.cancelWait = null;
      this.finishCleanup();
      this.update({ isPlaying: false, isPaused: false, scene: null, label: "idle", progress: 0, phase: "idle" });
    }
  }

  private runTimeline(timeline: SceneTimeline, phase: DirectorSnapshot["phase"]) {
    return new Promise<void>((resolve) => {
      this.currentTimeline?.kill();
      this.currentTimeline = timeline;
      changeMountedMetric("gsap", 1);
      let counted = true;
      const finish = () => {
        if (counted) changeMountedMetric("gsap", -1);
        counted = false;
        this.currentResolve = null;
        resolve();
      };
      this.currentResolve = finish;
      timeline.eventCallback("onUpdate", () => this.update({ progress: timeline.progress() }));
      timeline.eventCallback("onComplete", finish);
      timeline.eventCallback("onReverseComplete", finish);
      timeline.timeScale(this.snapshot.speed);
      this.update({ phase, progress: timeline.progress() });
      timeline.play(0);
    });
  }

  private startIdle(timeline: SceneTimeline) {
    this.currentTimeline = timeline;
    timeline.timeScale(this.snapshot.speed).play(0);
  }

  private stopIdle() {
    this.currentTimeline?.kill();
    this.currentTimeline = null;
  }

  private throwIfCancelled() {
    if (this.cancelled) throw new AnimationCancelledError();
  }

  private finishCleanup() {
    this.cleanups
      .splice(0)
      .reverse()
      .forEach((cleanup) => {
        try {
          cleanup();
        } catch {
          // Cleanup must be best-effort and must not mask an authoritative result.
        }
      });
  }
}
