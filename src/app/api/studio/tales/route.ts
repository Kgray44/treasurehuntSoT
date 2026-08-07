import { NextResponse } from "next/server";
import { apiError } from "@/chronicle/api";
import { requireStudioWorkspace } from "@/chronicle/studio-authorization";
import { createStudioTale, listStudioTales } from "@/chronicle/studio-service";

export async function GET() {
  const session = await requireStudioWorkspace();
  if (!session) return NextResponse.json({ error: "Sign in with a creator account to continue." }, { status: 401 });
  return NextResponse.json({ csrfToken: session.csrfToken, tales: await listStudioTales(session.accountId) });
}

export async function POST(request: Request) {
  const session = await requireStudioWorkspace(request);
  if (!session) return NextResponse.json({ error: "Sign in with a creator account to continue." }, { status: 401 });
  try {
    return NextResponse.json(await createStudioTale({ ...(await request.json()), creatorId: session.accountId }), {
      status: 201,
    });
  } catch (cause) {
    return apiError(cause);
  }
}
