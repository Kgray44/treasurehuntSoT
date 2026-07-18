"use strict";

const { spawn } = require("node:child_process");
const { EventEmitter } = require("node:events");
const path = require("node:path");
const readline = require("node:readline");
const { captureError } = require("./capture-contract.cjs");

const bindings = Object.freeze({
  "Control+Alt+F9": { virtualKey: 120, modifiers: 3 },
  "Control+Shift+F10": { virtualKey: 121, modifiers: 6 },
  F9: { virtualKey: 120, modifiers: 0 },
});

class WindowsHotkeyMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.scriptPath = options.scriptPath ?? path.join(__dirname, "windows-hotkey-monitor.ps1");
    this.process = null;
    this.binding = null;
    this.interaction = null;
    this.windowHandle = "0";
  }

  async configure(binding, interaction) {
    if (!bindings[binding]) throw captureError("VALIDATION_FAILED", "Hotkey preset is invalid.");
    await this.disable(true, false);
    this.binding = binding;
    this.interaction = interaction;
    return this.#start();
  }

  async setWindowHandle(windowHandle) {
    this.windowHandle = /^\d+$/.test(String(windowHandle)) ? String(windowHandle) : "0";
    await this.disable(false, false);
    if (this.binding || this.windowHandle !== "0") return this.#start();
    return { registered: false, conflict: false, healthOnly: false };
  }

  async #start() {
    const selected = bindings[this.binding] ?? { virtualKey: 120, modifiers: 0 };
    const healthOnly = !this.binding;
    const argumentsList = [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      this.scriptPath,
      "-VirtualKey",
      String(selected.virtualKey),
      "-Modifiers",
      String(selected.modifiers),
      "-WindowHandle",
      this.windowHandle,
    ];
    if (healthOnly) argumentsList.push("-HealthOnly");
    const child = spawn("powershell.exe", argumentsList, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    this.process = child;
    const lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      if (line.length > 2_000) return;
      try {
        const event = JSON.parse(line);
        if (event.type === "keydown") this.emit("keydown", event);
        else if (event.type === "keyup") this.emit("keyup", event);
        else if (event.type === "release-lost") this.emit("release-lost", event);
        else if (event.type === "health") this.emit("health", event);
      } catch {
        // Non-JSON PowerShell output is intentionally ignored and never forwarded to application logs.
      }
    });
    child.on("exit", (code) => {
      if (this.process === child) {
        this.process = null;
        if (code && code !== 0) this.emit("unavailable", { code });
      }
    });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill();
        reject(captureError("HOTKEY_UNAVAILABLE", "The Windows hotkey monitor did not start."));
      }, 8_000);
      const onLine = (line) => {
        try {
          const event = JSON.parse(line);
          if (event.type !== "registration") return;
          clearTimeout(timeout);
          lines.removeListener("line", onLine);
          if (!event.registered) {
            child.kill();
            resolve({ registered: false, conflict: true });
          } else
            resolve({
              registered: !healthOnly,
              conflict: false,
              healthOnly,
              binding: this.binding,
              interaction: this.interaction,
            });
        } catch {
          // Wait for the fixed registration message.
        }
      };
      lines.on("line", onLine);
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(captureError("HOTKEY_UNAVAILABLE", error.message));
      });
    });
  }

  async disable(clearBinding = true, preserveHealth = true) {
    const child = this.process;
    this.process = null;
    if (child && !child.killed) {
      child.kill();
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 2_000);
        child.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
    if (clearBinding) {
      this.binding = null;
      this.interaction = null;
    }
    if (preserveHealth && !this.process && this.windowHandle !== "0") await this.#start();
  }

  async shutdown() {
    this.windowHandle = "0";
    await this.disable(true, false);
  }
}

module.exports = { WindowsHotkeyMonitor, bindings };
