import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authorizeTaleSessionPlayer, verifyPlayerCsrf } from "@/platform/auth";
import { apiError } from "@/tall-tale/api";
import { acknowledgeVisionPresentation } from "@/vision/runtime-attempts";

const presentationSchema = z
  .object({
    status: z.enum(["STARTED", "COMPLETED", "FAILED", "RECOVERED"]),
    errorCode: z.string().max(120).optional(),
  })
  .strict();

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
    const input = presentationSchema.parse(await request.json());
    return NextResponse.json(await acknowledgeVisionPresentation(attemptId, input.status, input.errorCode));
  } catch (cause) {
    return apiError(cause);
  }
}
