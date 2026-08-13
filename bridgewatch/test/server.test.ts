import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

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
      const dashboard = await app.inject({ method: "GET", url: "/" });
      expect(dashboard.statusCode).toBe(200);
      expect(dashboard.body).toContain('href="/style.css"');
      expect(dashboard.body).toContain('src="/app.js"');
      expect(dashboard.body).toContain('href="/admin"');
      expect((await app.inject({ method: "GET", url: "/style.css" })).statusCode).toBe(200);
      const appScript = (await app.inject({ method: "GET", url: "/app.js" })).body;
      expect(appScript).toContain('window.location.pathname.startsWith("/bridgewatch")');
      expect(appScript).toContain("`${bridgewatchBase}api/summary`");
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
});
