"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { once } = require("node:events");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { app, BrowserWindow, desktopCapturer, ipcMain } = require("electron");
const { WebSocket } = require("ws");
const { CaptureCore } = require("./capture-core.cjs");
const { ElectronCaptureWorker } = require("./electron-capture-worker.cjs");
const { ElectronTargetProvider } = require("./electron-target-provider.cjs");
const { CompanionStorage } = require("./storage.cjs");
const { WindowsHotkeyMonitor } = require("./windows-hotkey-monitor.cjs");
const { CompanionLoopbackServer } = require("./loopback-server.cjs");

const harnessTitle = `Forever Treasure B2 Capture Harness ${crypto.randomUUID()}`;
let sourceWindow = null;
let core = null;
let storageRoot = null;
let loopback = null;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function waitForHealth(monitor, predicate, timeoutMs = 8_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      monitor.removeListener("health", listener);
      reject(new Error("Selected HWND health heartbeat timed out."));
    }, timeoutMs);
    const listener = (health) => {
      if (!predicate(health)) return;
      clearTimeout(timeout);
      monitor.removeListener("health", listener);
      resolve(health);
    };
    monitor.on("health", listener);
  });
}

function nextSocketEnvelope(socket, predicate = () => true, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeListener("message", listener);
      reject(new Error("Browser-paired capture response timed out."));
    }, timeoutMs);
    const listener = (binary) => {
      const envelope = JSON.parse(binary.toString("utf8"));
      if (!predicate(envelope)) return;
      clearTimeout(timeout);
      socket.removeListener("message", listener);
      resolve(envelope);
    };
    socket.on("message", listener);
  });
}

function captureEnvelope(messageType, payload, requestId, sequence) {
  return {
    protocolVersion: "2.0",
    messageType,
    messageId: `message_${crypto.randomUUID()}`,
    requestId,
    timestamp: new Date().toISOString(),
    sequence,
    payload,
  };
}

async function connectPairedSocket(server, pairing, origin, privateKey) {
  const socket = new WebSocket(`ws://${server.host}:${server.port}/v2/socket`, { origin });
  const challengePromise = nextSocketEnvelope(
    socket,
    (envelope) => envelope.payload?.eventType === "companion.challenge",
  );
  await once(socket, "open");
  const challenge = (await challengePromise).payload.challenge;
  const signed = Buffer.from(`${challenge}|${pairing.pairingId}|${origin}|2.0`, "utf8");
  const signature = crypto.sign("sha256", signed, { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
  const requestId = `request_${crypto.randomUUID()}`;
  const authenticatedPromise = nextSocketEnvelope(socket, (envelope) => envelope.payload?.requestId === requestId);
  socket.send(
    JSON.stringify(
      captureEnvelope("companion.authenticate", { pairingId: pairing.pairingId, signature }, requestId, 0),
    ),
  );
  const authenticated = await authenticatedPromise;
  return { socket, authenticated };
}

async function runBrowserPairedScan(storage, targetId) {
  const origin = "http://127.0.0.1:3000";
  loopback = new CompanionLoopbackServer({ core, storage, port: 0, allowedOrigins: [origin] });
  const server = await loopback.start();
  const base = `http://${server.host}:${server.port}`;
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const requested = await (
    await fetch(`${base}/v2/pair/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        protocolVersion: "2.0",
        clientInstanceId: "browser_electron_capture_smoke",
        publicKeyJwk: publicKey.export({ format: "jwk" }),
      }),
    })
  ).json();
  const pending = loopback.pairings.listPending()[0];
  loopback.pairings.approvePending(requested.pairingId, true);
  const pairing = await (
    await fetch(`${base}/v2/pair/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ pairingId: requested.pairingId, pairingCode: pending.pairingCode }),
    })
  ).json();
  const connected = await connectPairedSocket(server, pairing, origin, privateKey);
  assert.equal(connected.authenticated.payload.ok, true);
  let sequence = 0;
  const command = async (name, input) => {
    const requestId = `request_${crypto.randomUUID()}`;
    const responsePromise = nextSocketEnvelope(
      connected.socket,
      (envelope) => envelope.payload?.requestId === requestId,
    );
    connected.socket.send(
      JSON.stringify(captureEnvelope("capture.command", { command: name, input }, requestId, ++sequence)),
    );
    const response = await responsePromise;
    if (!response.payload.ok) throw new Error(response.payload.error?.code || "BROWSER_CAPTURE_COMMAND_FAILED");
    return response.payload.result;
  };
  await command("capture.selectTarget", { targetId, remember: false });
  core.lastCompletionAt = 0;
  const started = await command("capture.scan.start", {
    requestId: "request_browser_real_scan",
    attemptId: "attempt_browser_real_scan",
    durationMs: 3_000,
    sampleFps: 10,
    minimumFrames: 3,
  });
  await delay(1_300);
  const result = await command("capture.scan.stop", { sessionId: started.sessionId });
  assert.equal(result.captureOnly, true);
  assert.equal(result.verificationResult, null);
  assert.ok(result.qualitySummary.capturedFrameCount >= 5);
  const closePromise = once(connected.socket, "close");
  await loopback.executeDesktopCommand("capture.pairing.revoke", { pairingId: pairing.pairingId }, origin);
  await closePromise;

  const revoked = await connectPairedSocket(server, pairing, origin, privateKey);
  assert.equal(revoked.authenticated.payload.ok, false);
  assert.equal(revoked.authenticated.payload.error.code, "PAIRING_REVOKED");
  if (revoked.socket.readyState !== WebSocket.CLOSED) await once(revoked.socket, "close");
  return {
    result: result.result,
    capturedFrames: result.qualitySummary.capturedFrameCount,
    selectedFrames: result.evidenceBundle.selection.selectedFrameCount,
    revokedRequestRejected: true,
  };
}

async function runRepeatedScanCheck(worker, storage) {
  const before = process.memoryUsage();
  const selectedFrameCounts = [];
  for (let index = 0; index < 5; index += 1) {
    core.lastCompletionAt = 0;
    const started = await core.beginPlayerScan({
      requestId: `request_repeat_scan_${index}`,
      attemptId: `attempt_repeat_scan_${index}`,
      durationMs: 3_000,
      sampleFps: 10,
      minimumFrames: 3,
    });
    await delay(750);
    const result = await core.stopPlayerScan(started.sessionId);
    assert.equal(result.evidenceBundle.retention.transientFramesCleared, true);
    assert.equal(core.getStatus().session, null);
    selectedFrameCounts.push(result.evidenceBundle.selection.selectedFrameCount);
  }
  const after = process.memoryUsage();
  const temporaryEntries = await fsp.readdir(storage.paths.temporary);
  assert.equal(worker.activeSessionId, null);
  assert.equal(storage.activeRecordings.size, 0);
  assert.equal(
    temporaryEntries.some((entry) => entry.endsWith(".part")),
    false,
  );
  const externalDeltaBytes = after.external - before.external;
  assert.ok(externalDeltaBytes < 128 * 1024 * 1024);
  return { scans: 5, selectedFrameCounts, externalDeltaBytes, orphanTemporaryFiles: 0 };
}

function sourceDocument() {
  return `<!doctype html><html><head><title>${harnessTitle}</title><style>
    html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#071b25}canvas{width:100%;height:100%}
  </style></head><body><canvas id="scene" width="960" height="540"></canvas><script>
    const canvas=document.getElementById('scene');const context=canvas.getContext('2d');let frame=0;
    function draw(){frame+=1;const gradient=context.createLinearGradient(0,0,960,540);
      gradient.addColorStop(0,'hsl('+((frame*3)%360)+' 80% 45%)');gradient.addColorStop(1,'hsl('+((frame*3+120)%360)+' 70% 18%)');
      context.fillStyle=gradient;context.fillRect(0,0,960,540);context.fillStyle='#f4d58d';context.font='bold 70px sans-serif';
      context.fillText('REAL WINDOW CAPTURE',80,180);context.fillStyle='#ffffff';context.fillRect((frame*13)%900,260,60,60);
      requestAnimationFrame(draw)}draw();
  </script></body></html>`;
}

async function runSmoke() {
  storageRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "forever-treasure-b2-electron-capture-"));
  sourceWindow = new BrowserWindow({
    show: true,
    width: 960,
    height: 540,
    x: 40,
    y: 40,
    title: harnessTitle,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false },
  });
  await sourceWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(sourceDocument())}`);
  await delay(750);

  const targetProvider = new ElectronTargetProvider(desktopCapturer);
  const worker = new ElectronCaptureWorker({ BrowserWindow, ipcMain, baseDirectory: __dirname });
  const storage = new CompanionStorage(storageRoot, { maximumCreatorBytes: 32 * 1024 * 1024 });
  const hotkey = new WindowsHotkeyMonitor({ scriptPath: path.join(__dirname, "windows-hotkey-monitor.ps1") });
  core = new CaptureCore({ targetProvider, worker, storage, hotkeyService: hotkey });
  await core.initialize();
  const targets = await core.listTargets();
  const target = targets.find((candidate) => candidate.label.includes(harnessTitle));
  assert.ok(target, "The explicit harness application window must be selectable.");
  assert.match(target.targetId, /^window:\d+:\d+$/);
  const healthPromise = waitForHealth(hotkey, (health) => !health.closed && !health.minimized);
  await core.selectTarget(target.targetId);
  const targetHealth = await healthPromise;
  assert.equal(targetHealth.closed, false);
  assert.equal(targetHealth.minimized, false);
  assert.ok(targetHealth.dimensions.width > 0 && targetHealth.dimensions.height > 0);

  const player = await core.beginPlayerScan({
    requestId: "request_electron_smoke_player",
    attemptId: "attempt_electron_smoke_player",
    durationMs: 3_000,
    sampleFps: 10,
    minimumFrames: 3,
  });
  await delay(1_500);
  const playerResult = await core.stopPlayerScan(player.sessionId);
  assert.equal(playerResult.captureOnly, true);
  assert.equal(playerResult.verificationResult, null);
  assert.ok(playerResult.qualitySummary.capturedFrameCount >= 5);
  assert.equal(playerResult.evidenceBundle.retention.transientFramesCleared, true);

  const minimizedPromise = waitForHealth(hotkey, (health) => health.minimized);
  sourceWindow.minimize();
  const minimizedHealth = await minimizedPromise;
  assert.equal(minimizedHealth.minimized, true);
  assert.equal(core.getStatus().state, "TARGET_LOST");
  const restoredPromise = waitForHealth(hotkey, (health) => !health.closed && !health.minimized);
  sourceWindow.restore();
  await restoredPromise;
  assert.equal(core.getStatus().state, "TARGET_SELECTED");
  const repeatedScans = await runRepeatedScanCheck(worker, storage);

  core.lastCompletionAt = 0;
  const creator = await core.beginCreatorRecording({
    requestId: "request_electron_smoke_creator",
    waypointVersionId: "waypoint_version_electron_smoke",
    purpose: "TARGET_REFERENCE",
    label: "Electron real-window smoke",
    notes: "",
    environmentNotes: "",
    allowCloudUpload: false,
    maxDurationMs: 4_000,
  });
  await delay(2_200);
  const creatorResult = await core.stopCreatorRecording(creator.sessionId);
  assert.equal(creatorResult.captureOnly, true);
  assert.ok(creatorResult.artifact.fileSize > 0);
  assert.match(creatorResult.artifact.contentHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal((await storage.listCreatorArtifacts()).length, 1);
  const browserPairedScan = await runBrowserPairedScan(storage, target.targetId);
  const deletedCreator = await core.execute("capture.creator.delete", {
    artifactId: creatorResult.artifact.artifactId,
  });
  assert.equal(deletedCreator.deleted, true);
  assert.equal((await storage.listCreatorArtifacts()).length, 0);
  const closedPromise = waitForHealth(hotkey, (health) => health.closed);
  sourceWindow.close();
  await closedPromise;
  assert.equal(core.getStatus().state, "TARGET_LOST");
  assert.equal(core.getStatus().target, null);

  console.log(
    JSON.stringify({
      area: "b2-electron-capture-smoke",
      selectedTarget: target.privacyLabel,
      captureApi: core.getCapabilities().captureApi,
      targetHealth: {
        closed: targetHealth.closed,
        minimized: targetHealth.minimized,
        dimensions: targetHealth.dimensions,
      },
      minimizeRestoreRecovered: true,
      repeatedScans,
      playerResult: playerResult.result,
      capturedFrames: playerResult.qualitySummary.capturedFrameCount,
      selectedFrames: playerResult.evidenceBundle.selection.selectedFrameCount,
      rawFramesCleared: playerResult.evidenceBundle.retention.transientFramesCleared,
      creatorBytes: creatorResult.artifact.fileSize,
      creatorHash: creatorResult.artifact.contentHash,
      creatorDeleted: true,
      browserPairedScan,
      targetCloseDetected: true,
    }),
  );
}

async function cleanup(exitCode) {
  await loopback?.stop().catch(() => {});
  await core?.shutdown().catch(() => {});
  if (sourceWindow && !sourceWindow.isDestroyed()) sourceWindow.destroy();
  if (storageRoot) await fsp.rm(storageRoot, { recursive: true, force: true }).catch(() => {});
  app.exit(exitCode);
}

app.whenReady().then(async () => {
  try {
    await runSmoke();
    await cleanup(0);
  } catch (error) {
    console.error(
      JSON.stringify({ area: "b2-electron-capture-smoke", error: error?.stack || error?.message || String(error) }),
    );
    await cleanup(1);
  }
});

app.on("window-all-closed", () => {});
