#!/usr/bin/env node
/* Runs generic browser authority against the exact built server and owns its lifecycle. */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const readinessIntervalMs = 250;
const readinessTimeoutMs = 120_000;
const shutdownTimeoutMs = 5_000;

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
  if (message.startsWith("SOUNDING_LINE_INVALID_SERVER_TOPOLOGY:")) return "INVALID_SERVER_TOPOLOGY";
  if (message.startsWith("SOUNDING_LINE_INFRASTRUCTURE_STARTUP_FAILURE:")) return "INFRASTRUCTURE_STARTUP_FAILURE";
  if (message.startsWith("SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:")) return "INFRASTRUCTURE_RUNTIME_FAILURE";
  return "PRODUCT_FAILURE";
}

export function browserRuntimeReceipt({ timings, failureCategory = null, failureCode = null, baseURL }) {
  return {
    version: 1,
    topology: "BUILT_SERVER_TASK_OWNED_RUNTIME",
    baseURL,
    failureCategory,
    failureCode,
    timings: {
      serverPreparationMs: timings.serverPreparationMs,
      serverReadinessMs: timings.serverReadinessMs,
      browserExecutionMs: timings.browserExecutionMs,
      infrastructureFailureWaitMs: timings.infrastructureFailureWaitMs,
      cleanupMs: timings.cleanupMs,
    },
  };
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

function spawnProcess(command, argumentsList, { root, env, stdio = "inherit" }) {
  return spawn(command, argumentsList, { cwd: root, env, stdio, windowsHide: true });
}

function exited(child) {
  if (child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  return new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
}

async function isReady(baseURL) {
  try {
    const response = await fetch(baseURL, { signal: AbortSignal.timeout(1_000) });
    return response.ok || response.status > 0;
  } catch {
    return false;
  }
}

async function waitForReadiness({ baseURL, server, now, sleep, ready = isReady }) {
  const startedAt = now();
  let serverExit;
  server.once("exit", (code, signal) => {
    serverExit = { code, signal };
  });
  while (now() - startedAt < readinessTimeoutMs) {
    if (serverExit)
      throw new Error(
        `SOUNDING_LINE_INFRASTRUCTURE_STARTUP_FAILURE:SERVER_EXITED:${serverExit.code ?? serverExit.signal ?? "UNKNOWN"}`,
      );
    if (await ready(baseURL)) return now() - startedAt;
    await sleep(readinessIntervalMs);
  }
  throw new Error("SOUNDING_LINE_INFRASTRUCTURE_STARTUP_FAILURE:SERVER_NOT_READY");
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  let timeout;
  const childExit = new Promise((resolve) => {
    child.once("exit", (code, signal) => {
      if (timeout) clearTimeout(timeout);
      resolve({ code, signal });
    });
  });
  child.kill();
  await Promise.race([
    childExit,
    new Promise((resolve) => {
      timeout = setTimeout(resolve, shutdownTimeoutMs);
    }),
  ]);
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
  environment = process.env,
  port,
  now = Date.now,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  launch = spawnProcess,
  ready = isReady,
  serverArguments: configuredServerArguments,
}) {
  const serverPort = port ?? (await availablePort());
  const baseURL = `http://127.0.0.1:${serverPort}`;
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
  let browser;
  let failureCategory = null;
  let failureCodeValue = null;
  try {
    assertBrowserAuthorityTopology({
      serverMode: nextServerMode(serverArguments),
      productionOutputDirectory: outputDirectory,
      serverOutputDirectory: outputDirectory,
    });
    server = launch(process.execPath, serverArguments, {
      root,
      env: { ...environment, PLAYWRIGHT_BASE_URL: baseURL, NEXT_TELEMETRY_DISABLED: "1" },
    });
    timings.serverPreparationMs = now() - serverStartedAt;
    timings.serverReadinessMs = await waitForReadiness({ baseURL, server, now, sleep, ready });
    const browserStartedAt = now();
    browser = launch(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...browserArguments], {
      root,
      env: {
        ...environment,
        FOREVER_PLAYWRIGHT_EXTERNAL_SERVER: "1",
        PLAYWRIGHT_BASE_URL: baseURL,
        SOUNDING_LINE_BROWSER_AUTHORITY: "1",
      },
    });
    const browserExit = exited(browser).then((value) => ({ type: "browser", value }));
    const serverExit = exited(server).then((value) => ({ type: "server", value }));
    const completed = await Promise.race([browserExit, serverExit]);
    timings.browserExecutionMs = now() - browserStartedAt;
    if (completed.type === "server") {
      const failureDetectedAt = now();
      await stop(browser);
      timings.infrastructureFailureWaitMs = now() - failureDetectedAt;
      throw new Error(
        `SOUNDING_LINE_INFRASTRUCTURE_RUNTIME_FAILURE:SERVER_EXITED:${completed.value.code ?? completed.value.signal ?? "UNKNOWN"}`,
      );
    }
    if (completed.value.code !== 0)
      throw new Error(`SOUNDING_LINE_BROWSER_PRODUCT_FAILURE:PLAYWRIGHT_EXITED:${completed.value.code ?? "UNKNOWN"}`);
  } catch (error) {
    failureCategory = infrastructureFailureCategory(error);
    failureCodeValue = failureCode(error);
  } finally {
    const cleanupStartedAt = now();
    await stop(browser);
    await stop(server);
    timings.cleanupMs = now() - cleanupStartedAt;
  }
  return browserRuntimeReceipt({ timings, failureCategory, failureCode: failureCodeValue, baseURL });
}

async function main() {
  const separator = process.argv.indexOf("--");
  if (separator === -1) throw new Error("SOUNDING_LINE_BROWSER_ARGUMENTS_REQUIRED");
  const root = process.cwd();
  const receipt = await runBrowserAuthority({ root, browserArguments: process.argv.slice(separator + 1) });
  await mkdir(path.join(root, "artifacts", "sounding-line"), { recursive: true });
  await writeFile(
    path.join(root, "artifacts", "sounding-line", "browser-runtime.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (receipt.failureCategory) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
