"use strict";

const allowedCommands = new Set(["vision.getCapabilities", "vision.prepareMockScan", "app.getDiagnostics"]);
const allowedScenarios = new Set([
  "verified",
  "insufficient",
  "not_at_target",
  "ambiguous",
  "system_error",
  "delayed_verified",
  "cancelled",
  "stale_stage",
  "duplicate_result_delivery",
]);
function safeIdentifier(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 128 && /^[A-Za-z0-9:_-]+$/.test(value);
}
function executeDesktopCommand(command, payload = {}) {
  if (!allowedCommands.has(command)) throw new Error("DESKTOP_COMMAND_NOT_ALLOWED");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("DESKTOP_PAYLOAD_INVALID");
  if (command === "vision.getCapabilities")
    return {
      available: true,
      state: "CONNECTED",
      protocolVersion: "1.0",
      packageSchemaVersions: [1],
      capture: false,
      deterministicMock: true,
    };
  if (command === "vision.prepareMockScan") {
    if (
      !safeIdentifier(payload.sessionId) ||
      !safeIdentifier(payload.blockId) ||
      !safeIdentifier(payload.waypointVersionId) ||
      !allowedScenarios.has(payload.scenario)
    )
      throw new Error("DESKTOP_SCAN_REQUEST_INVALID");
    return {
      accepted: true,
      implementation: "B1_DETERMINISTIC_MOCK",
      capturesCamera: false,
      accessesFilesystem: false,
    };
  }
  return {
    shellVersion: "0.3.0-b1",
    platform: "windows",
    protocolVersion: "1.0",
    packageSchemaVersion: 1,
    genericNativeCommands: false,
  };
}
module.exports = { allowedCommands, executeDesktopCommand };
