import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { afterEach, describe, expect, it } from "vitest";

const priorEnv = { ...process.env };
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in priorEnv)) delete process.env[key];
  Object.assign(process.env, priorEnv);
});

describe("representative Phase 2 operational load", () => {
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
});
