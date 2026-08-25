import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import {
  listCurrentDrydockExternalEvidence,
  recordCurrentDrydockExternalEvidence,
} from "@/drydock/external-evidence-store";

const privateHeaders = { "Cache-Control": "private, no-store" };
const body = z
  .object({
    providerId: z.string().min(1).max(128),
    providerVersion: z.string().min(1).max(128),
    evidenceKind: z.string().min(1).max(128),
    status: z.enum(["PRESENT", "MISSING", "UNAVAILABLE", "EXTERNAL_VALIDATION_REQUIRED"]),
    safeSummary: z.string().min(1).max(500),
    sourceReference: z.string().min(1).max(500).optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .strict();

export async function GET(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request)))
    return NextResponse.json(
      { error: "This Chronicle is not available to this Creator account." },
      { status: 404, headers: privateHeaders },
    );
  try {
    return NextResponse.json(await listCurrentDrydockExternalEvidence(taleId), { headers: privateHeaders });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization)
    return NextResponse.json(
      { error: "This Chronicle is not available to this Creator account." },
      { status: 404, headers: privateHeaders },
    );
  if (!authorization.session.account.roles.some((assignment) => assignment.role === "ADMINISTRATOR"))
    return NextResponse.json(
      { error: "External evidence references require Administrator authorization." },
      { status: 403, headers: privateHeaders },
    );
  try {
    const input = body.parse(await request.json());
    return NextResponse.json(
      await recordCurrentDrydockExternalEvidence({
        taleId,
        ...input,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      }),
      { status: 201, headers: privateHeaders },
    );
  } catch (cause) {
    return apiError(cause);
  }
}
