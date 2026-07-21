import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/chronicle/api";
import { submitHelperVerification } from "@/chronicle/progression";
import type { VerificationSubmission } from "@/chronicle/types";
import { createHash } from "node:crypto";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

const verificationSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string().min(8).max(160),
  idempotencyKey: z.string().min(8).max(200),
  eventType: z.enum(["verification.observation", "verification.result"]),
  providerType: z.enum([
    "captainManual",
    "playerConfirmation",
    "textAnswer",
    "timer",
    "visionLocation",
    "visionObject",
    "externalWebhook",
  ]),
  providerInstanceId: z.string().max(160).optional(),
  sessionId: z.string().min(8).max(128),
  publishedVersionId: z.string().min(8).max(128),
  blockId: z.string().min(8).max(128),
  verificationRequestId: z.string().min(8).max(128),
  observedAt: z.iso.datetime(),
  result: z.enum(["match", "notMatch", "uncertain"]),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "A helper pairing token is required." }, { status: 401 });
  try {
    const tokenKey = createHash("sha256").update(token).digest("hex").slice(0, 24);
    const rate = consumeRateLimit(`tale-helper:${tokenKey}`, { limit: 120, windowMs: 60_000 });
    if (!rate.allowed)
      return NextResponse.json(
        { error: "The helper event limit was reached. Wait before retrying." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    const submission = verificationSchema.parse(await request.json()) as VerificationSubmission;
    return NextResponse.json(await submitHelperVerification(token, submission), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    return apiError(cause);
  }
}
