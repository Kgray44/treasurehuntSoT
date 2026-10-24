// Tiny inert files and creation-owned forced stops only. No product build.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createPreparationCapture } from "../../scripts/sounding-line/development-preparation-evidence.mjs";
import {
  developmentBuildFingerprint,
  writeDevelopmentPreparedManifest,
} from "../../scripts/sounding-line/develop-browser-suite.mjs";
import { processExit, spawnOwnedProcess, stopOwnedProcess } from "../../scripts/sounding-line/owned-process.mjs";

const phases = ["BUILD_TREE_FINGERPRINT", "FINAL_DEPENDENCY_FINGERPRINT", "MANIFEST_WRITE"];
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function fixture(t) {
  const parent = await realpath(tmpdir());
  const root = await realpath(await mkdtemp(path.join(parent, "postbuild-timing-")));
  t.after(async () => {
    assert.equal(path.dirname(await realpath(root)), parent);
    assert(path.basename(root).startsWith("postbuild-timing-"));
    await rm(root, { recursive: true });
  });
  const output = path.join(root, "private-output");
  await mkdir(output);
  const capture = createPreparationCapture({}, output);
  capture.phase("MANIFEST");
  return { root, output, capture };
}
async function records(directory) {
  const names = (await readdir(directory)).filter((name) => name.startsWith("postbuild-verification-")).sort();
  return Promise.all(
    names.map(async (name) => {
      const bytes = await readFile(path.join(directory, name));
      assert(bytes.length <= 512);
      const record = JSON.parse(bytes);
      assert.deepEqual(
        Object.keys(record).sort(),
        ["version", "role", "qualification", "sequence", "phase", "event", "atUtc", "elapsedMs", "outcome"].sort(),
      );
      assert.equal(record.role, "DEVELOPMENT_ONLY");
      assert.equal(record.qualification, false);
      assert(Number.isFinite(Date.parse(record.atUtc)));
      return record;
    }),
  );
}

test("real tiny fingerprints and synced manifest produce six bounded opaque records", async (t) => {
  const f = await fixture(t);
  const workspace = path.join(f.root, "workspace"),
    build = path.join(workspace, "immutable-build");
  const registry = path.join(workspace, "node_modules/playwright-core/lib/server/registry");
  await mkdir(build, { recursive: true });
  await mkdir(registry, { recursive: true });
  await writeFile(path.join(build, "page.js"), "PRIVATE_BUILD_CONTENT");
  await writeFile(path.join(workspace, "package-lock.json"), "{}");
  await writeFile(path.join(workspace, "node_modules/.package-lock.json"), "{}");
  await writeFile(path.join(workspace, "node_modules/playwright-core/package.json"), '{"type":"module"}');
  await writeFile(
    path.join(registry, "index.js"),
    'import{fileURLToPath}from"node:url";export const registry={findExecutable(name){return{executablePath:()=>fileURLToPath(new URL("./"+name,import.meta.url))}}};',
  );
  for (const name of ["chromium", "chromium-headless-shell", "ffmpeg"])
    await writeFile(path.join(registry, name), name);
  const preparedDirectory = path.join(f.root, "prepared");
  await mkdir(preparedDirectory);
  const prepared = {
    version: 1,
    role: "DEVELOPMENT_ONLY",
    qualification: false,
    workspace,
    buildDirectory: build,
    preparedDirectory,
  };
  const result = await writeDevelopmentPreparedManifest(prepared, f.capture);
  const bytes = await readFile(result.file),
    manifest = JSON.parse(bytes);
  assert.equal(hash(bytes), result.sha256);
  assert.deepEqual(manifest.build, await developmentBuildFingerprint(build, workspace));
  assert.equal(manifest.dependencies.projectLock, hash("{}"));
  assert.equal(manifest.dependencies.installedLock, hash("{}"));
  assert.match(manifest.dependencies.installedTree, /^[a-f0-9]{64}$/);
  for (const browser of manifest.dependencies.browsers) assert.equal(browser.sha256, hash(browser.name));
  const journal = await records(f.output);
  assert.deepEqual(
    journal.map((r) => r.phase),
    phases.flatMap((phase) => [phase, phase]),
  );
  assert.deepEqual(
    journal.map((r) => r.event),
    ["START", "END", "START", "END", "START", "END"],
  );
  assert.deepEqual(
    journal.map((r) => r.sequence),
    [1, 2, 3, 4, 5, 6],
  );
  for (const record of journal.filter((r) => r.event === "END")) {
    assert.equal(record.outcome, "PASS");
    assert(record.elapsedMs >= 0);
  }
  const text = JSON.stringify(journal);
  for (const canary of [f.root, "PRIVATE_BUILD_CONTENT", "page.js", "node_modules"]) assert(!text.includes(canary));
  await assert.rejects(f.capture.measurePostbuild(undefined, () => {}));
  assert.equal((await records(f.output)).length, 6);
});

test("start is readable before work; failure preserves its identity and exposes no message", async (t) => {
  const f = await fixture(t),
    original = Error("PRIVATE_CREDENTIAL_DB_PATH_SENTINEL");
  await assert.rejects(
    f.capture.measurePostbuild(phases[0], async () => {
      assert.deepEqual(
        (await records(f.output)).map((r) => r.event),
        ["START"],
      );
      throw original;
    }),
    (error) => error === original,
  );
  const journal = await records(f.output);
  assert.equal(journal[1].outcome, "FAIL");
  assert(!JSON.stringify(journal).includes(original.message));
  await assert.rejects(f.capture.measurePostbuild(phases[0], () => {}));
  await assert.rejects(f.capture.measurePostbuild("PRIVATE_UNKNOWN_PHASE", () => {}));
  assert.equal((await records(f.output)).length, 2);
});

test("exclusive checkpoint failures never overwrite evidence or hide the operation failure", async (t) => {
  const f = await fixture(t),
    collision = path.join(f.output, "postbuild-verification-1.private.json");
  await writeFile(collision, "ORIGINAL");
  let called = false;
  await assert.rejects(
    f.capture.measurePostbuild(phases[0], () => {
      called = true;
    }),
    { code: "EEXIST" },
  );
  assert.equal(called, false);
  assert.equal(await readFile(collision, "utf8"), "ORIGINAL");
  const second = await fixture(t),
    original = Error("PRIVATE_ORIGINAL_FAILURE");
  await writeFile(path.join(second.output, "postbuild-verification-2.private.json"), "RETAINED");
  await assert.rejects(
    second.capture.measurePostbuild(phases[0], () => {
      throw original;
    }),
    (error) => error === original,
  );
  assert.equal(await readFile(path.join(second.output, "postbuild-verification-2.private.json"), "utf8"), "RETAINED");
});

test("a successful operation cannot pass after its end checkpoint fails", async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.output, "postbuild-verification-2.private.json"), "RETAINED");
  await assert.rejects(
    f.capture.measurePostbuild(phases[0], () => 42),
    { code: "EEXIST" },
  );
});

for (const [index, phase] of phases.entries()) {
  test(`owned forced stop retains durable incomplete ${phase}`, { timeout: 20000 }, async (t) => {
    const f = await fixture(t);
    const environment = Object.fromEntries(
      Object.entries(process.env).filter(([key]) =>
        ["SystemRoot", "WINDIR", "ComSpec", "PATH", "Path", "PATHEXT", "TEMP", "TMP"].includes(key),
      ),
    );
    const child = spawnOwnedProcess(
      process.execPath,
      [path.join(repository, "tests/sounding-line/fixtures/postbuild-verification-stop.mjs"), f.output, phase],
      { root: repository, env: environment, cleanupOptions: { gracefulMs: 0 } },
    );
    child.stdout.unpipe(process.stdout);
    child.stderr.unpipe(process.stderr);
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 4096) stderr += chunk.toString().slice(0, 4096 - stderr.length);
    });
    child.stdout.resume();
    try {
      let exited, ready;
      processExit(child).then(
        (result) => {
          exited = result;
        },
        (error) => {
          exited = { error: error.message };
        },
      );
      const deadline = performance.now() + 10000;
      for (;;) {
        try {
          ready = JSON.parse(await readFile(path.join(f.output, "synthetic-ready.json"), "utf8"));
          break;
        } catch (error) {
          if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
        }
        if (exited) throw Error(`SYNTHETIC_EARLY_EXIT:${JSON.stringify(exited)}:${stderr}`);
        if (performance.now() >= deadline) throw Error("SYNTHETIC_READY_DEADLINE");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(ready.ready, true);
      const before = await records(f.output);
      assert.equal(before.length, index * 2 + 1);
      assert.equal(before.at(-1).phase, phase);
      assert.equal(before.at(-1).event, "START");
      const cleanup = await stopOwnedProcess(child);
      assert.equal(cleanup.status, "PASS");
      assert.equal(cleanup.treeReaped, true);
      assert.equal(cleanup.streamsClosed, true);
      assert.throws(() => process.kill(ready.pid, 0));
      assert.deepEqual(await records(f.output), before);
      await assert.rejects(readFile(path.join(f.output, "development-result.private.json")), { code: "ENOENT" });
    } finally {
      await stopOwnedProcess(child);
    }
  });
}
