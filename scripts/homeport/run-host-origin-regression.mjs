import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const repositoryRoot = path.resolve(process.cwd());
const runId = `homeport-origin-${new Date()
  .toISOString()
  .replace(/[^0-9]/gu, "")
  .slice(0, 14)}-${process.pid}`;
const requestedTaskRoot = process.env.HOMEPORT_ORIGIN_TASK_ROOT?.trim();
const taskRoot = requestedTaskRoot
  ? path.resolve(requestedTaskRoot)
  : path.join(os.tmpdir(), "forever-treasure-homeport", runId);
const distDir = ".next-homeport-origin-regression";
const distPath = path.join(repositoryRoot, distDir);
const databasePath = path.join(taskRoot, "origin-regression.db");
const receiptPath = path.join(taskRoot, "host-origin-regression-receipt.json");
const directHost = "127.0.0.1";
const proxyHost = "staging.homeport.test";
const output = [];
let nextProcess;
let proxyServer;
let browser;

await mkdir(taskRoot, { recursive: true });
await writeFile(
  path.join(taskRoot, "ownership.json"),
  JSON.stringify({ schemaVersion: 1, owner: "homeport-host-origin-regression", runId, taskRoot }, null, 2),
  "utf8",
);

try {
  const [directPort, proxyPort] = await Promise.all([freePort(), freePort()]);
  await writeFile(databasePath, "", { flag: "wx" });
  initializeDatabase();
  nextProcess = startNext(directPort);
  await waitForHttp(`http://${directHost}:${directPort}/`, nextProcess);
  proxyServer = await startReverseProxy(directPort, proxyPort);
  browser = await chromium.launch({
    headless: true,
    args: [`--host-resolver-rules=MAP ${proxyHost} 127.0.0.1`],
  });

  output.push(await verifyOrigin(browser, "direct", `http://${directHost}:${directPort}`, directHost));
  output.push(await verifyOrigin(browser, "reverse-proxy", `http://${proxyHost}:${proxyPort}`, proxyHost));

  const receipt = {
    schemaVersion: 1,
    runId,
    generatedAt: new Date().toISOString(),
    source: process.env.GITHUB_SHA || "LOCAL",
    artifact: { kind: "next-dev", directPort, proxyPort },
    results: output,
    decision: output.every((result) => result.passed) ? "HOST_ORIGIN_REGRESSION_PASSED" : "FAILED",
  };
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  assert.equal(receipt.decision, "HOST_ORIGIN_REGRESSION_PASSED");
  console.log(JSON.stringify({ decision: receipt.decision, receiptPath, results: output }, null, 2));
} finally {
  await browser?.close().catch(() => undefined);
  await closeServer(proxyServer);
  stopOwnedProcess(nextProcess);
  if (
    distPath.startsWith(`${repositoryRoot}${path.sep}`) &&
    path.basename(distPath) === ".next-homeport-origin-regression"
  )
    await rm(distPath, { recursive: true, force: true });
}

function initializeDatabase() {
  const result = spawnSync(
    process.execPath,
    [
      path.join("node_modules", "prisma", "build", "index.js"),
      "migrate",
      "deploy",
      "--schema",
      path.join("prisma", "schema.sqlite.prisma"),
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}` },
      windowsHide: true,
    },
  );
  if (result.status !== 0) {
    throw new Error(`Task database migration failed.\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
}

function startNext(port) {
  const stdout = createWriteStream(path.join(taskRoot, "next.stdout.log"), { flags: "a" });
  const stderr = createWriteStream(path.join(taskRoot, "next.stderr.log"), { flags: "a" });
  const child = spawn(
    process.execPath,
    [path.join("node_modules", "next", "dist", "bin", "next"), "dev", "-H", directHost, "-p", String(port)],
    {
      cwd: repositoryRoot,
      windowsHide: true,
      env: {
        ...process.env,
        DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}`,
        HOMEPORT_ALLOWED_DEV_ORIGINS: `${directHost},${proxyHost}`,
        HOMEPORT_ORIGIN_DIAGNOSTICS: "1",
        NEXT_DIST_DIR: distDir,
        HOMEPORT_PUBLIC_APP_ORIGIN: `http://${proxyHost}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  child.once("exit", () => {
    stdout.end();
    stderr.end();
  });
  return child;
}

async function verifyOrigin(browserInstance, label, baseUrl, expectedHost) {
  const context = await browserInstance.newContext();
  const page = await context.newPage();
  const requests = [];
  const responses = [];
  const consoleErrors = [];
  const pageErrors = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("response", (response) => responses.push({ url: response.url(), status: response.status() }));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator('html[data-homeport-hydration="complete"]').waitFor({ timeout: 15_000 });
    await page.locator('html[data-homeport-current-user-state="anonymous"]').waitFor({ timeout: 15_000 });
    const authContext = responses.find((response) => response.url === `${baseUrl}/api/auth/context`);
    assert.equal(authContext?.status, 200, `${label} current-user bootstrap did not return 200`);

    const navigationButton = page.locator('button[aria-controls="product-navigation-drawer"]');
    assert.equal(await navigationButton.getAttribute("aria-expanded"), "false");
    await navigationButton.click();
    assert.equal(await navigationButton.getAttribute("aria-expanded"), "true");
    const navigationDialog = page.getByRole("dialog", { name: "Product navigation" });
    await navigationDialog.waitFor({ state: "visible" });
    await Promise.all([
      page.waitForURL(`${baseUrl}/tales`, { timeout: 15_000 }),
      navigationDialog.getByRole("link", { name: "Explore Chronicles" }).click(),
    ]);
    await page.locator('html[data-homeport-hydration="complete"]').waitFor({ timeout: 15_000 });

    await page.goto(`${baseUrl}/sign-in`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator('html[data-homeport-hydration="complete"]').waitFor({ timeout: 15_000 });
    const identifier = page.getByLabel("Email or legacy Player name");
    const password = page.getByLabel("Password");
    assert.equal(await identifier.isEnabled(), true);
    await identifier.click();
    await identifier.fill("origin-regression@example.invalid");
    assert.equal(await identifier.inputValue(), "origin-regression@example.invalid");
    await identifier.press("Tab");
    assert.equal(await password.evaluate((element) => document.activeElement === element), true);
    await password.fill("synthetic-origin-regression-only");
    assert.equal(await password.inputValue(), "synthetic-origin-regression-only");

    await page.goto(`${baseUrl}/register`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator('html[data-homeport-hydration="complete"]').waitFor({ timeout: 15_000 });
    const displayName = page.getByLabel("Display name");
    await displayName.click();
    await displayName.fill("Origin Regression");
    assert.equal(await displayName.inputValue(), "Origin Regression");

    const diagnostic = await page.evaluate(async () => {
      const response = await fetch("/api/dev/origin-diagnostics", { cache: "no-store" });
      return { status: response.status, body: await response.json() };
    });
    assert.equal(diagnostic.status, 200);
    assert.equal(diagnostic.body.coherent, true);
    assert.match(diagnostic.body.effectiveHost, new RegExp(`^${expectedHost.replaceAll(".", "\\.")}(?::\\d+)?$`, "u"));

    const settled = await page.evaluate(() => ({
      inert: [...document.querySelectorAll("[inert]")].map((element) => element.tagName),
      shellOverlay: document.body.dataset.shellOverlay ?? null,
      activeElement: document.activeElement?.id ?? null,
    }));
    assert.deepEqual(settled.inert, []);
    assert.equal(settled.shellOverlay, null);
    assert.equal(settled.activeElement, "account-displayName");

    const failedResources = responses.filter((response) => response.status >= 400);
    assert.deepEqual(failedResources, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
    if (label === "reverse-proxy") {
      const browserLoopbackRequests = requests.filter((url) => {
        const hostname = new URL(url).hostname;
        return ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname);
      });
      assert.deepEqual(browserLoopbackRequests, []);
    }

    return {
      label,
      origin: baseUrl,
      passed: true,
      hydration: "complete",
      currentUserBootstrap: authContext.status,
      click: "passed",
      focusAndTyping: "passed",
      navigation: "passed",
      settledInertCount: settled.inert.length,
      browserLoopbackRequestCount:
        label === "reverse-proxy"
          ? requests.filter((url) => ["localhost", "127.0.0.1", "0.0.0.0"].includes(new URL(url).hostname)).length
          : 0,
      forwarded: {
        host: diagnostic.body.host,
        forwardedHost: diagnostic.body.forwardedHost,
        forwardedProto: diagnostic.body.forwardedProto,
        effectiveHost: diagnostic.body.effectiveHost,
        effectiveProto: diagnostic.body.effectiveProto,
      },
      resourceCount: responses.length,
    };
  } finally {
    await context.close();
  }
}

function proxyHeaders(request) {
  const host = request.headers.host ?? "";
  return {
    ...request.headers,
    host,
    "x-forwarded-host": host,
    "x-forwarded-proto": "http",
    forwarded: `host="${host}";proto=http`,
  };
}

async function startReverseProxy(upstreamPort, proxyPort) {
  const server = http.createServer((request, response) => {
    const upstream = http.request(
      {
        host: directHost,
        port: upstreamPort,
        path: request.url,
        method: request.method,
        headers: proxyHeaders(request),
      },
      (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        upstreamResponse.pipe(response);
      },
    );
    upstream.on("error", () => {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    });
    request.pipe(upstream);
  });
  server.on("upgrade", (request, clientSocket, head) => {
    clientSocket.on("error", () => undefined);
    const upstream = http.request({
      host: directHost,
      port: upstreamPort,
      path: request.url,
      method: request.method,
      headers: proxyHeaders(request),
    });
    upstream.on("upgrade", (upstreamResponse, upstreamSocket, upstreamHead) => {
      upstreamSocket.on("error", () => clientSocket.destroy());
      const statusLine = `HTTP/1.1 ${upstreamResponse.statusCode ?? 101} ${upstreamResponse.statusMessage ?? "Switching Protocols"}\r\n`;
      const headers = Object.entries(upstreamResponse.headers)
        .flatMap(([name, value]) =>
          Array.isArray(value) ? value.map((item) => `${name}: ${item}\r\n`) : value ? [`${name}: ${value}\r\n`] : [],
        )
        .join("");
      clientSocket.write(`${statusLine}${headers}\r\n`);
      if (head.length) upstreamSocket.write(head);
      if (upstreamHead.length) clientSocket.write(upstreamHead);
      clientSocket.pipe(upstreamSocket).pipe(clientSocket);
    });
    upstream.on("response", (upstreamResponse) => {
      clientSocket.write(
        `HTTP/1.1 ${upstreamResponse.statusCode ?? 502} ${upstreamResponse.statusMessage ?? "Bad Gateway"}\r\n\r\n`,
      );
      upstreamResponse.pipe(clientSocket);
    });
    upstream.on("error", () => clientSocket.destroy());
    upstream.end();
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(proxyPort, directHost, resolve);
  });
  return server;
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, directHost, resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  const port = address.port;
  await closeServer(server);
  return port;
}

async function waitForHttp(url, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Next.js exited before becoming ready (${child.exitCode}).`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Next.js did not become ready at ${url}.`);
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve) => server.close(() => resolve()));
}

function stopOwnedProcess(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32")
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true });
  else child.kill("SIGTERM");
}
