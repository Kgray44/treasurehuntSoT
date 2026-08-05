import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccountError } from "@/wayfarer/accounts";
import { AccountLifecycleError } from "@/wayfarer/account-lifecycle";

export function accountApiError(cause: unknown) {
  if (cause instanceof ZodError || cause instanceof SyntaxError)
    return NextResponse.json({ code: "WAYFARER_INVALID", error: "The account request is invalid." }, { status: 400 });
  if (cause instanceof AccountLifecycleError) {
    const status =
      cause.code === "NOT_FOUND"
        ? 404
        : cause.code === "CONFLICT"
          ? 409
          : cause.code === "FORBIDDEN"
            ? 403
            : cause.code === "EXPIRED"
              ? 410
              : 400;
    return NextResponse.json({ code: `WAYFARER_${cause.code}`, error: cause.message }, { status });
  }
  if (cause instanceof AccountError) {
    const status = cause.code === "CONFLICT" ? 409 : cause.code === "UNAVAILABLE" ? 503 : 400;
    return NextResponse.json({ code: `WAYFARER_${cause.code}`, error: cause.message }, { status });
  }
  return NextResponse.json(
    { code: "WAYFARER_REQUEST_FAILED", error: "The account request could not be completed." },
    { status: 500 },
  );
}
