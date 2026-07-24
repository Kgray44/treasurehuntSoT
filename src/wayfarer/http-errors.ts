import { NextResponse } from "next/server";
import { ProfileError } from "@/wayfarer/profile";

export function profileApiError(cause: unknown) {
  if (cause instanceof ProfileError) {
    const status =
      cause.code === "NOT_FOUND" ? 404 : cause.code === "CONFLICT" ? 409 : cause.code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ code: `WAYFARER_${cause.code}`, error: cause.message }, { status });
  }
  return NextResponse.json(
    { code: "WAYFARER_REQUEST_FAILED", error: "The profile request could not be completed." },
    { status: 400 },
  );
}
