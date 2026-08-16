import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { BridgewatchStore } from "../lib/store.js";
import { discoverObservations } from "../src/discovery.js";
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

  it("retains actionable source-health observations without persisting a secret", () => {
    const store = new BridgewatchStore(join(mkdtempSync(join(tmpdir(), "bridgewatch-source-")), "cache.sqlite"));
    try {
      store.upsertSourceObservation({
        name: "github",
        state: "DEGRADED",
        configured: true,
        reachable: false,
        lastAttemptAt: "2026-08-16T20:00:00.000Z",
        lastSuccessAt: "2026-08-16T19:00:00.000Z",
        nextRetryAt: "2026-08-16T20:01:00.000Z",
        detail: "GitHub GET failed: 503",
        cacheAgeMs: 60_000,
        authenticationState: "TOKEN_CONFIGURED",
      });
      expect(store.sourceObservations()).toEqual([
        expect.objectContaining({ name: "github", state: "DEGRADED", authenticationState: "TOKEN_CONFIGURED" }),
      ]);
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
      expect(upgraded.migrationVersions()).toEqual([1, 2, 3, 4]);
      expect(upgraded.get<{ headSha: string }>("github:snapshot")?.value).toEqual({ headSha: "phase-1" });
      expect(upgraded.projects()).toEqual([project]);
    } finally {
      upgraded.close();
    }
  });

  it("upgrades a genuine Phase 2-format database to migration 3 without losing durable or operational rows", () => {
    const file = join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "phase-2.sqlite");
    const phaseTwo = new DatabaseSync(file);
    phaseTwo.exec(`
      CREATE TABLE bridgewatch_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      INSERT INTO bridgewatch_migrations VALUES (1, '2026-08-01T00:00:00.000Z'), (2, '2026-08-01T00:00:00.000Z');
      CREATE TABLE bridgewatch_cache (cache_key TEXT PRIMARY KEY, value_json TEXT NOT NULL, etag TEXT, observed_at TEXT NOT NULL, error_text TEXT);
      CREATE TABLE project_history (project_id TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE phase_history (phase_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, ordinal INTEGER NOT NULL, value_json TEXT NOT NULL, accepted_at TEXT, integrated_main_sha TEXT);
      CREATE TABLE milestone_history (milestone_id TEXT PRIMARY KEY, phase_id TEXT NOT NULL, value_json TEXT NOT NULL, accepted_at TEXT);
      CREATE TABLE completion_records (project_id TEXT PRIMARY KEY, receipt_path TEXT NOT NULL, final_main_sha TEXT, final_decision TEXT, completed_at TEXT);
      CREATE TABLE workers (worker_id TEXT PRIMARY KEY, value_json TEXT NOT NULL, heartbeat_at TEXT NOT NULL, finished_at TEXT);
      CREATE TABLE test_runs (run_id TEXT PRIMARY KEY, value_json TEXT NOT NULL, observed_at TEXT NOT NULL);
      CREATE TABLE test_nodes (node_id TEXT PRIMARY KEY, run_id TEXT NOT NULL, value_json TEXT NOT NULL, completed_at TEXT);`);
    phaseTwo
      .prepare("INSERT INTO project_history VALUES (?, ?, ?)")
      .run(project.id, JSON.stringify(project), "2026-08-12T00:00:00.000Z");
    phaseTwo
      .prepare("INSERT INTO phase_history VALUES (?, ?, ?, ?, ?, ?)")
      .run("archive-p1", "archive", 1, JSON.stringify(project.phases[0]), "2026-08-12T00:00:00.000Z", "abc");
    phaseTwo
      .prepare("INSERT INTO milestone_history VALUES (?, ?, ?, ?)")
      .run(
        "archive-p1-record",
        "archive-p1",
        JSON.stringify(project.phases[0]!.milestones[0]),
        "2026-08-12T00:00:00.000Z",
      );
    phaseTwo
      .prepare("INSERT INTO completion_records VALUES (?, ?, ?, ?, ?)")
      .run("archive", "Development_Docs/receipt.md", "abc", "RELEASE_GO", "2026-08-12T00:00:00.000Z");
    phaseTwo
      .prepare("INSERT INTO workers VALUES (?, ?, ?, ?)")
      .run("worker-1", JSON.stringify({ workerId: "worker-1" }), "2026-08-12T00:00:00.000Z", null);
    phaseTwo
      .prepare("INSERT INTO test_runs VALUES (?, ?, ?)")
      .run("run-1", JSON.stringify({ id: "run-1", nodes: [] }), "2026-08-12T00:00:00.000Z");
    phaseTwo
      .prepare("INSERT INTO test_nodes VALUES (?, ?, ?, ?)")
      .run("run-1:node", "run-1", JSON.stringify({ id: "node" }), "2026-08-12T00:00:00.000Z");
    phaseTwo.close();

    const upgraded = new BridgewatchStore(file);
    try {
      expect(upgraded.migrationVersions()).toEqual([1, 2, 3, 4]);
      expect(upgraded.projects()).toEqual([project]);
      expect(upgraded.workers()).toHaveLength(1);
      expect(upgraded.recentTestRuns()).toHaveLength(1);
      expect(upgraded.history({ since: "2026-01-01T00:00:00.000Z", limit: 1 }).events).toEqual([]);
      expect(upgraded.migrationVersions()).toEqual([1, 2, 3, 4]);
    } finally {
      upgraded.close();
    }
  });

  it("preserves accepted identities and evidence when a later source recollection renames or omits them", () => {
    const store = new BridgewatchStore(join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite"));
    try {
      store.replaceProjectRegistry([project]);
      const recollected = structuredClone(project);
      recollected.name = "Current project name";
      recollected.completionReceipt = undefined;
      recollected.finalMainSha = undefined;
      recollected.finalDecision = undefined;
      recollected.phases[0]!.name = "Current phase name";
      recollected.phases[0]!.integratedMainSha = undefined;
      recollected.phases[0]!.milestones = [];
      store.replaceProjectRegistry([recollected]);
      const retained = store.projects()[0]!;
      expect(retained.name).toBe("Current project name");
      expect(retained.historicalNames).toContain("Archived project");
      expect(retained.completionReceipt).toBe(project.completionReceipt);
      expect(retained.finalMainSha).toBe("abc");
      expect(retained.finalDecision).toBe("RELEASE_GO");
      expect(retained.phases[0]).toMatchObject({
        name: "Current phase name",
        historicalNames: ["Accepted phase"],
        integratedMainSha: "abc",
      });
      expect(retained.phases[0]!.milestones).toEqual(project.phases[0]!.milestones);
    } finally {
      store.close();
    }
  });

  it("replaces stale current project projections while retaining current accepted evidence", () => {
    const store = new BridgewatchStore(
      join(mkdtempSync(join(tmpdir(), "bridgewatch-project-replace-")), "cache.sqlite"),
    );
    try {
      const staleDiscovery = structuredClone(project);
      staleDiscovery.phases.push({
        id: "archive-p2",
        ordinal: 2,
        name: "Invented pending phase",
        scope: "Stale discovery only",
        state: "PLANNED",
        milestones: [],
      });
      store.replaceProjectRegistry([staleDiscovery, { ...project, id: "invented", name: "Invented project" }]);
      store.replaceProjectRegistry([project]);

      expect(store.projects()).toEqual([project]);
    } finally {
      store.close();
    }
  });

  it("persists normalized discovery evidence idempotently without replacing retained project history", () => {
    const store = new BridgewatchStore(join(mkdtempSync(join(tmpdir(), "bridgewatch-discovery-")), "cache.sqlite"));
    try {
      store.replaceProjectRegistry([project]);
      const discovery = discoverObservations({
        observedAt: "2026-08-16T20:00:00.000Z",
        documents: [
          {
            path: "Development_Docs/Project_Bridgewatch_v1.2_Mission_Control_Realization_Design_Record.md",
            text: "# Project Bridgewatch v1.2\n\n## Phase 1: Raise the Board",
          },
        ],
        branches: [{ name: "codex/project-bridgewatch-v1.2-mission-control", headSha: "abcdef1" }],
        pullRequests: [],
      });

      store.replaceDiscovery(discovery, "2026-08-16T20:00:00.000Z");
      store.replaceDiscovery(discovery, "2026-08-16T20:00:00.000Z");

      expect(store.discoveredProjects()).toEqual(discovery.projects);
      expect(store.discoveryEvidence("version", "bridgewatch:v1.2")).toHaveLength(2);
      expect(store.projects()).toEqual([project]);
      store.replaceDiscovery({ projects: [], unclassified: [] }, "2026-08-16T20:01:00.000Z");
      expect(store.discoveredProjects()).toEqual([]);
      expect(store.projects()).toEqual([project]);
    } finally {
      store.close();
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
