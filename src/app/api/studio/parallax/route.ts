import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioWorkspace, requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { getStudioTale } from "@/chronicle/studio-service";
import { apiError } from "@/chronicle/api";
import { consumeRateLimit } from "@/lib/rate-limit";
import { draftSchema } from "@/parallax/authoring";
import { spatialId, spatialMomentSchema } from "@/parallax/contracts";
import {
  listSpatialItems,
  saveSpatialDraft,
  releaseSpatialVersion,
  attachSpatialVersion,
  restoreSpatialAttachment,
  assertSpatialDraftAccess,
} from "@/parallax/library-service";
import {
  validateSpatialAuthoring,
  simulateSpatialEnvironments,
  spatialPerformanceEstimate,
} from "@/parallax/studio-validation";
import { requestSpatialAI } from "@/parallax/ai-authoring";
import { creatorFieldQuality, reviewCalibration } from "@/parallax/field-service";
import { calibrationReviewInputSchema } from "@/parallax/field-contracts";

const inputSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("FIELD_QUALITY"), definitionId: spatialId, draft: draftSchema.optional() }),
  z.strictObject({ action: z.literal("CALIBRATION_REVIEW"), review: calibrationReviewInputSchema, draft: draftSchema }),
  z.strictObject({ action: z.literal("SAVE"), draft: draftSchema, revision: z.number().int().min(0) }),
  z.strictObject({ action: z.literal("RELEASE"), definitionId: spatialId, revision: z.number().int().min(1) }),
  z.strictObject({ action: z.literal("VALIDATE"), draft: draftSchema }),
  z.strictObject({
    action: z.literal("AI"),
    draft: draftSchema,
    kind: z.enum(["INTENT", "CRITIQUE"]),
    request: z.string().trim().min(1).max(2000),
  }),
  z.strictObject({
    action: z.literal("ATTACH"),
    definitionId: spatialId,
    versionId: spatialId,
    chronicleId: spatialId,
    blockId: spatialId,
    autosaveVersion: z.number().int().min(1),
    narrative: z.string().trim().max(4000).optional(),
  }),
  z.strictObject({
    action: z.literal("RESTORE_ATTACHMENT"),
    chronicleId: spatialId,
    blockId: spatialId,
    autosaveVersion: z.number().int().min(1),
    moment: spatialMomentSchema.nullable(),
  }),
]);
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(request: Request) {
  const session = await requireStudioWorkspace();
  if (!session) return NextResponse.json({ error: "Creator access required." }, { status: 401, headers });
  try {
    const chronicleId = new URL(request.url).searchParams.get("chronicle");
    let chronicle = null;
    if (chronicleId) {
      if (!(await requireOwnedStudioTale(chronicleId)))
        return NextResponse.json({ error: "Chronicle unavailable." }, { status: 404, headers });
      const source = await getStudioTale(chronicleId);
      chronicle = {
        id: chronicleId,
        title: source.tale.title,
        autosaveVersion: source.draft.autosaveVersion,
        blocks: source.draft.chapters.flatMap((c) =>
          c.blocks.map((b) => ({ id: b.id, title: b.title, spatialMoment: b.presentation.spatialMoment ?? null })),
        ),
      };
    }
    return NextResponse.json(
      {
        csrfToken: session.csrfToken,
        layoutScope: session.accountId,
        items: await listSpatialItems(session.accountId),
        chronicle,
        aiAvailable: Boolean(process.env.PARALLAX_AUTHORING_AI_URL && process.env.PARALLAX_AUTHORING_AI_TOKEN),
      },
      { headers },
    );
  } catch (cause) {
    return apiError(cause);
  }
}
export async function POST(request: Request) {
  const session = await requireStudioWorkspace(request);
  if (!session)
    return NextResponse.json({ error: "Creator access and CSRF verification required." }, { status: 401, headers });
  const rate = consumeRateLimit(`parallax.studio:${session.accountId}`, { limit: 60, windowMs: 60000 });
  if (!rate.allowed) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429, headers });
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 256 * 1024)
      return NextResponse.json({ error: "Spatial request exceeds 256 KiB." }, { status: 413, headers });
    const input = inputSchema.parse(JSON.parse(body));
    if ("draft" in input && input.draft) await assertSpatialDraftAccess(input.draft);
    switch (input.action) {
      case "FIELD_QUALITY":
        return NextResponse.json(await creatorFieldQuality(session.accountId, input.definitionId, input.draft), {
          headers,
        });
      case "CALIBRATION_REVIEW":
        return NextResponse.json(await reviewCalibration(session.accountId, input.review, input.draft), { headers });
      case "SAVE":
        return NextResponse.json(
          { revision: await saveSpatialDraft(session.accountId, input.draft, input.revision) },
          { headers },
        );
      case "RELEASE":
        return NextResponse.json(await releaseSpatialVersion(session.accountId, input.definitionId, input.revision), {
          headers,
        });
      case "VALIDATE":
        return NextResponse.json(
          {
            findings: validateSpatialAuthoring(input.draft.content),
            simulations: simulateSpatialEnvironments(input.draft.content),
            performance: spatialPerformanceEstimate(input.draft.content),
            authority: "DRYDOCK_STATIC_CONTRACT",
            physicalQualification: "NOT_ESTABLISHED",
          },
          { headers },
        );
      case "AI":
        return NextResponse.json(await requestSpatialAI(input.kind, input.request, input.draft), { headers });
      case "ATTACH":
        return NextResponse.json(await attachSpatialVersion({ ...input, ownerAccountId: session.accountId }), {
          headers,
        });
      case "RESTORE_ATTACHMENT":
        return NextResponse.json(await restoreSpatialAttachment({ ...input, ownerAccountId: session.accountId }), {
          headers,
        });
    }
  } catch (cause) {
    return apiError(cause);
  }
}
