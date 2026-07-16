import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createGmSession, hashToken } from "@/lib/security";

const schema = z.object({ username: z.string().min(2).max(80), password: z.string().min(8).max(256) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the captain's credentials." }, { status: 400 });
  const fingerprint = hashToken(`${request.headers.get("x-forwarded-for") ?? "local"}:${parsed.data.username.toLowerCase()}`);
  const since = new Date(Date.now() - 15 * 60 * 1000);
  if (await db.loginAttempt.count({ where: { fingerprint, succeeded: false, createdAt: { gt: since } } }) >= 5) return NextResponse.json({ error: "Too many attempts. Wait fifteen minutes before trying again." }, { status: 429 });
  const user = await db.gameMasterUser.findUnique({ where: { username: parsed.data.username } });
  const valid = Boolean(user && await bcrypt.compare(parsed.data.password, user.passwordHash));
  await db.loginAttempt.create({ data: { fingerprint, succeeded: valid } });
  if (!valid || !user) return NextResponse.json({ error: "The quartermaster does not recognize those credentials." }, { status: 401 });
  const csrfToken = await createGmSession(user.id);
  return NextResponse.json({ ok: true, csrfToken });
}
