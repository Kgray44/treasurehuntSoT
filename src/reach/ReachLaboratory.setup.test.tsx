// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReachLaboratory } from "./ReachLaboratory";
import { SampleWindow } from "./sample-window";
import { defaultReachRuntimePolicy } from "./runtime-policy";

vi.mock("./runtime-policy-client", () => ({
  useReachRuntimePolicy: () => ({ status: "READY", revision: 1, policy: defaultReachRuntimePolicy, refresh: () => {} }),
}));

// D0 ReactDOM interaction regression only: no camera, worker, physical accuracy or acceptance claim.
vi.mock("./ReachStage", () => ({ ReachStage: () => null }));
vi.mock("motion/react", async () => {
  const React = await import("react");
  return {
    motion: {
      div: React.forwardRef<HTMLDivElement, ComponentProps<"div"> & { animate?: unknown; initial?: unknown }>(
        function StaticDiagnosticDiv({ animate: _animate, initial: _initial, ...props }, ref) {
          return React.createElement("div", { ...props, ref });
        },
      ),
    },
  };
});

let pauseDemoObservations = false;
let deliveredDemoObservations = 0;
let lastDemoObservationAt = -Infinity;
let demoIntervals = 0;
let intervalDelays: (number | undefined)[] = [];

function advance(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

function nativeClick(element: HTMLElement) {
  const delivered = vi.fn();
  element.addEventListener("click", delivered);
  try {
    act(() => {
      element.click();
    });
    // HTMLElement.click honors disabled controls; do not dispatch/force the event or invoke the handler.
    expect(delivered).toHaveBeenCalledTimes(1);
  } finally {
    element.removeEventListener("click", delivered);
  }
}

function laboratory() {
  return screen.getByRole("region", { name: "Find your point." });
}

function setupButton() {
  return screen.getByRole("button", { name: "Begin nine-point calibration" });
}

function currentGuidance() {
  const guidance = screen.getByRole("status", { name: "Reach status" }).querySelector("strong");
  expect(guidance).not.toBeNull();
  return guidance!.textContent!;
}

function expectPrepared() {
  expect(laboratory()).toHaveAttribute("data-step", "PREPARE");
  expect(screen.queryByLabelText(/^Target \d+ of \d+$/)).not.toBeInTheDocument();
}

function startDemo(condition: "NONE" | "TWO_HANDS" = "NONE") {
  render(<ReachLaboratory />);
  nativeClick(screen.getByRole("button", { name: "Explore guided demo" }));
  if (condition === "TWO_HANDS") {
    // Existing D0 condition before the first observation: no sticky active hand has been selected.
    fireEvent.change(screen.getByRole("combobox", { name: "Demo tracking condition" }), {
      target: { value: condition },
    });
  }
  advance(600);
  expect(demoIntervals).toBe(1);
  expect(intervalDelays).toEqual(expect.arrayContaining([50, 100, 1000]));
  expect(deliveredDemoObservations).toBe(12);
  expect(performance.now() - lastDemoObservationAt).toBe(0);
  nativeClick(screen.getByRole("radio", { name: "Absolute pointing" }));
  expect(laboratory()).toHaveAttribute("data-pointing-mode", "ABSOLUTE");
  advance(600);
  expectPrepared();
}

function startReadyDemo() {
  startDemo();
  expect(currentGuidance()).toBe("Your hand is ready. Keep a relaxed index point.");
  expect(setupButton()).toBeEnabled();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date", "performance"] });
  pauseDemoObservations = false;
  deliveredDemoObservations = 0;
  lastDemoObservationAt = -Infinity;
  demoIntervals = 0;
  intervalDelays = [];
  // jsdom has no layout observer/media playback; the real Reach selector/demo/timers/guards remain installed.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const clockSetInterval = globalThis.setInterval.bind(globalThis);
  vi.spyOn(globalThis, "setInterval").mockImplementation((handler, delay, ...args) => {
    intervalDelays.push(delay);
    if (delay !== 50) return clockSetInterval(handler, delay, ...args);
    demoIntervals += 1;
    if (typeof handler !== "function") throw new Error("Expected the existing D0 observation callback");
    return clockSetInterval(() => {
      if (pauseDemoObservations) return;
      handler(...args);
      deliveredDemoObservations += 1;
      lastDemoObservationAt = performance.now();
    }, delay);
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Reach explicit setup requests (D0 ReactDOM only)", () => {
  it.each([200, 300])("delivers a native setup click at age %ims without collecting stale samples", (age) => {
    const sampling = vi.spyOn(SampleWindow.prototype, "push");
    startReadyDemo();
    const delivered = deliveredDemoObservations;
    pauseDemoObservations = true;
    advance(age);
    expect(performance.now() - lastDemoObservationAt).toBe(age);
    expect(deliveredDemoObservations).toBe(delivered);
    // The unchanged 100ms freshness task has run: rendered eligibility is no longer fresh.
    expect(currentGuidance()).toBe("Waiting for fresh tracking. Hold here briefly.");
    nativeClick(setupButton());
    expect(laboratory()).toHaveAttribute("data-step", "TRAINING");
    expect(screen.getByLabelText("Target 1 of 9")).toHaveAttribute("data-calibration-target", "true");
    nativeClick(screen.getByRole("button", { name: "Move demo hand to target" }));
    advance(1000);
    expect(deliveredDemoObservations).toBe(delivered);
    expect(sampling).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Target 1 of 9")).toBeInTheDocument();
    expect(screen.queryByLabelText("Target 2 of 9")).not.toBeInTheDocument();
  });

  it("opens an empty target beyond the old 300ms entry grace without treating stale evidence as a sample", () => {
    const sampling = vi.spyOn(SampleWindow.prototype, "push");
    startReadyDemo();
    pauseDemoObservations = true;
    advance(301);
    expect(performance.now() - lastDemoObservationAt).toBe(301);
    const guidance = currentGuidance();
    expect(guidance).toBe("Waiting for fresh tracking. Hold here briefly.");
    nativeClick(setupButton());
    expect(laboratory()).toHaveAttribute("data-step", "TRAINING");
    expect(screen.getByLabelText("Target 1 of 9")).toBeInTheDocument();
    nativeClick(screen.getByRole("button", { name: "Move demo hand to target" }));
    advance(1000);
    expect(sampling).not.toHaveBeenCalled();
    pauseDemoObservations = false;
    advance(600);
    expect(screen.getByLabelText("Target 1 of 9")).toBeInTheDocument();
    expect(sampling).toHaveBeenCalled();
  });

  it.each([
    ["NO_HAND", "Tracking paused. Bring the same hand back; completed targets stay saved."],
    ["POSTURE", "Extend your index finger comfortably; a gentle bend and relaxed fingers are fine."],
    ["TWO_HANDS", "Choose the hand you want to use, or show just one pointing hand."],
  ])("keeps an explicitly opened target empty during %s and resumes on fresh eligible recovery", (fault, guidance) => {
    const sampling = vi.spyOn(SampleWindow.prototype, "push");
    if (fault === "TWO_HANDS") {
      startDemo("TWO_HANDS");
    } else {
      startReadyDemo();
      fireEvent.change(screen.getByRole("combobox", { name: "Demo tracking condition" }), { target: { value: fault } });
      advance(600);
    }
    expect(currentGuidance()).toBe(guidance);
    pauseDemoObservations = true;
    nativeClick(setupButton());
    expect(laboratory()).toHaveAttribute("data-step", "TRAINING");
    expect(screen.getByLabelText("Target 1 of 9")).toBeInTheDocument();
    nativeClick(screen.getByRole("button", { name: "Move demo hand to target" }));
    advance(1000);
    expect(sampling).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("combobox", { name: "Demo tracking condition" }), { target: { value: "NONE" } });
    pauseDemoObservations = false;
    advance(600);
    expect(currentGuidance()).toBe("Your hand is ready. Keep a relaxed index point.");
    expect(screen.getByLabelText("Target 1 of 9")).toBeInTheDocument();
    expect(sampling).toHaveBeenCalled();
  });
});
