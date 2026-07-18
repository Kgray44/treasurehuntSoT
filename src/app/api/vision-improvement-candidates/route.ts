import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireGmCapability, verifyCsrf } from "@/lib/security";

const dispositionSchema = z
  .object({
    candidateId: z.string().min(8).max(200),
    action: z.enum(["ACCEPT_FOR_CORPUS", "REJECT", "DEFER"]),
    reason: z.string().trim().min(3).max(1_000),
  })
  .strict();

function parseDiagnostics(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { error: "DIAGNOSTIC_METADATA_INVALID" };
  }
}

export async function GET() {
  const session = await requireGmCapability("CREATE_TALES");
  if (!session)
    return NextResponse.json(
      { error: { code: "IMPROVEMENT_QUEUE_AUTH_REQUIRED", message: "Creator authentication is required." } },
      { status: 401 },
    );
  const candidates = await db.visionImprovementCandidate.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  return NextResponse.json({
    csrfToken: session.csrfToken,
    candidates: candidates.map((candidate) => ({
      ...candidate,
      derivedDiagnostics: parseDiagnostics(candidate.derivedDiagnostics),
      createdAt: candidate.createdAt.toISOString(),
      reviewedAt: candidate.reviewedAt?.toISOString() ?? null,
    })),
  });
}

export async function PATCH(request: Request) {
  const session = await requireGmCapability("CREATE_TALES");
  if (!session)
    return NextResponse.json(
      { error: { code: "IMPROVEMENT_QUEUE_AUTH_REQUIRED", message: "Creator authentication is required." } },
      { status: 401 },
    );
  if (!(await verifyCsrf(session)))
    return NextResponse.json(
      { error: { code: "CSRF_REJECTED", message: "Refresh Studio and try again." } },
      { status: 403 },
    );
  const parsed = dispositionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: { code: "IMPROVEMENT_DISPOSITION_INVALID", message: "The disposition request is invalid." } },
      { status: 400 },
    );
  const input = parsed.data;
  const candidate = await db.visionImprovementCandidate.findUnique({ where: { id: input.candidateId } });
  if (!candidate)
    return NextResponse.json(
      { error: { code: "IMPROVEMENT_CANDIDATE_NOT_FOUND", message: "The candidate no longer exists." } },
      { status: 404 },
    );
  const status =
    input.action === "ACCEPT_FOR_CORPUS" ? "ACCEPTED_FOR_REVIEW" : input.action === "REJECT" ? "REJECTED" : "DEFERRED";
  const updated = await db.$transaction(async (tx) => {
    const next = await tx.visionImprovementCandidate.update({
      where: { id: input.candidateId },
      data: { status, dispositionReason: input.reason, reviewedAt: new Date() },
    });
    await tx.platformAuditEvent.create({
      data: {
        actorType: "CREATOR",
        actorId: session.userId,
        action: `VISION_B6_IMPROVEMENT_${input.action}`,
        resourceType: "VISION_IMPROVEMENT_CANDIDATE",
        resourceId: candidate.id,
        correlationId: `vision-improvement:${candidate.id}:${status}`,
        metadata: JSON.stringify({
          sourceAttemptId: candidate.sourceAttemptId,
          waypointVersionId: candidate.waypointVersionId,
          truthLabel: candidate.humanTruthLabel,
          proposedPartition: candidate.proposedPartition,
          rawFramesRetained: false,
          reason: input.reason,
        }),
      },
    });
    return next;
  });
  return NextResponse.json({ candidate: { ...updated, reviewedAt: updated.reviewedAt?.toISOString() ?? null } });
}
