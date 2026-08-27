import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { writeVoyagewrightRuntimeState } from "./write-runtime-state.mjs";

test("runtime writer preserves start identity while refreshing only allowlisted fields", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "bridgewatch-runtime-state-"));
  const priorPath = process.env.BRIDGEWATCH_VOYAGEWRIGHT_RUNTIME_STATE_PATH;
  process.env.BRIDGEWATCH_VOYAGEWRIGHT_RUNTIME_STATE_PATH = path.join(root, "runtime.json");
  try {
    const first = await writeVoyagewrightRuntimeState({ state: "RUNNING", port: 3001, sourceRoot: process.cwd() });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await writeVoyagewrightRuntimeState({ state: "RUNNING", port: 3001, sourceRoot: process.cwd() });
    const stored = JSON.parse(await readFile(process.env.BRIDGEWATCH_VOYAGEWRIGHT_RUNTIME_STATE_PATH, "utf8"));
    assert.equal(second.startedAt, first.startedAt);
    assert.ok(Date.parse(second.observedAt) >= Date.parse(first.observedAt));
    assert.deepEqual(Object.keys(stored).sort(), [
      "observedAt",
      "port",
      "runtime",
      "schemaVersion",
      "sourceSha",
      "startedAt",
      "state",
    ]);
    assert.equal(stored.state, "RUNNING");
    assert.equal(stored.port, 3001);
  } finally {
    if (priorPath === undefined) delete process.env.BRIDGEWATCH_VOYAGEWRIGHT_RUNTIME_STATE_PATH;
    else process.env.BRIDGEWATCH_VOYAGEWRIGHT_RUNTIME_STATE_PATH = priorPath;
    await rm(root, { force: true, recursive: true });
  }
});
