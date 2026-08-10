export type AdmiraltyErrorCode =
  | "ADMIRALTY_AUTH_REQUIRED"
  | "ADMIRALTY_CSRF_INVALID"
  | "ADMIRALTY_CAPABILITY_DENIED"
  | "ADMIRALTY_ASSURANCE_REQUIRED"
  | "ADMIRALTY_ASSURANCE_EXPIRED"
  | "ADMIRALTY_REAUTH_FAILED"
  | "SUPPORT_GRANT_REQUIRED"
  | "SUPPORT_GRANT_SCOPE_DENIED"
  | "SUPPORT_GRANT_EXPIRED"
  | "SUPPORT_GRANT_REVOKED"
  | "ADMIN_TARGET_NOT_FOUND"
  | "ADMIN_CONFLICT"
  | "ADMIN_AUDIT_UNAVAILABLE"
  | "ADMIN_OPERATION_UNAVAILABLE"
  | "ADMIN_VALIDATION_FAILED"
  | "ADMIN_RATE_LIMITED";

export class AdmiraltyError extends Error {
  constructor(
    readonly code: AdmiraltyErrorCode,
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AdmiraltyError";
  }
}

export function asAdmiraltyError(cause: unknown) {
  if (cause instanceof AdmiraltyError) return cause;
  return new AdmiraltyError("ADMIN_OPERATION_UNAVAILABLE", "The administrative operation is unavailable.", 503);
}
