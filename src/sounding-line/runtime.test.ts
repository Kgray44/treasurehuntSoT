import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { acquireBundle, cleanupRuntime, createRuntime } from "../../scripts/sounding-line/runtime.mjs";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Sounding Line Phase 2 broker", () => {
  it("does not release a first bundle when a second bundle conflicts", async () => {
    const base = await mkdtemp(path.join(os.tmpdir(), "sl-vitest-"));
    roots.push(base);
    const first = await createRuntime({ base });
    const second = await createRuntime({ base });
    await acquireBundle(first, [{ type: "application-port", key: "fixture" }]);
    await expect(acquireBundle(second, [{ type: "application-port", key: "fixture" }])).rejects.toMatchObject({
      code: "RESOURCE_CONFLICT",
    });
    await expect(acquireBundle(second, [{ type: "application-port", key: "second" }])).resolves.toHaveLength(1);
    await cleanupRuntime(first);
    await cleanupRuntime(second);
  });
});
