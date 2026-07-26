import { describe, expect, it } from "vitest";
import { assertVoyageLogPublishable, assertVoyageLogTransition, voyageLogReadiness } from "./voyage-log-lifecycle";

const approved = {
  id: "p-1",
  displayNameSnapshot: "Deckhand",
  isChild: false,
  consents: [{ purpose: "DISPLAY_IN_LOG", grantedAt: new Date("2026-07-25"), revokedAt: null }],
};
const media = {
  id: "m-1",
  derivativeChecksum: "a".repeat(64),
  processingStatus: "READY",
  scanStatus: "CLEAN",
  exifGpsRemoved: true,
  consents: [{ purpose: "PUBLIC_MEDIA", grantedAt: new Date("2026-07-25"), revokedAt: null }],
};
const input = {
  visibility: "COMMUNITY" as const,
  restrictions: [],
  participants: [approved],
  media: [media],
  sourceProvenanceVerified: true,
  sourceWatermarkUnchanged: true,
  sourceChecksumUnchanged: true,
  publishedTaleVersionId: "version-1",
  projectionChecksum: "b".repeat(64),
  searchEligible: true,
  openGraphEligible: true,
};

describe("Voyage Log lifecycle", () => {
  it("requires all source, consent, checksum, visibility, search, and metadata gates before publication", () => {
    expect(voyageLogReadiness(input)).toEqual({ ready: true, reasons: [] });
    expect(() => assertVoyageLogPublishable({ ...input, sourceChecksumUnchanged: false })).toThrow("source changed");
    expect(() => assertVoyageLogPublishable({ ...input, openGraphEligible: false })).toThrow("sharing metadata");
  });
  it("makes consent review and removal one-way from a published state", () => {
    expect(() => assertVoyageLogTransition("PUBLISHED", "CONSENT_REVIEW_REQUIRED")).not.toThrow();
    expect(() => assertVoyageLogTransition("CONSENT_REVIEW_REQUIRED", "PUBLISHED")).toThrow("cannot transition");
    expect(() => assertVoyageLogTransition("REMOVED", "PUBLISHED")).toThrow("cannot transition");
  });
  it("does not make non-discoverable visibility modes searchable to publish", () => {
    for (const visibility of ["PRIVATE", "CREW_ONLY", "UNLISTED"] as const)
      expect(voyageLogReadiness({ ...input, visibility, searchEligible: false, openGraphEligible: false })).toEqual({
        ready: true,
        reasons: [],
      });
  });
});
