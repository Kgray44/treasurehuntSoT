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
    schemaVersion: 2,
    runId,
    generatedAt: new Date().toISOString(),
    source: process.env.GITHUB_SHA || "LOCAL",
    artifact: { kind: "next-dev", directPort, proxyPort },
    results: output,
    decision: output.every((result) => result.passed) ? "HOST_ORIGIN_REGRESSION_PASSED" : "FAILED",
  };
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  assert.equal(receipt.decision, "HOST_ORIGIN_REGRESSION_PASSED");
  console.log(
    JSON.stringify(
      {
        decision: receipt.decision,
        receiptPath,
        results: output.map((result) => ({
          ...result,
          initialLoad: {
            ...result.initialLoad,
            entries: `${result.initialLoad.entries.length} entries retained in the task-owned receipt`,
          },
          hitTargets: `${result.hitTargets.length} targets retained in the task-owned receipt`,
        })),
      },
      null,
      2,
    ),
  );
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
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 900 } });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseUrl });
  const page = await context.newPage();
  const requests = [];
  const responses = [];
  const requestFailures = [];
  const webSockets = [];
  const consoleErrors = [];
  const pageErrors = [];
  page.on("request", (request) => requests.push(requestRecord(request)));
  page.on("response", (response) => responses.push(responseRecord(response)));
  page.on("requestfailed", (request) =>
    requestFailures.push({ url: request.url(), errorText: request.failure()?.errorText ?? "UNKNOWN" }),
  );
  page.on("websocket", (socket) => {
    const record = { url: socket.url(), framesSent: 0, framesReceived: 0, errors: [], closed: false };
    socket.on("framesent", () => record.framesSent++);
    socket.on("framereceived", () => record.framesReceived++);
    socket.on("socketerror", (error) => record.errors.push(String(error)));
    socket.on("close", () => {
      record.closed = true;
    });
    webSockets.push(record);
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__homeportUnhandledRejections = [];
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      window.__homeportUnhandledRejections.push({
        name: reason instanceof Error ? reason.name : typeof reason,
        message: reason instanceof Error ? reason.message : String(reason),
      });
    });
  });

  try {
    const initialDocument = await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    assert(initialDocument, `${label} initial document response is required`);
    assert.equal(initialDocument.status(), 200, `${label} initial document did not return 200`);
    const initialHtml = await initialDocument.text();
    assert.match(
      initialHtml,
      /data-homeport-hydration="pending"/u,
      `${label} initial HTML did not expose the development hydration-start marker`,
    );
    await page.locator('html[data-homeport-hydration="complete"]').waitFor({ timeout: 15_000 });
    await page.locator('html[data-homeport-current-user-state="anonymous"]').waitFor({ timeout: 15_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
    const authContext = responses.find((response) => response.url === `${baseUrl}/api/auth/context`);
    assert.equal(authContext?.status, 200, `${label} current-user bootstrap did not return 200`);
    await waitForCondition(
      () => webSockets.some((socket) => /\/_next\/webpack-hmr(?:\?|$)/u.test(socket.url)),
      10_000,
      `${label} HMR WebSocket did not initialize`,
    );
    const hmrWebSocket = webSockets.find((socket) => /\/_next\/webpack-hmr(?:\?|$)/u.test(socket.url));
    assert(hmrWebSocket);
    assert.deepEqual(hmrWebSocket.errors, []);
    assert.equal(hmrWebSocket.closed, false);

    const initialRequests = requests.slice();
    const initialResponses = responses.slice();
    const initialLoad = initialLoadEvidence(initialRequests, initialResponses);
    assert(initialLoad.entries.some((entry) => entry.category === "document" && entry.status === 200));
    assert(initialLoad.entries.some((entry) => entry.category === "auth-context" && entry.status === 200));
    assert(initialLoad.entries.filter((entry) => entry.category === "next-static-script").length > 0);
    assert(initialLoad.entries.filter((entry) => entry.category === "stylesheet").length > 0);
    assert.deepEqual(
      initialLoad.entries.filter(
        (entry) => ["document", "next-static-script", "stylesheet"].includes(entry.category) && entry.status !== 200,
      ),
      [],
    );

    const navigationButton = page.locator('button[aria-controls="product-navigation-drawer"]');
    const homeHitTargets = await Promise.all([
      hitTargetEvidence(navigationButton, "mobile-navigation"),
      hitTargetEvidence(page.getByRole("button", { name: "Account", exact: true }), "account-trigger"),
      hitTargetEvidence(page.getByRole("link", { name: "Enter as Player", exact: true }), "player-card"),
      hitTargetEvidence(page.getByRole("link", { name: "Enter as Captain", exact: true }), "captain-card"),
      hitTargetEvidence(page.getByRole("link", { name: "Enter as Creator", exact: true }), "creator-card"),
    ]);
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
    const signInHitTargets = await Promise.all([
      hitTargetEvidence(identifier, "sign-in-identifier"),
      hitTargetEvidence(password, "sign-in-password"),
    ]);
    await installInputEventRecorder(identifier);
    assert.equal(await identifier.isEnabled(), true);
    await identifier.click();
    await page.keyboard.type("origin-regression@example.invalid");
    assert.equal(await identifier.inputValue(), "origin-regression@example.invalid");
    await identifier.press("Control+A");
    const pastedIdentifier = "pasted-origin-regression@example.invalid";
    const pasteMode = await pasteIntoInput(page, identifier, pastedIdentifier);
    assert.equal(await identifier.inputValue(), pastedIdentifier);
    await identifier.press("Tab");
    assert.equal(await password.evaluate((element) => document.activeElement === element), true);
    await page.keyboard.type("synthetic-origin-regression-only");
    assert.equal(await password.inputValue(), "synthetic-origin-regression-only");
    const desktopInputEvents = await readInputEventRecorder(identifier);
    for (const eventType of ["pointerdown", "click", "focus", "input"])
      assert(
        desktopInputEvents.some((event) => event.type === eventType && event.isTrusted),
        `${label} did not record a trusted ${eventType} event on the Sign In identifier`,
      );
    assert(
      desktopInputEvents.some((event) => event.type === "paste"),
      `${label} did not record a paste event`,
    );
    if (pasteMode === "native-clipboard")
      assert(
        desktopInputEvents.some((event) => event.type === "paste" && event.isTrusted),
        `${label} did not record a trusted native paste event`,
      );

    await page.goto(`${baseUrl}/register`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator('html[data-homeport-hydration="complete"]').waitFor({ timeout: 15_000 });
    const registrationFields = [
      { label: "Display name", value: "Origin Regression" },
      { label: "Email", value: "registration-origin@example.invalid" },
      { label: "Password", value: "synthetic-registration-password" },
      { label: "Confirm password", value: "synthetic-registration-password" },
    ];
    const registrationHitTargets = [];
    for (const field of registrationFields) {
      const locator = page.getByLabel(field.label, { exact: true });
      registrationHitTargets.push(
        await hitTargetEvidence(locator, `registration-${field.label.toLowerCase().replaceAll(" ", "-")}`),
      );
      assert.equal(await locator.isEnabled(), true);
      await locator.click();
      await page.keyboard.type(field.value);
      assert.equal(await locator.inputValue(), field.value);
    }
    const displayName = page.getByLabel("Display name", { exact: true });

    const diagnostic = await page.evaluate(async () => {
      const response = await fetch("/api/dev/origin-diagnostics", { cache: "no-store" });
      return { status: response.status, body: await response.json() };
    });
    assert.equal(diagnostic.status, 200);
    assert.equal(diagnostic.body.coherent, true);
    assert.match(diagnostic.body.effectiveHost, new RegExp(`^${expectedHost.replaceAll(".", "\\.")}(?::\\d+)?$`, "u"));

    const settled = await settledInteractionEvidence(page);
    assert.deepEqual(settled.inert, []);
    assert.equal(settled.shellOverlay, null);
    assert.equal(settled.activeElement, "account-confirmPassword");
    assert.deepEqual(settled.viewportBlockers, []);
    assert.equal(settled.route.state, "settled");
    assert.equal(settled.route.loadingShown, false);
    assert.equal(settled.route.interactiveLayerCount, 1);
    assert.equal(settled.route.outgoingLayerCount, 0);

    const failedResources = responses.filter((response) => response.status >= 400);
    const nonCanceledRequestFailures = requestFailures.filter((failure) => failure.errorText !== "net::ERR_ABORTED");
    const unhandledRejections = await page.evaluate(() => window.__homeportUnhandledRejections ?? []);
    assert.deepEqual(failedResources, []);
    assert.deepEqual(nonCanceledRequestFailures, []);
    assert.deepEqual(unhandledRejections, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
    if (label === "reverse-proxy") {
      const browserLoopbackRequests = requests.filter((request) => {
        const hostname = new URL(request.url).hostname;
        return ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname);
      });
      assert.deepEqual(browserLoopbackRequests, []);
    }
    const touch = await touchInputEvidence(browserInstance, baseUrl, label);

    return {
      label,
      origin: baseUrl,
      passed: true,
      hydration: { start: "pending", completion: "complete" },
      currentUserBootstrap: authContext.status,
      click: "passed",
      focusTypingPasteAndTab: "passed",
      navigation: "passed",
      settledInertCount: settled.inert.length,
      hitTargets: [...homeHitTargets, ...signInHitTargets, ...registrationHitTargets],
      inputEvents: {
        desktop: { ...summarizeInputEvents(desktopInputEvents), pasteMode },
        touch,
      },
      settledInteraction: settled,
      hmrWebSocket: {
        connected: true,
        framesSent: hmrWebSocket.framesSent,
        framesReceived: hmrWebSocket.framesReceived,
        errorCount: hmrWebSocket.errors.length,
      },
      initialLoad,
      pageErrorCount: pageErrors.length,
      consoleErrorCount: consoleErrors.length,
      unhandledRejectionCount: unhandledRejections.length,
      nonCanceledRequestFailureCount: nonCanceledRequestFailures.length,
      browserLoopbackRequestCount:
        label === "reverse-proxy"
          ? requests.filter((request) => ["localhost", "127.0.0.1", "0.0.0.0"].includes(new URL(request.url).hostname))
              .length
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

function requestRecord(request) {
  const headers = request.headers();
  const serverAction = Boolean(headers["next-action"]);
  const rsc = headers.rsc === "1" || new URL(request.url()).searchParams.has("_rsc");
  return {
    url: request.url(),
    method: request.method(),
    resourceType: request.resourceType(),
    navigation: request.isNavigationRequest(),
    serverAction,
    rsc,
    category: classifyRequest(request.url(), request.resourceType(), request.method(), serverAction, rsc),
  };
}

function responseRecord(response) {
  const request = response.request();
  const record = requestRecord(request);
  return { ...record, status: response.status(), contentType: response.headers()["content-type"] ?? null };
}

function classifyRequest(url, resourceType, method, serverAction, rsc) {
  const parsed = new URL(url);
  if (serverAction) return "server-action";
  if (resourceType === "document") return "document";
  if (parsed.pathname.startsWith("/_next/static/") && resourceType === "script") return "next-static-script";
  if (parsed.pathname.startsWith("/_next/static/") && resourceType === "stylesheet") return "stylesheet";
  if (rsc) return "rsc-navigation";
  if (parsed.pathname === "/api/auth/context") return "auth-context";
  if (parsed.pathname === "/api/shell/context") return "shell-context";
  if (parsed.pathname.startsWith("/api/profile-media/") || ["image", "media"].includes(resourceType)) return "media";
  if (resourceType === "font") return "font";
  if (parsed.pathname.startsWith("/api/")) return "api";
  if (["fetch", "xhr"].includes(resourceType)) return method === "GET" ? "other-fetch" : "other-mutation";
  return "other";
}

function initialLoadEvidence(requests, responses) {
  const entries = responses.map((response) => ({
    url: response.url,
    method: response.method,
    status: response.status,
    resourceType: response.resourceType,
    category: response.category,
    contentType: response.contentType,
    serverAction: response.serverAction,
    rsc: response.rsc,
  }));
  const categoryCounts = Object.fromEntries(
    [...new Set(entries.map((entry) => entry.category))]
      .sort()
      .map((category) => [category, entries.filter((entry) => entry.category === category).length]),
  );
  return {
    documentStatus: entries.find((entry) => entry.category === "document")?.status ?? null,
    requestCount: requests.length,
    responseCount: responses.length,
    categoryCounts,
    entries,
  };
}

async function hitTargetEvidence(locator, label) {
  assert.equal(await locator.count(), 1, `${label} must resolve to one visible control`);
  const evidence = await locator.evaluate((element, targetLabel) => {
    const rect = element.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const hit = document.elementFromPoint(center.x, center.y);
    const style = getComputedStyle(element);
    const safeElement = (value) =>
      value
        ? {
            tag: value.tagName,
            id: value.id || null,
            role: value.getAttribute("role"),
            ariaLabel: value.getAttribute("aria-label"),
          }
        : null;
    return {
      label: targetLabel,
      intended: safeElement(element),
      hit: safeElement(hit),
      hitMatches: hit === element || Boolean(hit && element.contains(hit)),
      center: { x: Math.round(center.x), y: Math.round(center.y) },
      rect: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      pointerEvents: style.pointerEvents,
      opacity: style.opacity,
      visibility: style.visibility,
      zIndex: style.zIndex,
    };
  }, label);
  assert.equal(evidence.hitMatches, true, `${label} is not the settled hit target`);
  assert.notEqual(evidence.pointerEvents, "none", `${label} rejects pointer input`);
  assert.notEqual(evidence.visibility, "hidden", `${label} is hidden`);
  assert(Number(evidence.opacity) > 0, `${label} is transparent`);
  return evidence;
}

async function installInputEventRecorder(locator) {
  await locator.evaluate((element) => {
    element.__homeportOriginInputEvents = [];
    for (const type of ["pointerdown", "touchstart", "click", "focus", "input", "paste"])
      element.addEventListener(type, (event) => {
        element.__homeportOriginInputEvents.push({
          type,
          isTrusted: event.isTrusted,
          pointerType: "pointerType" in event ? event.pointerType : null,
          activeElementMatches: document.activeElement === element,
          valueLength: "value" in element ? element.value.length : null,
        });
      });
  });
}

async function readInputEventRecorder(locator) {
  return locator.evaluate((element) => element.__homeportOriginInputEvents ?? []);
}

function summarizeInputEvents(events) {
  return {
    eventTypes: [...new Set(events.map((event) => event.type))],
    trustedEventTypes: [...new Set(events.filter((event) => event.isTrusted).map((event) => event.type))],
    pointerTypes: [...new Set(events.map((event) => event.pointerType).filter(Boolean))],
    finalValueLength: events.at(-1)?.valueLength ?? 0,
  };
}

async function pasteIntoInput(page, locator, value) {
  const nativeClipboardAvailable = await page.evaluate(() => typeof navigator.clipboard?.writeText === "function");
  if (nativeClipboardAvailable) {
    await page.evaluate((nextValue) => navigator.clipboard.writeText(nextValue), value);
    await locator.press("Control+V");
    return "native-clipboard";
  }
  await locator.evaluate((element, nextValue) => {
    element.focus();
    const transfer = new DataTransfer();
    transfer.setData("text/plain", nextValue);
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer }));
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(element, nextValue);
    element.dispatchEvent(
      new InputEvent("input", { bubbles: true, composed: true, data: nextValue, inputType: "insertFromPaste" }),
    );
  }, value);
  return "synthetic-http-proxy-fallback";
}

async function touchInputEvidence(browserInstance, baseUrl, label) {
  const context = await browserInstance.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/sign-in`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator('html[data-homeport-hydration="complete"]').waitFor({ timeout: 15_000 });
    const identifier = page.getByLabel("Email or legacy Player name");
    const hitTarget = await hitTargetEvidence(identifier, "touch-sign-in-identifier");
    await installInputEventRecorder(identifier);
    const box = await identifier.boundingBox();
    assert(box, `${label} touch identifier has no bounding box`);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    assert.equal(await identifier.evaluate((element) => document.activeElement === element), true);
    await page.keyboard.type("touch-origin-regression@example.invalid");
    assert.equal(await identifier.inputValue(), "touch-origin-regression@example.invalid");
    const events = await readInputEventRecorder(identifier);
    for (const eventType of ["pointerdown", "touchstart", "click", "focus", "input"])
      assert(
        events.some((event) => event.type === eventType && event.isTrusted),
        `${label} did not record a trusted emulated-touch ${eventType} event`,
      );
    assert(events.some((event) => event.type === "pointerdown" && event.pointerType === "touch"));
    return {
      emulatedTouch: true,
      physicalDeviceProof: false,
      hitTarget,
      ...summarizeInputEvents(events),
    };
  } finally {
    await context.close();
  }
}

async function settledInteractionEvidence(page) {
  return page.evaluate(() => {
    const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
    const safeElement = (element) => ({
      tag: element.tagName,
      id: element.id || null,
      role: element.getAttribute("role"),
      ariaLabel: element.getAttribute("aria-label"),
      classes: [...element.classList].slice(0, 8),
      routeGeneration: element.getAttribute("data-route-generation"),
      routeRole: element.getAttribute("data-route-role"),
      transitionRole: element.getAttribute("data-transition-role"),
    });
    const positionedElements = [...document.querySelectorAll("body *")]
      .map((element) => {
        const style = getComputedStyle(element);
        if (!["fixed", "absolute"].includes(style.position)) return null;
        const rect = element.getBoundingClientRect();
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number(style.opacity) <= 0 ||
          rect.width <= 0 ||
          rect.height <= 0
        )
          return null;
        const intersectionWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
        const intersectionHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
        const coverageRatio = (intersectionWidth * intersectionHeight) / viewportArea;
        return {
          ...safeElement(element),
          position: style.position,
          pointerEvents: style.pointerEvents,
          opacity: style.opacity,
          visibility: style.visibility,
          zIndex: style.zIndex,
          coverageRatio: Number(coverageRatio.toFixed(4)),
          rect: {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      })
      .filter(Boolean);
    const routeRoot = document.querySelector("[data-route-active-generation]");
    return {
      inert: [...document.querySelectorAll("[inert]")].map(safeElement),
      shellOverlay: document.body.dataset.shellOverlay ?? null,
      activeElement: document.activeElement?.id ?? null,
      positionedElements,
      viewportBlockers: positionedElements.filter(
        (element) => element.coverageRatio >= 0.9 && element.pointerEvents !== "none",
      ),
      route: {
        state: routeRoot?.getAttribute("data-route-state") ?? null,
        loadingShown: routeRoot?.getAttribute("data-route-loading-shown") === "true",
        activeGeneration: routeRoot?.getAttribute("data-route-active-generation") ?? null,
        interactiveLayerCount: document.querySelectorAll('[data-route-interactive="true"]').length,
        outgoingLayerCount: document.querySelectorAll('[data-route-role="outgoing"]').length,
        layers: [...document.querySelectorAll("[data-route-layer]")].map((element) => ({
          ...safeElement(element),
          interactive: element.getAttribute("data-route-interactive"),
          inert: element.hasAttribute("inert"),
        })),
      },
    };
  });
}

async function waitForCondition(predicate, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(message);
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
