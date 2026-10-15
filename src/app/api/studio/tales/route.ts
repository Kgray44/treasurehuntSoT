import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
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
    const input = await request.json();
    if (input.creationMode && input.creationMode !== "MANUAL")
      return NextResponse.json({ error: "This creation option is coming soon." }, { status: 400 });
    const creation =
      input.creationMode === "MANUAL" ? { title: "Untitled Chronicle", slug: `chronicle-${randomUUID()}` } : input;
    return NextResponse.json(await createStudioTale({ ...creation, creatorId: session.accountId }), {
      status: 201,
    });
  } catch (cause) {
    return apiError(cause);
  }
}
