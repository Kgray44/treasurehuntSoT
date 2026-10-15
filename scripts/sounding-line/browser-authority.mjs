#!/usr/bin/env node
/* Runs generic browser authority against the exact built server and owns its lifecycle. */
import { createServer as createHttpServer, request as requestHttp } from "node:http";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bounded, observeProcess, processExit, spawnOwnedProcess, stopOwnedProcess } from "./owned-process.mjs";
import { writeBrowserDiagnosticReceipt } from "./browser-diagnostics.mjs";

const readinessIntervalMs = 250;
const readinessTimeoutMs = 120_000;

const diagnosticFailureCodes = new Set([
  "SOUNDING_LINE_INVALID_SERVER_TOPOLOGY:PRODUCTION_BROWSER_AUTHORITY_REQUIRES_NEXT_START",
  "SOUNDING_LINE_INVALID_SERVER_TOPOLOGY:BUILT_OUTPUT_MISMATCH",
  "SOUNDING_LINE_INVALID_SERVER_TOPOLOGY:PRODUCTION_AND_DEVELOPMENT_OUTPUT_COLLISION",
  "SOUNDING_LINE_INFRASTRUCTURE_STARTUP_FAILURE:SERVER_EXITED",
  "SOUNDING_LINE_INFRASTRUCTURE_STARTUP_FAILURE:SERVER_NOT_READY",
  "SOUNDING_LINE_INFRASTRUCTURE_STARTUP_FAILURE:TASK_OWNED_HTTP_PROXY",
  "SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:SERVER_EXITED",
  "SOUNDING_LINE_BROWSER_PRODUCT_FAILURE:PLAYWRIGHT_FIXTURE_EXITED",
  "SOUNDING_LINE_BROWSER_PRODUCT_FAILURE:PLAYWRIGHT_EXITED",
  "SOUNDING_LINE_INFRASTRUCTURE_CLEANUP_FAILURE:OWNED_RESOURCES_REMAIN",
  "SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:CANCELLED",
  "SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:EXECUTION_TIMEOUT",
  "SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:PROCESS_SUPERVISION",
]);

function authorityDiagnostic(
  startedAt,
  event,
  { child, exit, failureCategory, failureCode, childCleanup, proxyCleanup, proxy, cleanupResult } = {},
) {
  // Diagnostic boundaries are best effort stderr records, never acceptance
  // receipts. Select metadata explicitly; error text, URLs and launch inputs
  // can contain credentials and must not enter these records.
  try {
    const record = {
      namespace: "SOUNDING_LINE_DIAGNOSTIC",
      version: 1,
      component: "browser-authority",
      event,
      utc: new Date().toISOString(),
      elapsedMs: Number(Math.max(0, performance.now() - startedAt).toFixed(3)),
    };
    if (Number.isSafeInteger(child?.pid) && child.pid > 0) record.pid = child.pid;
    const observedExit = exit ?? (childCleanup && child ? { code: child.exitCode, signal: child.signalCode } : null);
    if (observedExit) {
      record.exitCode = Number.isInteger(observedExit.code) ? observedExit.code : null;
      record.signal = /^SIG[A-Z0-9]{1,12}$/u.test(observedExit.signal ?? "") ? observedExit.signal : null;
    }
    if (failureCategory !== undefined) {
      record.failureCategory = failureCategory;
      record.failureCode = diagnosticFailureCodes.has(failureCode) ? failureCode : null;
    }
    if (childCleanup)
      record.outcome = !child
        ? "NOT_STARTED"
        : child.exitCode !== null || child.signalCode !== null
          ? "EXITED"
          : "EXIT_NOT_OBSERVED";
    if (proxyCleanup) record.outcome = !proxy ? "NOT_STARTED" : !proxy.listening ? "CLOSED" : "CLOSE_NOT_OBSERVED";
    if (cleanupResult) {
      record.cleanupStatus = cleanupResult.status;
      record.treeReaped = cleanupResult.treeReaped;
      record.streamsClosed = cleanupResult.streamsClosed;
      record.escalated = cleanupResult.escalated;
    }
    console.error(JSON.stringify(record));
  } catch {
    // Observability must not change an existing result or cleanup path.
  }
}

export function assertBrowserAuthorityTopology({
  requiresProductionBuild = true,
  serverMode,
  productionOutputDirectory,
  serverOutputDirectory,
  developmentOutputDirectory,
}) {
  if (!requiresProductionBuild) return;
  if (serverMode !== "production")
    throw new Error("SOUNDING_LINE_INVALID_SERVER_TOPOLOGY:PRODUCTION_BROWSER_AUTHORITY_REQUIRES_NEXT_START");
  if (!productionOutputDirectory || productionOutputDirectory !== serverOutputDirectory)
    throw new Error("SOUNDING_LINE_INVALID_SERVER_TOPOLOGY:BUILT_OUTPUT_MISMATCH");
  if (developmentOutputDirectory && developmentOutputDirectory === productionOutputDirectory)
    throw new Error("SOUNDING_LINE_INVALID_SERVER_TOPOLOGY:PRODUCTION_AND_DEVELOPMENT_OUTPUT_COLLISION");
}

export function infrastructureFailureCategory(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("SOUNDING_LINE_SUITE_FIXTURE_CONTRACT_UNSATISFIED:"))
    return "SUITE_FIXTURE_CONTRACT_UNSATISFIED";
  if (message.startsWith("SOUNDING_LINE_INVALID_SERVER_TOPOLOGY:")) return "INVALID_SERVER_TOPOLOGY";
  if (message.startsWith("SOUNDING_LINE_INFRASTRUCTURE_STARTUP_FAILURE:")) return "INFRASTRUCTURE_STARTUP_FAILURE";
  if (message.startsWith("SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:")) return "INFRASTRUCTURE_RUNTIME_FAILURE";
  if (message.startsWith("SOUNDING_LINE_INFRASTRUCTURE_CLEANUP_FAILURE:")) return "INFRASTRUCTURE_CLEANUP_FAILURE";
  return "PRODUCT_FAILURE";
}

export function browserRuntimeReceipt({ timings, failureCategory = null, failureCode = null, baseURL, lifecycle }) {
  return {
    version: 1,
    topology: "BUILT_SERVER_TASK_OWNED_RUNTIME",
    baseURL,
    failureCategory,
    failureCode,
    ...(lifecycle ? { lifecycle } : {}),
    timings: {
      serverPreparationMs: timings.serverPreparationMs,
      serverReadinessMs: timings.serverReadinessMs,
      browserExecutionMs: timings.browserExecutionMs,
      infrastructureFailureWaitMs: timings.infrastructureFailureWaitMs,
      cleanupMs: timings.cleanupMs,
    },
  };
}

export async function writeBrowserReceiptAndExit(
  receipt,
  { write = process.stdout.write.bind(process.stdout), exit = process.exit.bind(process) } = {},
) {
  const output = `${JSON.stringify(receipt, null, 2)}\n`;
  await bounded(
    () =>
      new Promise((resolve, reject) => {
        write(output, (error) => (error ? reject(error) : resolve()));
      }),
    2000,
    "SOUNDING_LINE_RECEIPT_FLUSH_DEADLINE",
  );
  // Cleanup has its own verified outcome. End the CLI only after its truthful
  // terminal receipt is flushed, including when cleanup failed.
  exit(receipt.failureCategory ? 1 : 0);
}

async function availablePort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("SOUNDING_LINE_PORT_UNAVAILABLE"));
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

export function taskOwnedCookieAdapterRequired(environment) {
  return (
    environment.SOUNDING_LINE_TASK_OWNED_HTTP === "1" &&
    environment.FOREVER_VALIDATION_ISOLATION === "1" &&
    environment.FOREVER_VALIDATION_PRODUCTION_IDENTITY === "1" &&
    /^[a-f0-9]{64}$/u.test(environment.FOREVER_VALIDATION_NONCE_HASH ?? "")
  );
}

export function stripTaskOwnedCookieSecurity(value) {
  return value.replace(/;\s*Secure(?=;|$)/giu, "");
}

async function startTaskOwnedHttpProxy({ port, backendPort }) {
  const sockets = new Set();
  const proxy = createHttpServer((incoming, outgoing) => {
    const upstream = requestHttp(
      {
        hostname: "127.0.0.1",
        port: backendPort,
        method: incoming.method,
        path: incoming.url,
        headers: { ...incoming.headers, host: `127.0.0.1:${backendPort}` },
      },
      (response) => {
        const headers = { ...response.headers };
        if (Array.isArray(headers["set-cookie"]))
          headers["set-cookie"] = headers["set-cookie"].map(stripTaskOwnedCookieSecurity);
        outgoing.writeHead(response.statusCode ?? 502, headers);
        response.pipe(outgoing);
      },
    );
    upstream.once("socket", (socket) => {
      sockets.add(socket);
      socket.once("close", () => sockets.delete(socket));
    });
    upstream.once("error", () => {
      if (!outgoing.headersSent) outgoing.writeHead(502);
      outgoing.end();
    });
    incoming.pipe(upstream);
  });
  proxy.ownedSockets = sockets;
  proxy.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  try {
    await bounded(
      () =>
        new Promise((resolve, reject) => {
          proxy.once("error", reject);
          proxy.listen(port, "127.0.0.1", resolve);
        }),
      2000,
      "SOUNDING_LINE_PROXY_STARTUP_DEADLINE",
    );
  } catch (error) {
    await stopProxy(proxy);
    throw error;
  }
  return proxy;
}

async function isReady(baseURL) {
  try {
    const response = await fetch(baseURL, { signal: AbortSignal.timeout(1_000) });
    return response.ok || response.status > 0;
  } catch {
    return false;
  }
}

async function waitForReadiness({ baseURL, server, now, sleep, ready = isReady, active }) {
  const startedAt = now();
  const state = observeProcess(server);
  while (now() - startedAt < readinessTimeoutMs) {
    if (state.exited)
      throw new Error(
        `SOUNDING_LINE_INFRASTRUCTURE_STARTUP_FAILURE:SERVER_EXITED:${state.code ?? state.signal ?? "UNKNOWN"}`,
      );
    if (await active(() => bounded(() => ready(baseURL), 1500, "SOUNDING_LINE_READINESS_PROBE_DEADLINE")))
      return now() - startedAt;
    await active(() => sleep(readinessIntervalMs));
  }
  throw new Error("SOUNDING_LINE_INFRASTRUCTURE_STARTUP_FAILURE:SERVER_NOT_READY");
}

export function terminateTaskOwnedProcess(child, { platform = process.platform, kill = process.kill } = {}) {
  if (!child) return;
  if (platform !== "win32" && Number.isInteger(child.pid) && child.pid > 0) {
    try {
      kill(-child.pid);
      return;
    } catch {
      // Fall through to direct-child termination when a process group is unavailable.
    }
  }
  child.kill();
}

export async function stopProxy(proxy) {
  if (!proxy) return { status: "NOT_STARTED" };
  // The proxy sits between Playwright and the task-owned Next process. A
  // completed browser can leave an upgraded or keep-alive connection behind;
  // close() then waits forever even though the product receipt is already
  // complete. These are exclusively task-owned validation connections.
  proxy.closeAllConnections?.();
  for (const socket of proxy.ownedSockets ?? []) socket.destroy();
  if (proxy.listening)
    await bounded(() => new Promise((resolve) => proxy.close(resolve)), 1000, "SOUNDING_LINE_PROXY_CLEANUP_DEADLINE");
  return { status: "PASS" };
}

function failureCode(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.split(":", 2).join(":");
}

function nextServerMode(argumentsList) {
  if (argumentsList.includes("start")) return "production";
  if (argumentsList.includes("dev")) return "development";
  return "unknown";
}

export async function runBrowserAuthority({
  root,
  browserArguments,
  browserScriptArguments,
  fixtureArguments = [],
  fixtureProject = "chromium",
  environment = process.env,
  port,
  now = Date.now,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  launch = spawnOwnedProcess,
  ready = isReady,
  serverArguments: configuredServerArguments,
  signal,
  executionTimeoutMs = 15 * 60_000,
  cleanupOptions,
}) {
  const diagnosticStartedAt = performance.now();
  const progress = (event, fields) => authorityDiagnostic(diagnosticStartedAt, event, fields);
  const useTaskOwnedCookieAdapter = taskOwnedCookieAdapterRequired(environment);
  const browserPort = port ?? (await availablePort());
  const serverPort = useTaskOwnedCookieAdapter ? await availablePort() : browserPort;
  const baseURL = `http://127.0.0.1:${browserPort}`;
  const serverBaseURL = `http://127.0.0.1:${serverPort}`;
  const outputDirectory = environment.NEXT_DIST_DIR ?? ".next";
  const serverArguments = configuredServerArguments ?? [
    "node_modules/next/dist/bin/next",
    "start",
    "-H",
    "127.0.0.1",
    "-p",
    String(serverPort),
  ];
  const timings = {
    serverPreparationMs: 0,
    serverReadinessMs: 0,
    browserExecutionMs: 0,
    infrastructureFailureWaitMs: 0,
    cleanupMs: 0,
  };
  const serverStartedAt = now();
  let server;
  let proxy;
  let browser;
  let fixture;
  let failureCategory = null;
  let failureCodeValue = null;
  const lifecycle = { capture: "NOT_STARTED", fixture: "NOT_STARTED", cleanup: null };
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort(new Error("SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:CANCELLED"));
  const executionTimer = setTimeout(
    () => cancellation.abort(new Error("SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:EXECUTION_TIMEOUT")),
    executionTimeoutMs,
  );
  const aborted = new Promise((_, reject) => {
    cancellation.signal.addEventListener("abort", () => reject(cancellation.signal.reason), { once: true });
  });
  // A cancellation during teardown is recorded, but never interrupts cleanup.
  aborted.catch(() => {});
  signal?.addEventListener("abort", cancel, { once: true });
  process.on("SIGTERM", cancel);
  process.on("SIGINT", cancel);
  if (signal?.aborted) cancel();
  const active = (operation) => {
    cancellation.signal.throwIfAborted();
    return Promise.race([Promise.resolve().then(operation), aborted]);
  };
  const start = (command, args, options) => {
    cancellation.signal.throwIfAborted();
    const child = launch(command, args, { ...options, cleanupOptions });
    observeProcess(child);
    return child;
  };
  try {
    assertBrowserAuthorityTopology({
      serverMode: nextServerMode(serverArguments),
      productionOutputDirectory: outputDirectory,
      serverOutputDirectory: outputDirectory,
    });
    server = start(process.execPath, serverArguments, {
      root,
      env: { ...environment, PLAYWRIGHT_BASE_URL: baseURL, NEXT_TELEMETRY_DISABLED: "1" },
    });
    timings.serverPreparationMs = now() - serverStartedAt;
    progress("readiness.backend.start", { child: server });
    timings.serverReadinessMs = await waitForReadiness({ baseURL: serverBaseURL, server, now, sleep, ready, active });
    progress("readiness.backend.result", { child: server });
    if (useTaskOwnedCookieAdapter) {
      try {
        progress("proxy.start");
        proxy = await startTaskOwnedHttpProxy({ port: browserPort, backendPort: serverPort });
        progress("proxy.result");
      } catch {
        throw new Error("SOUNDING_LINE_INFRASTRUCTURE_STARTUP_FAILURE:TASK_OWNED_HTTP_PROXY");
      }
      progress("readiness.proxy.start", { child: server });
      timings.serverReadinessMs += await waitForReadiness({ baseURL, server, now, sleep, ready, active });
      progress("readiness.proxy.result", { child: server });
    }
    if (fixtureArguments.length) {
      progress("fixture.start");
      fixture = start(
        process.execPath,
        ["node_modules/@playwright/test/cli.js", "test", ...fixtureArguments, "--project", fixtureProject],
        {
          root,
          env: {
            ...environment,
            FOREVER_PLAYWRIGHT_EXTERNAL_SERVER: "1",
            PLAYWRIGHT_BASE_URL: baseURL,
            SOUNDING_LINE_BROWSER_AUTHORITY: "1",
            SOUNDING_LINE_BROWSER_FIXTURE_SETUP: "1",
          },
        },
      );
      progress("fixture.launched", { child: fixture });
      lifecycle.fixture = "RUNNING";
      const fixtureResult = await active(() =>
        Promise.race([
          processExit(fixture),
          processExit(server).then(() => {
            throw new Error("SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:SERVER_EXITED");
          }),
        ]),
      );
      lifecycle.fixture = fixtureResult.code === 0 ? "PASS" : "FAIL";
      if (fixtureResult.supervisionFailure)
        throw new Error("SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:PROCESS_SUPERVISION");
      progress("fixture.exit", { child: fixture, exit: fixtureResult });
      if (fixtureResult.code !== 0)
        throw new Error(
          `SOUNDING_LINE_BROWSER_PRODUCT_FAILURE:PLAYWRIGHT_FIXTURE_EXITED:${fixtureResult.code ?? "UNKNOWN"}`,
        );
    }
    const browserStartedAt = now();
    progress("capture-child.start");
    browser = start(
      process.execPath,
      browserScriptArguments ?? ["node_modules/@playwright/test/cli.js", "test", ...browserArguments],
      {
        root,
        env: {
          ...environment,
          FOREVER_PLAYWRIGHT_EXTERNAL_SERVER: "1",
          PLAYWRIGHT_BASE_URL: baseURL,
          SOUNDING_LINE_BROWSER_AUTHORITY: "1",
        },
      },
    );
    progress("capture-child.launched", { child: browser });
    lifecycle.capture = "RUNNING";
    const browserExit = processExit(browser).then((value) => {
      progress("capture-child.exit", { child: browser, exit: value });
      return { type: "browser", value };
    });
    const serverExit = processExit(server).then((value) => ({ type: "server", value }));
    const completed = await active(() => Promise.race([browserExit, serverExit]));
    timings.browserExecutionMs = now() - browserStartedAt;
    if (completed.type === "server") {
      const failureDetectedAt = now();
      progress("authority.failure", {
        failureCategory: "INFRASTRUCTURE_RUNTIME_FAILURE",
        failureCode: "SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:SERVER_EXITED",
      });
      timings.infrastructureFailureWaitMs = now() - failureDetectedAt;
      throw new Error(
        `SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:SERVER_EXITED:${completed.value.code ?? completed.value.signal ?? "UNKNOWN"}`,
      );
    }
    lifecycle.capture = completed.value.code === 0 ? "PASS" : "FAIL";
    if (completed.value.supervisionFailure)
      throw new Error("SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:PROCESS_SUPERVISION");
    if (completed.value.code !== 0)
      throw new Error(`SOUNDING_LINE_BROWSER_PRODUCT_FAILURE:PLAYWRIGHT_EXITED:${completed.value.code ?? "UNKNOWN"}`);
  } catch (error) {
    failureCategory = infrastructureFailureCategory(error);
    failureCodeValue = failureCode(error);
    progress("authority.failure", { failureCategory, failureCode: failureCodeValue });
  } finally {
    clearTimeout(executionTimer);
    const cleanupStartedAt = now();
    progress("cleanup.browser.start", { child: browser });
    progress("cleanup.proxy.start");
    progress("cleanup.server.start", { child: server });
    const [browserCleanup, fixtureCleanup, serverCleanup, proxyCleanup] = await Promise.all([
      stopOwnedProcess(browser, cleanupOptions),
      stopOwnedProcess(fixture, cleanupOptions),
      stopOwnedProcess(server, cleanupOptions),
      stopProxy(proxy).catch(() => ({ status: "FAIL" })),
    ]);
    let portsReleased = true;
    for (const ownedPort of server ? new Set([browserPort, serverPort]) : []) {
      try {
        await bounded(() => verifyPortReleased(ownedPort), 1000, "SOUNDING_LINE_PORT_VERIFY_DEADLINE");
      } catch {
        portsReleased = false;
      }
    }
    lifecycle.cleanup = {
      browser: browserCleanup,
      fixture: fixtureCleanup,
      server: serverCleanup,
      proxy: proxyCleanup,
      portsReleased,
      status:
        [browserCleanup, fixtureCleanup, serverCleanup, proxyCleanup].every(
          (entry) => entry.status === "PASS" || entry.status === "NOT_STARTED",
        ) && portsReleased
          ? "PASS"
          : "FAIL",
    };
    progress("cleanup.browser.result", { child: browser, childCleanup: true, cleanupResult: browserCleanup });
    progress("cleanup.proxy.result", { proxy, proxyCleanup: true });
    progress("cleanup.server.result", { child: server, childCleanup: true, cleanupResult: serverCleanup });
    timings.cleanupMs = now() - cleanupStartedAt;
    if (!failureCategory && cancellation.signal.aborted) {
      failureCategory = "INFRASTRUCTURE_RUNTIME_FAILURE";
      failureCodeValue = failureCode(cancellation.signal.reason);
    }
    if (!failureCategory && lifecycle.cleanup.status !== "PASS") {
      failureCategory = "INFRASTRUCTURE_CLEANUP_FAILURE";
      failureCodeValue = "SOUNDING_LINE_INFRASTRUCTURE_CLEANUP_FAILURE:OWNED_RESOURCES_REMAIN";
    }
    if (lifecycle.capture === "RUNNING") lifecycle.capture = "INTERRUPTED";
    if (lifecycle.fixture === "RUNNING") lifecycle.fixture = "INTERRUPTED";
    lifecycle.cancelled = cancellation.signal.aborted;
    signal?.removeEventListener("abort", cancel);
    process.removeListener("SIGTERM", cancel);
    process.removeListener("SIGINT", cancel);
  }
  const receipt = browserRuntimeReceipt({
    timings,
    failureCategory,
    failureCode: failureCodeValue,
    baseURL,
    lifecycle,
  });
  progress("authority.result", { failureCategory, failureCode: failureCodeValue });
  return receipt;
}

async function verifyPortReleased(port) {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
}

async function main() {
  const separator = process.argv.indexOf("--");
  if (separator === -1) throw new Error("SOUNDING_LINE_BROWSER_ARGUMENTS_REQUIRED");
  const root = process.cwd();
  const fixtureArguments = [];
  let fixtureProject = "chromium";
  for (let index = 2; index < separator; index += 1) {
    if (process.argv[index] === "--fixture" && process.argv[index + 1]) fixtureArguments.push(process.argv[index + 1]);
    if (process.argv[index] === "--fixture-project" && process.argv[index + 1])
      fixtureProject = process.argv[index + 1];
  }
  const receipt = await runBrowserAuthority({
    root,
    fixtureArguments,
    fixtureProject,
    browserArguments: process.argv.slice(separator + 1),
    port: browserPortFromEnvironment(process.env),
  });
  await writeBrowserDiagnosticReceipt(root, "browser-runtime.json", receipt);
  await writeBrowserReceiptAndExit(receipt);
}

function browserPortFromEnvironment(environment) {
  const configured = environment.SOUNDING_LINE_BROWSER_PORT;
  if (!configured) return undefined;
  if (!/^[1-9]\d{0,4}$/u.test(configured)) throw new Error("SOUNDING_LINE_BROWSER_PORT_INVALID");
  const port = Number(configured);
  if (port > 65_535) throw new Error("SOUNDING_LINE_BROWSER_PORT_INVALID");
  return port;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
