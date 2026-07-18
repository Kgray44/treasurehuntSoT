import { NextResponse } from "next/server";
import { DraftConflictError } from "@/tall-tale/studio-service";
import { PublishValidationError } from "@/tall-tale/publishing";
import { VerificationRejectedError } from "@/tall-tale/progression";
import { logger } from "@/lib/logger";

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
  const message = cause instanceof Error ? cause.message : "The request could not be completed.";
  if (message.includes("Unique constraint"))
    return NextResponse.json({ error: "That name or address is already in use." }, { status: 409 });
  return NextResponse.json({ error: message }, { status: 400 });
}
