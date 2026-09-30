import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { getDraftLandfallDefinition, saveDraftLandfallDefinition } from "@/landfall/definition-store";

const noStore = { "Cache-Control": "private, no-store" };
const body = z.strictObject({
  expectedAutosaveVersion: z.number().int().positive(),
  definition: z.unknown().nullable(),
});

export async function GET(_: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId)))
    return NextResponse.json({ error: "Chronicle unavailable." }, { status: 404, headers: noStore });
  try {
    return NextResponse.json(await getDraftLandfallDefinition(taleId), { headers: noStore });
  } catch (cause) {
    const response = apiError(cause);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}

export async function PUT(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  if (!(await requireOwnedStudioTale(taleId, request)))
    return NextResponse.json({ error: "Chronicle unavailable." }, { status: 404, headers: noStore });
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 1100 * 1024) throw new Error("LANDFALL_DEFINITION_TOO_LARGE");
    const parsed = body.parse(JSON.parse(raw));
    return NextResponse.json(
      await saveDraftLandfallDefinition(taleId, parsed.definition, parsed.expectedAutosaveVersion),
      { headers: noStore },
    );
  } catch (cause) {
    const response = apiError(cause);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
}
