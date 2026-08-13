import { describe, expect, it } from "vitest";
import { parsePublishedSnapshot } from "@/chronicle/publishing";

const snapshot = { schemaVersion: 1, chapters: [], tale: {}, assets: [], locations: [], artifacts: [], publishedAt: "2026-08-13T00:00:00.000Z" };

describe("governed historical snapshot reader", () => {
  it("rejects malformed, deeply nested, and oversized historical content", () => {
    expect(() => parsePublishedSnapshot("not json")).toThrow("invalid stored content");
    let deep: unknown = {}; for (let index = 0; index < 34; index += 1) deep = { child: deep };
    expect(() => parsePublishedSnapshot(JSON.stringify({ ...snapshot, deep }))).toThrow("depth limit");
    expect(() => parsePublishedSnapshot(JSON.stringify({ ...snapshot, large: "x".repeat(5 * 1024 * 1024) }))).toThrow("too large");
  });

  it("keeps valid version-pinned snapshots readable", () => {
    expect(parsePublishedSnapshot(JSON.stringify(snapshot))).toMatchObject({ schemaVersion: 1, chapters: [] });
  });
});
