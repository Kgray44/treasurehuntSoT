import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BridgewatchStore } from "../lib/store.js";

describe("BridgewatchStore", () => {
  it("persists a bounded cache entry with its ETag", () => {
    const store = new BridgewatchStore(join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite"));
    try {
      store.put("snapshot", { state: "FRESH" }, "etag-1", "2026-08-10T00:00:00.000Z");
      expect(store.get<{ state: string }>("snapshot")).toEqual({
        value: { state: "FRESH" },
        etag: "etag-1",
        observedAt: "2026-08-10T00:00:00.000Z",
        error: null,
      });
    } finally {
      store.close();
    }
  });
});
