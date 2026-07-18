import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { saveStudioDraft } from "@/tall-tale/studio-service";

export async function PATCH(request: Request, context: { params: Promise<{ taleId: string }> }) {
  const session = await requireGmCapability("CREATE_TALES");
  if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json({ error: "The creator session expired." }, { status: 403 });
  try {
    return NextResponse.json(
      await saveStudioDraft((await context.params).taleId, await request.json(), session.userId),
    );
  } catch (cause) {
    return apiError(cause);
  }
}
