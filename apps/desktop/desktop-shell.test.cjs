"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { allowedCommands, executeDesktopCommand } = require("./commands.cjs");

test("desktop bridge exposes only governed capture and diagnostic commands", async () => {
  assert.equal(allowedCommands.has("capture.scan.start"), true);
  assert.equal(allowedCommands.has("capture.pairing.approve"), true);
  assert.equal(allowedCommands.has("vision.prepareMockScan"), true);
  assert.equal(allowedCommands.has("shell.exec"), false);
  const coordinator = { packaged: false, execute: async () => ({}), diagnostics: () => ({}) };
  await assert.rejects(
    executeDesktopCommand(coordinator, "shell.exec", { command: "whoami" }),
    /DESKTOP_COMMAND_NOT_ALLOWED/,
  );
  await assert.rejects(
    executeDesktopCommand(coordinator, "filesystem.read", { path: "C:\\" }),
    /DESKTOP_COMMAND_NOT_ALLOWED/,
  );
});

test("legacy desktop mock preparation is validated and development-only", async () => {
  const coordinator = { packaged: false };
  assert.deepEqual(
    await executeDesktopCommand(coordinator, "vision.prepareMockScan", {
      sessionId: "session-1234",
      blockId: "block-1234",
      waypointVersionId: "version-1234",
      scenario: "verified",
    }),
    {
      accepted: true,
      implementation: "B1_DETERMINISTIC_MOCK_DEVELOPMENT_ONLY",
      capturesCamera: false,
      accessesFilesystem: false,
    },
  );
  await assert.rejects(
    executeDesktopCommand(coordinator, "vision.prepareMockScan", {
      sessionId: "short",
      blockId: "block-1234",
      waypointVersionId: "version-1234",
      scenario: "verified",
    }),
    /DESKTOP_SCAN_REQUEST_INVALID/,
  );
  await assert.rejects(
    executeDesktopCommand({ packaged: true }, "vision.prepareMockScan", {
      sessionId: "session-1234",
      blockId: "block-1234",
      waypointVersionId: "version-1234",
      scenario: "verified",
    }),
    /DEVELOPMENT_MOCK_DISABLED/,
  );
});

test("desktop capability shim reports the real B-2 core without generic native access", async () => {
  const coordinator = {
    packaged: false,
    core: {
      getCapabilities: () => ({ protocolVersion: "2.0", nativeCapture: true }),
    },
  };
  assert.deepEqual(await executeDesktopCommand(coordinator, "vision.getCapabilities", {}), {
    available: true,
    state: "CONNECTED",
    protocolVersion: "2.0",
    capture: true,
    deterministicMock: true,
    platform: "DESKTOP",
  });
});
