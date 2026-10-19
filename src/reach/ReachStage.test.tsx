// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReachStage } from "./ReachStage";
import { ReachTiming, type ReachVisualFrame } from "./visualization";
import { syntheticObservation } from "./synthetic";

describe("Reach canvas submissions", () => {
  let next: number;
  let queued: Map<number, FrameRequestCallback>;
  let width: number;
  let height: number;
  let context: CanvasRenderingContext2D;
  let strokes: { alpha: number; style: string | CanvasGradient | CanvasPattern }[];
  beforeEach(() => {
    next = 0;
    queued = new Map();
    width = 320;
    height = 240;
    strokes = [];
    context = {
      globalAlpha: 1,
      strokeStyle: "",
      fillStyle: "",
      lineWidth: 0,
      lineCap: "butt",
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      setLineDash: vi.fn(),
      fillText: vi.fn(),
      stroke: vi.fn(() => strokes.push({ alpha: context.globalAlpha, style: context.strokeStyle })),
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    vi.spyOn(HTMLCanvasElement.prototype, "clientWidth", "get").mockImplementation(() => width);
    vi.spyOn(HTMLCanvasElement.prototype, "clientHeight", "get").mockImplementation(() => height);
    vi.stubGlobal("devicePixelRatio", 1);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      queued.set(++next, callback);
      return next;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => queued.delete(id));
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  const tick = (at: number) =>
    act(() => {
      const current = [...queued.values()];
      queued.clear();
      for (const callback of current) callback(at);
    });
  const inputs = () => ({
    frame: {
      current: {
        observation: syntheticObservation({ x: 0.5, y: 0.5 }, 1, 100),
        activeTrack: "synthetic-1",
        raw: null,
        filtered: null,
        uncertainty: null,
        previewEstimate: false,
        lastSeen: null,
      } as ReachVisualFrame,
    },
    timings: { current: new ReachTiming() },
  });
  it("draws an unchanged hand once, preserves its geometry, and submits freshness transitions without new observations", () => {
    const props = inputs();
    render(<ReachStage {...props} kind="CAMERA" />);
    tick(110);
    expect(context.clearRect).toHaveBeenCalledTimes(1);
    expect(context.stroke).toHaveBeenCalledTimes(22);
    expect(context.arc).toHaveBeenCalledTimes(22);
    expect(context.arc).toHaveBeenCalledWith(160, (0.5 - 0.06) * 240, 11, 0, Math.PI * 2);
    expect(strokes.every((stroke) => stroke.alpha === 1 && stroke.style === "#8be1cd")).toBe(true);
    for (const at of [120, 150, 200, 250]) tick(at);
    expect(context.clearRect).toHaveBeenCalledTimes(1);
    expect(queued.size).toBe(1); // RAF polling continues while canvas work skips.
    expect(props.timings.current.submissionAge).toEqual([10]);
    tick(251);
    expect(context.clearRect).toHaveBeenCalledTimes(2);
    expect(strokes.at(-1)?.alpha).toBe(0.3);
    for (const at of [300, 450, 550]) tick(at);
    expect(context.clearRect).toHaveBeenCalledTimes(2);
    const strokeCount = vi.mocked(context.stroke).mock.calls.length;
    tick(551);
    expect(context.clearRect).toHaveBeenCalledTimes(3);
    expect(context.stroke).toHaveBeenCalledTimes(strokeCount);
    tick(600);
    expect(context.clearRect).toHaveBeenCalledTimes(3);
    props.frame.current.observation = syntheticObservation({ x: 0.6, y: 0.5 }, 2, 610);
    tick(620);
    expect(context.clearRect).toHaveBeenCalledTimes(4);
    expect(props.timings.current.submissionAge).toEqual([10, 10]);
    expect(props.timings.current.visualizationIntervals).toEqual([510]);
  });
  it("fades and expires old camera pixels by origin rather than their newer dispatch", () => {
    const props = inputs();
    props.frame.current.observation = {
      ...props.frame.current.observation!,
      monotonicCaptureTime: 200,
      monotonicPixelOriginTime: 100,
    };
    render(<ReachStage {...props} kind="CAMERA" />);
    tick(250);
    expect(strokes.at(-1)?.alpha).toBe(1);
    tick(251);
    expect(strokes.at(-1)?.alpha).toBe(0.3);
    const count = strokes.length;
    tick(550);
    expect(strokes.length).toBe(count);
    tick(551);
    expect(context.clearRect).toHaveBeenCalledTimes(3);
    expect(strokes.length).toBe(count);
    expect(props.timings.current.submissionAge).toEqual([50]);
  });
  it("removes actionable pointer strokes at the pixel-origin freshness deadline", () => {
    const props = inputs();
    props.frame.current.observation = {
      ...props.frame.current.observation!,
      monotonicCaptureTime: 200,
      monotonicPixelOriginTime: 100,
    };
    props.frame.current.filtered = { x: 0.5, y: 0.5 };
    render(<ReachStage {...props} kind="POINTER" />);
    tick(250);
    expect(context.stroke).toHaveBeenCalledTimes(1);
    tick(251);
    expect(context.clearRect).toHaveBeenCalledTimes(2);
    expect(context.stroke).toHaveBeenCalledTimes(1);
    tick(300);
    expect(context.clearRect).toHaveBeenCalledTimes(2);
  });
  it("polls sixty RAFs but submits only five source updates and their five stale transitions", () => {
    const props = inputs();
    render(<ReachStage {...props} kind="CAMERA" />);
    for (let i = 0; i < 60; ++i) {
      const at = 100 + (i * 1000) / 60;
      if (i % 12 === 0) props.frame.current.observation = syntheticObservation({ x: 0.5 + i / 1000, y: 0.5 }, i, at);
      tick(at);
    }
    expect(context.clearRect).toHaveBeenCalledTimes(10);
    expect(context.stroke).toHaveBeenCalledTimes(220); //22 unchanged skeleton strokes/submission.
    expect(props.timings.current.submissionAge).toEqual([0, 0, 0, 0, 0]);
    expect(queued.size).toBe(1);
  });
  it("redraws selection, observation, size, hidden/revealed backing store and DPR changes", () => {
    const props = inputs();
    const view = render(<ReachStage {...props} kind="CAMERA" />);
    tick(110);
    props.frame.current.activeTrack = null;
    tick(120);
    expect(context.clearRect).toHaveBeenCalledTimes(2);
    expect(strokes.at(-1)?.style).toBe("#e7bb77");
    width = 400;
    tick(130);
    expect(view.container.querySelector("canvas")!.width).toBe(400);
    expect(context.clearRect).toHaveBeenCalledTimes(3);
    vi.stubGlobal("devicePixelRatio", 2);
    tick(140);
    expect(view.container.querySelector("canvas")!.width).toBe(800);
    expect(context.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, 0, 0);
    height = 0;
    tick(150);
    height = 240;
    tick(160);
    expect(view.container.querySelector("canvas")!.height).toBe(480);
    expect(context.clearRect).toHaveBeenCalledTimes(6);
    props.frame.current.observation = { ...props.frame.current.observation!, monotonicCaptureTime: 170 };
    tick(180);
    expect(context.clearRect).toHaveBeenCalledTimes(7);
  });
  it("snapshots mutable pointer primitives and redraws raw overlay, uncertainty and preview changes", () => {
    const props = inputs();
    props.frame.current.filtered = { x: 0.5, y: 0.5 };
    props.frame.current.raw = { x: 0.4, y: 0.4 };
    props.frame.current.uncertainty = 12;
    const view = render(<ReachStage {...props} kind="POINTER" overlay />);
    tick(110);
    tick(120);
    expect(context.clearRect).toHaveBeenCalledTimes(1);
    expect(context.arc).toHaveBeenCalledWith(160, 120, 12, 0, Math.PI * 2);
    props.frame.current.filtered.x = 0.6;
    tick(130);
    expect(context.arc).toHaveBeenCalledWith(192, 120, 14, 0, Math.PI * 2);
    props.frame.current.raw.x = 0.7;
    tick(140);
    expect(context.moveTo).toHaveBeenCalledWith(0.7 * 320 - 6, 0.4 * 240);
    props.frame.current.uncertainty = 20;
    tick(150);
    props.frame.current.previewEstimate = true;
    tick(160);
    expect(strokes.at(-1)?.style).toBe("#e7bb77");
    expect(context.clearRect).toHaveBeenCalledTimes(5);
    view.rerender(<ReachStage {...props} kind="POINTER" overlay={false} />);
    tick(170);
    expect(context.clearRect).toHaveBeenCalledTimes(6);
    tick(251);
    expect(context.clearRect).toHaveBeenCalledTimes(7);
    tick(260);
    expect(context.clearRect).toHaveBeenCalledTimes(7);
  });
  it("keeps every last-seen fade frame and clears exactly after450ms", () => {
    const props = inputs();
    props.frame.current.lastSeen = { point: { x: 0.2, y: 0.3 }, capturedAt: 100 };
    render(<ReachStage {...props} kind="POINTER" />);
    for (const at of [110, 120, 130]) tick(at);
    expect(context.clearRect).toHaveBeenCalledTimes(3);
    expect(context.fillText).toHaveBeenCalledTimes(3);
    expect(strokes.map((stroke) => stroke.alpha)).toEqual([10, 20, 30].map((age) => 0.55 * (1 - age / 450)));
    tick(550);
    expect(context.clearRect).toHaveBeenCalledTimes(4);
    expect(strokes.at(-1)?.alpha).toBe(0);
    tick(551);
    expect(context.clearRect).toHaveBeenCalledTimes(5);
    expect(context.fillText).toHaveBeenCalledTimes(4);
    tick(600);
    expect(context.clearRect).toHaveBeenCalledTimes(5);
  });
  it("handles a fresh boundary after a future RAF timestamp and cancels polling when inactive or unmounted", () => {
    const props = inputs();
    const view = render(<ReachStage {...props} kind="CAMERA" />);
    tick(99);
    expect(context.stroke).not.toHaveBeenCalled();
    tick(100);
    expect(context.clearRect).toHaveBeenCalledTimes(2);
    expect(strokes.at(-1)?.alpha).toBe(1);
    tick(101);
    expect(context.clearRect).toHaveBeenCalledTimes(2);
    view.rerender(<ReachStage {...props} kind="CAMERA" active={false} />);
    expect(queued.size).toBe(0);
    tick(110);
    expect(context.clearRect).toHaveBeenCalledTimes(3); // Deactivation also clears the retained canvas once.
    view.unmount();
    expect(queued.size).toBe(0);
  });
  it.each(["CAMERA", "POINTER"] as const)(
    "clears the full %s backing bitmap when stopped and redraws only after a fresh activation",
    (kind) => {
      vi.stubGlobal("devicePixelRatio", 2);
      const props = inputs();
      props.frame.current.filtered = { x: 0.5, y: 0.5 };
      const view = render(<ReachStage {...props} kind={kind} />);
      tick(110);
      const el = view.container.querySelector("canvas")!;
      expect([el.width, el.height]).toEqual([640, 480]);
      expect(context.stroke).toHaveBeenCalled();
      const drawn = vi.mocked(context.stroke).mock.calls.length;
      const submitted = [...props.timings.current.submissionAge];
      // Stop replaces the frame ref while retaining this mounted canvas.
      props.frame.current.observation = null;
      props.frame.current.filtered = null;
      view.rerender(<ReachStage {...props} kind={kind} active={false} />);
      expect(context.setTransform).toHaveBeenLastCalledWith(1, 0, 0, 1, 0, 0);
      expect(context.clearRect).toHaveBeenLastCalledWith(0, 0, 640, 480);
      expect(queued.size).toBe(0);
      const clears = vi.mocked(context.clearRect).mock.calls.length;
      width = 480;
      height = 320;
      tick(600);
      expect(context.clearRect).toHaveBeenCalledTimes(clears);
      expect(context.stroke).toHaveBeenCalledTimes(drawn);
      expect(props.timings.current.submissionAge).toEqual(submitted);
      props.frame.current.observation = syntheticObservation({ x: 0.6, y: 0.5 }, 2, 610);
      props.frame.current.filtered = { x: 0.6, y: 0.5 };
      view.rerender(<ReachStage {...props} kind={kind} active />);
      expect(queued.size).toBe(1);
      tick(620);
      expect([el.width, el.height]).toEqual([960, 640]);
      expect(context.stroke).toHaveBeenCalledTimes(drawn + (kind === "CAMERA" ? 22 : 1));
      view.unmount();
      expect(queued.size).toBe(0);
    },
  );
  it("keeps an initially inactive canvas blank without starting polling or submitting observations", () => {
    const props = inputs();
    const view = render(<ReachStage {...props} kind="CAMERA" active={false} />);
    const el = view.container.querySelector("canvas")!;
    expect(context.setTransform).toHaveBeenLastCalledWith(1, 0, 0, 1, 0, 0);
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, el.width, el.height);
    expect(queued.size).toBe(0);
    tick(110);
    expect(context.stroke).not.toHaveBeenCalled();
    expect(props.timings.current.submissionAge).toEqual([]);
  });
});
