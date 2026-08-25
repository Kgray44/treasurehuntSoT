import { describe, expect, it } from "vitest";
import { assertCommunityDrydockPublicationGate } from "./drydock-publication-gate";

const checksum = "a".repeat(64);

describe("Community Drydock publication gate", () => {
  it("requires immutable evidence that matches the Community release source", () => {
    expect(() => assertCommunityDrydockPublicationGate(null)).toThrow("no immutable Drydock launch evidence");
    expect(() =>
      assertCommunityDrydockPublicationGate({
        id: "version-1",
        checksum,
        drydockPublishingEvidence: { digest: "evidence", sourceChecksum: "b".repeat(64) },
      }),
    ).toThrow("does not match");
    expect(
      assertCommunityDrydockPublicationGate({
        id: "version-1",
        checksum,
        drydockPublishingEvidence: { digest: "evidence", sourceChecksum: checksum },
      }),
    ).toEqual({ publishedVersionId: "version-1", sourceChecksum: checksum, evidenceDigest: "evidence" });
  });
});
