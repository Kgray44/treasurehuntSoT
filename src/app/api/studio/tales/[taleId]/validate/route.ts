import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/chronicle/api";
import { validateTaleDraft } from "@/chronicle/validation";

export async function POST(_: Request, context: { params: Promise<{ taleId: string }> }) {
  const session = await requireGmCapability("CREATE_TALES");
  if (!session) return NextResponse.json({ error: "Sign in with a creator account to continue." }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json(
      { error: "Your creator session has expired. Reload the page and try again." },
      { status: 403 },
    );
  try {
    return NextResponse.json(await validateTaleDraft((await context.params).taleId));
  } catch (cause) {
    return apiError(cause);
  }
}
