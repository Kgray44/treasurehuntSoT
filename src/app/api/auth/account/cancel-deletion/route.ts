import { NextResponse } from "next/server";
import { z } from "zod";
import { accountApiError } from "@/wayfarer/account-api-error";
import { cancelScheduledDeletion } from "@/wayfarer/account-lifecycle";
import { setWayfarerCookie } from "@/wayfarer/http";

const schema = z
  .object({
    email: z.string().trim().max(254),
    password: z.string().min(1).max(256),
    confirmation: z.literal("CANCEL DELETION"),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const result = await cancelScheduledDeletion(input.email, input.password, input.confirmation);
    await setWayfarerCookie(result.session.token);
    return NextResponse.json({ ok: true, next: "/account" });
  } catch (cause) {
    return accountApiError(cause);
  }
}
