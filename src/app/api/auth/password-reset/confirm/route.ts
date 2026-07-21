import { NextResponse } from "next/server";
import { z } from "zod";
import { AccountError, resetPassword } from "@/wayfarer/accounts";

const schema = z.object({ token: z.string().min(20).max(256), password: z.string().max(256) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Reset details are invalid." }, { status: 400 });
  try {
    await resetPassword(parsed.data.token, parsed.data.password);
    return NextResponse.json({ ok: true });
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof AccountError ? cause.message : "Password reset is unavailable." },
      { status: 400 },
    );
  }
}
