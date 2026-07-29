import { describe, expect, it } from "vitest";
import { assertAppealTransition, assertModerationTransition, moderationPublicReceipt } from "./moderation";
import { isTrustedCurrentCommunityScanReceipt } from "./scanner";

describe("Harborlight Phase 4 moderation contracts", () => {
  it("permits only explicit case lifecycle transitions", () => {
    expect(() => assertModerationTransition("OPEN", "TRIAGED")).not.toThrow();
    expect(() => assertModerationTransition("CLOSED", "OPEN")).toThrow("not permitted");
    expect(() => assertModerationTransition("OPEN", "arbitrary")).toThrow("not permitted");
  });

  it("preserves appeal state-machine boundaries", () => {
    expect(() => assertAppealTransition("SUBMITTED", "UNDER_REVIEW")).not.toThrow();
    expect(() => assertAppealTransition("UPHELD", "OVERTURNED")).toThrow("not permitted");
  });

  it("keeps reporter receipts minimal", () => {
    expect(
      moderationPublicReceipt({
        id: "report_1",
        subjectType: "LISTING",
        subjectId: "listing_1",
        status: "RECEIVED",
        createdAt: new Date(0),
      }),
    ).toEqual({
      id: "report_1",
      subjectType: "LISTING",
      subjectId: "listing_1",
      status: "RECEIVED",
      createdAt: new Date(0),
    });
  });

  it("requires a current non-synthetic digest-bound clean receipt", () => {
    const hash = "a".repeat(64);
    expect(
      isTrustedCurrentCommunityScanReceipt(
        {
          provider: "clamav-instream",
          providerVersion: "1",
          result: "CLEAN",
          sha256: hash,
          scannedAt: new Date().toISOString(),
          evidenceKind: "clamav",
          byteLength: 1,
          declaredMediaType: "image/png",
          detectedMediaType: "image/png",
        },
        hash,
      ),
    ).toBe(true);
    expect(
      isTrustedCurrentCommunityScanReceipt(
        {
          provider: "synthetic-test",
          providerVersion: "1",
          result: "CLEAN",
          sha256: hash,
          scannedAt: new Date().toISOString(),
          evidenceKind: "synthetic",
          byteLength: 1,
          declaredMediaType: "image/png",
          detectedMediaType: "image/png",
        },
        hash,
      ),
    ).toBe(false);
  });
});
