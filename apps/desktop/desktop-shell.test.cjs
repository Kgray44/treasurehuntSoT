"use strict";
/* eslint-disable @typescript-eslint/no-require-imports -- Node's desktop boundary test is CommonJS. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { allowedCommands, executeDesktopCommand } = require("./commands.cjs");
test("desktop bridge exposes only governed commands", () => {
  assert.deepEqual([...allowedCommands], ["vision.getCapabilities", "vision.prepareMockScan", "app.getDiagnostics"]);
  assert.throws(() => executeDesktopCommand("shell.exec", { command: "whoami" }), /DESKTOP_COMMAND_NOT_ALLOWED/);
  assert.throws(() => executeDesktopCommand("filesystem.read", { path: "C:\\\\" }), /DESKTOP_COMMAND_NOT_ALLOWED/);
});
test("desktop mock scan validates identifiers and scenarios", () => {
  assert.deepEqual(
    executeDesktopCommand("vision.prepareMockScan", {
      sessionId: "session-1234",
      blockId: "block-1234",
      waypointVersionId: "version-1234",
      scenario: "verified",
    }),
    { accepted: true, implementation: "B1_DETERMINISTIC_MOCK", capturesCamera: false, accessesFilesystem: false },
  );
  assert.throws(
    () =>
      executeDesktopCommand("vision.prepareMockScan", {
        sessionId: "short",
        blockId: "block-1234",
        waypointVersionId: "version-1234",
        scenario: "verified",
      }),
    /DESKTOP_SCAN_REQUEST_INVALID/,
  );
});
