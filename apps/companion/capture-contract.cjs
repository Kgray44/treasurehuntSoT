"use strict";

const CAPTURE_PROTOCOL_VERSION = "2.0";
const CAPTURE_CORE_VERSION = "0.4.0-b2";

const captureStates = Object.freeze([
  "IDLE",
  "PAIRING",
  "READY",
  "TARGET_SELECTION_REQUIRED",
  "TARGET_SELECTED",
  "STARTING",
  "CAPTURING",
  "PAUSED",
  "FINALIZING",
  "PROCESSING_CAPTURE",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
  "TARGET_LOST",
]);

const captureModes = Object.freeze(["CREATOR_RECORDING", "PLAYER_SCAN", "DIAGNOSTIC"]);
const captureResults = Object.freeze([
  "EVIDENCE_CAPTURED",
  "INSUFFICIENT_CAPTURE_EVIDENCE",
  "CAPTURE_CANCELLED",
  "CAPTURE_ERROR",
]);

const captureErrorCodes = Object.freeze([
  "CAPTURE_SOURCE_NOT_SELECTED",
  "CAPTURE_SOURCE_CLOSED",
  "CAPTURE_SOURCE_MINIMIZED",
  "CAPTURE_SOURCE_UNAVAILABLE",
  "CAPTURE_PERMISSION_DENIED",
  "CAPTURE_FORMAT_CHANGED",
  "CAPTURE_FRAME_TIMEOUT",
  "CAPTURE_INSUFFICIENT_FRAMES",
  "CAPTURE_EXCESSIVE_BLUR",
  "CAPTURE_EXCESSIVE_DUPLICATES",
  "CAPTURE_EXCESSIVE_MOTION",
  "CAPTURE_INSUFFICIENT_MOTION",
  "CAPTURE_STORAGE_UNAVAILABLE",
  "CAPTURE_ALREADY_ACTIVE",
  "CAPTURE_NOT_ACTIVE",
  "CAPTURE_PRIVACY_PAUSED",
  "CAPTURE_REQUEST_STALE",
  "PAIRING_REQUIRED",
  "PAIRING_EXPIRED",
  "PAIRING_REVOKED",
  "PAIRING_CODE_INVALID",
  "PAIRING_REPLAY_REJECTED",
  "ORIGIN_NOT_ALLOWED",
  "PROTOCOL_INCOMPATIBLE",
  "COMPANION_UNAVAILABLE",
  "COMPANION_RATE_LIMITED",
  "COMPANION_PAYLOAD_TOO_LARGE",
  "HOTKEY_CONFLICT",
  "HOTKEY_UNAVAILABLE",
  "HOTKEY_RELEASE_LOST",
  "DIAGNOSTIC_CONSENT_REQUIRED",
  "ARTIFACT_NOT_FOUND",
  "ARTIFACT_PATH_INVALID",
  "VALIDATION_FAILED",
  "INTERNAL_ERROR",
]);

const allowedTransitions = Object.freeze({
  IDLE: ["READY", "PAIRING"],
  PAIRING: ["READY", "TARGET_SELECTION_REQUIRED", "FAILED"],
  READY: ["TARGET_SELECTION_REQUIRED", "TARGET_SELECTED", "PAIRING", "FAILED"],
  TARGET_SELECTION_REQUIRED: ["TARGET_SELECTED", "PAIRING", "FAILED"],
  TARGET_SELECTED: ["STARTING", "TARGET_SELECTION_REQUIRED", "TARGET_LOST", "PAIRING", "FAILED"],
  STARTING: ["CAPTURING", "CANCELLED", "FAILED", "TARGET_LOST"],
  CAPTURING: ["PAUSED", "FINALIZING", "CANCELLED", "FAILED", "TARGET_LOST"],
  PAUSED: ["CAPTURING", "FINALIZING", "CANCELLED", "FAILED", "TARGET_LOST"],
  FINALIZING: ["PROCESSING_CAPTURE", "CANCELLED", "FAILED", "TARGET_LOST"],
  PROCESSING_CAPTURE: ["COMPLETED", "CANCELLED", "FAILED"],
  COMPLETED: ["TARGET_SELECTED", "TARGET_SELECTION_REQUIRED", "TARGET_LOST", "READY"],
  CANCELLED: ["TARGET_SELECTED", "TARGET_SELECTION_REQUIRED", "TARGET_LOST", "READY"],
  FAILED: ["TARGET_SELECTED", "TARGET_SELECTION_REQUIRED", "TARGET_LOST", "READY"],
  TARGET_LOST: ["TARGET_SELECTED", "TARGET_SELECTION_REQUIRED", "READY"],
});

const userGuidance = Object.freeze({
  CAPTURE_SOURCE_NOT_SELECTED: {
    title: "Select the game window",
    message: "Choose the Sea of Thieves window before starting capture.",
    action: "Select Game Window",
    retrySafe: true,
    reselectionRequired: true,
  },
  CAPTURE_SOURCE_CLOSED: {
    title: "Game window closed",
    message: "Sea of Thieves is no longer available for capture. Reopen the game and select its window again.",
    action: "Reopen and reselect the game window",
    retrySafe: true,
    reselectionRequired: true,
  },
  CAPTURE_SOURCE_MINIMIZED: {
    title: "Restore the game window",
    message: "The selected game window is minimized and cannot provide a reliable scan. Restore it and try again.",
    action: "Restore Sea of Thieves",
    retrySafe: true,
    reselectionRequired: false,
  },
  CAPTURE_FRAME_TIMEOUT: {
    title: "Capture stream stopped",
    message:
      "The game window stopped providing changing frames. Restore it or switch Sea of Thieves to Borderless Windowed mode, then try again.",
    action: "Restore the window or use Borderless Windowed",
    retrySafe: true,
    reselectionRequired: false,
  },
  CAPTURE_INSUFFICIENT_FRAMES: {
    title: "Not enough clear views",
    message: "The scan did not contain enough clear views. Hold Inspect Surroundings and make one slow sweep.",
    action: "Try one slow sweep",
    retrySafe: true,
    reselectionRequired: false,
  },
  CAPTURE_EXCESSIVE_BLUR: {
    title: "Move more slowly",
    message: "Most views were blurred. Move the camera more slowly while inspecting the surroundings.",
    action: "Retry with slower camera movement",
    retrySafe: true,
    reselectionRequired: false,
  },
  CAPTURE_EXCESSIVE_MOTION: {
    title: "Too much motion",
    message: "Move the camera more slowly while inspecting the surroundings.",
    action: "Retry with slower movement",
    retrySafe: true,
    reselectionRequired: false,
  },
  PAIRING_EXPIRED: {
    title: "Pairing expired",
    message: "The Companion connection expired. Pair this browser with the Companion again.",
    action: "Pair again",
    retrySafe: true,
    reselectionRequired: false,
  },
  HOTKEY_CONFLICT: {
    title: "Hotkey is already in use",
    message: "Another application owns this hotkey. Choose a different binding or use the in-application control.",
    action: "Choose another hotkey",
    retrySafe: true,
    reselectionRequired: false,
  },
});

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value, name = "payload") {
  if (!isPlainObject(value)) throw captureError("VALIDATION_FAILED", `${name} must be an object.`);
  return value;
}

function assertExactKeys(value, allowed, name = "payload") {
  assertPlainObject(value, name);
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw captureError("VALIDATION_FAILED", `${name} contains unknown field ${unknown[0]}.`);
  return value;
}

function safeIdentifier(value, options = {}) {
  const min = options.min ?? 8;
  const max = options.max ?? 160;
  return (
    typeof value === "string" &&
    value.length >= min &&
    value.length <= max &&
    /^[A-Za-z0-9][A-Za-z0-9:._-]*$/.test(value)
  );
}

function requireIdentifier(value, name) {
  if (!safeIdentifier(value)) throw captureError("VALIDATION_FAILED", `${name} is invalid.`);
  return value;
}

function clampInteger(value, name, minimum, maximum, fallback) {
  const resolved = value === undefined ? fallback : value;
  if (!Number.isInteger(resolved) || resolved < minimum || resolved > maximum)
    throw captureError("VALIDATION_FAILED", `${name} must be an integer from ${minimum} to ${maximum}.`);
  return resolved;
}

function captureError(code, message, options = {}) {
  if (!captureErrorCodes.includes(code)) code = "INTERNAL_ERROR";
  const error = new Error(message || code);
  error.name = "CaptureError";
  error.code = code;
  error.recoverable = options.recoverable ?? !["VALIDATION_FAILED", "PROTOCOL_INCOMPATIBLE"].includes(code);
  error.reselectionRequired = options.reselectionRequired ?? userGuidance[code]?.reselectionRequired ?? false;
  error.diagnosticAvailable = options.diagnosticAvailable ?? true;
  error.userGuidance = userGuidance[code] ?? {
    title: "Capture could not continue",
    message: message || "The Companion could not complete this capture.",
    action: "Review Companion status and try again",
    retrySafe: error.recoverable,
    reselectionRequired: error.reselectionRequired,
  };
  return error;
}

function serializeCaptureError(error) {
  const normalized =
    error?.name === "CaptureError" && error.userGuidance
      ? error
      : captureError(captureErrorCodes.includes(error?.code) ? error.code : "INTERNAL_ERROR", error?.message);
  return {
    code: normalized.code,
    developerMessage: String(normalized.message || normalized.code).slice(0, 600),
    userTitle: normalized.userGuidance.title,
    userMessage: normalized.userGuidance.message,
    recommendedAction: normalized.userGuidance.action,
    recoverable: Boolean(normalized.recoverable),
    retrySafe: Boolean(normalized.userGuidance.retrySafe),
    reselectionRequired: Boolean(normalized.reselectionRequired),
    diagnosticAvailable: Boolean(normalized.diagnosticAvailable),
  };
}

function assertTransition(from, to) {
  if (!captureStates.includes(from) || !captureStates.includes(to) || !allowedTransitions[from].includes(to))
    throw captureError("INTERNAL_ERROR", `Capture cannot move from ${from} to ${to}.`, { recoverable: false });
}

function validateSourceId(value) {
  if (typeof value !== "string" || !/^window:\d+:\d+$/.test(value))
    throw captureError("VALIDATION_FAILED", "Capture target must be an approved window source.");
  return value;
}

function validateCreatorStart(payload) {
  assertExactKeys(
    payload,
    [
      "requestId",
      "waypointVersionId",
      "purpose",
      "label",
      "notes",
      "fieldOfView",
      "environmentNotes",
      "allowCloudUpload",
      "maxDurationMs",
    ],
    "creator start",
  );
  requireIdentifier(payload.requestId, "requestId");
  requireIdentifier(payload.waypointVersionId, "waypointVersionId");
  const purposes = [
    "TARGET_REFERENCE",
    "ACCEPTED_AREA_WALK",
    "BOUNDARY",
    "ENVIRONMENTAL_VARIATION",
    "NEARBY_HARD_NEGATIVE",
    "DISTANT_HARD_NEGATIVE",
    "INVALID_POSE",
    "DIAGNOSTIC_POSITIVE",
    "DIAGNOSTIC_NEGATIVE",
  ];
  if (!purposes.includes(payload.purpose)) throw captureError("VALIDATION_FAILED", "Recording purpose is invalid.");
  if (typeof payload.label !== "string" || payload.label.trim().length < 1 || payload.label.length > 120)
    throw captureError("VALIDATION_FAILED", "Recording label must be 1 to 120 characters.");
  if (payload.notes !== undefined && (typeof payload.notes !== "string" || payload.notes.length > 1000))
    throw captureError("VALIDATION_FAILED", "Recording notes are too long.");
  if (
    payload.environmentNotes !== undefined &&
    (typeof payload.environmentNotes !== "string" || payload.environmentNotes.length > 1000)
  )
    throw captureError("VALIDATION_FAILED", "Environment notes are too long.");
  if (
    payload.fieldOfView !== undefined &&
    (typeof payload.fieldOfView !== "number" || payload.fieldOfView < 20 || payload.fieldOfView > 180)
  )
    throw captureError("VALIDATION_FAILED", "Field of view must be between 20 and 180 degrees.");
  if (payload.allowCloudUpload !== undefined && typeof payload.allowCloudUpload !== "boolean")
    throw captureError("VALIDATION_FAILED", "Cloud upload consent must be explicit.");
  payload.maxDurationMs = clampInteger(payload.maxDurationMs, "maxDurationMs", 1_000, 600_000, 120_000);
  return payload;
}

function validateScanStart(payload) {
  assertExactKeys(payload, ["requestId", "attemptId", "durationMs", "sampleFps", "minimumFrames"], "scan start");
  requireIdentifier(payload.requestId, "requestId");
  requireIdentifier(payload.attemptId, "attemptId");
  payload.durationMs = clampInteger(payload.durationMs, "durationMs", 3_000, 8_000, 5_000);
  payload.sampleFps = clampInteger(payload.sampleFps, "sampleFps", 8, 12, 10);
  payload.minimumFrames = clampInteger(payload.minimumFrames, "minimumFrames", 3, 15, 6);
  return payload;
}

function validateCommand(command, payload = {}) {
  const empty = [
    "capture.getCapabilities",
    "capture.listTargets",
    "capture.getStatus",
    "capture.creator.list",
    "capture.privacy.resume",
    "capture.hotkey.disable",
    "capture.pairing.pending",
    "capture.pairing.list",
  ];
  if (empty.includes(command)) return assertExactKeys(payload, [], command);
  if (command === "capture.selectTarget") {
    assertExactKeys(payload, ["targetId", "remember"], command);
    validateSourceId(payload.targetId);
    if (payload.remember !== undefined && typeof payload.remember !== "boolean")
      throw captureError("VALIDATION_FAILED", "remember must be a boolean.");
    if (payload.remember === true)
      throw captureError(
        "VALIDATION_FAILED",
        "B-2 window targets expire when the Companion exits and cannot be remembered.",
      );
    return payload;
  }
  if (command === "capture.creator.start") return validateCreatorStart(payload);
  if (
    ["capture.creator.pause", "capture.creator.resume", "capture.creator.stop", "capture.creator.cancel"].includes(
      command,
    )
  ) {
    assertExactKeys(payload, ["sessionId"], command);
    requireIdentifier(payload.sessionId, "sessionId");
    return payload;
  }
  if (["capture.creator.delete", "capture.creator.preview"].includes(command)) {
    assertExactKeys(payload, ["artifactId"], command);
    requireIdentifier(payload.artifactId, "artifactId");
    return payload;
  }
  if (command === "capture.scan.start") return validateScanStart(payload);
  if (["capture.scan.stop", "capture.scan.cancel"].includes(command)) {
    assertExactKeys(payload, ["sessionId"], command);
    requireIdentifier(payload.sessionId, "sessionId");
    return payload;
  }
  if (command === "capture.privacy.pause") {
    assertExactKeys(payload, ["reason"], command);
    if (payload.reason !== undefined && (typeof payload.reason !== "string" || payload.reason.length > 240))
      throw captureError("VALIDATION_FAILED", "Pause reason is too long.");
    return payload;
  }
  if (command === "capture.hotkey.configure") {
    assertExactKeys(payload, ["binding", "interaction"], command);
    if (!["Control+Alt+F9", "Control+Shift+F10", "F9"].includes(payload.binding))
      throw captureError("VALIDATION_FAILED", "Hotkey binding is not an approved preset.");
    if (!["HOLD", "TOGGLE"].includes(payload.interaction))
      throw captureError("VALIDATION_FAILED", "Hotkey interaction is invalid.");
    return payload;
  }
  if (command === "capture.pairing.approve") {
    assertExactKeys(payload, ["pairingId", "approved"], command);
    requireIdentifier(payload.pairingId, "pairingId");
    if (typeof payload.approved !== "boolean") throw captureError("VALIDATION_FAILED", "approved must be a boolean.");
    return payload;
  }
  if (command === "capture.pairing.revoke") {
    assertExactKeys(payload, ["pairingId"], command);
    requireIdentifier(payload.pairingId, "pairingId");
    return payload;
  }
  if (command === "capture.diagnostic.create") {
    assertExactKeys(payload, ["includeFrames", "consent"], command);
    if (typeof payload.includeFrames !== "boolean" || typeof payload.consent !== "boolean")
      throw captureError("VALIDATION_FAILED", "Diagnostic consent fields must be boolean.");
    if (payload.includeFrames && !payload.consent)
      throw captureError("DIAGNOSTIC_CONSENT_REQUIRED", "Frame retention requires explicit diagnostic consent.");
    return payload;
  }
  if (command === "capture.diagnostic.export") {
    assertExactKeys(payload, ["bundleId"], command);
    requireIdentifier(payload.bundleId, "bundleId");
    return payload;
  }
  throw captureError("VALIDATION_FAILED", `Capture command ${String(command).slice(0, 120)} is not allowed.`);
}

function validateEnvelope(value) {
  assertExactKeys(
    value,
    ["protocolVersion", "messageType", "messageId", "requestId", "sessionId", "timestamp", "sequence", "payload"],
    "protocol envelope",
  );
  if (value.protocolVersion !== CAPTURE_PROTOCOL_VERSION)
    throw captureError("PROTOCOL_INCOMPATIBLE", `Capture protocol ${value.protocolVersion} is not supported.`);
  if (!["capture.command", "capture.response", "capture.event", "companion.authenticate"].includes(value.messageType))
    throw captureError("VALIDATION_FAILED", "Protocol message type is invalid.");
  requireIdentifier(value.messageId, "messageId");
  if (value.requestId !== undefined) requireIdentifier(value.requestId, "requestId");
  if (value.sessionId !== undefined) requireIdentifier(value.sessionId, "sessionId");
  if (typeof value.timestamp !== "string" || !Number.isFinite(Date.parse(value.timestamp)))
    throw captureError("VALIDATION_FAILED", "Protocol timestamp is invalid.");
  if (value.sequence !== undefined && (!Number.isSafeInteger(value.sequence) || value.sequence < 0))
    throw captureError("VALIDATION_FAILED", "Protocol sequence is invalid.");
  assertPlainObject(value.payload, "protocol payload");
  return value;
}

module.exports = {
  CAPTURE_CORE_VERSION,
  CAPTURE_PROTOCOL_VERSION,
  allowedTransitions,
  assertExactKeys,
  assertPlainObject,
  assertTransition,
  captureError,
  captureErrorCodes,
  captureModes,
  captureResults,
  captureStates,
  clampInteger,
  requireIdentifier,
  safeIdentifier,
  serializeCaptureError,
  userGuidance,
  validateCommand,
  validateEnvelope,
  validateSourceId,
};
