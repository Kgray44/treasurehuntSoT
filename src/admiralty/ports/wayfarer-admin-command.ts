import type { AdmiraltyCommandPort } from "../commands";
import { revokeAccountSessionByAdministrator } from "@/wayfarer/admin-commands";

export type SessionRevokeCommandInput = Readonly<{ sessionId: string }>;

export function wayfarerSessionRevokePort(actor: {
  accountId: string;
  accountSessionId: string;
  roles: readonly string[];
  authorizationBasis: string;
}): AdmiraltyCommandPort<SessionRevokeCommandInput> {
  return {
    ownerDomain: "Wayfarer",
    async preview(request) {
      // Execution refetches in the canonical owner. This preview deliberately
      // contains no token, CSRF, IP, or device-fingerprint material.
      return {
        commandType: request.commandType,
        targetSummary: { accountId: request.targetId, sessionId: request.input.sessionId },
        currentState: { state: "AUTHORITATIVE_STATE_REQUIRED_AT_EXECUTION" },
        resultingState: { state: "REVOKED" },
        consequences: ["The selected device will lose access immediately."],
        warnings: ["This action cannot restore an existing session."],
        requiredCapability: "SECURITY_OPERATE",
        risk: "HIGH",
        reauthenticationRequired: true,
        auditBehavior: "Wayfarer writes a redacted security event and Admiralty audit record atomically.",
        rollbackAvailable: false,
      };
    },
    async execute(request) {
      const result = await revokeAccountSessionByAdministrator({
        actor: {
          accountId: actor.accountId,
          accountSessionId: actor.accountSessionId,
          role: actor.roles[0] ?? "SECURITY_OPERATOR",
          capability: "SECURITY_OPERATE",
          authorizationBasis: actor.authorizationBasis,
        },
        accountId: request.targetId,
        sessionId: request.input.sessionId,
        reason: request.reason,
        correlationId: request.commandId,
      });
      return {
        outcome: "SUCCEEDED",
        ownerReceiptId: result.id,
        correlationId: request.commandId,
        resultSummary: { sessionId: result.id, revokedAt: result.revokedAt, alreadyRevoked: result.alreadyRevoked },
      };
    },
  };
}
