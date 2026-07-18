"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- Electron preload runs as CommonJS. */
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "tallTaleDesktop",
  Object.freeze({
    platform: "windows",
    shellVersion: "0.3.0-b1",
    invoke: (command, payload) => ipcRenderer.invoke("vision:invoke", command, payload),
  }),
);
