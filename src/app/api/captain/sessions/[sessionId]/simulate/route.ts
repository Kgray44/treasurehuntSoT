import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { getTaleSessionState, submitVerification } from "@/tall-tale/progression";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const session = await requireGmCapability("CAPTAIN");
  if (!session || process.env.NODE_ENV === "production")
    return NextResponse.json({ error: "The development simulator is unavailable." }, { status: 403 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json({ error: "The Captain session expired." }, { status: 403 });
  try {
    const { sessionId } = await context.params;
    const body = (await request.json()) as {
      result: "match" | "notMatch" | "uncertain";
      confidence?: number;
      scenario?: "valid" | "duplicate" | "stale" | "wrongBlock" | "wrongVersion" | "wrongSession";
      idempotencyKey?: string;
    };
    const state = await getTaleSessionState(sessionId, undefined, true);
    if (!state.pendingVerification || !state.block)
      throw new Error("The session has no pending verification to simulate.");
    const key = body.idempotencyKey ?? randomUUID();
    const submission = {
      schemaVersion: 1 as const,
      eventId: randomUUID(),
      idempotencyKey: key,
      eventType: "verification.result" as const,
      providerType: "visionLocation" as const,
      providerInstanceId: "development-simulator",
      sessionId: body.scenario === "wrongSession" ? randomUUID() : sessionId,
      publishedVersionId: body.scenario === "wrongVersion" ? randomUUID() : state.session.versionId,
      blockId: body.scenario === "wrongBlock" ? randomUUID() : state.block.id,
      verificationRequestId: state.pendingVerification.id,
      observedAt: body.scenario === "stale" ? new Date(0).toISOString() : new Date().toISOString(),
      result: body.result,
      confidence: body.confidence ?? 0.95,
      evidence: { simulated: true, scenario: body.scenario ?? "valid" },
    };
    const result = await submitVerification(submission, { sourceType: "simulator", sourceId: session.userId });
    if (body.scenario === "duplicate")
      return NextResponse.json({
        first: result,
        duplicate: await submitVerification(submission, { sourceType: "simulator", sourceId: session.userId }),
      });
    return NextResponse.json(result);
  } catch (cause) {
    return apiError(cause);
  }
}
