import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { BridgewatchProgramSnapshot } from "../src/history.js";

const priorEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in priorEnv)) delete process.env[key];
  Object.assign(process.env, priorEnv);
});

describe("Bridgewatch read-only API", () => {
  it("serves GET-only health and truthful unavailable-source state", async () => {
    process.env.BRIDGEWATCH_REPOSITORY = "owner/repository";
    process.env.BRIDGEWATCH_DB_PATH = join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite");
    process.env.BRIDGEWATCH_TELEMETRY_TOKEN = "test-telemetry-token";
    const { buildServer } = await import("../lib/server.js");
    const { app } = buildServer();
    try {
      const summary = await app.inject({ method: "GET", url: "/api/summary" });
      expect(summary.statusCode).toBe(200);
      expect(summary.json().source.state).toBe("UNAVAILABLE");
      expect(
        (await app.inject({ method: "GET", url: "/api/sources" }))
          .json()
          .find((entry: { name: string }) => entry.name === "reporter").state,
      ).toBe("UNMEASURED");
      expect(summary.headers["content-security-policy"]).toContain("default-src 'self'");
      const mutation = await app.inject({ method: "POST", url: "/api/summary" });
      expect(mutation.statusCode).toBe(404);
      const heartbeat = {
        workerId: "codex-bridgewatch-02",
        project: "bridgewatch",
        phase: "2",
        task: "Test activity only",
        state: "WORKING",
        branch: "codex/project-bridgewatch-phase2-wire-the-signals",
        sourceSha: "236c27241bb8d1630274f5d5412ec9addbdb8893",
        host: "test-host",
        startedAt: new Date().toISOString(),
        heartbeatAt: new Date().toISOString(),
      };
      expect(
        (await app.inject({ method: "POST", url: "/api/telemetry/heartbeat", payload: heartbeat })).statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/telemetry/heartbeat?token=no",
            headers: { authorization: "Bearer test-telemetry-token" },
            payload: heartbeat,
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/telemetry/heartbeat",
            headers: { authorization: "Bearer test-telemetry-token" },
            payload: heartbeat,
          })
        ).statusCode,
      ).toBe(202);
      expect((await app.inject({ method: "GET", url: "/api/workers" })).json()[0].effectiveState).toBe("WORKING");
      expect(
        (await app.inject({ method: "GET", url: "/api/sources" }))
          .json()
          .find((entry: { name: string }) => entry.name === "reporter").state,
      ).toBe("FRESH");
      for (let index = 0; index < 59; index += 1)
        await app.inject({
          method: "POST",
          url: "/api/telemetry/heartbeat",
          headers: { authorization: "Bearer test-telemetry-token" },
          payload: heartbeat,
        });
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/telemetry/heartbeat",
            headers: { authorization: "Bearer test-telemetry-token" },
            payload: heartbeat,
          })
        ).statusCode,
      ).toBe(429);
    } finally {
      await app.close();
    }
  });

  it("protects dashboard and human observation routes when private dashboard authentication is configured", async () => {
    process.env.BRIDGEWATCH_REPOSITORY = "owner/repository";
    process.env.BRIDGEWATCH_DB_PATH = join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite");
    process.env.BRIDGEWATCH_DASHBOARD_USERNAME = "operator";
    process.env.BRIDGEWATCH_DASHBOARD_PASSWORD = "test-password";
    const { buildServer } = await import("../lib/server.js");
    const { app } = buildServer();
    try {
      expect((await app.inject({ method: "GET", url: "/api/summary" })).statusCode).toBe(401);
      expect(
        (
          await app.inject({
            method: "GET",
            url: "/api/summary",
            headers: { authorization: `Basic ${Buffer.from("operator:test-password").toString("base64")}` },
          })
        ).statusCode,
      ).toBe(200);
      expect((await app.inject({ method: "GET", url: "/healthz" })).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("keeps program history bounded, filtered, and GET-only without changing activity API semantics", async () => {
    process.env.BRIDGEWATCH_REPOSITORY = "owner/repository";
    process.env.BRIDGEWATCH_DB_PATH = join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite");
    const { buildServer } = await import("../lib/server.js");
    const { app, store } = buildServer();
    try {
      const capturedAt = new Date().toISOString();
      const before: BridgewatchProgramSnapshot = {
        schemaVersion: 1,
        capturedAt,
        projects: store.projects(),
        github: null,
        workers: [],
        soundingLine: null,
      };
      const after = structuredClone(before);
      const project = after.projects.find((entry) => entry.id === "bridgewatch")!;
      project.state = "COMPLETE";
      project.phases[2]!.state = "COMPLETE";
      store.recordHistory(before);
      store.recordHistory(after);
      const history = await app.inject({
        method: "GET",
        url: `/api/history?since=${encodeURIComponent(new Date(Date.now() - 60_000).toISOString())}&project=bridgewatch`,
      });
      expect(history.statusCode).toBe(200);
      expect(history.json().events.some((event: { kind: string }) => event.kind === "PROJECT_STATE_CHANGED")).toBe(
        true,
      );
      expect((await app.inject({ method: "GET", url: "/api/history?since=not-a-date" })).statusCode).toBe(400);
      expect(
        (await app.inject({ method: "GET", url: "/api/history?since=2099-01-01T00%3A00%3A00.000Z" })).statusCode,
      ).toBe(400);
      expect((await app.inject({ method: "POST", url: "/api/history" })).statusCode).toBe(404);
      expect((await app.inject({ method: "GET", url: "/api/activity" })).statusCode).toBe(200);
      const trends = await app.inject({ method: "GET", url: "/api/trends" });
      expect(trends.statusCode).toBe(200);
      expect(trends.json().acceptedTimeline).toEqual(expect.any(Array));
      expect((await app.inject({ method: "GET", url: "/api/archive?order=name" })).statusCode).toBe(200);
      expect((await app.inject({ method: "GET", url: "/api/archive?order=unknown" })).statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("continues serving current observation when the history writer fails", async () => {
    process.env.BRIDGEWATCH_REPOSITORY = "owner/repository";
    process.env.BRIDGEWATCH_DB_PATH = join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite");
    process.env.BRIDGEWATCH_TELEMETRY_TOKEN = "test-telemetry-token";
    const { buildServer } = await import("../lib/server.js");
    const { app, store } = buildServer();
    try {
      store.recordHistory = (() => {
        throw new Error("task-owned history fault");
      }) as typeof store.recordHistory;
      const response = await app.inject({
        method: "POST",
        url: "/api/telemetry/heartbeat",
        headers: { authorization: "Bearer test-telemetry-token" },
        payload: {
          workerId: "history-writer-fixture",
          project: "bridgewatch",
          phase: "3",
          task: "Failure posture proof",
          state: "WORKING",
          branch: "codex/project-bridgewatch-phase3-keep-the-watch-1",
          sourceSha: "aaaaaaa",
          host: "fixture",
          startedAt: new Date().toISOString(),
          heartbeatAt: new Date().toISOString(),
        },
      });
      expect(response.statusCode).toBe(202);
      const summary = await app.inject({ method: "GET", url: "/api/summary" });
      expect(summary.statusCode).toBe(200);
      expect(summary.json().history.warning).toContain("Historical persistence");
      expect(summary.json().workers[0].workerId).toBe("history-writer-fixture");
    } finally {
      await app.close();
    }
  });
});
