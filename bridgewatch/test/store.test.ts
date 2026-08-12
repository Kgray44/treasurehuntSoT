import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BridgewatchStore } from "../lib/store.js";
import type { ProjectRecord } from "../src/domain.js";
import { normalizeSoundingLineProjection } from "../src/sounding-line.js";

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

describe("Phase 2 durable history migration", () => {
  const project: ProjectRecord = {
    id: "archive",
    name: "Archived project",
    repository: "owner/repository",
    state: "COMPLETE",
    governingReferences: ["receipt"],
    sourcePaths: ["receipt"],
    confidence: "HIGH",
    completionReceipt: "Development_Docs/receipt.md",
    finalMainSha: "abc",
    finalDecision: "RELEASE_GO",
    phases: [
      {
        id: "archive-p1",
        ordinal: 1,
        name: "Accepted phase",
        scope: "Durable history",
        state: "COMPLETE",
        acceptedAt: "2026-08-12T00:00:00.000Z",
        integratedMainSha: "abc",
        milestones: [{ id: "archive-p1-record", title: "Record", weight: 1, state: "ACCEPTED", evidence: ["receipt"] }],
      },
    ],
  };

  it("upgrades a Phase 1 cache without losing it and is repeat-safe", () => {
    const file = join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite");
    const first = new BridgewatchStore(file);
    first.put("github:snapshot", { headSha: "phase-1" }, "etag-1");
    first.close();
    const upgraded = new BridgewatchStore(file);
    try {
      upgraded.replaceProjectRegistry([project]);
      upgraded.replaceProjectRegistry([project]);
      expect(upgraded.migrationVersions()).toEqual([1, 2]);
      expect(upgraded.get<{ headSha: string }>("github:snapshot")?.value).toEqual({ headSha: "phase-1" });
      expect(upgraded.projects()).toEqual([project]);
    } finally {
      upgraded.close();
    }
  });

  it("retains recent governed test runs and nodes independently from the cache", () => {
    const store = new BridgewatchStore(join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite"));
    try {
      const projection = normalizeSoundingLineProjection({
        schemaVersion: 1,
        observedAt: "2026-08-12T00:00:00.000Z",
        source: "SOUNDING_LINE_RUNTIME",
        leases: 0,
        workers: [],
        plans: [
          {
            id: "run-1",
            sourceSha: "abc",
            gate: "mainline",
            state: "FINISHED",
            createdAt: "2026-08-12T00:00:00.000Z",
            cleanupState: "CLEAN",
            finalDecision: "RELEASE_GO",
            nodes: [
              {
                id: "unit.bridgewatch",
                suiteId: "unit.bridgewatch",
                state: "PASSED",
                queuedAt: "2026-08-12T00:00:00.000Z",
                startedAt: "2026-08-12T00:00:01.000Z",
                completedAt: "2026-08-12T00:00:02.000Z",
                attempt: 1,
                rootFailureId: null,
              },
            ],
          },
        ],
      });
      store.replaceTestProjection(projection);
      expect(store.recentTestRuns()).toEqual([
        { id: "run-1", observedAt: "2026-08-12T00:00:00.000Z", value: projection.plans[0] },
      ]);
    } finally {
      store.close();
    }
  });
});
