import { afterEach, describe, expect, it, vi } from "vitest";

import type { PresentationReceipt } from "./animation-types";
import {
  createPresentationTelemetryRecorder,
  readPresentationTelemetry,
  recordPresentationTelemetry,
  resetPresentationTelemetry,
  subscribePresentationTelemetry,
  toPresentationTelemetryEvent,
} from "./presentation-telemetry";

function receipt(overrides: Partial<PresentationReceipt<unknown>> = {}): PresentationReceipt<unknown> {
  return {
    sceneName: "chapter-release",
    sceneInstanceId: "chapter-release:42",
    hostId: "player-presentation-host",
    hostKind: "player-chapter",
    requestSource: "automatic",
    eventOrActionId: "event_42",
    outcome: "presented",
    motionPolicy: {
      level: "gentle",
      source: { productSetting: "full", browserPrefersReduced: false },
      allowSpatialTravel: true,
      allowContinuousAmbientMotion: false,
      allowPageCurl: true,
      allowRiveStateTravel: true,
      allowLottiePlayback: true,
      allowMotionCues: true,
      durationScale: 0.65,
      distanceScale: 0.5,
      preserveSemanticStaging: true,
    },
    startedAt: 100,
    completedAt: 350,
    durationMs: 250,
    semanticLabelsReached: ["release-start", "chapter-readable"],
    targetReport: {
      sceneName: "chapter-release",
      sceneInstanceId: "chapter-release:42",
      hostId: "player-presentation-host",
      startedAt: 95,
      completedAt: 100,
      durationMs: 5,
      requiredSatisfied: true,
      observations: [
        {
          part: "chapter-panel",
          required: true,
          matchedCount: 1,
          visibleCount: 1,
          duplicateCount: 0,
          ownershipRejectedCount: 0,
          observations: [
            {
              connected: true,
              rect: { x: 0, y: 0, width: 100, height: 100 },
              display: "block",
              visibility: "visible",
              effectiveOpacity: 1,
              hostIntersection: true,
              pageFlipSource: false,
              staleSceneInstance: false,
              owner: "gsap",
            },
          ],
        },
        {
          part: "release-glow",
          required: false,
          matchedCount: 2,
          visibleCount: 2,
          duplicateCount: 1,
          ownershipRejectedCount: 1,
          observations: [],
        },
      ],
      failures: [],
    },
    finalSemanticState: "chapter-readable",
    acknowledgmentAllowed: true,
    cleanup: "completed",
    operationResult: {
      chapterTitle: "Private chapter title",
      story: "Private story content",
      stack: "Error: secret\n at private/file.ts:1:1",
    },
    ...overrides,
  };
}

afterEach(() => resetPresentationTelemetry());

describe("presentation telemetry projection", () => {
  it("projects presentation truth and bounded target counts without content payloads", () => {
    const event = toPresentationTelemetryEvent(
      receipt({ outcome: "presented-fallback", fallbackUsed: "readable-chapter-release" }),
      {
        route: "/player/tale",
        playerSection: "released-chapter",
      },
    );

    expect(event).toMatchObject({
      version: 1,
      sceneName: "chapter-release",
      sceneInstanceId: "chapter-release:42",
      hostId: "player-presentation-host",
      hostKind: "player-chapter",
      requestSource: "automatic",
      eventOrActionId: "event_42",
      route: "/player/tale",
      playerSection: "released-chapter",
      outcome: "presented-fallback",
      durationMs: 250,
      semanticLabelsReached: ["release-start", "chapter-readable"],
      finalSemanticState: "chapter-readable",
      fallbackUsed: "readable-chapter-release",
      acknowledgmentAllowed: true,
      cleanup: "completed",
      targetSummary: {
        partCount: 2,
        requiredPartCount: 1,
        matchedCount: 3,
        visibleCount: 3,
        duplicateCount: 1,
        ownershipRejectedCount: 1,
      },
    });
    expect(event?.targets).toEqual([
      {
        part: "chapter-panel",
        required: true,
        matchedCount: 1,
        visibleCount: 1,
        duplicateCount: 0,
        ownershipRejectedCount: 0,
      },
      {
        part: "release-glow",
        required: false,
        matchedCount: 2,
        visibleCount: 2,
        duplicateCount: 1,
        ownershipRejectedCount: 1,
      },
    ]);
    expect(event?.motion).toMatchObject({ level: "gentle", durationScale: 0.65, distanceScale: 0.5 });

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("Private chapter title");
    expect(serialized).not.toContain("Private story content");
    expect(serialized).not.toContain("private/file.ts");
    expect(serialized).not.toContain("observations");
    expect(serialized).not.toContain("failures");
    expect(serialized).not.toContain("rect");
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event?.targets)).toBe(true);
    expect(Object.isFrozen(event?.motion.source)).toBe(true);
  });

  it("omits content-like strings, strips route queries, and redacts opaque route segments", () => {
    const unsafe = receipt({
      sceneInstanceId: "chapter release contains prose",
      hostId: "host with private title",
      hostKind: "x".repeat(100),
      eventOrActionId: "event id includes prose",
      semanticLabelsReached: ["safe-label", "Captain's secret title", "x".repeat(81)],
      finalSemanticState: "readable state with text",
      fallbackUsed: "fallback includes text",
    });

    const event = toPresentationTelemetryEvent(unsafe, {
      route: "/player/550e8400-e29b-41d4-a716-446655440000?invitation=PRIVATE#story",
      playerSection: "Chapter One Private",
    });

    expect(event).toMatchObject({
      sceneInstanceId: "redacted",
      hostId: "redacted",
      hostKind: "redacted",
      route: "/player/:redacted",
      semanticLabelsReached: ["safe-label"],
    });
    expect(event).not.toHaveProperty("eventOrActionId");
    expect(event).not.toHaveProperty("playerSection");
    expect(event).not.toHaveProperty("finalSemanticState");
    expect(event).not.toHaveProperty("fallbackUsed");
    expect(JSON.stringify(event)).not.toContain("PRIVATE");
  });

  it("bounds target arrays, counts, scales, and durations", () => {
    const observations = Array.from({ length: 70 }, (_, index) => ({
      part: `part-${index}`,
      required: index % 2 === 0,
      matchedCount: Number.POSITIVE_INFINITY,
      visibleCount: -10,
      duplicateCount: 90_000,
      ownershipRejectedCount: 1.6,
      observations: [],
    }));
    const base = receipt();
    const event = toPresentationTelemetryEvent(
      receipt({
        durationMs: Number.POSITIVE_INFINITY,
        motionPolicy: { ...base.motionPolicy, durationScale: 20, distanceScale: -4 },
        targetReport: { ...base.targetReport, observations },
      }),
    );

    expect(event?.targets).toHaveLength(64);
    expect(event?.targets[0]).toMatchObject({
      matchedCount: 0,
      visibleCount: 0,
      duplicateCount: 10_000,
      ownershipRejectedCount: 2,
    });
    expect(event?.targetSummary.duplicateCount).toBe(10_000);
    expect(event?.durationMs).toBe(0);
    expect(event?.motion.durationScale).toBe(4);
    expect(event?.motion.distanceScale).toBe(0);
  });

  it.each([
    ["sceneName", "not-a-scene"],
    ["requestSource", "unknown-source"],
    ["outcome", "unknown-outcome"],
    ["cleanup", "unknown-cleanup"],
  ])("rejects an invalid %s enum", (key, value) => {
    expect(toPresentationTelemetryEvent(receipt({ [key]: value }))).toBeNull();
  });

  it("rejects malformed resolved motion truth", () => {
    const base = receipt();
    expect(
      toPresentationTelemetryEvent(receipt({ motionPolicy: { ...base.motionPolicy, level: "unknown" as "full" } })),
    ).toBeNull();
    expect(
      toPresentationTelemetryEvent(
        receipt({ motionPolicy: { ...base.motionPolicy, allowPageCurl: "yes" as unknown as boolean } }),
      ),
    ).toBeNull();
  });
});

describe("presentation telemetry recorder", () => {
  it("retains only the bounded newest events and supports safe subscriptions", () => {
    const recorder = createPresentationTelemetryRecorder({ capacity: 2 });
    const listener = vi.fn();
    const unsubscribe = recorder.subscribe(listener);
    recorder.subscribe(() => {
      throw new Error("diagnostic observer failure");
    });

    expect(recorder.record(receipt({ sceneName: "first-arrival" }))).not.toBeNull();
    expect(recorder.record(receipt({ sceneName: "session-reentry" }))).not.toBeNull();
    expect(recorder.record(receipt({ sceneName: "chapter-release" }))).not.toBeNull();

    expect(listener).toHaveBeenCalledTimes(3);
    expect(recorder.read().map((event) => event.sceneName)).toEqual(["session-reentry", "chapter-release"]);
    expect(Object.isFrozen(recorder.read())).toBe(true);

    unsubscribe();
    recorder.record(receipt({ sceneName: "map-reveal" }));
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("does not retain or emit receipts rejected at the runtime validation boundary", () => {
    const recorder = createPresentationTelemetryRecorder();
    const listener = vi.fn();
    recorder.subscribe(listener);

    expect(recorder.record(receipt({ outcome: "not-real" as "presented" }))).toBeNull();
    expect(recorder.read()).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
  });

  it("exposes a resettable application recorder without relying on window state", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePresentationTelemetry(listener);

    expect(recordPresentationTelemetry(receipt())).not.toBeNull();
    expect(readPresentationTelemetry()).toHaveLength(1);
    expect(listener).toHaveBeenCalledOnce();

    resetPresentationTelemetry();
    expect(readPresentationTelemetry()).toEqual([]);
    unsubscribe();
  });
});
