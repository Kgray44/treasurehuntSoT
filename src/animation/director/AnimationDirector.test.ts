import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SceneTimeline } from "../core/animation-types";
import { readAnimationMetrics, resetAnimationMetrics } from "../core/metrics";

const harness = vi.hoisted(() => {
  type Callback = (() => void) | null;
  const played: string[] = [];
  const rendered: string[] = [];
  const reverted = vi.fn();

  class FakeTimeline {
    labels: Record<string, number> = { safe: 0.5 };
    private callbacks = new Map<string, Callback>();
    private value = 0;
    private finished = false;

    constructor(private kind: string) {}

    eventCallback(name: string, callback: Callback) {
      this.callbacks.set(name, callback);
      return this;
    }

    play() {
      played.push(this.kind);
      if (this.kind !== "idle") queueMicrotask(() => this.complete("onComplete"));
      return this;
    }

    progress(value?: number, suppressEvents?: boolean) {
      if (value === undefined) return this.value;
      this.value = value;
      rendered.push(this.kind);
      this.callbacks.get("onUpdate")?.();
      if (value === 1 && suppressEvents === false) queueMicrotask(() => this.complete("onComplete"));
      return this;
    }

    private complete(name: string) {
      if (this.finished) return;
      this.finished = true;
      this.value = 1;
      this.callbacks.get("onUpdate")?.();
      this.callbacks.get(name)?.();
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
      return this;
    }
  }

  const timeline = (kind: string) => new FakeTimeline(kind) as unknown as SceneTimeline;
  return { played, rendered, reverted, timeline };
});

vi.mock("../core/gsap-client", () => ({
  gsap: {
    context: (build: () => void) => {
      build();
      return { revert: harness.reverted };
    },
  },
}));

vi.mock("./scene-registry", () => ({
  getSceneDefinition: () => ({
    name: "player-access",
    reversible: true,
    buildOpening: () => harness.timeline("opening"),
    buildIdle: () => harness.timeline("idle"),
    buildSuccess: () => harness.timeline("success"),
    buildFailure: () => harness.timeline("failure"),
  }),
}));

import { AnimationCancelledError } from "../core/animation-types";
import { AnimationDirector } from "./AnimationDirector";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

describe("AnimationDirector", () => {
  afterEach(() => {
    harness.played.length = 0;
    harness.rendered.length = 0;
    harness.reverted.mockClear();
    resetAnimationMetrics();
  });

  it("holds at await-server and renders the final success state only after authority settles", async () => {
    const operation = deferred<string>();
    const director = new AnimationDirector();
    const result = director.play("player-access", {
      root: document.createElement("main"),
      operation: () => operation.promise,
    });

    await waitFor(() => expect(director.getSnapshot().phase).toBe("await-server"));
    director.skip();
    expect(director.getSnapshot().phase).toBe("await-server");
    expect(harness.played).not.toContain("success");

    operation.resolve("authorized");
    await expect(result).resolves.toBe("authorized");
    expect(harness.rendered).toContain("success");
    expect(harness.played).not.toContain("failure");
    expect(readAnimationMetrics().gsap).toBe(0);
    expect(harness.reverted).toHaveBeenCalledOnce();
    director.kill();
  });

  it("selects the failure branch and never plays success after a rejected operation", async () => {
    const director = new AnimationDirector();
    const failure = new Error("rejected by server");
    const result = director.play("player-access", {
      root: document.createElement("main"),
      operation: () => Promise.reject(failure),
    });

    await expect(result).rejects.toBe(failure);
    expect(harness.played).toContain("failure");
    expect(harness.played).not.toContain("success");
    expect(readAnimationMetrics().gsap).toBe(0);
    director.kill();
  });

  it("cancels a pending operation wait, reverts ownership, and ignores a late result", async () => {
    const operation = deferred<string>();
    const director = new AnimationDirector();
    const result = director.play("player-access", {
      root: document.createElement("main"),
      operation: () => operation.promise,
    });
    await waitFor(() => expect(director.getSnapshot().phase).toBe("await-server"));
    director.cancel("route-exit");
    await expect(result).rejects.toBeInstanceOf(AnimationCancelledError);
    operation.resolve("too late");
    await Promise.resolve();
    expect(harness.played).not.toContain("success");
    expect(readAnimationMetrics().gsap).toBe(0);
    director.kill();
  });

  it("serializes queued scenes and rejects an explicitly conflicting scene", async () => {
    const director = new AnimationDirector();
    const first = director.play("player-access", { root: document.createElement("main") });
    const second = director.play("map-reveal", { root: document.createElement("main") });
    await expect(
      director.play("artifact-award", { root: document.createElement("main"), queue: false }),
    ).rejects.toThrow(/conflicting/);
    await Promise.all([first, second]);
    expect(harness.played).toEqual(["opening", "success", "opening", "success"]);
    expect(director.getSnapshot().queueDepth).toBe(0);
    director.kill();
  });
});
