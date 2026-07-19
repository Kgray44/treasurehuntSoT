import { describe, expect, it } from "vitest";
import type { PresentationReceipt } from "@/animation/core/animation-types";
import type { ClientProgressEvent } from "@/domain/story";
import {
  MAX_PROGRESSION_CONTROLLER_RECEIPTS,
  ProgressionPresentationController,
  type ProgressionPresentationExecution,
} from "./ProgressionPresentationController";
import type { ProgressionPresentationRequest } from "./contracts";

function event(id: string, sequence: number, type: ClientProgressEvent["type"] = "PLAYER_LOG_ENTRY_ADDED") {
  return Object.freeze({
    id,
    sequence,
    type,
    payload: Object.freeze({ key: id, title: `Title ${id}` }),
    releaseAt: "2026-07-19T00:00:00.000Z",
  }) satisfies ClientProgressEvent;
}

function sceneReceipt(request: ProgressionPresentationRequest, acknowledgmentAllowed = true): PresentationReceipt {
  return {
    sceneName: "log-entry",
    sceneInstanceId: `scene:${request.playbackIdentity}`,
    hostId: "player-progression-host",
    hostKind: "player-progression",
    requestSource: request.source === "replay" ? "replay" : "automatic",
    eventOrActionId: request.eventId,
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
    startedAt: 1,
    completedAt: 2,
    durationMs: 1,
    semanticLabelsReached: ["content-readable"],
    targetReport: {
      sceneName: "log-entry",
      sceneInstanceId: `scene:${request.playbackIdentity}`,
      hostId: "player-progression-host",
      startedAt: 1,
      completedAt: 2,
      durationMs: 1,
      requiredSatisfied: true,
      observations: [],
      failures: [],
    },
    acknowledgmentAllowed,
    cleanup: "completed",
  };
}

function harness(
  overrides: {
    present?: (request: ProgressionPresentationRequest) => Promise<ProgressionPresentationExecution>;
    acknowledge?: (eventId: string) => Promise<boolean>;
    cancelActive?: (requestId: string) => void;
  } = {},
) {
  let clock = 10;
  let identity = 0;
  const presented: ProgressionPresentationRequest[] = [];
  const receipts: string[] = [];
  const acknowledged: string[] = [];
  const cancelled: string[] = [];
  const settled: Array<{
    eventId: string;
    acknowledgmentAttempted: boolean;
    acknowledged: boolean;
    acknowledgedCursor: number;
  }> = [];
  const controller = new ProgressionPresentationController({
    now: () => ++clock,
    createIdentity: (kind, nextEvent, source) => `${kind}:${source}:${nextEvent.id}:${++identity}`,
    present:
      overrides.present ??
      (async (request) => {
        presented.push(request);
        return { status: "presented", sceneReceipt: sceneReceipt(request) };
      }),
    acknowledge: async (receipt) => {
      acknowledged.push(receipt.eventId);
      return overrides.acknowledge?.(receipt.eventId) ?? true;
    },
    cancelActive: (requestId) => {
      cancelled.push(requestId);
      overrides.cancelActive?.(requestId);
    },
    onReceipt: (receipt) => receipts.push(`${receipt.eventId}:${receipt.status}:${receipt.source}`),
    onSettled: (notification) =>
      settled.push({
        eventId: notification.request.eventId,
        acknowledgmentAttempted: notification.acknowledgmentAttempted,
        acknowledged: notification.acknowledged,
        acknowledgedCursor: notification.snapshot.cursors.acknowledged,
      }),
  });
  return { controller, presented, receipts, acknowledged, cancelled, settled };
}

describe("ProgressionPresentationController", () => {
  it("keeps authoritative work oldest-first and permanently behind no replay", async () => {
    let releaseBlocker: (() => void) | undefined;
    let blockerStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      blockerStarted = resolve;
    });
    const { controller, presented } = harness({
      present: async (request) => {
        presented.push(request);
        if (request.eventId === "blocker") {
          blockerStarted?.();
          await new Promise<void>((resolve) => {
            releaseBlocker = resolve;
          });
        }
        return { status: "presented", sceneReceipt: sceneReceipt(request) };
      },
    });
    controller.submit(event("blocker", 1), "live");
    await started;
    controller.submit(event("replay-old", 1), "replay");
    controller.submit(event("live-next", 2), "reconnect");
    releaseBlocker?.();
    await controller.awaitIdle();

    expect(presented.map((request) => `${request.eventId}:${request.source}`)).toEqual([
      "blocker:live",
      "live-next:reconnect",
      "replay-old:replay",
    ]);
  });

  it("tracks observed, queued, presented, and acknowledged cursors separately", async () => {
    const { controller, acknowledged } = harness({
      acknowledge: async (eventId) => eventId !== "event-2",
    });
    controller.submit(event("event-1", 1), "live");
    controller.submit(event("event-2", 2), "live");
    await controller.awaitIdle();

    expect(controller.snapshot().cursors).toEqual({ observed: 2, queued: 2, presented: 2, acknowledged: 1 });
    expect(acknowledged).toEqual(["event-1", "event-2"]);
  });

  it("skips server-confirmed reconnect work but permits explicit replay without another acknowledgment", async () => {
    const { controller, presented, acknowledged, settled } = harness();
    await controller.reconcile({
      events: [event("already-seen", 1), event("unseen", 2)],
      acknowledgedEventIds: ["already-seen"],
      source: "reconnect",
    });
    controller.submit(event("already-seen", 1), "replay");
    await controller.awaitIdle();

    expect(presented.map((request) => request.eventId)).toEqual(["unseen", "already-seen"]);
    expect(acknowledged).toEqual(["unseen"]);
    expect(settled).toEqual([
      { eventId: "unseen", acknowledgmentAttempted: true, acknowledged: true, acknowledgedCursor: 2 },
      { eventId: "already-seen", acknowledgmentAttempted: false, acknowledged: false, acknowledgedCursor: 2 },
    ]);
  });

  it("cancels Director only after the queue authorizes replay interruption", async () => {
    let releaseReplay: ((execution: ProgressionPresentationExecution) => void) | undefined;
    let markReplayStarted: (() => void) | undefined;
    const replayStarted = new Promise<void>((resolve) => {
      markReplayStarted = resolve;
    });
    const { controller, presented, cancelled } = harness({
      present: (request) => {
        presented.push(request);
        if (request.source !== "replay") {
          return Promise.resolve({ status: "presented", sceneReceipt: sceneReceipt(request) });
        }
        markReplayStarted?.();
        return new Promise((finish) => {
          releaseReplay = finish;
        });
      },
      cancelActive: () => releaseReplay?.({ status: "cancelled" }),
    });
    controller.submit(event("replay", 1), "replay");
    await replayStarted;
    controller.submit(event("authoritative", 2), "live");
    await controller.awaitIdle();

    expect(cancelled).toHaveLength(1);
    expect(presented.map((request) => request.eventId)).toEqual(["replay", "authoritative"]);
  });

  it("reconciles oldest-first and emits duplicate/stale receipts without presentation", async () => {
    const { controller, presented, receipts } = harness();
    await controller.reconcile({
      events: [event("third", 3), event("first", 1), event("second", 2)],
      acknowledgedEventIds: [],
      source: "reconnect",
    });
    controller.submit(event("late-different-id", 1), "live");
    await controller.awaitIdle();

    expect(presented.map((request) => request.eventId)).toEqual(["first", "second", "third"]);
    expect(receipts).toContain("late-different-id:stale:live");
  });

  it("bounds retained receipts and gives replay fresh immutable identities without acknowledgment", async () => {
    const { controller, acknowledged } = harness({ acknowledge: async () => false });
    controller.submit(event("original", 1), "live");
    await controller.awaitIdle();
    for (let index = 0; index < MAX_PROGRESSION_CONTROLLER_RECEIPTS + 10; index += 1) {
      controller.submit(event("original", 1), "live");
    }
    controller.submit(event("original", 1), "replay");
    await controller.awaitIdle();

    const snapshot = controller.snapshot();
    expect(snapshot.queue.receipts).toHaveLength(MAX_PROGRESSION_CONTROLLER_RECEIPTS);
    expect(acknowledged).toEqual(["original"]);
    expect(snapshot.queue.receipts.at(-1)).toMatchObject({ source: "replay", acknowledgmentEligible: false });
  });
});
