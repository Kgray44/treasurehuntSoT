import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { apiError } from "@/tall-tale/api";
import { getHelperScope } from "@/tall-tale/progression";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "A helper pairing token is required." }, { status: 401 });
  try {
    const tokenKey = createHash("sha256").update(token).digest("hex").slice(0, 24);
    const rate = consumeRateLimit(`tale-helper-status:${tokenKey}`, { limit: 120, windowMs: 60_000 });
    if (!rate.allowed)
      return NextResponse.json(
        { error: "The helper status limit was reached. Wait before retrying." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    return NextResponse.json(await getHelperScope(token), { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    return apiError(cause);
  }
}
