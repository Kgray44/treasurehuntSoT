import { describe, expect, it } from "vitest";
import type { PublishedTaleSnapshot } from "@/chronicle/types";
import { publishedSourceChecksum } from "@/chronicle/snapshot";

const source = (): PublishedTaleSnapshot => ({
  schemaVersion: 1,
  tale: { id: "tale-1", slug: "source", title: "Source", subtitle: null, shortDescription: null, longDescription: null, coverAssetId: null, theme: "CARTOGRAPHERS_TABLE", visibility: "PRIVATE", playerCountMin: 1, playerCountMax: 4, estimatedDuration: null, contentWarnings: null },
  chapters: [], assets: [], locations: [], artifacts: [], publishedAt: "2026-08-13T00:00:00.000Z",
});

describe("published authored-source identity", () => {
  it("ignores server-assigned publication time while detecting authored changes", () => {
    const first = source();
    const republishedAtAnotherInstant = { ...source(), publishedAt: "2026-08-13T12:00:00.000Z" };
    const changed = { ...source(), tale: { ...source().tale, title: "Changed" } };
    expect(publishedSourceChecksum(republishedAtAnotherInstant)).toBe(publishedSourceChecksum(first));
    expect(publishedSourceChecksum(changed)).not.toBe(publishedSourceChecksum(first));
  });
});
