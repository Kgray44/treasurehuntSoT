"use strict";

const { validateCommand } = require("../companion/capture-contract.cjs");
const { validateVisionCommand } = require("../companion/vision-command-contract.cjs");

const allowedCommands = new Set([
  "capture.getCapabilities",
  "capture.listTargets",
  "capture.selectTarget",
  "capture.getStatus",
  "capture.creator.start",
  "capture.creator.pause",
  "capture.creator.resume",
  "capture.creator.stop",
  "capture.creator.cancel",
  "capture.creator.list",
  "capture.creator.delete",
  "capture.creator.preview",
  "capture.scan.start",
  "capture.scan.stop",
  "capture.scan.cancel",
  "capture.privacy.pause",
  "capture.privacy.resume",
  "capture.hotkey.configure",
  "capture.hotkey.disable",
  "capture.pairing.pending",
  "capture.pairing.approve",
  "capture.pairing.revoke",
  "capture.pairing.list",
  "capture.diagnostic.create",
  "capture.diagnostic.export",
  "vision.getCapabilities",
  "vision.prepareMockScan",
  "vision.engine.getCapabilities",
  "vision.build.start",
  "vision.build.status",
  "vision.build.cancel",
  "vision.runtime.arm",
  "vision.runtime.disarm",
  "app.getDiagnostics",
]);

const developmentScenarios = new Set([
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

function validateLegacyMockPreparation(payload) {
  const keys = Object.keys(payload);
  const identifiers = [payload.sessionId, payload.blockId, payload.waypointVersionId];
  if (
    keys.length !== 4 ||
    !["sessionId", "blockId", "waypointVersionId", "scenario"].every((key) => keys.includes(key)) ||
    !identifiers.every(
      (value) =>
        typeof value === "string" &&
        value.length >= 8 &&
        value.length <= 160 &&
        /^[A-Za-z0-9][A-Za-z0-9:._-]*$/.test(value),
    ) ||
    !developmentScenarios.has(payload.scenario)
  )
    throw new Error("DESKTOP_SCAN_REQUEST_INVALID");
}

async function executeDesktopCommand(coordinator, command, payload = {}) {
  if (!allowedCommands.has(command)) throw new Error("DESKTOP_COMMAND_NOT_ALLOWED");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("DESKTOP_PAYLOAD_INVALID");
  if (command === "vision.getCapabilities") {
    validateCommand("capture.getStatus", payload);
    const capabilities = coordinator.core.getCapabilities();
    return {
      available: true,
      state: "CONNECTED",
      protocolVersion: capabilities.protocolVersion,
      capture: capabilities.nativeCapture,
      deterministicMock: !coordinator.packaged,
      platform: "DESKTOP",
    };
  }
  if (command === "vision.prepareMockScan") {
    if (coordinator.packaged) throw new Error("DEVELOPMENT_MOCK_DISABLED");
    validateLegacyMockPreparation(payload);
    return {
      accepted: true,
      implementation: "B1_DETERMINISTIC_MOCK_DEVELOPMENT_ONLY",
      capturesCamera: false,
      accessesFilesystem: false,
    };
  }
  if (command === "app.getDiagnostics") {
    validateCommand("capture.getStatus", payload);
    return coordinator.diagnostics();
  }
  if (
    command.startsWith("vision.engine.") ||
    command.startsWith("vision.build.") ||
    command.startsWith("vision.runtime.")
  ) {
    validateVisionCommand(command, { ...payload });
    return coordinator.execute(command, payload);
  }
  validateCommand(command, { ...payload });
  return coordinator.execute(command, payload);
}

module.exports = { allowedCommands, executeDesktopCommand };
