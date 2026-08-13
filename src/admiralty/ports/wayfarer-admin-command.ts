import type { AdmiraltyCommandPort } from "../commands";
import { AdmiraltyError } from "../errors";
import {
  inspectAccountLifecycleForAdministrator,
  revokeAccountSessionByAdministrator,
  suspendAccountByAdministrator,
} from "@/wayfarer/admin-commands";

function rethrowWayfarerCommandError(cause: unknown): never {
  if (cause instanceof AdmiraltyError) throw cause;
  if (cause instanceof Error && cause.message === "WAYFARER_ADMIN_ACCOUNT_NOT_FOUND")
    throw new AdmiraltyError("ADMIN_TARGET_NOT_FOUND", "The account is no longer available.", 404);
  if (
    cause instanceof Error &&
    [
      "WAYFARER_ADMIN_ACCOUNT_CONFLICT",
      "WAYFARER_ADMIN_ACCOUNT_TRANSITION_INVALID",
      "WAYFARER_ADMIN_SESSION_CONFLICT",
    ].includes(cause.message)
  )
    throw new AdmiraltyError(
      "ADMIN_CONFLICT",
      "The target changed. Refresh the dossier and review a new preview.",
      409,
    );
  if (cause instanceof Error && cause.message === "WAYFARER_ADMIN_SESSION_NOT_FOUND")
    throw new AdmiraltyError("ADMIN_TARGET_NOT_FOUND", "The selected session is no longer available.", 404);
  throw cause;
}

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
      let result;
      try {
        result = await revokeAccountSessionByAdministrator({
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
      } catch (cause) {
        rethrowWayfarerCommandError(cause);
      }
      return {
        outcome: "SUCCEEDED",
        ownerReceiptId: result.id,
        correlationId: request.commandId,
        resultSummary: { sessionId: result.id, revokedAt: result.revokedAt, alreadyRevoked: result.alreadyRevoked },
      };
    },
  };
}

export type AccountSuspendCommandInput = Readonly<{ expectedUpdatedAt: string }>;
export function wayfarerAccountSuspendPort(actor: {
  accountId: string;
  accountSessionId: string;
  roles: readonly string[];
  authorizationBasis: string;
}): AdmiraltyCommandPort<AccountSuspendCommandInput> {
  return {
    ownerDomain: "Wayfarer",
    async preview(request) {
      let account;
      try {
        account = await inspectAccountLifecycleForAdministrator(request.targetId);
        if (!account) throw new Error("WAYFARER_ADMIN_ACCOUNT_NOT_FOUND");
        if (account.updatedAt.toISOString() !== request.input.expectedUpdatedAt || account.status !== "ACTIVE")
          throw new Error("WAYFARER_ADMIN_ACCOUNT_CONFLICT");
      } catch (cause) {
        rethrowWayfarerCommandError(cause);
      }
      return {
        commandType: request.commandType,
        targetSummary: { accountId: account.id },
        currentState: { status: account.status },
        resultingState: { status: "SUSPENDED" },
        consequences: ["All active account sessions will be revoked immediately."],
        warnings: ["Reactivation requires a separate governed Wayfarer command."],
        requiredCapability: "ACCOUNT_OPERATE",
        risk: "CRITICAL",
        reauthenticationRequired: true,
        auditBehavior:
          "Wayfarer lifecycle, session revocation, security event, and Admiralty audit are transaction-bound.",
        rollbackAvailable: true,
        compensatingAction: "Reactivate only through the canonical Wayfarer lifecycle command.",
        revision: account.updatedAt.toISOString(),
      };
    },
    async execute(request) {
      let result;
      try {
        result = await suspendAccountByAdministrator({
          actor: {
            accountId: actor.accountId,
            accountSessionId: actor.accountSessionId,
            role: actor.roles[0] ?? "SECURITY_OPERATOR",
            capability: "ACCOUNT_OPERATE",
            authorizationBasis: actor.authorizationBasis,
          },
          accountId: request.targetId,
          expectedUpdatedAt: request.input.expectedUpdatedAt,
          reason: request.reason,
          correlationId: request.commandId,
        });
      } catch (cause) {
        rethrowWayfarerCommandError(cause);
      }
      return {
        outcome: "SUCCEEDED",
        ownerReceiptId: result.id,
        correlationId: request.commandId,
        resultSummary: {
          status: result.status,
          suspendedAt: result.suspendedAt,
          alreadySuspended: result.alreadySuspended,
        },
      };
    },
  };
}
