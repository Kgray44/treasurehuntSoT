import { describe, expect, it } from "vitest";
import type { PresentationReceipt } from "@/animation/core/animation-types";
import {
  progressionPresentationPriorities,
  type Phase3PlayerProgressEventType,
  type ProgressionPresentationRequest,
} from "./contracts";
import {
  cancelProgressionPresentation,
  createProgressionPresentationQueue,
  createReplayPresentationRequest,
  enqueueProgressionPresentation,
  interruptReplayForAuthoritative,
  settleActiveProgressionPresentation,
  takeNextProgressionPresentation,
} from "./presentation-queue";

function request(
  requestId: string,
  eventId: string,
  eventSequence: number,
  eventType: Phase3PlayerProgressEventType = "PLAYER_LOG_ENTRY_ADDED",
  overrides: Partial<ProgressionPresentationRequest> = {},
): ProgressionPresentationRequest {
  return {
    requestId,
    eventId,
    eventSequence,
    eventType,
    payload: { title: eventId },
    source: "live",
    policyVersion: 1,
    priority: progressionPresentationPriorities.informational,
    enqueuedAt: 10,
    relevantSection: "log",
    mandatory: false,
    playbackIdentity: `playback-${requestId}`,
    acknowledgmentEligible: true,
    ...overrides,
  } as ProgressionPresentationRequest;
}

function directorReceipt(acknowledgmentAllowed: boolean): PresentationReceipt {
  return {
    sceneName: "log-entry",
    sceneInstanceId: "scene-instance-1",
    hostId: "player-progression-host",
    hostKind: "player-progression",
    requestSource: "automatic",
    eventOrActionId: "event-1",
    outcome: "presented",
    motionPolicy: {
      level: "full",
      source: { productSetting: "full", browserPrefersReduced: false },
      allowSpatialTravel: true,
      allowContinuousAmbientMotion: true,
      allowPageCurl: true,
      allowRiveStateTravel: true,
      allowLottiePlayback: true,
      allowMotionCues: true,
      durationScale: 1,
      distanceScale: 1,
      preserveSemanticStaging: true,
    },
    startedAt: 20,
    completedAt: 30,
    durationMs: 10,
    semanticLabelsReached: ["content-readable"],
    targetReport: {
      sceneName: "log-entry",
      sceneInstanceId: "scene-instance-1",
      hostId: "player-progression-host",
      startedAt: 20,
      completedAt: 30,
      durationMs: 10,
      requiredSatisfied: true,
      observations: [],
      failures: [],
    },
    acknowledgmentAllowed,
    cleanup: "completed",
  };
}

function enqueueAll(requests: readonly ProgressionPresentationRequest[]) {
  return requests.reduce(
    (queue, next) => enqueueProgressionPresentation(queue, next).queue,
    createProgressionPresentationQueue(),
  );
}

describe("ProgressionPresentationQueue", () => {
  it("orders authoritative work by sequence, then policy priority, then stable request ID", () => {
    const queue = enqueueAll([
      request("request-z", "event-z", 5),
      request("request-b", "event-b", 4, "MAP_LOCATION_REVEALED", {
        priority: progressionPresentationPriorities.section,
      }),
      request("request-c", "event-c", 4, "STATE_REVERTED", {
        priority: progressionPresentationPriorities.reversal,
      }),
      request("request-a", "event-a", 4, "STATE_REVERTED", {
        priority: progressionPresentationPriorities.reversal,
      }),
    ]);

    expect(queue.pending.map((item) => item.requestId)).toEqual(["request-a", "request-c", "request-b", "request-z"]);
  });

  it("always keeps replay behind authoritative work regardless of historical sequence or numeric priority", () => {
    const live = request("live", "event-live", 12);
    const replay = createReplayPresentationRequest(
      request("original", "event-old", 1, "CHAPTER_RELEASED", {
        priority: progressionPresentationPriorities.ceremony,
        relevantSection: "journal",
        mandatory: true,
      }),
      { requestId: "replay", playbackIdentity: "replay-playback", enqueuedAt: 11 },
    );
    const queue = enqueueAll([replay, live]);
    expect(queue.pending.map((item) => item.requestId)).toEqual(["live", "replay"]);
  });

  it("emits a duplicate receipt without changing pending order, audio, scene, or acknowledgment truth", () => {
    const first = request("request-1", "event-1", 1);
    const next = request("request-2", "event-2", 2);
    const initial = enqueueAll([first, next]);
    const before = initial.pending.map((item) => item.requestId);
    const duplicate = request("request-duplicate", "event-1", 1, "PLAYER_LOG_ENTRY_ADDED", {
      priority: progressionPresentationPriorities.ceremony,
    });

    const result = enqueueProgressionPresentation(initial, duplicate, 50);
    expect(result.queue.pending.map((item) => item.requestId)).toEqual(before);
    expect(result.receipt).toMatchObject({
      requestId: "request-duplicate",
      eventId: "event-1",
      status: "duplicate",
      acknowledgmentEligible: false,
      semanticLabels: [],
    });
    expect(result.receipt).not.toHaveProperty("sceneReceipt");
    expect(result.receipt).not.toHaveProperty("targetReport");
  });

  it("records stale authoritative work after the settled cursor without reserving its event ID", () => {
    const queue = createProgressionPresentationQueue(10);
    const result = enqueueProgressionPresentation(queue, request("request-stale", "event-stale", 9), 40);
    expect(result.receipt?.status).toBe("stale");
    expect(result.queue.pending).toEqual([]);
    expect(result.queue.authoritativeEventIds).not.toContain("event-stale");
  });

  it("allows acknowledgment only for successful authoritative work with Director proof", () => {
    const live = request("live", "event-live", 1);
    let queue = enqueueProgressionPresentation(createProgressionPresentationQueue(), live).queue;
    queue = takeNextProgressionPresentation(queue, 20).queue;
    const liveResult = settleActiveProgressionPresentation(queue, {
      requestId: "live",
      status: "presented",
      completedAt: 30,
      sceneReceipt: directorReceipt(true),
    });
    expect(liveResult.receipt.acknowledgmentEligible).toBe(true);
    expect(liveResult.queue.settledAuthoritativeSequence).toBe(1);

    const replay = createReplayPresentationRequest(live, {
      requestId: "replay",
      playbackIdentity: "replay-playback",
      enqueuedAt: 40,
    });
    queue = enqueueProgressionPresentation(liveResult.queue, replay).queue;
    queue = takeNextProgressionPresentation(queue, 50).queue;
    const replayResult = settleActiveProgressionPresentation(queue, {
      requestId: "replay",
      status: "presented",
      completedAt: 60,
      sceneReceipt: directorReceipt(true),
    });
    expect(replayResult.receipt.acknowledgmentEligible).toBe(false);
    expect(replayResult.receipt.source).toBe("replay");
    expect(replayResult.queue.settledAuthoritativeSequence).toBe(1);
  });

  it("requires fresh replay request and playback identities while preserving immutable event truth", () => {
    const original = request("original", "event-1", 7, "MAP_ROUTE_REVEALED", {
      payload: { key: "route-1", fromKey: "a", toKey: "b" },
      priority: progressionPresentationPriorities.section,
      relevantSection: "chart",
    });
    const replay = createReplayPresentationRequest(original, {
      requestId: "replay-1",
      playbackIdentity: "playback-replay-1",
      enqueuedAt: 100,
    });
    expect(replay).toMatchObject({
      requestId: "replay-1",
      playbackIdentity: "playback-replay-1",
      source: "replay",
      acknowledgmentEligible: false,
      eventId: "event-1",
      eventSequence: 7,
      payload: original.payload,
    });
    expect(() =>
      createReplayPresentationRequest(original, {
        requestId: original.requestId,
        playbackIdentity: "new-playback",
        enqueuedAt: 100,
      }),
    ).toThrow(/fresh request and playback identities/i);
  });

  it("deterministically interrupts replay and selects the first authoritative replacement", () => {
    const replay = createReplayPresentationRequest(request("original", "old-event", 20), {
      requestId: "replay",
      playbackIdentity: "replay-playback",
      enqueuedAt: 1,
    });
    let queue = enqueueProgressionPresentation(createProgressionPresentationQueue(), replay).queue;
    queue = takeNextProgressionPresentation(queue, 2).queue;
    queue = enqueueProgressionPresentation(queue, request("live-later", "event-3", 3)).queue;
    queue = enqueueProgressionPresentation(queue, request("live-next", "event-2", 2)).queue;

    const interrupted = interruptReplayForAuthoritative(queue, 3, false);
    expect(interrupted.receipt).toMatchObject({ requestId: "replay", status: "interrupted" });
    expect(interrupted.replacementRequestId).toBe("live-next");
    expect(interrupted.queue.active).toBeNull();

    const replacement = takeNextProgressionPresentation(interrupted.queue, 4);
    expect(replacement.request?.requestId).toBe("live-next");
  });

  it("defers authoritative replacement at a replay semantic commit boundary", () => {
    const chapterReplay = createReplayPresentationRequest(
      request("chapter-original", "chapter-event", 1, "CHAPTER_RELEASED", {
        priority: progressionPresentationPriorities.ceremony,
        relevantSection: "journal",
        mandatory: true,
      }),
      { requestId: "chapter-replay", playbackIdentity: "chapter-replay-playback", enqueuedAt: 1 },
    );
    let queue = enqueueProgressionPresentation(createProgressionPresentationQueue(), chapterReplay).queue;
    queue = takeNextProgressionPresentation(queue, 2).queue;
    queue = enqueueProgressionPresentation(queue, request("live", "live-event", 2)).queue;

    const deferred = interruptReplayForAuthoritative(queue, 3, true);
    expect(deferred.receipt).toMatchObject({ requestId: "live", status: "deferred" });
    expect(deferred.queue.active?.request.requestId).toBe("chapter-replay");

    const interrupted = interruptReplayForAuthoritative(deferred.queue, 4, false);
    expect(interrupted.receipt).toMatchObject({ requestId: "chapter-replay", status: "interrupted" });
    expect(interrupted.queue.active).toBeNull();
  });

  it("releases failed and cancelled authoritative reservations for bounded explicit retry", () => {
    const first = request("attempt-1", "event-1", 1);
    let queue = enqueueProgressionPresentation(createProgressionPresentationQueue(), first).queue;
    queue = takeNextProgressionPresentation(queue, 20).queue;
    const failed = settleActiveProgressionPresentation(queue, {
      requestId: "attempt-1",
      status: "failed",
      completedAt: 30,
    });
    expect(failed.receipt.retryDisposition).toBe("retryable");
    expect(failed.queue.authoritativeEventIds).not.toContain("event-1");

    const retry = request("attempt-2", "event-1", 1);
    const retried = enqueueProgressionPresentation(failed.queue, retry);
    expect(retried.receipt).toBeUndefined();
    expect(retried.queue.pending.map((item) => item.requestId)).toContain("attempt-2");

    const cancelled = cancelProgressionPresentation(retried.queue, "attempt-2", 40);
    expect(cancelled.receipt?.status).toBe("cancelled");
    expect(cancelled.queue.authoritativeEventIds).not.toContain("event-1");
  });
});
