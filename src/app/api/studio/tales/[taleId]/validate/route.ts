import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { validateTaleDraft } from "@/tall-tale/validation";

export async function POST(_: Request, context: { params: Promise<{ taleId: string }> }) {
  const session = await requireGmCapability("CREATE_TALES");
  if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json({ error: "The creator session expired." }, { status: 403 });
  try {
    return NextResponse.json(await validateTaleDraft((await context.params).taleId));
  } catch (cause) {
    return apiError(cause);
  }
}
