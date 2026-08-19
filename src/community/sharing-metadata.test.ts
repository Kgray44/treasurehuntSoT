import { describe, expect, it } from "vitest";
import { harborSharingMetadata } from "./sharing-metadata";

describe("Harborlight sharing metadata", () => {
  it("emits only an allowlisted Community projection", () => {
    const metadata = harborSharingMetadata({
      kind: "voyage-log",
      visibility: "COMMUNITY",
      canonicalPath: "/community/voyage-logs/safe",
      title: "Safe voyage",
      safeDescription: "Spoiler-safe summary",
    });
    expect(metadata).toMatchObject({
      title: "Safe voyage",
      description: "Spoiler-safe summary",
      alternates: { canonical: "/community/voyage-logs/safe" },
      openGraph: { title: "Safe voyage" },
    });
    expect(JSON.stringify(metadata)).not.toContain("session");
    expect(JSON.stringify(metadata)).not.toContain("storage");
  });
  it("denies anonymous metadata for private/crew content and marks unlisted content non-indexable", () => {
    expect(
      harborSharingMetadata({ kind: "guide", visibility: "PRIVATE", canonicalPath: "/private", title: "Private" }),
    ).toMatchObject({ title: "Not found", robots: { index: false, follow: false } });
    expect(
      harborSharingMetadata({
        kind: "collection",
        visibility: "UNLISTED",
        canonicalPath: "/unlisted",
        title: "Unlisted",
      }),
    ).toMatchObject({ robots: { index: false, follow: false, noarchive: true } });
  });
});
