import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readCommunityWorkerRuntime, workerRuntimeCurrent, writeCommunityWorkerRuntime } from "./worker-runtime";

const priorPath = process.env.COMMUNITY_WORKER_STATE_PATH;

afterEach(() => {
  if (priorPath === undefined) delete process.env.COMMUNITY_WORKER_STATE_PATH;
  else process.env.COMMUNITY_WORKER_STATE_PATH = priorPath;
});

describe("community worker runtime state", () => {
  it("writes an allowlisted ready state and rejects a future heartbeat as current", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "community-worker-runtime-"));
    process.env.COMMUNITY_WORKER_STATE_PATH = path.join(root, "worker-state.json");
    try {
      await writeCommunityWorkerRuntime("READY", "2026-08-27T12:00:00.000Z", true);
      const state = await readCommunityWorkerRuntime();
      expect(state).toMatchObject({ schemaVersion: 1, state: "READY", ready: true });
      expect(workerRuntimeCurrent(state, 90_000)).toBe(true);
      expect(
        workerRuntimeCurrent({ ...state!, heartbeatAt: new Date(Date.now() + 60_000).toISOString() }, 90_000),
      ).toBe(false);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("treats an unsafe path as unavailable rather than failing the health projection", async () => {
    process.env.COMMUNITY_WORKER_STATE_PATH = "relative-worker-state.json";
    await expect(readCommunityWorkerRuntime()).resolves.toBeNull();
  });
});
