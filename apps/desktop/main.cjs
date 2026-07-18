"use strict";
const electron = require("electron");
const { app, BrowserWindow, ipcMain, Menu, utilityProcess } = electron;
const { randomUUID } = require("node:crypto");
const http = require("node:http");
const path = require("node:path");
const { executeDesktopCommand } = require("./commands.cjs");
const { CompanionCoordinator } = require("../companion/companion-coordinator.cjs");

const DEVELOPMENT_URL = process.env.TALL_TALE_DESKTOP_URL || "http://127.0.0.1:3000";
let applicationServer = null;
let coordinator = null;
let primaryWindow = null;
let smokeHarnessWindow = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  if (!primaryWindow) return;
  if (primaryWindow.isMinimized()) primaryWindow.restore();
  primaryWindow.show();
  primaryWindow.focus();
});

function waitForServer(url, attempts = 80) {
  return new Promise((resolve, reject) => {
    const check = (remaining) => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) resolve();
        else retry(remaining);
      });
      request.on("error", () => retry(remaining));
      request.setTimeout(750, () => request.destroy());
    };
    const retry = (remaining) =>
      remaining <= 0
        ? reject(new Error("DESKTOP_APP_SERVER_UNAVAILABLE"))
        : setTimeout(() => check(remaining - 1), 250);
    check(attempts);
  });
}

async function applicationUrl() {
  if (!app.isPackaged) return DEVELOPMENT_URL;
  const port = 32178;
  const serverEntry = path.join(process.resourcesPath, "app-server", "server.js");
  applicationServer = utilityProcess.fork(serverEntry, [], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      TALL_TALE_DESKTOP: "1",
      FEATURE_VISION_COMPANION: "1",
      FEATURE_NATIVE_WINDOW_CAPTURE: "1",
      FEATURE_CREATOR_CAPTURE: "1",
      FEATURE_PLAYER_HOLD_TO_SCAN: "1",
      FEATURE_BROWSER_COMPANION_PAIRING: "1",
      FEATURE_CAPTURE_PREVIEW: "1",
      FEATURE_DIAGNOSTIC_CAPTURE: "1",
    },
    stdio: "pipe",
  });
  applicationServer.stdout?.on("data", (chunk) => console.error(`[app-server:stdout] ${chunk.toString().trim()}`));
  applicationServer.stderr?.on("data", (chunk) => console.error(`[app-server:stderr] ${chunk.toString().trim()}`));
  applicationServer.on("exit", (code) => console.error(`[app-server:exit] ${code}`));
  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  return url;
}

async function runDesktopCaptureSmoke(origin) {
  const harnessTitle = `Forever Treasure Desktop Adapter Harness ${randomUUID()}`;
  smokeHarnessWindow = new BrowserWindow({
    show: true,
    width: 800,
    height: 480,
    x: 40,
    y: 40,
    title: harnessTitle,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false },
  });
  await smokeHarnessWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><title>${harnessTitle}</title><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#071b25}canvas{width:100%;height:100%}</style></head><body><canvas id="scene" width="960" height="540"></canvas><script>const canvas=document.getElementById('scene');const context=canvas.getContext('2d');let frame=0;function draw(){frame+=1;const gradient=context.createLinearGradient(0,0,960,540);gradient.addColorStop(0,'hsl('+((frame*3)%360)+' 80% 45%)');gradient.addColorStop(1,'hsl('+((frame*3+120)%360)+' 70% 18%)');context.fillStyle=gradient;context.fillRect(0,0,960,540);context.fillStyle='#f4d58d';context.font='bold 70px sans-serif';context.fillText('DESKTOP ADAPTER CAPTURE',50,180);context.fillStyle='#ffffff';context.fillRect((frame*13)%900,260,60,60);requestAnimationFrame(draw)}draw()</script></body></html>`)}`,
  );
  await new Promise((resolve) => setTimeout(resolve, 750));
  await primaryWindow.loadURL(`${origin}/vision-companion`);
  return primaryWindow.webContents.executeJavaScript(`(async () => {
    let targetList = { targets: [] };
    let target = null;
    for (let attempt = 0; attempt < 20 && !target; attempt += 1) {
      targetList = await window.tallTaleDesktop.invoke("capture.listTargets", {});
      target = targetList.targets.find((candidate) => candidate.label.includes(${JSON.stringify(harnessTitle)}));
      if (!target) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!target) throw new Error("DESKTOP_SMOKE_TARGET_MISSING:" + targetList.targets.map((candidate) => candidate.label).join("|"));
    await window.tallTaleDesktop.invoke("capture.selectTarget", { targetId: target.targetId, remember: false });
    const started = await window.tallTaleDesktop.invoke("capture.scan.start", {
      requestId: "request_packaged_desktop_smoke",
      attemptId: "attempt_packaged_desktop_smoke",
      durationMs: 3000,
      sampleFps: 10,
      minimumFrames: 3
    });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const completed = await window.tallTaleDesktop.invoke("capture.scan.stop", { sessionId: started.sessionId });
    return {
      selectedTarget: target.privacyLabel,
      result: completed.result,
      capturedFrames: completed.qualitySummary.capturedFrameCount,
      selectedFrames: completed.evidenceBundle.selection.selectedFrameCount,
      rawFramesCleared: completed.evidenceBundle.retention.transientFramesCleared,
      verificationResult: completed.verificationResult
    };
  })()`);
}

async function createWindow() {
  const origin = await applicationUrl();
  const smoke = process.env.TALL_TALE_DESKTOP_SMOKE === "1";
  primaryWindow = new BrowserWindow({
    show: !smoke,
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: "#071b25",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  primaryWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  primaryWindow.webContents.on("will-navigate", (event, target) => {
    if (!target.startsWith(origin)) event.preventDefault();
  });
  const navigate = (route) => primaryWindow.loadURL(`${origin}${route}`);
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Navigate",
        submenu: [
          { label: "Harbor", click: () => navigate("/") },
          { label: "Player", click: () => navigate("/player") },
          { label: "Captain", click: () => navigate("/captain") },
          { label: "Studio", click: () => navigate("/studio") },
          { label: "Vision Companion", click: () => navigate("/vision-companion") },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "toggleDevTools" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
        ],
      },
    ]),
  );
  coordinator = new CompanionCoordinator({
    electron,
    userDataRoot: app.getPath("userData"),
    desktopOrigin: new URL(origin).origin,
    projectRoot: path.resolve(__dirname, "..", ".."),
    packaged: app.isPackaged,
    port: Number(process.env.TALL_TALE_COMPANION_PORT || 32179),
  });
  await coordinator.initialize();
  coordinator.attachWindow(primaryWindow);
  ipcMain.handle("vision:invoke", async (event, command, payload) => {
    const senderUrl = event.senderFrame?.url ?? event.sender.getURL();
    const senderOrigin = new URL(senderUrl).origin;
    if (event.sender.id !== primaryWindow.webContents.id || senderOrigin !== new URL(origin).origin)
      throw new Error("DESKTOP_SENDER_NOT_ALLOWED");
    return executeDesktopCommand(coordinator, command, payload);
  });
  await primaryWindow.loadURL(origin);
  if (smoke) {
    const title = await primaryWindow.webContents.executeJavaScript("document.title");
    const desktopAdapterScan = await runDesktopCaptureSmoke(origin);
    const diagnostics = coordinator.diagnostics();
    console.log(
      JSON.stringify({
        area: "desktop-smoke",
        loaded: true,
        title,
        origin,
        shellVersion: "0.5.0-b3",
        companionListening: diagnostics.companion.listening,
        captureApi: diagnostics.capture.health ? coordinator.core.getCapabilities().captureApi : null,
        desktopAdapterScan,
      }),
    );
    setTimeout(() => app.quit(), 100);
  }
}

app.setAppUserModelId("com.forevertreasure.companion");
app
  .whenReady()
  .then(createWindow)
  .catch((error) => {
    console.error(JSON.stringify({ area: "desktop-shell", code: error.code || error.message }));
    app.quit();
  });

app.on("window-all-closed", () => app.quit());
app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  void (async () => {
    await coordinator?.shutdown();
    if (smokeHarnessWindow && !smokeHarnessWindow.isDestroyed()) smokeHarnessWindow.destroy();
    applicationServer?.kill();
    app.exit(0);
  })();
});
