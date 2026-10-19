import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, rm, symlink, access, cp } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createServer } from "node:net";
import { runBrowserAuthority } from "../../scripts/sounding-line/browser-authority.mjs";
import { createBrowserDiagnosticSession } from "../../scripts/sounding-line/browser-diagnostics.mjs";
import { assertTerminated } from "./fixtures/process-state.mjs";
import {
  bounded,
  processExit,
  spawnOwnedProcess,
  stopOwnedProcess,
} from "../../scripts/sounding-line/owned-process.mjs";

const workspace = process.cwd();
const fixture = fileURLToPath(new URL("./fixtures/owned-runtime.mjs", import.meta.url));
const receipts = [];
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function eventually(operation, ms = 12000) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    try {
      return await operation();
    } catch {
      await pause(20);
    }
  }
  throw new Error("FIXTURE_OBSERVATION_DEADLINE");
}
async function unusedPort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function assertPortReleased(port) {
  if (!port) return;
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve) => server.close(resolve));
}
async function read(root, name) {
  return JSON.parse(await readFile(path.join(root, name), "utf8"));
}
test(
  "Linux real Next production capture publishes artifacts and returns to its caller",
  {
    timeout: 180000,
  },
  async (t) => {
    await mkdir(path.join(workspace, "artifacts"), { recursive: true });
    const root = await mkdtemp(path.join(workspace, "artifacts", "lifecycle-next-"));
    const children = [];
    t.after(async () => {
      await Promise.all(children.map((child) => stopOwnedProcess(child)));
      await rm(root, { recursive: true, force: true });
    });
    await mkdir(path.join(root, "pages"));
    await symlink(path.join(workspace, "node_modules"), path.join(root, "node_modules"), "junction");
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ name: "isolated-lifecycle-fixture", private: true }),
    );
    await writeFile(
      path.join(root, "pages/index.js"),
      'export default function Page(){return <main><h1>Capture ready</h1><a href="/done">Complete capture</a><a href="#">No-op capture</a></main>}',
    );
    await writeFile(
      path.join(root, "pages/done.js"),
      'export default function Page(){return <main><h1>Capture complete</h1><a href="/">Return to capture</a></main>}',
    );
    await writeFile(path.join(root, "instrumentation.js"), "export async function register() {}");
    await writeFile(
      path.join(root, "next.config.mjs"),
      'export default {experimental:{cpus:1},generateBuildId:async()=>"lifecycle-fixture"}',
    );
    const next = path.join(workspace, "node_modules/next/dist/bin/next");
    const build = spawnOwnedProcess(process.execPath, [next, "build"], { root, env: process.env });
    children.push(build);
    const result = await bounded(() => processExit(build), 100000, "NEXT_FIXTURE_BUILD_DEADLINE");
    const buildCleanup = await stopOwnedProcess(build);
    assert.equal(result.code, 0);
    assert.equal(buildCleanup.status, "PASS");
    const plan = {
      applicable: true,
      baseSha: "a".repeat(40),
      sourceDigest: "b".repeat(64),
      contractDigest: "c".repeat(64),
      outputDirectory: "artifacts/captured",
      contracts: [
        {
          id: "lifecycle-fixture",
          experience: {
            objective: "Verify protected capture lifecycle",
            entryPoint: "/",
            devices: ["DESKTOP"],
            roles: ["ANONYMOUS"],
            journeys: [
              {
                id: "capture-return",
                roles: ["ANONYMOUS"],
                outcome: "Capture completes and returns",
                steps: [
                  { action: "click", role: "link", name: "Complete capture" },
                  {
                    action: "assert",
                    kind: "outcome",
                    role: "heading",
                    name: "Capture complete",
                    path: "/done",
                    state: "COMPLETE",
                  },
                  { action: "click", role: "link", name: "Return to capture" },
                  {
                    action: "assert",
                    role: "heading",
                    name: "Capture ready",
                    path: "/",
                    state: "READY",
                    returnPath: true,
                  },
                ],
              },
            ],
          },
        },
      ],
    };
    await writeFile(path.join(root, "plan.json"), JSON.stringify(plan));
    const wrapper = spawnOwnedProcess(
      process.execPath,
      [
        path.join(workspace, "scripts/sounding-line/experience-browser.mjs"),
        "--workspace",
        root,
        "--run-server",
        path.join(root, "plan.json"),
      ],
      { root, env: process.env },
    );
    children.push(wrapper);
    const wrapperResult = await bounded(() => processExit(wrapper), 45000, "EXPERIENCE_CALLER_DEADLINE");
    assert.equal((await stopOwnedProcess(wrapper)).status, "PASS");
    assert.equal(wrapperResult.code, 0);
    const receipt = await read(root, "artifacts/sounding-line/browser-runtime.json");
    assert.equal(receipt.failureCategory, null);
    assert.equal(receipt.lifecycle.cleanup.status, "PASS");
    await assertPortReleased(Number(new URL(receipt.baseURL).port));
    const capture = await read(root, "artifacts/captured/capture.json");
    assert.ok(capture.artifacts.some((artifact) => artifact.type === "screenshot"));
    for (const artifact of capture.artifacts) {
      const bytes = await readFile(path.join(root, artifact.path));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), artifact.sha256);
    }
    await cp(
      path.join(root, "artifacts/captured"),
      path.join(workspace, "artifacts/sounding-line/capture-lifecycle-rendered"),
      { recursive: true },
    );
    receipts.push({ scenario: "REAL_NEXT_PRODUCTION_CAPTURE", ...receipt, artifacts: capture.artifacts.length });
    const historicalBytes = await readFile(path.join(root, "artifacts/sounding-line/browser-runtime.json"), "utf8");
    const diagnostics = createBrowserDiagnosticSession(root, {
      baseSha: "a".repeat(40),
      candidateSha: "b".repeat(40),
      planDigest: "c".repeat(64),
    });
    const failingPlan = structuredClone(plan);
    failingPlan.outputDirectory = "artifacts/failed-capture";
    failingPlan.contracts[0].experience.journeys[0].steps = [
      { action: "click", role: "link", name: "No-op capture" },
      { action: "assert", kind: "outcome", role: "heading", name: "Capture ready", path: "/", state: "READY" },
    ];
    await writeFile(path.join(root, "failing-plan.json"), JSON.stringify(failingPlan));
    const failingWrapper = spawnOwnedProcess(
      process.execPath,
      [
        path.join(workspace, "scripts/sounding-line/experience-browser.mjs"),
        "--workspace",
        root,
        "--run-server",
        path.join(root, "failing-plan.json"),
      ],
      { root, env: { ...process.env, ...diagnostics.beginScope() } },
    );
    children.push(failingWrapper);
    const failingResult = await bounded(() => processExit(failingWrapper), 45000, "BOUND_EXPERIENCE_CALLER_DEADLINE");
    assert.equal((await stopOwnedProcess(failingWrapper)).status, "PASS");
    assert.equal(failingResult.code, 1);
    const boundFailure = await diagnostics.read();
    assert.equal(boundFailure.runtime.failureCategory, "PRODUCT_FAILURE");
    assert.equal(boundFailure.runtime.lifecycle.cleanup.status, "PASS");
    assert.equal(boundFailure.profile, null);
    assert.deepEqual(boundFailure.runtime.diagnosticBinding, boundFailure.binding);
    await assertPortReleased(Number(new URL(boundFailure.runtime.baseURL).port));
    assert.equal(
      await readFile(path.join(root, "artifacts/sounding-line/browser-runtime.json"), "utf8"),
      historicalBytes,
    );
    receipts.push({ scenario: "BOUND_REAL_BROWSER_FAILURE_PRESERVES_HISTORICAL_RECEIPT", ...boundFailure.runtime });
    for (const mode of ["browser-fail", "browser-hang"]) {
      const controller = new AbortController();
      const port = await unusedPort();
      let watcher;
      const pending = runBrowserAuthority({
        root,
        port,
        signal: controller.signal,
        environment: { ...process.env, LIFECYCLE_FIXTURE_ROOT: root },
        serverArguments: [next, "start", "-H", "127.0.0.1", "-p", String(port)],
        browserScriptArguments: [fixture, "capture", mode],
        executionTimeoutMs: 30000,
        launch: (...args) => {
          const child = spawnOwnedProcess(...args);
          children.push(child);
          if (mode === "browser-hang" && args[1][0] === fixture)
            watcher = eventually(() => access(path.join(root, "browser-active.json"))).then(() => controller.abort());
          return child;
        },
      });
      const failed = await pending;
      await watcher;
      assert.ok(failed.failureCategory);
      assert.equal(failed.lifecycle.cleanup.status, "PASS");
      await assertPortReleased(port);
      const active = await read(root, "browser-active.json");
      assert.ok(active.ownedPids.length > 1);
      await assertTerminated(active.ownedPids);
      await rm(path.join(root, "browser-active.json"), { force: true });
      receipts.push({ scenario: mode, ...failed });
    }
  },
);

test.after(async () => {
  await mkdir(path.join(workspace, "artifacts/sounding-line"), { recursive: true });
  await writeFile(
    path.join(workspace, "artifacts/sounding-line/capture-lifecycle-browser-qualification.json"),
    JSON.stringify(
      {
        platform: process.platform,
        scenarios: receipts,
      },
      null,
      2,
    ) + "\n",
  );
});
