import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeTaleSessionPlayer } from "@/platform/auth";
import { apiError } from "@/tall-tale/api";
import { getRuntimePackageForAttempt } from "@/vision/runtime-attempts";

export async function GET(request: Request, context: { params: Promise<{ packageId: string }> }) {
  try {
    const packageId = (await context.params).packageId;
    const attemptId = new URL(request.url).searchParams.get("attemptId");
    if (!attemptId) return NextResponse.json({ error: "attemptId is required." }, { status: 400 });
    const attempt = await db.verificationAttempt.findFirst({
      where: { id: attemptId, packageId },
      select: { sessionId: true },
    });
    if (!attempt?.sessionId) return NextResponse.json({ error: "Runtime package not found." }, { status: 404 });
    if (!(await authorizeTaleSessionPlayer(attempt.sessionId)))
      return NextResponse.json({ error: "Voyage session required." }, { status: 401 });
    return NextResponse.json(await getRuntimePackageForAttempt(attemptId), {
      headers: {
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (cause) {
    return apiError(cause);
  }
}
