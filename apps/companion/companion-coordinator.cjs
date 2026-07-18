"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { CaptureCore } = require("./capture-core.cjs");
const { CompanionLoopbackServer } = require("./loopback-server.cjs");
const { ElectronCaptureWorker } = require("./electron-capture-worker.cjs");
const { ElectronTargetProvider } = require("./electron-target-provider.cjs");
const { CompanionStorage } = require("./storage.cjs");
const { WindowsHotkeyMonitor } = require("./windows-hotkey-monitor.cjs");
const { CAPTURE_CORE_VERSION, serializeCaptureError, validateCommand } = require("./capture-contract.cjs");
const { VisionEngineService } = require("./vision-engine-service.cjs");
const { validateVisionCommand } = require("./vision-command-contract.cjs");
const { serializeVisionEngineError } = require("./vision-engine-contract.cjs");

function parseAllowedOrigins(value, required = []) {
  const origins = new Set(required);
  for (const entry of String(value || "").split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    try {
      const parsed = new URL(trimmed);
      if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        parsed.pathname !== "/"
      )
        continue;
      origins.add(parsed.origin);
    } catch {
      // Invalid configured origins are ignored; wildcard or malformed values never broaden access.
    }
  }
  return [...origins].filter((origin) => origin !== "*");
}

class StructuredCompanionLogger {
  constructor(logDirectory) {
    this.logDirectory = logDirectory;
    this.logPath = path.join(logDirectory, "companion.jsonl");
    this.pending = Promise.resolve();
  }

  async initialize() {
    await fsp.mkdir(this.logDirectory, { recursive: true });
  }

  write(entry) {
    const safe = {
      timestamp: entry.timestamp ?? new Date().toISOString(),
      level: entry.level ?? "INFO",
      event: String(entry.event ?? "companion_event").slice(0, 120),
      ...(entry.code ? { code: String(entry.code).slice(0, 120) } : {}),
      ...(entry.from ? { from: entry.from } : {}),
      ...(entry.to ? { to: entry.to } : {}),
      ...(entry.sessionId ? { sessionId: entry.sessionId } : {}),
      ...(entry.pairingId ? { pairingId: entry.pairingId } : {}),
      ...(entry.allowedOrigin ? { allowedOrigin: entry.allowedOrigin } : {}),
      ...(entry.targetId ? { targetId: entry.targetId } : {}),
      ...(entry.dimensions ? { dimensions: entry.dimensions } : {}),
      ...(entry.recoverable !== undefined ? { recoverable: Boolean(entry.recoverable) } : {}),
      ...(entry.storageCleanup ? { storageCleanup: entry.storageCleanup } : {}),
    };
    this.pending = this.pending
      .then(() => fsp.appendFile(this.logPath, `${JSON.stringify(safe)}\n`, "utf8"))
      .catch(() => {});
  }
}

class CompanionCoordinator {
  constructor(options) {
    this.electron = options.electron;
    this.userDataRoot = options.userDataRoot;
    this.desktopOrigin = options.desktopOrigin;
    this.projectRoot = options.projectRoot;
    this.packaged = options.packaged;
    this.port = options.port ?? 32179;
    this.window = null;
    this.tray = null;
    this.storage = new CompanionStorage(path.join(this.userDataRoot, "companion"));
    this.logger = new StructuredCompanionLogger(this.storage.paths.logs);
    this.targetProvider = new ElectronTargetProvider(this.electron.desktopCapturer);
    this.worker = new ElectronCaptureWorker({
      BrowserWindow: this.electron.BrowserWindow,
      ipcMain: this.electron.ipcMain,
      baseDirectory: __dirname,
    });
    this.hotkey = new WindowsHotkeyMonitor({
      scriptPath: this.packaged
        ? path.join(process.resourcesPath, "companion", "windows-hotkey-monitor.ps1")
        : path.join(__dirname, "windows-hotkey-monitor.ps1"),
    });
    this.core = new CaptureCore({
      targetProvider: this.targetProvider,
      worker: this.worker,
      storage: this.storage,
      hotkeyService: this.hotkey,
      logger: (entry) => this.logger.write(entry),
    });
    this.vision = new VisionEngineService({ storage: this.storage, featureFlags: () => this.#featureFlagSnapshot() });
    this.core.setPlayerEvidenceConsumer((evidence) => this.vision.consumePlayerEvidence(evidence));
    const requiredOrigins = [
      this.desktopOrigin,
      ...(this.packaged ? [] : ["http://127.0.0.1:3000", "http://localhost:3000"]),
    ];
    this.allowedOrigins = parseAllowedOrigins(process.env.TALL_TALE_COMPANION_ALLOWED_ORIGINS, requiredOrigins);
    this.server = new CompanionLoopbackServer({
      core: this.core,
      vision: this.vision,
      storage: this.storage,
      port: this.port,
      allowedOrigins: this.allowedOrigins,
      logger: (entry) => this.logger.write(entry),
    });
    this.core.setDiagnosticContextProvider(() => ({
      loopback: this.server.getStatus(),
      featureFlags: this.#featureFlagSnapshot(),
    }));
    for (const eventName of ["status", "state", "capture-progress", "capture-completed", "capture-error"]) {
      this.core.on(eventName, (payload) => this.#forward(eventName, payload));
    }
    for (const eventName of [
      "vision-build-progress",
      "vision-build-completed",
      "vision-build-failed",
      "vision-runtime-progress",
      "vision-runtime-completed",
    ])
      this.vision.on(eventName, (payload) => this.#forward(eventName, payload));
  }

  async initialize() {
    await this.logger.initialize();
    const gpuInfo = await this.electron.app.getGPUInfo("basic").catch(() => null);
    this.core.setGraphicsAdapters(gpuInfo?.gpuDevice ?? []);
    this.vision.setGraphicsAdapters(gpuInfo?.gpuDevice ?? []);
    const capabilities = await this.core.initialize();
    const companion = await this.server.start();
    this.#createTray();
    this.logger.write({ level: "INFO", event: "companion_started" });
    return { capabilities, companion };
  }

  attachWindow(window) {
    this.window = window;
    this.#updateTray(this.core.getStatus());
  }

  async execute(command, payload = {}) {
    try {
      if (
        command.startsWith("vision.engine.") ||
        command.startsWith("vision.build.") ||
        command.startsWith("vision.runtime.")
      ) {
        validateVisionCommand(command, { ...payload });
        return await this.vision.execute(command, payload);
      }
      const validated = validateCommand(command, { ...payload });
      if (
        command.startsWith("capture.pairing.") ||
        command === "capture.creator.preview" ||
        command === "capture.diagnostic.export"
      )
        return await this.server.executeDesktopCommand(command, validated, this.desktopOrigin);
      return await this.core.execute(command, validated);
    } catch (error) {
      if (error?.name === "VisionEngineError") {
        const serialized = serializeVisionEngineError(error);
        const wrapped = new Error(serialized.userMessage);
        wrapped.name = "VisionEngineCommandError";
        wrapped.code = serialized.code;
        wrapped.details = serialized;
        throw wrapped;
      }
      const serialized = serializeCaptureError(error);
      const wrapped = new Error(serialized.userMessage);
      wrapped.name = "CaptureCommandError";
      wrapped.code = serialized.code;
      wrapped.details = serialized;
      throw wrapped;
    }
  }

  diagnostics() {
    return {
      shellVersion: CAPTURE_CORE_VERSION,
      platform: "windows",
      protocolVersion: "2.0",
      companion: this.server.getStatus(),
      capture: this.core.getStatus(),
      genericNativeCommands: false,
      storageRootCategory: "ELECTRON_USER_DATA",
      featureFlags: this.#featureFlagSnapshot(),
      visionEngine: this.vision.capabilities(),
    };
  }

  async shutdown() {
    this.logger.write({ level: "INFO", event: "companion_shutdown_started" });
    await this.server.stop().catch(() => {});
    await this.core.shutdown().catch(() => {});
    this.tray?.destroy();
    this.tray = null;
    await this.logger.pending;
  }

  #forward(eventName, payload) {
    if (eventName === "status") this.#updateTray(payload);
    if (!this.window || this.window.isDestroyed()) return;
    this.window.webContents.send("vision:event", { eventName, payload });
  }

  #createTray() {
    const { Menu, Tray, nativeImage } = this.electron;
    const source = this.packaged
      ? path.join(process.resourcesPath, "app-server", "public", "icons", "forever-treasure-192.svg")
      : path.join(this.projectRoot, "public", "icons", "forever-treasure-192.svg");
    let icon = nativeImage.createFromPath(source);
    if (icon.isEmpty()) {
      const svg = fs.readFileSync(source, "utf8");
      icon = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
    }
    this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
    const refreshMenu = () => {
      const status = this.core.getStatus();
      this.tray.setContextMenu(
        Menu.buildFromTemplate([
          {
            label: "Open Companion Status",
            click: () => {
              this.window?.show();
              this.window?.focus();
              void this.window?.loadURL(`${this.desktopOrigin}/vision-companion`);
            },
          },
          { type: "separator" },
          {
            label: status.privacy.paused ? "Resume Vision" : "Pause Vision",
            click: () =>
              void (status.privacy.paused ? this.core.resumeVision() : this.core.pauseVision("TRAY_PRIVACY_PAUSE")),
          },
          {
            label: "Stop Active Capture",
            enabled: Boolean(status.session),
            click: () => status.session && void this.core.cancel(status.session.sessionId, "TRAY_STOP"),
          },
          { type: "separator" },
          { role: "quit" },
        ]),
      );
    };
    this.tray.on("click", () => {
      this.window?.show();
      this.window?.focus();
    });
    this.core.on("status", refreshMenu);
    refreshMenu();
  }

  #updateTray(status) {
    if (!this.tray) return;
    const active = status.privacy.captureIndicatorVisible;
    this.tray.setToolTip(
      active
        ? `The Forever Treasure - Vision Active (${status.mode?.replaceAll("_", " ") || status.state})`
        : status.privacy.paused
          ? "The Forever Treasure - Vision Paused"
          : "The Forever Treasure Companion - Capture Inactive",
    );
  }

  #featureFlagSnapshot() {
    const enabled = (name, packagedDefault) => {
      const value = process.env[`FEATURE_${name}`];
      if (value === undefined) return packagedDefault;
      return ["1", "true", "yes", "on", "enabled"].includes(value.toLowerCase());
    };
    return {
      visionCompanion: enabled("VISION_COMPANION", true),
      visionBuildEngine: enabled("VISION_BUILD_ENGINE", false),
      visionRuntimeEngine: enabled("VISION_RUNTIME_ENGINE", false),
      visionReconstruction: enabled("VISION_RECONSTRUCTION", false),
      visionSecondaryMatcher: enabled("VISION_SECONDARY_MATCHER", false),
      shadowVerification: enabled("SHADOW_VERIFICATION", false),
      nativeWindowCapture: enabled("NATIVE_WINDOW_CAPTURE", true),
      creatorCapture: enabled("CREATOR_CAPTURE", true),
      playerHoldToScan: enabled("PLAYER_HOLD_TO_SCAN", true),
      browserCompanionPairing: enabled("BROWSER_COMPANION_PAIRING", true),
      diagnosticCapture: enabled("DIAGNOSTIC_CAPTURE", true),
      mockVerificationConsumer: enabled("MOCK_VERIFICATION_CONSUMER", !this.packaged),
      automaticVisionProgression: false,
    };
  }
}

module.exports = { CompanionCoordinator, StructuredCompanionLogger, parseAllowedOrigins };
