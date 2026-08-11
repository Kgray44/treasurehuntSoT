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
    const { buildServer } = await import("../lib/server.js");
    const { app } = buildServer();
    try {
      const summary = await app.inject({ method: "GET", url: "/api/summary" });
      expect(summary.statusCode).toBe(200);
      expect(summary.json().source.state).toBe("UNAVAILABLE");
      expect(summary.headers["content-security-policy"]).toContain("default-src 'self'");
      const mutation = await app.inject({ method: "POST", url: "/api/summary" });
      expect(mutation.statusCode).toBe(404);
    } finally { await app.close(); }
  });
});
