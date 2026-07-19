import { describe, expect, it } from "vitest";
import type { JournalPhaseOutcome, PresentationOutcome, PresentationReceipt } from "@/animation/core/animation-types";
import type { ReplayablePresentation } from "@/domain/story";
import {
  canUseReadableChapterFallback,
  decideChapterPresentation,
  journalPhaseDisposition,
  presentationDiagnostic,
  receiptValidatesAudio,
  shouldSuppressChapterViewed,
  toChapterReleaseClientEvent,
} from "./presentation-policy";

const allowedOutcomes: PresentationOutcome[] = ["presented", "presented-fallback", "skipped-by-user"];
const failureOutcomes: PresentationOutcome[] = [
  "skipped-by-policy",
  "aborted",
  "interrupted",
  "timed-out",
  "missing-required-target",
  "duplicate-required-target",
  "ownership-rejected",
  "runtime-failed",
];

function receipt(overrides: Partial<PresentationReceipt> = {}): PresentationReceipt {
  return {
    sceneName: "chapter-release",
    sceneInstanceId: "scene-instance-1",
    hostId: "player-progression-host",
    hostKind: "player-progression",
    requestSource: "automatic",
    eventOrActionId: "event-release-1",
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
    semanticLabelsReached: ["seal", "content-readable"],
    targetReport: {
      sceneName: "chapter-release",
      sceneInstanceId: "scene-instance-1",
      hostId: "player-progression-host",
      startedAt: 1,
      completedAt: 2,
      durationMs: 1,
      requiredSatisfied: true,
      observations: [
        {
          part: "ink-story",
          required: true,
          matchedCount: 1,
          visibleCount: 1,
          duplicateCount: 0,
          ownershipRejectedCount: 0,
          observations: [],
        },
      ],
      failures: [],
    },
    acknowledgmentAllowed: true,
    cleanup: "completed",
    ...overrides,
  };
}

describe("Player presentation policy", () => {
  it.each(allowedOutcomes)("acknowledges allowed automatic outcome %s exactly through the decision gate", (outcome) => {
    expect(decideChapterPresentation(receipt({ outcome, acknowledgmentAllowed: true }), false)).toEqual({
      shouldAcknowledge: true,
      retryable: false,
      completed: true,
    });
  });

  it.each(failureOutcomes)("keeps failed automatic outcome %s unacknowledged and retryable", (outcome) => {
    expect(decideChapterPresentation(receipt({ outcome, acknowledgmentAllowed: false }), false)).toEqual({
      shouldAcknowledge: false,
      retryable: true,
      completed: false,
    });
  });

  it.each(failureOutcomes)(
    "denies automatic failure %s even if a malformed receipt allows acknowledgment",
    (outcome) => {
      expect(decideChapterPresentation(receipt({ outcome, acknowledgmentAllowed: true }), false)).toEqual({
        shouldAcknowledge: false,
        retryable: true,
        completed: false,
      });
    },
  );

  it.each(allowedOutcomes)("keeps allowed outcome %s retryable when the receipt denies acknowledgment", (outcome) => {
    expect(decideChapterPresentation(receipt({ outcome, acknowledgmentAllowed: false }), false)).toEqual({
      shouldAcknowledge: false,
      retryable: true,
      completed: false,
    });
  });

  it("never acknowledges replay and suppresses duplicate automatic acknowledgment", () => {
    expect(
      decideChapterPresentation(
        receipt({ requestSource: "replay", outcome: "presented", acknowledgmentAllowed: true }),
        false,
      ),
    ).toEqual({ shouldAcknowledge: false, retryable: false, completed: true });
    expect(decideChapterPresentation(receipt(), true)).toEqual({
      shouldAcknowledge: false,
      retryable: false,
      completed: true,
    });
  });

  it("suppresses chapter content-view mutation while mandatory presentation is pending or failed", () => {
    expect(shouldSuppressChapterViewed("event-1", null)).toBe(true);
    expect(shouldSuppressChapterViewed(null, "event-1")).toBe(true);
    expect(shouldSuppressChapterViewed(null, null, true)).toBe(true);
    expect(shouldSuppressChapterViewed(null, null)).toBe(false);
  });

  it("reconstructs repeated replay with immutable event identity and payload", () => {
    const presentation: ReplayablePresentation = {
      eventId: "event-release-1",
      eventType: "CHAPTER_RELEASED",
      sequence: 7,
      occurredAt: "2026-07-18T12:00:00.000Z",
      sceneName: "chapter-release",
      payloadVersion: 1,
      payload: {
        ordinal: 1,
        title: "Safe title",
        narrative: "Safe narrative",
        objective: "Safe objective",
        riddle: "Safe riddle",
      },
      replayPolicy: "presentation-only",
    };

    const first = toChapterReleaseClientEvent(presentation);
    const second = toChapterReleaseClientEvent(presentation);
    expect(first).toEqual(second);
    expect(first.id).toBe("event-release-1");
    expect(first.payload).toEqual(presentation.payload);
  });

  it.each([
    ["completed", "continue"],
    ["completed-fallback", "readable-fallback"],
    ["aborted", "aborted"],
    ["missing-actor", "failed"],
    ["missing-animation", "failed"],
    ["timed-out", "failed"],
    ["runtime-failed", "failed"],
  ] as const)("maps Journal phase %s explicitly to %s", (status, disposition) => {
    expect(journalPhaseDisposition({ status } as JournalPhaseOutcome)).toBe(disposition);
  });

  it("permits a readable chapter fallback only for reduced, non-aborted presentation", () => {
    expect(canUseReadableChapterFallback("reduced", true, false)).toBe(true);
    expect(canUseReadableChapterFallback("full", true, false)).toBe(false);
    expect(canUseReadableChapterFallback("reduced", false, false)).toBe(false);
    expect(canUseReadableChapterFallback("reduced", true, true)).toBe(false);
  });

  it("requires target and semantic-label proof for post-receipt audio", () => {
    expect(receiptValidatesAudio(receipt(), "seal")).toBe(true);
    expect(receiptValidatesAudio(receipt(), "not-reached")).toBe(false);
    expect(receiptValidatesAudio(receipt({ outcome: "runtime-failed", acknowledgmentAllowed: false }), "seal")).toBe(
      false,
    );
  });

  it("builds a bounded diagnostic from identifiers and counts only", () => {
    const diagnostic = presentationDiagnostic(receipt());
    expect(diagnostic).toContain("event=event-release-1");
    expect(diagnostic).toContain("visible=1");
    expect(diagnostic).not.toContain("Safe narrative");
  });
});
