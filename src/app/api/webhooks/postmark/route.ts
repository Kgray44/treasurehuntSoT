import { NextResponse } from "next/server";
import { z } from "zod";
import { safeEqual } from "@/lib/security";
import { recordPostmarkWebhook } from "@/wayfarer/transactional-email";

const webhookSchema = z
  .object({
    RecordType: z.enum(["Delivery", "Bounce", "SpamComplaint"]),
    MessageID: z.string().uuid(),
    DeliveredAt: z.string().datetime().optional(),
    BouncedAt: z.string().datetime().optional(),
    TypeCode: z.number().int().optional(),
    Type: z.string().max(80).optional(),
    BounceType: z.string().max(80).optional(),
  })
  .passthrough();

function authorized(request: Request) {
  const expectedUser = process.env.POSTMARK_WEBHOOK_USERNAME?.trim() ?? "";
  const expectedPassword = process.env.POSTMARK_WEBHOOK_PASSWORD?.trim() ?? "";
  const header = request.headers.get("authorization") ?? "";
  if (!expectedUser || !expectedPassword || !header.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    return (
      safeEqual(decoded.slice(0, separator), expectedUser) && safeEqual(decoded.slice(separator + 1), expectedPassword)
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Webhook authentication failed." }, { status: 403 });
  const parsed = webhookSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Webhook payload is invalid." }, { status: 400 });
  const event = parsed.data;
  await recordPostmarkWebhook({
    recordType: event.RecordType,
    messageId: event.MessageID,
    payload: event,
    deliveredAt: event.DeliveredAt ? new Date(event.DeliveredAt) : undefined,
    bouncedAt: event.BouncedAt ? new Date(event.BouncedAt) : undefined,
    failureCode:
      event.RecordType === "Bounce" || event.RecordType === "SpamComplaint"
        ? `${event.TypeCode ?? "unknown"}-${event.Type ?? event.BounceType ?? event.RecordType}`.slice(0, 64)
        : undefined,
  });
  return NextResponse.json({ ok: true });
}
