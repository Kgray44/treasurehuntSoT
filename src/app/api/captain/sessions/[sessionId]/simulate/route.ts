import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireCaptainSession } from "@/chronicle/captain-authorization";
import { apiError } from "@/chronicle/api";
import { getTaleSessionState, submitVerification } from "@/chronicle/progression";
import { verifyWayfarerCsrf } from "@/wayfarer/http";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const authorization = await requireCaptainSession(sessionId);
  if (!authorization || process.env.NODE_ENV === "production")
    return NextResponse.json({ error: "The development verification simulator is unavailable." }, { status: 403 });
  if (!verifyWayfarerCsrf(authorization.session, request))
    return NextResponse.json(
      { error: "Your Captain session expired. Sign in again; no Voyage progress has changed." },
      { status: 403 },
    );
  try {
    const body = (await request.json()) as {
      result: "match" | "notMatch" | "uncertain";
      confidence?: number;
      scenario?: "valid" | "duplicate" | "stale" | "wrongBlock" | "wrongVersion" | "wrongSession";
      idempotencyKey?: string;
    };
    const state = await getTaleSessionState(sessionId, undefined, true);
    if (!state.pendingVerification || !state.block)
      throw new Error("This Voyage has no pending verification to simulate. No progress has changed.");
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
    const result = await submitVerification(submission, {
      sourceType: "simulator",
      sourceId: authorization.session.accountId,
    });
    if (body.scenario === "duplicate")
      return NextResponse.json({
        first: result,
        duplicate: await submitVerification(submission, {
          sourceType: "simulator",
          sourceId: authorization.session.accountId,
        }),
      });
    return NextResponse.json(result);
  } catch (cause) {
    return apiError(cause);
  }
}
