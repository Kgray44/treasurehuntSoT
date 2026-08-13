import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/chronicle/api";
import { requireOwnedStudioTale } from "@/chronicle/studio-authorization";
import { archiveReusableAuthoringItem, createReusableAuthoringItem, listReusableAuthoringItems } from "@/studio/reusable-library-service";

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), envelope: z.unknown() }),
  z.object({ action: z.literal("archive"), itemId: z.string().min(8).max(128) }),
]);

export async function GET(_: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId);
  if (!authorization) return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404 });
  try {
    return NextResponse.json({ items: await listReusableAuthoringItems(authorization.session.accountId) });
  } catch (cause) {
    return apiError(cause);
  }
}

export async function POST(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const { taleId } = await context.params;
  const authorization = await requireOwnedStudioTale(taleId, request);
  if (!authorization) return NextResponse.json({ error: "This Chronicle is not available to this Creator account." }, { status: 404 });
  try {
    const input = requestSchema.parse(await request.json());
    if (input.action === "create") return NextResponse.json(await createReusableAuthoringItem(authorization.session.accountId, input.envelope), { status: 201 });
    return NextResponse.json(await archiveReusableAuthoringItem(authorization.session.accountId, input.itemId));
  } catch (cause) {
    return apiError(cause);
  }
}
