import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeTaleSessionPlayer, verifyPlayerCsrf } from "@/platform/auth";
import { apiError } from "@/tall-tale/api";
import { applyRuntimeVerificationResult } from "@/vision/runtime-attempts";
import { runtimeResultSchema } from "@/vision/runtime-contract";

export async function POST(request: Request, context: { params: Promise<{ attemptId: string }> }) {
  try {
    const attemptId = (await context.params).attemptId;
    const attempt = await db.verificationAttempt.findUnique({
      where: { id: attemptId },
      select: { sessionId: true },
    });
    if (!attempt?.sessionId) return NextResponse.json({ error: "Verification attempt not found." }, { status: 404 });
    const access = await authorizeTaleSessionPlayer(attempt.sessionId);
    if (!access) return NextResponse.json({ error: "Voyage session required." }, { status: 401 });
    if (access.kind === "identity" && !(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
      return NextResponse.json({ error: "The Player session expired." }, { status: 403 });
    const result = runtimeResultSchema.parse({ ...(await request.json()), attemptId });
    return NextResponse.json(await applyRuntimeVerificationResult(result));
  } catch (cause) {
    return apiError(cause);
  }
}
