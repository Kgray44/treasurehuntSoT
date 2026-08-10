import { NextResponse } from "next/server";
import type { z } from "zod";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { AdmiraltyError, asAdmiraltyError } from "./errors";

export function admiraltyErrorResponse(cause: unknown) {
  const error = asAdmiraltyError(cause);
  return NextResponse.json(
    { code: error.code, error: error.message },
    {
      status: error.status,
      headers: error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : undefined,
    },
  );
}

export function enforceAdmiraltyRateLimit(key: string, limit: number, windowMs: number) {
  const result = consumeRateLimit(`admiralty:${key}`, { limit, windowMs });
  if (!result.allowed)
    throw new AdmiraltyError(
      "ADMIN_RATE_LIMITED",
      "Too many requests. Try again shortly.",
      429,
      result.retryAfterSeconds,
    );
  return rateLimitHeaders(result);
}

export async function parseAdmiraltyBody<T>(request: Request, schema: z.ZodType<T>) {
  try {
    return schema.parse(await request.json());
  } catch {
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "The request was not valid.", 400);
  }
}
