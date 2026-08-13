import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { drydockReadinessRequirements, getDrydockReadiness } from "@/drydock/readiness-store";

const privateHeaders = { "Cache-Control": "private, no-store" };

/** Owner-safe Launch Gate DTO; it never serializes draft prose or raw provider evidence. */
export async function GET(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization)
    return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404 });
  try {
    return NextResponse.json(
      { readiness: await getDrydockReadiness(taleId), requirements: drydockReadinessRequirements() },
      { headers: privateHeaders },
    );
  } catch (cause) {
    return apiError(cause);
  }
}
