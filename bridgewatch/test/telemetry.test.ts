import { describe, expect, it } from "vitest";
import { authorizeTelemetry, parseHeartbeat, workerState } from "../src/telemetry.js";

const heartbeat = {
  workerId: "codex-bridgewatch-02",
  project: "bridgewatch",
  phase: "2",
  task: "Wire durable telemetry",
  state: "WORKING" as const,
  branch: "codex/project-bridgewatch-phase2-wire-the-signals",
  sourceSha: "236c27241bb8d1630274f5d5412ec9addbdb8893",
  host: "dev-laptop",
  startedAt: "2026-08-12T00:00:00.000Z",
  heartbeatAt: "2026-08-12T00:00:15.000Z",
};

describe("machine-only telemetry", () => {
  it("accepts strict authenticated activity heartbeats and makes them stale without changing project truth", () => {
    const parsed = parseHeartbeat(heartbeat, Date.parse("2026-08-12T00:00:20.000Z"));
    expect(authorizeTelemetry("Bearer local-only", "local-only")).toBe(true);
    expect(workerState(parsed, 60_000, Date.parse("2026-08-12T00:01:20.000Z"))).toBe("STALE");
  });

  it("rejects unknown fields, progress claims, body tokens, and clock skew", () => {
    expect(() => parseHeartbeat({ ...heartbeat, progress: 100 }, Date.parse("2026-08-12T00:00:20.000Z"))).toThrow();
    expect(() => parseHeartbeat({ ...heartbeat, token: "no" }, Date.parse("2026-08-12T00:00:20.000Z"))).toThrow();
    expect(() => parseHeartbeat(heartbeat, Date.parse("2026-08-12T00:10:20.000Z"))).toThrow("HEARTBEAT_CLOCK_SKEW");
    expect(authorizeTelemetry("Bearer github-token", "local-only")).toBe(false);
  });
});
