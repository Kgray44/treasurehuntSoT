import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it } from "vitest";
import { BridgewatchStore } from "../lib/store.js";
import type { ProjectRecord } from "../src/domain.js";
import type { BridgewatchProgramSnapshot } from "../src/history.js";

const priorEnv = { ...process.env };
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in priorEnv)) delete process.env[key];
  Object.assign(process.env, priorEnv);
});

describe("representative Phase 3 operational load", () => {
  it.each([10, 25, 50])(
    "accepts %i authenticated activity heartbeats and keeps warm summary under one second",
    async (count) => {
      process.env.BRIDGEWATCH_REPOSITORY = "owner/repository";
      process.env.BRIDGEWATCH_DB_PATH = join(mkdtempSync(join(tmpdir(), "bridgewatch-performance-")), "cache.sqlite");
      process.env.BRIDGEWATCH_TELEMETRY_TOKEN = "performance-token";
      const { buildServer } = await import("../lib/server.js");
      const { app } = buildServer();
      try {
        const timestamp = new Date().toISOString();
        const started = performance.now();
        for (let index = 0; index < count; index += 1) {
          const response = await app.inject({
            method: "POST",
            url: "/api/telemetry/heartbeat",
            headers: { authorization: "Bearer performance-token" },
            payload: {
              workerId: `worker-${index}`,
              project: "bridgewatch",
              phase: "2",
              task: "Performance fixture",
              state: "WORKING",
              branch: "codex/project-bridgewatch-phase2-wire-the-signals",
              sourceSha: "236c27241bb8d1630274f5d5412ec9addbdb8893",
              host: "performance-host",
              startedAt: timestamp,
              heartbeatAt: timestamp,
            },
          });
          expect(response.statusCode).toBe(202);
        }
        const ingestionMs = performance.now() - started;
        const warmStarted = performance.now();
        const summary = await app.inject({ method: "GET", url: "/api/summary" });
        const warmMs = performance.now() - warmStarted;
        expect(summary.statusCode).toBe(200);
        expect(summary.json().workers).toHaveLength(count);
        expect(ingestionMs).toBeLessThan(1000);
        expect(warmMs).toBeLessThan(1000);
      } finally {
        await app.close();
      }
    },
  );

  it("keeps representative Phase 3 historical queries and retention comfortably bounded", () => {
    const directory = mkdtempSync(join(tmpdir(), "bridgewatch-history-performance-"));
    const file = join(directory, "history.sqlite");
    const store = new BridgewatchStore(file);
    try {
      const projects: ProjectRecord[] = Array.from({ length: 36 }, (_, projectIndex) => ({
        id: `project-${projectIndex}`,
        name: `Synthetic Project ${projectIndex}`,
        repository: "owner/repository",
        state: "ACTIVE",
        governingReferences: ["Development_Docs/synthetic.md"],
        sourcePaths: ["Development_Docs/synthetic.md"],
        confidence: "HIGH",
        phases: Array.from({ length: 3 }, (_, phaseIndex) => ({
          id: `project-${projectIndex}-p${phaseIndex + 1}`,
          ordinal: phaseIndex + 1,
          name: `Synthetic Phase ${phaseIndex + 1}`,
          scope: "Synthetic performance fixture",
          state: "ACTIVE",
          milestones: Array.from({ length: 3 }, (_, milestoneIndex) => ({
            id: `project-${projectIndex}-p${phaseIndex + 1}-m${milestoneIndex + 1}`,
            title: `Synthetic milestone ${milestoneIndex + 1}`,
            weight: 1,
            state: "PLANNED",
            evidence: ["Development_Docs/synthetic.md"],
          })),
        })),
      }));
      const end = Date.parse("2026-08-12T00:00:00.000Z");
      const nodes = Array.from({ length: 240 }, (_, index) => ({
        id: `node-${index}`,
        suiteId: "unit.bridgewatch",
        state: index % 9 === 0 ? ("RUNNING" as const) : ("PASSED" as const),
        queuedAt: "2026-08-11T00:00:00.000Z",
        startedAt: "2026-08-11T00:00:01.000Z",
        completedAt: index % 9 === 0 ? null : "2026-08-11T00:00:02.000Z",
        attempt: 1,
        rootFailureId: null,
      }));
      const snapshot = (capturedAt: string, sourceSha: string): BridgewatchProgramSnapshot => ({
        schemaVersion: 1,
        capturedAt,
        projects: structuredClone(projects),
        github: {
          repository: "owner/repository",
          defaultBranch: "main",
          headSha: sourceSha,
          pullRequests: [],
          branches: [],
          observedAt: capturedAt,
        },
        workers: Array.from({ length: 50 }, (_, index) => ({
          workerId: `worker-${index}`,
          project: `project-${index % 36}`,
          phase: "1",
          task: "Synthetic history fixture",
          state: "WORKING",
          branch: `codex/project-${index % 36}`,
          sourceSha,
          host: "fixture",
          startedAt: capturedAt,
          heartbeatAt: capturedAt,
        })),
        soundingLine: {
          schemaVersion: 1,
          observedAt: capturedAt,
          source: "SOUNDING_LINE_RUNTIME",
          leases: 1,
          workers: [],
          plans: [
            {
              id: "synthetic-run",
              sourceSha,
              gate: "mainline",
              state: "RUNNING",
              createdAt: capturedAt,
              cleanupState: "PENDING",
              finalDecision: null,
              nodes,
            },
          ],
        },
      });
      const initial = snapshot(new Date(end - 119 * 86_400_000).toISOString(), "aaaaaaa");
      store.replaceProjectRegistry(initial.projects, initial.capturedAt);
      store.recordHistory(initial);
      for (let day = 1; day < 120; day += 1) {
        const current = snapshot(
          new Date(end - (119 - day) * 86_400_000).toISOString(),
          `${day.toString(16).padStart(7, "0")}`,
        );
        current.projects.forEach((project, index) => {
          project.state = (day + index) % 2 === 0 ? "TESTING" : "REVIEW";
          project.phases[0]!.state = project.state;
        });
        store.recordHistory(current);
      }
      const queryStarted = performance.now();
      const lastTwelveHours = store.history({ since: "2026-08-11T12:00:00.000Z", limit: 100 });
      const projectHistory = store.projectHistory("project-0");
      const queryMs = performance.now() - queryStarted;
      const pruneStarted = performance.now();
      const retention = store.pruneHistory({
        eventRetentionDays: 30,
        rollupRetentionDays: 90,
        dryRun: false,
        now: new Date(end),
      });
      const retentionMs = performance.now() - pruneStarted;
      expect(lastTwelveHours.events).not.toHaveLength(0);
      expect(projectHistory).not.toHaveLength(0);
      expect(retention.deleted.events).toBeGreaterThan(0);
      expect(queryMs).toBeLessThan(1_000);
      expect(retentionMs).toBeLessThan(5_000);
      const databaseBytes = statSync(file).size;
      expect(databaseBytes).toBeLessThan(250 * 1024 * 1024);
      console.info(
        "BRIDGEWATCH_PHASE3_PERFORMANCE",
        JSON.stringify({
          projects: projects.length,
          phases: projects.length * 3,
          milestones: projects.length * 9,
          workers: 50,
          testNodes: nodes.length,
          lastTwelveHourEvents: lastTwelveHours.events.length,
          projectEvents: projectHistory.length,
          queryMs: Number(queryMs.toFixed(2)),
          retentionMs: Number(retentionMs.toFixed(2)),
          databaseBytes,
        }),
      );
    } finally {
      store.close();
    }
  }, 15_000);
});
