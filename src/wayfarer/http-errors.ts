import { NextResponse } from "next/server";
import { ProfileError } from "@/wayfarer/profile";

export function profileApiError(cause: unknown) {
  const compatibleProfileError =
    cause instanceof ProfileError ||
    (typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      ["INVALID", "CONFLICT", "STALE", "NOT_FOUND", "FORBIDDEN"].includes(String(cause.code)) &&
      "message" in cause &&
      typeof cause.message === "string");
  if (compatibleProfileError) {
    const profileError = cause as ProfileError;
    const status =
      profileError.code === "NOT_FOUND"
        ? 404
        : profileError.code === "CONFLICT" || profileError.code === "STALE"
          ? 409
          : profileError.code === "FORBIDDEN"
            ? 403
            : 400;
    return NextResponse.json({ code: `WAYFARER_${profileError.code}`, error: profileError.message }, { status });
  }
  return NextResponse.json(
    { code: "WAYFARER_REQUEST_FAILED", error: "The profile request could not be completed." },
    { status: 400 },
  );
}
