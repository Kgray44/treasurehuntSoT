import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { hashToken } from "@/lib/security";
import { requestPasswordReset } from "@/wayfarer/accounts";

const schema = z.object({ email: z.string().max(254) });
const generic = { ok: true, message: "If that email can reset an account, we sent a recovery link." };
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(generic);
  const rate = consumeRateLimit(
    `wayfarer-reset:${hashToken(`${request.headers.get("x-forwarded-for") ?? "local"}:${parsed.data.email.toLowerCase()}`)}`,
    { limit: 3, windowMs: 15 * 60_000 },
  );
  if (!rate.allowed) return NextResponse.json(generic, { headers: rateLimitHeaders(rate) });
  await requestPasswordReset(parsed.data.email);
  return NextResponse.json(generic);
}
