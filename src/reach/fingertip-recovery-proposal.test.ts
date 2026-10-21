// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { describe, expect, it } from "vitest";
import { createFingertipRecoveryProposal, type FingertipRecoveryFrame } from "./fingertip-recovery-proposal";
import { indexImageObservationSchema } from "./index-image-observation";

const current: FingertipRecoveryFrame = {
  providerId: "test-mediapipe",
  providerVersion: "test-version",
  providerGeneration: 1,
  cameraLeaseId: "test-camera",
  cameraFrameVersion: 1,
  frameWidth: 640,
  frameHeight: 480,
  mirrorTransform: "PREVIEW_X",
  orientation: 0,
  sequence: 12,
  monotonicCaptureTime: 1000,
  monotonicPixelOriginTime: 990,
  sourceKey: "test-current-raw-source",
};
const input = () => ({
  ...current,
  coordinateSpace: "NORMALIZED_CURRENT_IMAGE" as const,
  proposalPoint: { x: 0.4, y: 0.3 },
  monotonicCompletionTime: 1020,
});

describe("unverified current-frame fingertip recovery data", () => {
  it("keeps even strong model/appearance claims outside the authoritative observation schema", () => {
    const result = createFingertipRecoveryProposal(
      {
        ...input(),
        facts: {
          localAppearance: { referenceCaptureTime: 900, correlation: 1, separation: 1, forwardBackwardErrorPixels: 0 },
          uncertaintyRadiusPixels: 0,
        },
      },
      current,
      1030,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected proposal");
    expect(result.proposal.status).toBe("UNVERIFIED");
    expect(result.proposal).not.toHaveProperty("point");
    expect(result.proposal).not.toHaveProperty("trackId");
    expect(result.proposal).not.toHaveProperty("authority");
    expect(indexImageObservationSchema.safeParse(result.proposal).success).toBe(false);
  });

  it("requires the exact independently supplied source image, including sequence and original-pixel clock", () => {
    for (const change of [
      { providerId: "other-provider" },
      { providerVersion: "other-version" },
      { providerGeneration: 2 },
      { cameraLeaseId: "other-camera" },
      { cameraFrameVersion: 2 },
      { frameWidth: 320 },
      { frameHeight: 240 },
      { mirrorTransform: "NONE" },
      { sequence: 13 },
      { monotonicCaptureTime: 1001 },
      { monotonicPixelOriginTime: 991 },
      { monotonicPixelOriginTime: undefined },
      { sourceKey: "new-temporary-source" },
      { providerId: " test-mediapipe" },
      { sourceKey: "test-current-raw-source " },
    ]) {
      expect(createFingertipRecoveryProposal({ ...input(), ...change }, current, 1030)).toEqual({
        ok: false,
        reason: "FRAME_CONTEXT_MISMATCH",
      });
    }
  });

  it("counts old pixels and time after inference in the unchanged inclusive150ms boundary", () => {
    expect(createFingertipRecoveryProposal(input(), current, 1140).ok).toBe(true);
    expect(createFingertipRecoveryProposal(input(), current, 1140.01)).toEqual({ ok: false, reason: "STALE_FRAME" });
    const replayed = {
      ...input(),
      monotonicCaptureTime: 1100,
      monotonicCompletionTime: 1110,
      monotonicPixelOriginTime: 900,
    };
    const replayContext = { ...current, monotonicCaptureTime: 1100, monotonicPixelOriginTime: 900 };
    expect(createFingertipRecoveryProposal(replayed, replayContext, 1110)).toEqual({
      ok: false,
      reason: "STALE_FRAME",
    });
  });

  it("does not manufacture a pixel-origin clock when the capture owner has none", () => {
    const withoutOrigin = { ...current };
    delete withoutOrigin.monotonicPixelOriginTime;
    expect(
      createFingertipRecoveryProposal({ ...input(), monotonicPixelOriginTime: undefined }, withoutOrigin, 1150).ok,
    ).toBe(true);
    expect(
      createFingertipRecoveryProposal({ ...input(), monotonicPixelOriginTime: undefined }, withoutOrigin, 1150.01),
    ).toEqual({ ok: false, reason: "STALE_FRAME" });
  });

  it("rejects reversed, future and nonfinite clocks without treating completion as new capture", () => {
    for (const completion of [999, 1031, NaN, Infinity])
      expect(
        createFingertipRecoveryProposal({ ...input(), monotonicCompletionTime: completion }, current, 1030).ok,
      ).toBe(false);
    for (const now of [NaN, Infinity, -1, 1019])
      expect(createFingertipRecoveryProposal(input(), current, now).ok).toBe(false);
    const invalidOrigin = { ...current, monotonicPixelOriginTime: 1006 };
    expect(createFingertipRecoveryProposal({ ...input(), ...invalidOrigin }, invalidOrigin, 1030)).toEqual({
      ok: false,
      reason: "INVALID_CLOCK",
    });
  });

  it("rejects screen/pixel modes and attempted trusted assertions at every supported nesting level", () => {
    for (const coordinateSpace of ["SCREEN", "ANALYSIS_PIXELS", "NORMALIZED_PREVIEW"])
      expect(createFingertipRecoveryProposal({ ...input(), coordinateSpace }, current, 1030).ok).toBe(false);
    for (const extra of [
      { status: "VERIFIED" },
      { point: { x: 0.4, y: 0.3 } },
      { authority: "POINT" },
      { trusted: true },
      { selectedIdentity: "old-index" },
    ])
      expect(createFingertipRecoveryProposal({ ...input(), ...extra }, current, 1030).ok).toBe(false);
    expect(createFingertipRecoveryProposal({ ...input(), facts: { accepted: true } }, current, 1030).ok).toBe(false);
    expect(
      createFingertipRecoveryProposal(
        { ...input(), facts: { observedIndexJoints: [{ index: 8, x: 0.4, y: 0.3, z: 0 }] } },
        current,
        1030,
      ).ok,
    ).toBe(false);
    expect(
      createFingertipRecoveryProposal(
        {
          ...input(),
          facts: {
            localAppearance: {
              referenceCaptureTime: 900,
              correlation: 1,
              separation: 1,
              forwardBackwardErrorPixels: 0,
              identityVerified: true,
            },
          },
        },
        current,
        1030,
      ).ok,
    ).toBe(false);
  });

  it("rejects invalidXY and unsupported view or malformed capture-owner context", () => {
    for (const proposalPoint of [
      { x: -0.001, y: 0.5 },
      { x: 0.5, y: 1.001 },
      { x: NaN, y: 0.5 },
      { x: 0.5, y: Infinity },
    ])
      expect(createFingertipRecoveryProposal({ ...input(), proposalPoint }, current, 1030).ok).toBe(false);
    expect(createFingertipRecoveryProposal({ ...input(), orientation: 90 }, current, 1030).ok).toBe(false);
    expect(createFingertipRecoveryProposal(input(), { ...current, frameWidth: 1 }, 1030)).toEqual({
      ok: false,
      reason: "INVALID_FRAME_CONTEXT",
    });
    expect(createFingertipRecoveryProposal(input(), { ...current, providerGeneration: NaN }, 1030).ok).toBe(false);
  });

  it("copies and freezes nested facts so neither a caller nor consumer can rewrite retained evidence", () => {
    const mutable = {
      ...input(),
      facts: {
        observedIndexJoints: [{ index: 8 as const, x: 0.4, y: 0.3 }],
        rivalPoints: [{ x: 0.7, y: 0.4 }],
        localAppearance: {
          referenceCaptureTime: 900,
          correlation: 0.8,
          separation: 0.1,
          forwardBackwardErrorPixels: 1,
        },
        motion: { previousCaptureTime: 950, displacementPixels: 3 },
        uncertaintyRadiusPixels: 2,
      },
    };
    const result = createFingertipRecoveryProposal(mutable, current, 1030);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected proposal");
    mutable.proposalPoint.x = 0.9;
    mutable.facts.observedIndexJoints[0].x = 0.9;
    mutable.facts.rivalPoints.push({ x: 0.1, y: 0.1 });
    mutable.facts.localAppearance.correlation = 0;
    expect(result.proposal.proposalPoint.x).toBe(0.4);
    expect(result.proposal.facts?.observedIndexJoints?.[0].x).toBe(0.4);
    expect(result.proposal.facts?.rivalPoints).toHaveLength(1);
    expect(result.proposal.facts?.localAppearance?.correlation).toBe(0.8);
    expect(Object.isFrozen(result.proposal.facts?.observedIndexJoints?.[0])).toBe(true);
    expect(Object.isFrozen(result.proposal.facts?.motion)).toBe(true);
    expect(() => Object.assign(result.proposal.proposalPoint, { x: 0.2 })).toThrow();
  });

  it("retains rival/possibly wrong-digit coordinates as unverified facts, never identity proof", () => {
    const result = createFingertipRecoveryProposal(
      { ...input(), facts: { observedIndexJoints: [{ index: 8, x: 0.8, y: 0.8 }], rivalPoints: [{ x: 0.4, y: 0.3 }] } },
      current,
      1030,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected proposal");
    expect(result.proposal.status).toBe("UNVERIFIED");
    expect(result.proposal.facts?.rivalPoints).toEqual([{ x: 0.4, y: 0.3 }]);
    expect(Object.values(result.proposal).some((value) => typeof value === "function")).toBe(false);
  });

  it("bounds competing facts and rejects duplicate joint or impossible evidence chronology", () => {
    expect(
      createFingertipRecoveryProposal(
        { ...input(), facts: { rivalPoints: Array.from({ length: 4 }, () => ({ x: 0.4, y: 0.3 })) } },
        current,
        1030,
      ).ok,
    ).toBe(false);
    expect(
      createFingertipRecoveryProposal(
        {
          ...input(),
          facts: {
            observedIndexJoints: [
              { index: 8, x: 0.4, y: 0.3 },
              { index: 8, x: 0.4, y: 0.3 },
            ],
          },
        },
        current,
        1030,
      ).ok,
    ).toBe(false);
    expect(
      createFingertipRecoveryProposal(
        { ...input(), facts: { motion: { previousCaptureTime: 1000, displacementPixels: 1 } } },
        current,
        1030,
      ),
    ).toEqual({ ok: false, reason: "INVALID_EVIDENCE_CLOCK" });
    expect(
      createFingertipRecoveryProposal(
        {
          ...input(),
          facts: {
            localAppearance: {
              referenceCaptureTime: 1001,
              correlation: 0.9,
              separation: 0.2,
              forwardBackwardErrorPixels: 0,
            },
          },
        },
        current,
        1030,
      ),
    ).toEqual({ ok: false, reason: "INVALID_EVIDENCE_CLOCK" });
  });
});
