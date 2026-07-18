"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "tallTaleDesktop",
  Object.freeze({
    platform: "windows",
    shellVersion: "0.6.0-b4",
    invoke: (command, payload) => ipcRenderer.invoke("vision:invoke", command, payload),
    subscribe: (callback) => {
      if (typeof callback !== "function") throw new Error("DESKTOP_SUBSCRIBER_INVALID");
      const listener = (_event, message) => callback(message);
      ipcRenderer.on("vision:event", listener);
      return () => ipcRenderer.removeListener("vision:event", listener);
    },
  }),
);
