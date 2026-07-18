"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- Electron main runs as CommonJS. */
const { app, BrowserWindow, ipcMain, Menu, utilityProcess } = require("electron");
const http = require("node:http");
const path = require("node:path");
const { executeDesktopCommand } = require("./commands.cjs");

const DEVELOPMENT_URL = process.env.TALL_TALE_DESKTOP_URL || "http://127.0.0.1:3000";
let applicationServer = null;
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
    env: { ...process.env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(port), TALL_TALE_DESKTOP: "1" },
    stdio: "pipe",
  });
  applicationServer.stdout?.on("data", (chunk) => console.error(`[app-server:stdout] ${chunk.toString().trim()}`));
  applicationServer.stderr?.on("data", (chunk) => console.error(`[app-server:stderr] ${chunk.toString().trim()}`));
  applicationServer.on("exit", (code) => console.error(`[app-server:exit] ${code}`));
  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  return url;
}
async function createWindow() {
  const origin = await applicationUrl();
  const smoke = process.env.TALL_TALE_DESKTOP_SMOKE === "1";
  const window = new BrowserWindow({
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
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, target) => {
    if (!target.startsWith(origin)) event.preventDefault();
  });
  const navigate = (route) => window.loadURL(`${origin}${route}`);
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Navigate",
        submenu: [
          { label: "Harbor", click: () => navigate("/") },
          { label: "Player", click: () => navigate("/player") },
          { label: "Captain", click: () => navigate("/captain") },
          { label: "Studio", click: () => navigate("/studio") },
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
  await window.loadURL(origin);
  if (smoke) {
    const title = await window.webContents.executeJavaScript("document.title");
    console.log(JSON.stringify({ area: "desktop-smoke", loaded: true, title, origin, shellVersion: "0.3.0-b1" }));
    setTimeout(() => app.quit(), 100);
  }
}
ipcMain.handle("vision:invoke", (_event, command, payload) => executeDesktopCommand(command, payload));
app
  .whenReady()
  .then(createWindow)
  .catch((error) => {
    console.error(JSON.stringify({ area: "desktop-shell", code: error.message }));
    app.quit();
  });
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => applicationServer?.kill());
