import { NextResponse } from "next/server";
import { z } from "zod";
import { AccountError, verifyAccountEmail } from "@/wayfarer/accounts";
const schema = z.object({ token: z.string().min(20).max(256) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Verification details are invalid." }, { status: 400 });
  try {
    await verifyAccountEmail(parsed.data.token);
    return NextResponse.json({ ok: true });
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof AccountError ? cause.message : "Verification is unavailable." },
      { status: 400 },
    );
  }
}
