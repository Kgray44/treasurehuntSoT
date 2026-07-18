"use strict";

const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { captureError } = require("./capture-contract.cjs");

class ElectronCaptureWorker extends EventEmitter {
  constructor(options) {
    super();
    this.BrowserWindow = options.BrowserWindow;
    this.ipcMain = options.ipcMain;
    this.baseDirectory = options.baseDirectory;
    this.window = null;
    this.readyPromise = null;
    this.pending = new Map();
    this.activeSessionId = null;
    this.boundEvent = (event, message) => this.#handleEvent(event, message);
    this.ipcMain.on("capture-worker:event", this.boundEvent);
  }

  async #ensureWindow() {
    if (this.window && !this.window.isDestroyed()) return this.readyPromise;
    let resolveReady;
    let rejectReady;
    this.readyPromise = new Promise((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    this.resolveReady = resolveReady;
    this.rejectReady = rejectReady;
    this.window = new this.BrowserWindow({
      show: false,
      width: 320,
      height: 180,
      webPreferences: {
        preload: path.join(this.baseDirectory, "capture-worker-preload.cjs"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        backgroundThrottling: false,
      },
    });
    this.window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    const workerFile = path.join(this.baseDirectory, "capture-worker.html");
    const workerUrl = pathToFileURL(workerFile).href;
    this.window.webContents.on("will-navigate", (event, navigationUrl) => {
      if (navigationUrl !== workerUrl) event.preventDefault();
    });
    this.window.on("closed", () => {
      this.window = null;
      if (this.activeSessionId) this.emit("ended", { sessionId: this.activeSessionId, reason: "WORKER_WINDOW_CLOSED" });
      this.activeSessionId = null;
    });
    await this.window.loadFile(workerFile);
    const timeout = setTimeout(
      () => rejectReady(captureError("COMPANION_UNAVAILABLE", "Capture worker did not become ready.")),
      8_000,
    );
    await this.readyPromise.finally(() => clearTimeout(timeout));
  }

  async #invoke(command, payload) {
    await this.#ensureWindow();
    const requestId = `worker_${crypto.randomUUID()}`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          this.pending.delete(requestId);
          reject(captureError("CAPTURE_FRAME_TIMEOUT", `Capture worker ${command} timed out.`));
        },
        command === "start" ? 15_000 : 10_000,
      );
      this.pending.set(requestId, { resolve, reject, timeout });
      this.window.webContents.send("capture-worker:command", { requestId, command, payload });
    });
  }

  async start(configuration) {
    if (this.activeSessionId) throw captureError("CAPTURE_ALREADY_ACTIVE", "The capture worker already owns a source.");
    const result = await this.#invoke("start", configuration);
    this.activeSessionId = configuration.sessionId;
    return result;
  }

  pause(sessionId) {
    return this.#invoke("pause", { sessionId });
  }

  resume(sessionId) {
    return this.#invoke("resume", { sessionId });
  }

  async stop(sessionId) {
    const result = await this.#invoke("stop", { sessionId });
    if (this.activeSessionId === sessionId) this.activeSessionId = null;
    return result;
  }

  async cancel(sessionId) {
    const result = await this.#invoke("cancel", { sessionId });
    if (this.activeSessionId === sessionId) this.activeSessionId = null;
    return result;
  }

  async destroy() {
    if (this.activeSessionId) await this.cancel(this.activeSessionId).catch(() => {});
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(captureError("COMPANION_UNAVAILABLE", "Capture worker shut down."));
    }
    this.pending.clear();
    this.ipcMain.removeListener("capture-worker:event", this.boundEvent);
    this.window?.destroy();
    this.window = null;
  }

  #handleEvent(event, message) {
    if (!this.window || event.sender.id !== this.window.webContents.id || !message || typeof message !== "object")
      return;
    if (message.type === "ready") {
      this.resolveReady?.();
      this.resolveReady = null;
      return;
    }
    if (message.type === "response") {
      const pending = this.pending.get(message.requestId);
      if (!pending) return;
      this.pending.delete(message.requestId);
      clearTimeout(pending.timeout);
      if (message.ok) pending.resolve(message.payload);
      else
        pending.reject(
          captureError("CAPTURE_SOURCE_UNAVAILABLE", message.payload?.message || "Capture worker failed."),
        );
      return;
    }
    if (message.type === "frame") {
      const binary = Buffer.from(message.pixels.buffer, message.pixels.byteOffset, message.pixels.byteLength);
      this.emit("frame", { ...message, pixels: Buffer.from(binary) });
      return;
    }
    if (message.type === "recording-chunk") {
      const binary = Buffer.from(message.chunk.buffer, message.chunk.byteOffset, message.chunk.byteLength);
      this.emit("recording-chunk", { sessionId: message.sessionId, chunk: Buffer.from(binary) });
      return;
    }
    if (message.type === "error") {
      this.emit("error", captureError("CAPTURE_SOURCE_UNAVAILABLE", message.message || "Capture worker failed."));
      return;
    }
    if (message.type === "ended") this.emit("ended", message);
  }
}

module.exports = { ElectronCaptureWorker };
