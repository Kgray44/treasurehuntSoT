// @sounding-line-registration owner=sealed-hold suite=unit.private-content contracts=sextant.shared-consumers.private-content
import { lstat, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSyntheticPrivateStorage } from "../../scripts/landfall/device-lab/private-content-storage";

const candidate = "a".repeat(40);
const proof = () => ({
  diagnosticBinding: { candidateSha: candidate },
  lifecycle: {
    cleanup: {
      status: "PASS",
      portsReleased: true,
      browser: { treeReaped: true, streamsClosed: true },
      server: { treeReaped: true, streamsClosed: true },
    },
  },
});
const owned: Array<{ root: string; dev: number; ino: number }> = [];
let checkout = "";
async function remember(root: string) {
  const stat = await lstat(root);
  owned.push({ root: await realpath(root), dev: stat.dev, ino: stat.ino });
}
beforeEach(async () => {
  checkout = await mkdtemp(path.join(await realpath(tmpdir()), "sextant-harness-checkout-"));
  await remember(checkout);
});
afterEach(async () => {
  for (const item of owned.splice(0).reverse()) {
    try {
      const current = await lstat(item.root),
        resolved = await realpath(item.root);
      if (
        current.isSymbolicLink() ||
        current.dev !== item.dev ||
        current.ino !== item.ino ||
        resolved !== item.root ||
        path.dirname(resolved) !== (await realpath(tmpdir())) ||
        !/^(sextant-private-|sextant-harness-checkout-)/.test(path.basename(resolved))
      )
        throw new Error("TEST_OWNED_ROOT_CHANGED");
      await rm(resolved, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
});
async function create() {
  const store = await createSyntheticPrivateStorage(candidate, "file:/synthetic/owned.db", checkout);
  await remember(store.environment.SEXTANT_PRIVATE_CONTENT_TEST_ROOT);
  return store;
}
describe("Sextant synthetic private-store ownership", () => {
  it("removes only its exact store after bound canonical tree, stream and port cleanup", async () => {
    const store = await create(),
      root = store.environment.SEXTANT_PRIVATE_CONTENT_TEST_ROOT;
    const key = store.environment.PRIVATE_CONTENT_LOCAL_MASTER_KEY;
    expect(JSON.parse(await readFile(store.receiptPath, "utf8"))).toMatchObject({
      sourceSha: candidate,
      taskRoot: root,
      status: "CREATED",
      keyPublished: false,
    });
    await expect(store.close({ succeeded: true, runtime: proof() })).resolves.toMatchObject({ removed: true });
    await expect(lstat(root)).rejects.toMatchObject({ code: "ENOENT" });
    const text = await readFile(store.receiptPath, "utf8");
    expect(text).not.toContain(key);
    expect(JSON.parse(text)).toMatchObject({
      status: "PASS_REMOVED_AFTER_CANONICAL_PROCESS_CLEANUP",
      processCleanupVerified: true,
      rootAbsent: true,
    });
  });
  it.each(["browser-failure", "port-not-released", "stale-candidate"] as const)(
    "retains failure state for %s with a redacted receipt",
    async (kind) => {
      const store = await create(),
        root = store.environment.SEXTANT_PRIVATE_CONTENT_TEST_ROOT;
      const runtime = proof();
      if (kind === "port-not-released") runtime.lifecycle.cleanup.portsReleased = false;
      if (kind === "stale-candidate") runtime.diagnosticBinding.candidateSha = "b".repeat(40);
      await expect(store.close({ succeeded: kind !== "browser-failure", runtime })).resolves.toMatchObject({
        removed: false,
      });
      expect((await lstat(root)).isDirectory()).toBe(true);
      expect(JSON.parse(await readFile(store.receiptPath, "utf8"))).toMatchObject({
        status: "RETAINED_AFTER_FAILURE",
        keyPublished: false,
        keyRetained: false,
      });
    },
  );
  it("refuses recursive cleanup when its creation marker changes", async () => {
    const store = await create(),
      root = store.environment.SEXTANT_PRIVATE_CONTENT_TEST_ROOT;
    await writeFile(path.join(root, "identity.json"), "changed synthetic ownership marker\n");
    await expect(store.close({ succeeded: true, runtime: proof() })).resolves.toMatchObject({ removed: false });
    expect((await lstat(root)).isDirectory()).toBe(true);
    expect(JSON.parse(await readFile(store.receiptPath, "utf8"))).toMatchObject({
      status: "FAIL_RETAINED_STORAGE_CLEANUP_OR_OWNERSHIP",
    });
  });
});
