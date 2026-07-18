import { NextResponse } from "next/server";
import { DraftConflictError } from "@/tall-tale/studio-service";
import { PublishValidationError } from "@/tall-tale/publishing";
import { VerificationRejectedError } from "@/tall-tale/progression";
import { logger } from "@/lib/logger";
import { InvitationUnavailableError } from "@/platform/invitations";
import { VisionDomainError } from "@/vision/domain";

export function apiError(cause: unknown) {
  logger.warn(
    {
      area: "tall-tale-api",
      errorType: cause instanceof Error ? cause.constructor.name : typeof cause,
      errorCode:
        cause instanceof DraftConflictError
          ? "DRAFT_CONFLICT"
          : cause instanceof PublishValidationError
            ? "VALIDATION_FAILED"
            : cause instanceof VerificationRejectedError
              ? cause.reason
              : cause instanceof InvitationUnavailableError
                ? cause.code
                : cause instanceof VisionDomainError
                  ? cause.code
                  : "REQUEST_FAILED",
    },
    "Tall Tale request rejected",
  );
  if (cause instanceof DraftConflictError)
    return NextResponse.json(
      { error: cause.message, code: "DRAFT_CONFLICT", currentVersion: cause.currentVersion },
      { status: 409 },
    );
  if (cause instanceof PublishValidationError)
    return NextResponse.json(
      { error: cause.message, code: "VALIDATION_FAILED", validation: cause.validation },
      { status: 422 },
    );
  if (cause instanceof VerificationRejectedError)
    return NextResponse.json({ error: cause.message, code: cause.reason }, { status: 409 });
  if (cause instanceof InvitationUnavailableError) {
    const status =
      cause.code === "ACCOUNT_REQUIRED" ? 401 : cause.code === "CONFLICT" ? 409 : cause.code === "INVALID" ? 400 : 410;
    return NextResponse.json({ error: cause.message, code: cause.code }, { status });
  }
  if (cause instanceof VisionDomainError) {
    const status = cause.code.includes("NOT_FOUND")
      ? 404
      : cause.code.includes("PERMISSION")
        ? 403
        : cause.code.includes("REQUIRED") || cause.code.includes("INVALID")
          ? 422
          : 409;
    return NextResponse.json({ error: cause.message, code: cause.code }, { status });
  }
  if (cause instanceof Error && cause.name === "VisionFeatureDisabledError")
    return NextResponse.json({ error: cause.message, code: "FEATURE_DISABLED" }, { status: 404 });
  const message = cause instanceof Error ? cause.message : "The request could not be completed.";
  if (message.includes("Unique constraint"))
    return NextResponse.json({ error: "That name or address is already in use." }, { status: 409 });
  return NextResponse.json({ error: message }, { status: 400 });
}
