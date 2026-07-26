import {
  protectedMediaFailure,
  type ProtectedMediaDerivativeState,
  type ProtectedMediaWithdrawalReason,
} from "./contracts";

export function withdrawProtectedDerivative(input: {
  state: ProtectedMediaDerivativeState;
  reason: ProtectedMediaWithdrawalReason;
  now?: Date;
}) {
  if (["WITHDRAWN", "SUPERSEDED"].includes(input.state))
    return Object.freeze({ state: "WITHDRAWN" as const, revokedGrantState: "REVOKED" as const, idempotent: true });
  if (
    ![
      "REQUESTED",
      "QUEUED",
      "PROCESSING",
      "VERIFYING",
      "BLOCKED_SOURCE_SCAN",
      "BLOCKED_DERIVATIVE_SCAN",
      "BLOCKED_CONSENT",
      "READY",
      "FAILED",
    ].includes(input.state)
  )
    throw protectedMediaFailure("PROTECTED_MEDIA_WITHDRAWAL_INVALID");
  return Object.freeze({
    state: "WITHDRAWN" as const,
    revokedGrantState: "REVOKED" as const,
    withdrawnAt: input.now ?? new Date(),
    reason: input.reason,
    idempotent: false,
  });
}
