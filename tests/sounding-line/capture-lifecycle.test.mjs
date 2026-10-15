import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, mkdir, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createServer } from "node:net";
import { runBrowserAuthority } from "../../scripts/sounding-line/browser-authority.mjs";
import {
  bounded,
  observeProcess,
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
async function verifyResources(root) {
  for (const name of ["server.json", "leaf.json", "active.json"]) {
    let resource;
    try {
      resource = await read(root, name);
    } catch {
      continue;
    }
    await assertPortReleased(resource.port);
    // Actual OS observation. On Linux a zombie is already terminated; the
    // direct child is separately reaped through its exit AND close events.
    if (process.platform === "linux") {
      let stat;
      try {
        stat = await readFile(`/proc/${resource.pid}/stat`, "utf8");
      } catch {
        continue;
      }
      assert.match(stat.slice(stat.lastIndexOf(")") + 2), /^[ZX] /u);
    } else {
      assert.throws(() => process.kill(resource.pid, 0), /ESRCH/u);
    }
  }
}
async function runFixture(t, { kind = "normal", capture = "normal", controller, onLaunch, ...extra } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "capture-lifecycle-"));
  const children = [];
  t.after(async () => {
    await Promise.all(children.map((child) => stopOwnedProcess(child)));
    await rm(root, { recursive: true, force: true });
  });
  const { launch: launchProcess = spawnOwnedProcess, ...authorityOptions } = extra;
  const port = await unusedPort();
  let launched = 0;
  const receipt = await runBrowserAuthority({
    root: workspace,
    port,
    environment: {
      ...process.env,
      LIFECYCLE_FIXTURE_ROOT: root,
      LIFECYCLE_WAIT_FOR_LEAF: kind.includes("orphan") ? "1" : "0",
    },
    serverArguments: [fixture, "server", kind, "start", "-p", String(port)],
    browserScriptArguments: [fixture, "capture", capture],
    signal: controller?.signal,
    cleanupOptions: { gracefulMs: 120, forceMs: 1500 },
    launch: (...args) => {
      const child = launchProcess(...args);
      children.push(child);
      onLaunch?.({ root, index: ++launched, child });
      return child;
    },
    ...authorityOptions,
  });
  receipts.push({ scenario: t.name, ...receipt });
  assert.ok(receipt.timings.cleanupMs < 10000);
  await assertPortReleased(port);
  await verifyResources(root);
  return { receipt, root, port };
}

test(
  "normal capture reaps server, closes streams, releases ports and retains capture artifacts",
  { timeout: 30000 },
  async (t) => {
    const { receipt, root } = await runFixture(t);
    assert.equal(receipt.failureCategory, null);
    assert.equal(receipt.lifecycle.capture, "PASS");
    assert.equal(receipt.lifecycle.cleanup.status, "PASS");
    assert.equal(receipt.lifecycle.cleanup.server.treeReaped, true);
    assert.equal(receipt.lifecycle.cleanup.server.streamsClosed, true);
    assert.equal((await read(root, "capture-operation.json")).status, "PASS");
  },
);
test("stubborn server is forcefully terminated within the cleanup budget", { timeout: 30000 }, async (t) => {
  const { receipt } = await runFixture(t, { kind: "stubborn" });
  assert.equal(receipt.failureCategory, null);
  assert.equal(receipt.lifecycle.cleanup.server.escalated, true);
});
test("orphaned detached server descendant is terminated after its parent exits", { timeout: 30000 }, async (t) => {
  const { receipt } = await runFixture(t, { kind: "orphan" });
  assert.equal(receipt.failureCategory, null);
  assert.equal(receipt.lifecycle.cleanup.server.treeReaped, true);
});
test("detached orphan with a sanitized environment remains owned", { timeout: 30000 }, async (t) => {
  const { receipt, root } = await runFixture(t, { kind: "sanitized-orphan" });
  assert.ok((await read(root, "leaf.json")).pid);
  assert.equal(receipt.failureCategory, null);
  assert.equal(receipt.lifecycle.cleanup.server.treeReaped, true);
});
test("capture exit before cleanup still terminates its inherited-pipe descendant", { timeout: 30000 }, async (t) => {
  const { receipt } = await runFixture(t, { capture: "orphan" });
  assert.equal(receipt.lifecycle.capture, "PASS");
  assert.equal(receipt.lifecycle.cleanup.browser.treeReaped, true);
  assert.equal(receipt.lifecycle.cleanup.browser.streamsClosed, true);
});
test("exit observation handles already exited children and the subscribe/check race", async () => {
  const child = spawn(process.execPath, ["-e", "process.exit(0)"], { stdio: "ignore", windowsHide: true });
  await new Promise((resolve) => child.once("close", resolve));
  assert.equal((await processExit(child)).code, 0);
  const raced = new EventEmitter();
  raced.exitCode = null;
  raced.signalCode = null;
  const original = raced.once.bind(raced);
  raced.once = (event, listener) => {
    original(event, listener);
    if (event === "exit") raced.exitCode = 0; // no event; state changes during subscription
    return raced;
  };
  assert.equal((await bounded(() => observeProcess(raced).exit, 100, "RACE")).code, 0);
});
test("capture failure retains product attribution and cleans every resource", { timeout: 30000 }, async (t) => {
  const { receipt } = await runFixture(t, { capture: "fail" });
  assert.equal(receipt.failureCategory, "PRODUCT_FAILURE");
  assert.equal(receipt.lifecycle.capture, "FAIL");
  assert.equal(receipt.lifecycle.cleanup.status, "PASS");
});
test(
  "missing payload supervision is infrastructure failure rather than product failure",
  { timeout: 30000 },
  async (t) => {
    const { receipt } = await runFixture(t, {
      launch: (command, args, options) =>
        spawnOwnedProcess(
          args[0] === fixture && args[1] === "capture"
            ? path.join(workspace, "artifacts", "missing-lifecycle-payload")
            : command,
          args,
          options,
        ),
    });
    assert.equal(receipt.failureCategory, "INFRASTRUCTURE_RUNTIME_FAILURE");
    assert.equal(receipt.failureCode, "SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:PROCESS_SUPERVISION");
    assert.equal(receipt.lifecycle.cleanup.status, "FAIL");
  },
);
test("cancellation during startup stops its owned server before launching capture", { timeout: 30000 }, async (t) => {
  const controller = new AbortController();
  const { receipt } = await runFixture(t, {
    kind: "startup",
    controller,
    onLaunch: ({ root }) => {
      eventually(() => access(path.join(root, "server.json"))).then(() => controller.abort());
    },
  });
  assert.equal(receipt.lifecycle.capture, "NOT_STARTED");
  assert.equal(receipt.failureCode, "SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:CANCELLED");
  assert.equal(receipt.lifecycle.cleanup.status, "PASS");
});
test("cancellation during active capture terminates the capture tree", { timeout: 30000 }, async (t) => {
  const controller = new AbortController();
  const { receipt } = await runFixture(t, {
    capture: "hang",
    controller,
    onLaunch: ({ root, index }) => {
      if (index === 2) eventually(() => access(path.join(root, "active.json"))).then(() => controller.abort());
    },
  });
  assert.equal(receipt.lifecycle.capture, "INTERRUPTED");
  assert.equal(receipt.lifecycle.cleanup.status, "PASS");
});
test("cancellation during teardown does not interrupt escalation or turn into PASS", { timeout: 30000 }, async (t) => {
  const controller = new AbortController();
  const { receipt } = await runFixture(t, {
    kind: "stubborn",
    controller,
    onLaunch: ({ index, child }) => {
      if (index === 1) child.stdin.once("finish", () => controller.abort());
    },
  });
  assert.equal(receipt.lifecycle.cancelled, true);
  assert.equal(receipt.lifecycle.cleanup.status, "PASS");
  assert.equal(receipt.failureCode, "SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:CANCELLED");
});
test("unverifiable cleanup returns a bounded truthful terminal failure", { timeout: 30000 }, async (t) => {
  // Fault injection deliberately bypasses creation-bound ownership while still
  // running real processes. Direct exit cannot establish tree cleanup.
  const { receipt } = await runFixture(t, {
    launch: (command, args, options) =>
      spawn(command, args, {
        cwd: options.root,
        env: options.env,
        stdio: "ignore",
        windowsHide: true,
      }),
  });
  assert.equal(receipt.lifecycle.capture, "PASS");
  assert.equal(receipt.lifecycle.cleanup.status, "FAIL");
  assert.equal(receipt.failureCategory, "INFRASTRUCTURE_CLEANUP_FAILURE");
  assert.ok(receipt.timings.cleanupMs < 5000);
});
test("sequential captures leave no process or port behind", { timeout: 60000 }, async (t) => {
  for (let index = 0; index < 3; index++) {
    const { receipt } = await runFixture(t);
    assert.equal(receipt.lifecycle.cleanup.status, "PASS");
  }
});
test("concurrent independent captures preserve each other's running server", { timeout: 60000 }, async (t) => {
  let release;
  const firstAlive = new Promise((resolve) => {
    release = resolve;
  });
  let secondRoot;
  const second = runFixture(t, {
    capture: "hang",
    executionTimeoutMs: 10000,
    onLaunch: ({ root, index }) => {
      if (index === 2) {
        secondRoot = root;
        release();
      }
    },
  });
  await firstAlive;
  const first = await runFixture(t, { kind: "stubborn" });
  assert.equal(first.receipt.failureCategory, null);
  const server = await read(secondRoot, "server.json");
  assert.equal((await fetch(`http://127.0.0.1:${server.port}`)).status, 200);
  const result = await second;
  assert.equal(result.receipt.failureCode, "SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:EXECUTION_TIMEOUT");
  assert.equal(result.receipt.lifecycle.cleanup.status, "PASS");
});

test.after(async () => {
  await mkdir(path.join(workspace, "artifacts/sounding-line"), { recursive: true });
  await writeFile(
    path.join(workspace, "artifacts/sounding-line/capture-lifecycle-qualification.json"),
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
