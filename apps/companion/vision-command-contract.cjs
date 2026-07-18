"use strict";

const { VisionEngineError, buildStages } = require("./vision-engine-contract.cjs");

const commands = Object.freeze([
  "vision.engine.getCapabilities",
  "vision.build.start",
  "vision.build.status",
  "vision.build.cancel",
  "vision.runtime.arm",
  "vision.runtime.disarm",
]);

function object(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new VisionEngineError("BUILD_INPUT_SCHEMA_UNSUPPORTED", `${name} must be an object.`, { retryable: false });
  return value;
}

function exact(value, keys, name) {
  object(value, name);
  const extras = Object.keys(value).filter((key) => !keys.includes(key));
  if (extras.length)
    throw new VisionEngineError(
      "BUILD_INPUT_SCHEMA_UNSUPPORTED",
      `${name} contains unknown fields: ${extras.join(", ")}.`,
      { retryable: false },
    );
  return value;
}

function identifier(value, name, prefix) {
  if (
    typeof value !== "string" ||
    value.length < 8 ||
    value.length > 200 ||
    !/^[A-Za-z0-9][A-Za-z0-9:._-]*$/.test(value) ||
    (prefix && !value.startsWith(prefix))
  )
    throw new VisionEngineError("BUILD_INPUT_SCHEMA_UNSUPPORTED", `${name} is invalid.`, { retryable: false });
  return value;
}

function validateVisionCommand(command, unchecked = {}) {
  if (!commands.includes(command))
    throw new VisionEngineError("INTERNAL_RUNTIME_ERROR", `Vision command ${command} is not allowed.`, {
      retryable: false,
    });
  const input = object(unchecked, command);
  if (command === "vision.engine.getCapabilities") return exact(input, [], command);
  if (command === "vision.build.start") {
    exact(
      input,
      ["buildId", "inputHash", "buildInput", "builtAt", "provider", "allowProviderFallback", "timeoutMs"],
      command,
    );
    identifier(input.buildId, "buildId", "build_");
    if (typeof input.inputHash !== "string" || !/^(sha256:)?[a-f0-9]{64}$/.test(input.inputHash))
      throw new VisionEngineError("BUILD_INPUT_HASH_MISMATCH", "inputHash is invalid.", { retryable: false });
    object(input.buildInput, "buildInput");
    if (typeof input.builtAt !== "string" || !Number.isFinite(Date.parse(input.builtAt)))
      throw new VisionEngineError("BUILD_INPUT_SCHEMA_UNSUPPORTED", "builtAt must be an ISO timestamp.", {
        retryable: false,
      });
    if (input.provider !== undefined && typeof input.provider !== "string")
      throw new VisionEngineError("MODEL_PROVIDER_UNAVAILABLE", "provider is invalid.");
    if (input.allowProviderFallback !== undefined && typeof input.allowProviderFallback !== "boolean")
      throw new VisionEngineError("BUILD_INPUT_SCHEMA_UNSUPPORTED", "allowProviderFallback must be boolean.");
    if (
      input.timeoutMs !== undefined &&
      (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 1_000 || input.timeoutMs > 3_600_000)
    )
      throw new VisionEngineError("BUILD_INPUT_SCHEMA_UNSUPPORTED", "timeoutMs is invalid.");
    return input;
  }
  if (command === "vision.build.status" || command === "vision.build.cancel") {
    exact(input, ["buildId"], command);
    identifier(input.buildId, "buildId", "build_");
    return input;
  }
  if (command === "vision.runtime.arm") {
    exact(
      input,
      [
        "attemptId",
        "packageId",
        "waypointVersionId",
        "stageToken",
        "expectedStageToken",
        "provider",
        "allowProviderFallback",
        "timeoutMs",
        "checkpointContext",
      ],
      command,
    );
    identifier(input.attemptId, "attemptId", "att_");
    identifier(input.packageId, "packageId", "pkg_");
    identifier(input.waypointVersionId, "waypointVersionId");
    identifier(input.stageToken, "stageToken");
    identifier(input.expectedStageToken, "expectedStageToken");
    if (input.checkpointContext !== undefined) object(input.checkpointContext, "checkpointContext");
    return input;
  }
  exact(input, ["attemptId"], command);
  identifier(input.attemptId, "attemptId", "att_");
  return input;
}

module.exports = { buildStages, commands, validateVisionCommand };
