import { describe, expect, it } from "vitest";
import {
  commandRequiresRecentAssurance,
  executeAdmiraltyCommand,
  newAdmiraltyCommandRequest,
  previewAdmiraltyCommand,
  type AdmiraltyCommandPort,
} from "./commands";

const request = () =>
  newAdmiraltyCommandRequest({
    commandType: "SESSION_REVOKE",
    actorAccountId: "operator_1",
    targetType: "AccountSession",
    targetId: "session_1",
    reason: "Account owner reported a lost device.",
    idempotencyKey: "session-revoke-command-0001",
    input: {},
  });

const port: AdmiraltyCommandPort = {
  ownerDomain: "Wayfarer",
  async preview() {
    return {
      commandType: "SESSION_REVOKE",
      targetSummary: { device: "Synthetic device" },
      currentState: { status: "ACTIVE" },
      resultingState: { status: "REVOKED" },
      consequences: ["The device will lose access immediately."],
      warnings: [],
      requiredCapability: "SECURITY_OPERATE",
      risk: "HIGH",
      reauthenticationRequired: true,
      auditBehavior: "A redacted command receipt is recorded.",
      rollbackAvailable: false,
    };
  },
  async execute() {
    return {
      outcome: "SUCCEEDED",
      correlationId: "correlation-1",
      resultSummary: { status: "REVOKED" },
    };
  },
};

describe("Admiralty command model", () => {
  it("requires recent assurance for high and critical operations", () => {
    expect(commandRequiresRecentAssurance("LOW")).toBe(false);
    expect(commandRequiresRecentAssurance("MODERATE")).toBe(false);
    expect(commandRequiresRecentAssurance("HIGH")).toBe(true);
    expect(commandRequiresRecentAssurance("CRITICAL")).toBe(true);
  });

  it("builds an owner-scoped preview and normalized receipt", async () => {
    const command = request();
    const preview = await previewAdmiraltyCommand(port, command);
    const receipt = await executeAdmiraltyCommand(port, command, preview);
    expect(receipt).toMatchObject({
      commandId: command.commandId,
      ownerDomain: "Wayfarer",
      outcome: "SUCCEEDED",
      correlationId: "correlation-1",
    });
  });

  it("rejects a secret-bearing or meaningless reason before the owner is called", async () => {
    const command = { ...request(), reason: "password is hunter2" };
    await expect(previewAdmiraltyCommand(port, command)).rejects.toMatchObject({
      code: "ADMIN_REASON_INVALID",
    });
    await expect(previewAdmiraltyCommand(port, { ...request(), reason: "because" })).rejects.toMatchObject({
      code: "ADMIN_REASON_INVALID",
    });
  });
});
