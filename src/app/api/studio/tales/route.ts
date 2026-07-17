import { NextResponse } from "next/server";
import { requireGmCapability, verifyCsrf } from "@/lib/security";
import { apiError } from "@/tall-tale/api";
import { createStudioTale, listStudioTales } from "@/tall-tale/studio-service";

export async function GET() {
  const session = await requireGmCapability("CREATE_TALES");
  if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
  return NextResponse.json({ csrfToken: session.csrfToken, tales: await listStudioTales() });
}

export async function POST(request: Request) {
  const session = await requireGmCapability("CREATE_TALES");
  if (!session) return NextResponse.json({ error: "Creator authentication required." }, { status: 401 });
  if (!(await verifyCsrf(session)))
    return NextResponse.json({ error: "The creator session expired. Reload and try again." }, { status: 403 });
  try {
    return NextResponse.json(await createStudioTale({ ...(await request.json()), creatorId: session.userId }), {
      status: 201,
    });
  } catch (cause) {
    return apiError(cause);
  }
}
