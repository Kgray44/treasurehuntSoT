import { NextResponse } from "next/server";
import { CommunityError } from "./domain";

export function communityApiError(cause: unknown) {
  if (cause instanceof CommunityError) {
    const status =
      cause.code === "COMMUNITY_RATE_LIMITED"
        ? 429
        : cause.code.includes("NOT_FOUND")
          ? 404
          : cause.code.includes("ACCESS_DENIED")
            ? 403
            : cause.code.includes("CONFLICT") || cause.code.includes("TAKEN") || cause.code.includes("EXISTS")
              ? 409
              : 400;
    return NextResponse.json(
      { code: cause.code, error: cause.message },
      { status, headers: cause.code === "COMMUNITY_RATE_LIMITED" ? { "Retry-After": "60" } : undefined },
    );
  }
  // Do not serialize Prisma, storage, or database exception details to a
  // browser. Those details are deliberately left for the server logger.
  return NextResponse.json(
    { code: "COMMUNITY_TRANSACTION_FAILED", error: "The Community Harbor request could not be completed." },
    { status: 400 },
  );
}
